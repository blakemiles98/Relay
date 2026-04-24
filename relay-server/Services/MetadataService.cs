using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;

namespace RelayServer.Services;

public class MetadataService(RelayDbContext db, IHttpClientFactory http, ILogger<MetadataService> logger)
{
    private const string TmdbBase = "https://api.themoviedb.org/3";

    public async Task RefreshLibraryMetadataAsync(Library library, CancellationToken ct = default)
    {
        var settings = await db.AppSettings.FirstAsync(ct);
        if (string.IsNullOrEmpty(settings.TmdbApiKey))
        {
            logger.LogWarning("TMDB API key not configured — skipping metadata refresh");
            return;
        }

        if (library.Type == LibraryType.HomeMedia) return;

        var client = http.CreateClient();

        if (library.Type is LibraryType.Movies or LibraryType.Mixed)
            await RefreshMoviesAsync(library.Id, settings.TmdbApiKey, client, ct);

        if (library.Type is LibraryType.TvShows or LibraryType.Mixed)
            await RefreshSeriesAsync(library.Id, settings.TmdbApiKey, client, ct);

        library.LastMetadataRefreshAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task RefreshMoviesAsync(int libraryId, string apiKey, HttpClient client, CancellationToken ct)
    {
        var movies = await db.MediaItems
            .Where(m => m.LibraryId == libraryId && m.Type == MediaType.Movie && m.TmdbId == null)
            .ToListAsync(ct);

        foreach (var movie in movies)
        {
            try
            {
                var search = await SearchTmdbAsync(client, apiKey, "movie", movie.Title, ct);
                if (search is null) continue;

                var detail = await GetTmdbDetailAsync(client, apiKey, "movie", search.TmdbId, ct);
                if (detail is null) continue;

                movie.TmdbId = search.TmdbId;
                movie.Overview = detail.Overview;
                movie.PosterPath = detail.PosterPath;
                movie.BackdropPath = detail.BackdropPath;
                movie.Genres = detail.Genres;
                movie.Cast = detail.Cast;
                movie.Year = detail.Year;
                movie.ImdbId = detail.ImdbId;
                movie.ImdbScore = detail.ImdbScore;
                movie.RottenTomatoesScore = detail.RottenTomatoesScore;
                movie.MetadataRefreshedAt = DateTime.UtcNow;

                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Metadata fetch failed for movie: {Title}", movie.Title);
            }
        }
    }

    private async Task RefreshSeriesAsync(int libraryId, string apiKey, HttpClient client, CancellationToken ct)
    {
        var seriesList = await db.Series
            .Where(s => s.LibraryId == libraryId && s.TmdbId == null)
            .ToListAsync(ct);

        foreach (var series in seriesList)
        {
            try
            {
                var search = await SearchTmdbAsync(client, apiKey, "tv", series.Title, ct);
                if (search is null) continue;

                var detail = await GetTmdbDetailAsync(client, apiKey, "tv", search.TmdbId, ct);
                if (detail is null) continue;

                series.TmdbId = search.TmdbId;
                series.Overview = detail.Overview;
                series.PosterPath = detail.PosterPath;
                series.BackdropPath = detail.BackdropPath;
                series.Genres = detail.Genres;
                series.Year = detail.Year;
                series.ImdbScore = detail.ImdbScore;
                series.RottenTomatoesScore = detail.RottenTomatoesScore;
                series.MetadataRefreshedAt = DateTime.UtcNow;

                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Metadata fetch failed for series: {Title}", series.Title);
            }
        }
    }

    private async Task<TmdbSearchResult?> SearchTmdbAsync(
        HttpClient client, string apiKey, string type, string title, CancellationToken ct)
    {
        var encoded = Uri.EscapeDataString(title);
        var url = $"{TmdbBase}/search/{type}?api_key={apiKey}&query={encoded}";
        using var resp = await client.GetAsync(url, ct);
        if (!resp.IsSuccessStatusCode) return null;

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var results = doc.RootElement.GetProperty("results");
        if (results.GetArrayLength() == 0) return null;

        var first = results[0];
        return new TmdbSearchResult(first.GetProperty("id").GetInt32());
    }

    private async Task<TmdbDetail?> GetTmdbDetailAsync(
        HttpClient client, string apiKey, string type, int tmdbId, CancellationToken ct)
    {
        var url = $"{TmdbBase}/{type}/{tmdbId}?api_key={apiKey}&append_to_response=credits,external_ids,release_dates";
        using var resp = await client.GetAsync(url, ct);
        if (!resp.IsSuccessStatusCode) return null;

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;

        var overview = root.TryGetProperty("overview", out var ov) ? ov.GetString() : null;
        var poster = root.TryGetProperty("poster_path", out var pp) ? $"https://image.tmdb.org/t/p/w500{pp.GetString()}" : null;
        var backdrop = root.TryGetProperty("backdrop_path", out var bp) ? $"https://image.tmdb.org/t/p/w1280{bp.GetString()}" : null;

        var year = 0;
        if (root.TryGetProperty("release_date", out var rd) && rd.GetString() is { Length: >= 4 } rds)
            int.TryParse(rds[..4], out year);
        else if (root.TryGetProperty("first_air_date", out var fd) && fd.GetString() is { Length: >= 4 } fds)
            int.TryParse(fds[..4], out year);

        string[] genres = [];
        if (root.TryGetProperty("genres", out var genreArr))
            genres = [.. genreArr.EnumerateArray().Select(g => g.GetProperty("name").GetString()!)];

        string[] cast = [];
        if (root.TryGetProperty("credits", out var credits) && credits.TryGetProperty("cast", out var castArr))
            cast = [.. castArr.EnumerateArray().Take(10).Select(c => c.GetProperty("name").GetString()!)];

        string? imdbId = null;
        if (root.TryGetProperty("external_ids", out var ext) && ext.TryGetProperty("imdb_id", out var imdb))
            imdbId = imdb.GetString();

        double? imdbScore = root.TryGetProperty("vote_average", out var va) ? va.GetDouble() : null;

        return new TmdbDetail(overview, poster, backdrop, year == 0 ? null : year, genres, cast, imdbId, imdbScore, null);
    }

    private record TmdbSearchResult(int TmdbId);

    private record TmdbDetail(
        string? Overview,
        string? PosterPath,
        string? BackdropPath,
        int? Year,
        string[] Genres,
        string[] Cast,
        string? ImdbId,
        double? ImdbScore,
        int? RottenTomatoesScore);
}
