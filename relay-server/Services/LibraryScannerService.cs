using Microsoft.EntityFrameworkCore;
using Relay.Server.Data;
using Relay.Server.Models;

namespace Relay.Server.Services;

public interface ILibraryScannerService
{
    Task ScanLibraryAsync(Guid libraryId, CancellationToken ct = default);
    Task ScanAllLibrariesAsync(CancellationToken ct = default);
}

public class LibraryScannerService(
    IServiceScopeFactory scopeFactory,
    IFfprobeService ffprobe,
    ILogger<LibraryScannerService> logger) : ILibraryScannerService
{
    private static readonly string[] VideoExtensions =
        [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".m2ts"];

    private static readonly string[] ImageExtensions =
        [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".tiff"];

    public async Task ScanAllLibrariesAsync(CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var libraryIds = await db.Libraries.Select(l => l.Id).ToListAsync(ct);
        foreach (var id in libraryIds)
            await ScanLibraryAsync(id, ct);
    }

    public async Task ScanLibraryAsync(Guid libraryId, CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var library = await db.Libraries.FindAsync([libraryId], ct);
        if (library is null || !Directory.Exists(library.Path))
        {
            logger.LogWarning("Library {Id} not found or path does not exist", libraryId);
            return;
        }

        logger.LogInformation("Scanning library '{Name}' at {Path}", library.Name, library.Path);

        switch (library.Type)
        {
            case LibraryType.Movies:
            case LibraryType.HomeVideos:
                await ScanVideoFlatAsync(library, db, ct);
                break;
            case LibraryType.Shows:
                await ScanShowsAsync(library, db, ct);
                break;
            case LibraryType.Mixed:
                await ScanMixedAsync(library, db, ct);
                break;
            case LibraryType.Photos:
                await ScanPhotosAsync(library, db, ct);
                break;
        }

        library.LastScanned = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Scan complete for '{Name}'", library.Name);
    }

    // Movies / HomeVideos: each video file anywhere in the tree = one MediaItem
    private async Task ScanVideoFlatAsync(Library library, AppDbContext db, CancellationToken ct)
    {
        var existingPaths = await db.MediaItems
            .Where(m => m.LibraryId == library.Id)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        var files = GetVideoFiles(library.Path);

        foreach (var file in files)
        {
            if (ct.IsCancellationRequested) break;
            if (existingPaths.Contains(file)) continue;

            var info = new FileInfo(file);
            var item = new MediaItem
            {
                LibraryId = library.Id,
                Title = Path.GetFileNameWithoutExtension(file),
                Type = library.Type == LibraryType.HomeVideos ? MediaType.HomeVideo : MediaType.Movie,
                FilePath = file,
                FileSizeBytes = info.Length,
                DateAdded = DateTime.UtcNow
            };

            await ApplyProbeAsync(item, file);
            db.MediaItems.Add(item);
            logger.LogDebug("Added {Type}: {Title}", item.Type, item.Title);
        }

        await db.SaveChangesAsync(ct);
        await GenerateLibraryThumbnailsAsync(library.Id, db, ct);
    }

    // Shows: walk the full directory tree; any folder whose name matches "Season N" / "S01"
    // is a season directory — its parent (at any depth) is the series directory.
    // This handles structures like:
    //   library/ShowName/Season 1/ep.mkv                (shallow)
    //   library/subfolder/ShowName/Season 1/ep.mkv      (nested)
    private async Task ScanShowsAsync(Library library, AppDbContext db, CancellationToken ct)
    {
        var seriesCache = new Dictionary<string, Series>(StringComparer.OrdinalIgnoreCase);
        var seasonDirs = GetSeasonDirectories(library.Path);

        foreach (var seasonDir in seasonDirs)
        {
            if (ct.IsCancellationRequested) break;
            await ProcessSeasonDirectoryAsync(library, seasonDir, seriesCache, db, ct);
        }
    }

    // Mixed: treats season-bearing sub-trees as shows; everything else as movies.
    // Example layout:
    //   anime/
    //     shows/Naruto/Season 1/ep.mkv   → episode
    //     movies/Spirited Away.mkv       → movie
    private async Task ScanMixedAsync(Library library, AppDbContext db, CancellationToken ct)
    {
        var seriesCache = new Dictionary<string, Series>(StringComparer.OrdinalIgnoreCase);
        var seasonDirs = GetSeasonDirectories(library.Path);

        // Collect the set of season directory paths so we can skip their files during movie scan
        var seasonDirSet = new HashSet<string>(
            seasonDirs.Select(d => Path.GetFullPath(d)),
            StringComparer.OrdinalIgnoreCase);

        // Shows pass
        foreach (var seasonDir in seasonDirs)
        {
            if (ct.IsCancellationRequested) break;
            await ProcessSeasonDirectoryAsync(library, seasonDir, seriesCache, db, ct);
        }

        // Movies pass — any video file whose immediate parent is NOT a season directory
        var existingMoviePaths = await db.MediaItems
            .Where(m => m.LibraryId == library.Id && m.Type == MediaType.Movie)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        foreach (var file in GetVideoFiles(library.Path))
        {
            if (ct.IsCancellationRequested) break;
            if (existingMoviePaths.Contains(file)) continue;

            var fileDir = Path.GetFullPath(Path.GetDirectoryName(file)!);
            if (seasonDirSet.Contains(fileDir)) continue; // it's an episode, handled above

            var info = new FileInfo(file);
            var item = new MediaItem
            {
                LibraryId = library.Id,
                Title = Path.GetFileNameWithoutExtension(file),
                Type = MediaType.Movie,
                FilePath = file,
                FileSizeBytes = info.Length,
                DateAdded = DateTime.UtcNow
            };

            await ApplyProbeAsync(item, file);
            db.MediaItems.Add(item);
            logger.LogDebug("Added Movie: {Title}", item.Title);
        }

        await db.SaveChangesAsync(ct);
        await GenerateLibraryThumbnailsAsync(library.Id, db, ct);
    }

    // Shared logic: given a season directory, find/create the Series + Season records
    // and add any new episode files found directly inside it.
    private async Task ProcessSeasonDirectoryAsync(
        Library library,
        string seasonDir,
        Dictionary<string, Series> seriesCache,
        AppDbContext db,
        CancellationToken ct)
    {
        if (!TryParseSeasonNumber(Path.GetFileName(seasonDir), out var seasonNumber)) return;

        var seriesDir = Path.GetDirectoryName(seasonDir)!;

        // Don't treat a "Season X" folder sitting directly in the library root as a show
        if (string.Equals(Path.GetFullPath(seriesDir), Path.GetFullPath(library.Path),
                StringComparison.OrdinalIgnoreCase))
            return;

        var seriesTitle = Path.GetFileName(seriesDir);

        // Get or create Series
        if (!seriesCache.TryGetValue(seriesDir, out var series))
        {
            series = await db.Series.FirstOrDefaultAsync(
                s => s.LibraryId == library.Id && s.FolderPath == seriesDir, ct);

            if (series is null)
            {
                series = new Series
                {
                    LibraryId = library.Id,
                    Title = seriesTitle,
                    FolderPath = seriesDir
                };
                db.Series.Add(series);
                await db.SaveChangesAsync(ct);
            }
            seriesCache[seriesDir] = series;
        }

        // Get or create Season
        var season = await db.Seasons.FirstOrDefaultAsync(
            s => s.SeriesId == series.Id && s.SeasonNumber == seasonNumber, ct);

        if (season is null)
        {
            season = new Season
            {
                SeriesId = series.Id,
                SeasonNumber = seasonNumber,
                Title = Path.GetFileName(seasonDir)
            };
            db.Seasons.Add(season);
            await db.SaveChangesAsync(ct);
        }

        // Episodes — files directly in this season dir only
        var existingPaths = await db.MediaItems
            .Where(m => m.SeasonId == season.Id)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        foreach (var file in Directory.EnumerateFiles(seasonDir)
            .Where(f => VideoExtensions.Contains(Path.GetExtension(f).ToLowerInvariant())))
        {
            if (ct.IsCancellationRequested) break;
            if (existingPaths.Contains(file)) continue;

            var info = new FileInfo(file);
            var fileName = Path.GetFileNameWithoutExtension(file);
            var item = new MediaItem
            {
                LibraryId = library.Id,
                SeriesId = series.Id,
                SeasonId = season.Id,
                Type = MediaType.Episode,
                Title = fileName,
                EpisodeNumber = ParseEpisodeNumber(fileName),
                FilePath = file,
                FileSizeBytes = info.Length,
                DateAdded = DateTime.UtcNow
            };

            await ApplyProbeAsync(item, file);
            db.MediaItems.Add(item);
            logger.LogDebug("Added Episode: {Title}", fileName);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task ScanPhotosAsync(Library library, AppDbContext db, CancellationToken ct)
    {
        var existingPaths = await db.MediaItems
            .Where(m => m.LibraryId == library.Id)
            .Select(m => m.FilePath)
            .ToHashSetAsync(ct);

        foreach (var file in Directory.EnumerateFiles(library.Path, "*.*", SearchOption.AllDirectories)
            .Where(f => ImageExtensions.Contains(Path.GetExtension(f).ToLowerInvariant())))
        {
            if (ct.IsCancellationRequested) break;
            if (existingPaths.Contains(file)) continue;

            var info = new FileInfo(file);
            db.MediaItems.Add(new MediaItem
            {
                LibraryId = library.Id,
                Title = Path.GetFileNameWithoutExtension(file),
                Type = MediaType.Photo,
                FilePath = file,
                FileSizeBytes = info.Length,
                DateAdded = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task GenerateLibraryThumbnailsAsync(Guid libraryId, AppDbContext db, CancellationToken ct)
    {
        var needsThumbnails = await db.MediaItems
            .Where(m => m.LibraryId == libraryId && m.ThumbnailPath == null && m.DurationSeconds != null)
            .ToListAsync(ct);

        foreach (var item in needsThumbnails)
        {
            if (ct.IsCancellationRequested) break;
            await GenerateThumbnailAsync(item, ct);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task GenerateThumbnailAsync(MediaItem item, CancellationToken ct)
    {
        var thumbDir = Path.Combine(AppContext.BaseDirectory, "thumbnails");
        var thumbPath = Path.Combine(thumbDir, $"{item.Id}.jpg");
        var at = Math.Min((item.DurationSeconds ?? 60) * 0.1, 30);

        if (await ffprobe.ExtractThumbnailAsync(item.FilePath, thumbPath, at))
        {
            item.ThumbnailPath = thumbPath;
            logger.LogDebug("Thumbnail generated for {Title}", item.Title);
        }
    }

    private async Task ApplyProbeAsync(MediaItem item, string filePath)
    {
        var probe = await ffprobe.ProbeAsync(filePath);
        if (probe is null) return;
        item.DurationSeconds = probe.DurationSeconds;
        item.Width = probe.Width;
        item.Height = probe.Height;
        item.VideoCodec = probe.VideoCodec;
        item.AudioCodec = probe.AudioCodec;
        item.Container = probe.Container;
    }

    // Returns all directories in the tree whose name matches a season pattern
    private static IEnumerable<string> GetSeasonDirectories(string root)
        => Directory.EnumerateDirectories(root, "*", SearchOption.AllDirectories)
            .Where(d => TryParseSeasonNumber(Path.GetFileName(d), out _));

    private static IEnumerable<string> GetVideoFiles(string root)
        => Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
            .Where(f => VideoExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()));

    // Returns true only when the name IS a season directory (strict match)
    private static bool TryParseSeasonNumber(string name, out int number)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            name, @"^(?:[Ss]eason\s*(\d+)|[Ss](\d+))$");
        if (match.Success)
        {
            var g = match.Groups[1].Success ? match.Groups[1] : match.Groups[2];
            number = int.Parse(g.Value);
            return true;
        }
        number = 0;
        return false;
    }

    private static int? ParseEpisodeNumber(string name)
    {
        var match = System.Text.RegularExpressions.Regex.Match(name, @"[Ee](\d+)|[Ss]\d+[Ee](\d+)");
        if (match.Success)
        {
            var g = match.Groups[1].Success ? match.Groups[1] : match.Groups[2];
            return int.Parse(g.Value);
        }
        return null;
    }
}
