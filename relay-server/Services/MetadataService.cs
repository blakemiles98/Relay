using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Relay.Server.Models;

namespace Relay.Server.Services;

public interface IMetadataService
{
    Task<MetadataResult?> SearchMovieAsync(string title, int? year);
    Task<MetadataResult?> SearchSeriesAsync(string title, int? year, MetadataProvider provider);
    Task<byte[]?> FetchImageAsync(string url);
}

public record MetadataResult(
    string ExternalId,
    string Source,
    string Title,
    string? Overview,
    int? Year,
    string? PosterUrl,
    string? BackdropUrl
);

public class MetadataService(IConfiguration config, IHttpClientFactory httpFactory, ILogger<MetadataService> logger) : IMetadataService
{
    private readonly string? _tmdbKey = config["Metadata:TMDbApiKey"];

    public async Task<MetadataResult?> SearchMovieAsync(string title, int? year)
    {
        if (string.IsNullOrEmpty(_tmdbKey)) return null;
        try
        {
            var client = httpFactory.CreateClient("tmdb");
            var url = $"/3/search/movie?api_key={_tmdbKey}&query={Uri.EscapeDataString(title)}" +
                      (year.HasValue ? $"&year={year}" : "");
            var resp = await client.GetFromJsonAsync<TMDbSearchResponse>(url);
            var hit = resp?.Results?.FirstOrDefault();
            if (hit is null) return null;
            return new MetadataResult(
                hit.Id.ToString(), "tmdb", hit.Title ?? title,
                hit.Overview, hit.ReleaseDate?.Year,
                hit.PosterPath is not null ? $"https://image.tmdb.org/t/p/w500{hit.PosterPath}" : null,
                hit.BackdropPath is not null ? $"https://image.tmdb.org/t/p/w780{hit.BackdropPath}" : null);
        }
        catch (Exception ex) { logger.LogWarning(ex, "TMDb movie search failed for {Title}", title); return null; }
    }

    public async Task<MetadataResult?> SearchSeriesAsync(string title, int? year, MetadataProvider provider)
    {
        return provider == MetadataProvider.AniList
            ? await SearchAniListAsync(title)
            : await SearchTMDbShowAsync(title, year);
    }

    private async Task<MetadataResult?> SearchTMDbShowAsync(string title, int? year)
    {
        if (string.IsNullOrEmpty(_tmdbKey)) return null;
        try
        {
            var client = httpFactory.CreateClient("tmdb");
            var url = $"/3/search/tv?api_key={_tmdbKey}&query={Uri.EscapeDataString(title)}" +
                      (year.HasValue ? $"&first_air_date_year={year}" : "");
            var resp = await client.GetFromJsonAsync<TMDbTvSearchResponse>(url);
            var hit = resp?.Results?.FirstOrDefault();
            if (hit is null) return null;
            return new MetadataResult(
                hit.Id.ToString(), "tmdb", hit.Name ?? title,
                hit.Overview, hit.FirstAirDate?.Year,
                hit.PosterPath is not null ? $"https://image.tmdb.org/t/p/w500{hit.PosterPath}" : null,
                hit.BackdropPath is not null ? $"https://image.tmdb.org/t/p/w780{hit.BackdropPath}" : null);
        }
        catch (Exception ex) { logger.LogWarning(ex, "TMDb TV search failed for {Title}", title); return null; }
    }

    private async Task<MetadataResult?> SearchAniListAsync(string title)
    {
        try
        {
            var client = httpFactory.CreateClient("anilist");
            var query = """
                query ($search: String) {
                  Media(search: $search, type: ANIME) {
                    id title { romaji english } description(asHtml: false)
                    seasonYear coverImage { large }
                  }
                }
                """;
            var body = JsonSerializer.Serialize(new { query, variables = new { search = title } });
            var resp = await client.PostAsync("", new StringContent(body, Encoding.UTF8, "application/json"));
            if (!resp.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            var media = doc.RootElement.GetProperty("data").GetProperty("Media");
            var romaji = media.GetProperty("title").TryGetProperty("romaji", out var r) ? r.GetString() : null;
            var english = media.GetProperty("title").TryGetProperty("english", out var e) ? e.GetString() : null;
            var displayTitle = english ?? romaji ?? title;
            var year = media.TryGetProperty("seasonYear", out var sy) && sy.ValueKind == JsonValueKind.Number ? (int?)sy.GetInt32() : null;
            var overview = media.TryGetProperty("description", out var desc) ? desc.GetString() : null;
            var poster = media.GetProperty("coverImage").TryGetProperty("large", out var img) ? img.GetString() : null;
            return new MetadataResult(
                media.GetProperty("id").GetInt32().ToString(), "anilist",
                displayTitle, overview, year, poster, null);
        }
        catch (Exception ex) { logger.LogWarning(ex, "AniList search failed for {Title}", title); return null; }
    }

    private static readonly HashSet<string> _allowedImageHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "image.tmdb.org",
        "www.themoviedb.org",
        "s4.anilist.co",
        "media.kitsu.io",
    };

    public async Task<byte[]?> FetchImageAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "https" && uri.Scheme != "http") ||
            !_allowedImageHosts.Contains(uri.Host))
        {
            logger.LogWarning("Blocked image fetch from disallowed host: {Url}", url);
            return null;
        }

        try
        {
            var client = httpFactory.CreateClient();
            return await client.GetByteArrayAsync(url);
        }
        catch { return null; }
    }

    // ── Internal DTOs ──────────────────────────────────────────────────────────
    private record TMDbSearchResponse([property: System.Text.Json.Serialization.JsonPropertyName("results")] List<TMDbMovieResult>? Results);
    private record TMDbMovieResult(
        int Id,
        string? Title,
        string? Overview,
        [property: System.Text.Json.Serialization.JsonPropertyName("release_date")] DateOnly? ReleaseDate,
        [property: System.Text.Json.Serialization.JsonPropertyName("poster_path")] string? PosterPath,
        [property: System.Text.Json.Serialization.JsonPropertyName("backdrop_path")] string? BackdropPath);
    private record TMDbTvSearchResponse([property: System.Text.Json.Serialization.JsonPropertyName("results")] List<TMDbTvResult>? Results);
    private record TMDbTvResult(
        int Id,
        string? Name,
        string? Overview,
        [property: System.Text.Json.Serialization.JsonPropertyName("first_air_date")] DateOnly? FirstAirDate,
        [property: System.Text.Json.Serialization.JsonPropertyName("poster_path")] string? PosterPath,
        [property: System.Text.Json.Serialization.JsonPropertyName("backdrop_path")] string? BackdropPath);
}
