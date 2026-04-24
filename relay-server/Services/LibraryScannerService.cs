using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;

namespace RelayServer.Services;

public class LibraryScannerService(RelayDbContext db, ILogger<LibraryScannerService> logger)
{
    private static readonly HashSet<string> VideoExtensions =
        [".mp4", ".mkv", ".mov", ".avi", ".m4v", ".ts", ".wmv"];

    private static readonly HashSet<string> PhotoExtensions =
        [".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".tiff"];

    public async Task ScanLibraryAsync(Library library, CancellationToken ct = default)
    {
        logger.LogInformation("Scanning library: {Name} ({Type})", library.Name, library.Type);

        if (!Directory.Exists(library.RootPath))
        {
            logger.LogWarning("Library root path does not exist: {Path}", library.RootPath);
            return;
        }

        switch (library.Type)
        {
            case LibraryType.Movies:
                await ScanMoviesAsync(library, library.RootPath, ct);
                break;
            case LibraryType.TvShows:
                await ScanTvShowsAsync(library, library.RootPath, ct);
                break;
            case LibraryType.Mixed:
                await ScanMixedAsync(library, ct);
                break;
            case LibraryType.HomeMedia:
                await ScanHomeMediaAsync(library, library.RootPath, ct);
                break;
        }

        library.LastScannedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Scan complete for library: {Name}", library.Name);
    }

    private async Task ScanMoviesAsync(Library library, string folder, CancellationToken ct)
    {
        var files = Directory.GetFiles(folder, "*", SearchOption.AllDirectories)
            .Where(f => VideoExtensions.Contains(Path.GetExtension(f).ToLower()));

        var existingPaths = await db.MediaItems
            .Where(m => m.LibraryId == library.Id && m.Type == MediaType.Movie)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        foreach (var file in files)
        {
            if (existingPaths.Contains(file)) continue;
            var info = new FileInfo(file);
            db.MediaItems.Add(new MediaItem
            {
                LibraryId = library.Id,
                Type = MediaType.Movie,
                Title = Path.GetFileNameWithoutExtension(file),
                FilePath = file,
                FileSizeBytes = info.Length
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task ScanTvShowsAsync(Library library, string folder, CancellationToken ct)
    {
        // Folder structure: library root / Series / Season XX / episode.mkv
        foreach (var seriesDir in Directory.GetDirectories(folder))
        {
            var seriesName = Path.GetFileName(seriesDir);
            var series = await db.Series
                .FirstOrDefaultAsync(s => s.LibraryId == library.Id && s.Title == seriesName, ct)
                ?? db.Series.Add(new Series
                {
                    LibraryId = library.Id,
                    Title = seriesName
                }).Entity;

            await db.SaveChangesAsync(ct);

            foreach (var seasonDir in Directory.GetDirectories(seriesDir))
            {
                var seasonName = Path.GetFileName(seasonDir);
                var seasonNum = ParseSeasonNumber(seasonName);

                var season = await db.Seasons
                    .FirstOrDefaultAsync(s => s.SeriesId == series.Id && s.SeasonNumber == seasonNum, ct)
                    ?? db.Seasons.Add(new Season
                    {
                        SeriesId = series.Id,
                        SeasonNumber = seasonNum,
                        Title = seasonName
                    }).Entity;

                await db.SaveChangesAsync(ct);

                var files = Directory.GetFiles(seasonDir, "*", SearchOption.TopDirectoryOnly)
                    .Where(f => VideoExtensions.Contains(Path.GetExtension(f).ToLower()));

                var existingPaths = await db.MediaItems
                    .Where(m => m.SeasonId == season.Id)
                    .Select(m => m.FilePath)
                    .ToHashSetAsync(ct);

                foreach (var file in files)
                {
                    if (existingPaths.Contains(file)) continue;
                    var epNum = ParseEpisodeNumber(Path.GetFileNameWithoutExtension(file));
                    var info = new FileInfo(file);
                    db.MediaItems.Add(new MediaItem
                    {
                        LibraryId = library.Id,
                        SeasonId = season.Id,
                        Type = MediaType.Episode,
                        Title = Path.GetFileNameWithoutExtension(file),
                        FilePath = file,
                        EpisodeNumber = epNum,
                        FileSizeBytes = info.Length
                    });
                }

                await db.SaveChangesAsync(ct);
            }
        }
    }

    private async Task ScanMixedAsync(Library library, CancellationToken ct)
    {
        // Root contains two subfolders — one for movies, one for shows
        foreach (var subDir in Directory.GetDirectories(library.RootPath))
        {
            var name = Path.GetFileName(subDir).ToLower();
            if (name.Contains("movie") || name.Contains("film"))
                await ScanMoviesAsync(library, subDir, ct);
            else
                await ScanTvShowsAsync(library, subDir, ct);
        }
    }

    private async Task ScanHomeMediaAsync(Library library, string folder, CancellationToken ct)
    {
        var files = Directory.GetFiles(folder, "*", SearchOption.AllDirectories)
            .Where(f =>
            {
                var ext = Path.GetExtension(f).ToLower();
                return VideoExtensions.Contains(ext) || PhotoExtensions.Contains(ext);
            });

        var existingPaths = await db.MediaItems
            .Where(m => m.LibraryId == library.Id)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        foreach (var file in files)
        {
            if (existingPaths.Contains(file)) continue;
            var ext = Path.GetExtension(file).ToLower();
            var type = PhotoExtensions.Contains(ext) ? MediaType.Photo : MediaType.HomeVideo;
            var info = new FileInfo(file);
            db.MediaItems.Add(new MediaItem
            {
                LibraryId = library.Id,
                Type = type,
                Title = Path.GetFileNameWithoutExtension(file),
                FilePath = file,
                FolderPath = Path.GetDirectoryName(file),
                FileSizeBytes = info.Length
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static int ParseSeasonNumber(string name)
    {
        var match = System.Text.RegularExpressions.Regex.Match(name, @"[Ss]eason\s*(\d+)|[Ss](\d+)");
        if (match.Success)
        {
            var g = match.Groups[1].Success ? match.Groups[1] : match.Groups[2];
            return int.Parse(g.Value);
        }
        return 1;
    }

    private static int? ParseEpisodeNumber(string name)
    {
        var match = System.Text.RegularExpressions.Regex.Match(name, @"[Ee](\d+)");
        return match.Success ? int.Parse(match.Groups[1].Value) : null;
    }
}
