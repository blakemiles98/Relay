using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Relay.Server.Data;
using Relay.Server.DTOs.Media;

namespace Relay.Server.Endpoints;

public static class MediaEndpoints
{
    public static void MapMediaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/media").RequireAuthorization();

        // Browse items in a library (with optional search and subfolder filter)
        group.MapGet("/library/{libraryId:guid}", async (
            Guid libraryId,
            string? search,
            string? subFolder,
            int page,
            int pageSize,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            if (!await HasLibraryAccessAsync(db, userId, libraryId, IsAdmin(principal)))
                return Results.Forbid();

            var query = db.MediaItems
                .Where(m => m.LibraryId == libraryId && m.SeriesId == null); // top-level items only

            // Filter to a specific subfolder (e.g. "movies" within a Mixed library)
            if (!string.IsNullOrEmpty(subFolder))
            {
                var library = await db.Libraries.FindAsync(libraryId);
                if (library is not null)
                {
                    var prefix = Path.Combine(library.Path, subFolder) + Path.DirectorySeparatorChar;
                    query = query.Where(m => m.FilePath.StartsWith(prefix));
                }
            }

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(m => m.Title.Contains(search));

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(m => m.Title)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var progressMap = await db.WatchProgress
                .Where(w => w.UserId == userId && items.Select(i => i.Id).Contains(w.MediaItemId))
                .ToDictionaryAsync(w => w.MediaItemId);

            var dtos = items.Select(m =>
            {
                progressMap.TryGetValue(m.Id, out var prog);
                return ToDto(m, prog?.PositionSeconds, prog?.IsCompleted);
            });

            return Results.Ok(new { total, page, pageSize, items = dtos });
        });

        // Direct subfolders of a Mixed library root that contain content
        group.MapGet("/library/{libraryId:guid}/subfolders", async (Guid libraryId, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (!await HasLibraryAccessAsync(db, userId, libraryId, IsAdmin(principal)))
                return Results.Forbid();

            var library = await db.Libraries.FindAsync(libraryId);
            if (library is null) return Results.NotFound();

            var folders = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);

            // Series paths
            var seriesPaths = await db.Series
                .Where(s => s.LibraryId == libraryId)
                .Select(s => s.FolderPath)
                .ToListAsync();

            foreach (var p in seriesPaths)
            {
                var rel = Path.GetRelativePath(library.Path, p);
                var parts = rel.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar], 2);
                if (parts.Length > 1 && parts[0] != "..")
                    folders.Add(parts[0]);
            }

            // Movie paths — use their containing directory
            var movieDirs = await db.MediaItems
                .Where(m => m.LibraryId == libraryId && m.Type == Models.MediaType.Movie)
                .Select(m => m.FilePath)
                .ToListAsync();

            foreach (var p in movieDirs)
            {
                var dir = Path.GetDirectoryName(p) ?? string.Empty;
                if (string.IsNullOrEmpty(dir)) continue;
                var rel = Path.GetRelativePath(library.Path, dir);
                if (rel == ".") continue;
                var parts = rel.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar], 2);
                if (parts[0] != "..") folders.Add(parts[0]);
            }

            return Results.Ok(folders);
        });

        // Get all series in a library (optional subFolder filter for Mixed libraries)
        group.MapGet("/library/{libraryId:guid}/series", async (
            Guid libraryId,
            string? subFolder,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (!await HasLibraryAccessAsync(db, userId, libraryId, IsAdmin(principal)))
                return Results.Forbid();

            var library = await db.Libraries.FindAsync(libraryId);
            if (library is null) return Results.NotFound();

            // Fetch with folder paths so we can filter by subfolder in memory
            var raw = await db.Series
                .Where(s => s.LibraryId == libraryId)
                .OrderBy(s => s.Title)
                .Select(s => new {
                    s.Id, s.LibraryId, s.Title, s.Overview,
                    s.ThumbnailPath, s.Year, s.FolderPath,
                    SeasonCount = s.Seasons.Count,
                    EpisodeCount = s.Seasons.SelectMany(se => se.Episodes).Count()
                })
                .ToListAsync();

            // Filter to the requested subfolder when specified
            if (!string.IsNullOrEmpty(subFolder))
            {
                raw = raw.Where(s =>
                {
                    var rel = Path.GetRelativePath(library.Path, s.FolderPath);
                    var parts = rel.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar], 2);
                    return parts.Length > 1 &&
                           string.Equals(parts[0], subFolder, StringComparison.OrdinalIgnoreCase);
                }).ToList();
            }

            var dtos = raw.Select(s => new SeriesDto(
                s.Id, s.LibraryId, s.Title, s.Overview,
                s.ThumbnailPath != null ? $"/api/media/thumbnail/{s.Id}" : null,
                s.Year, s.SeasonCount, s.EpisodeCount));

            return Results.Ok(dtos);
        });

        // Get seasons for a series
        group.MapGet("/series/{seriesId:guid}/seasons", async (Guid seriesId, AppDbContext db) =>
        {
            var seasons = await db.Seasons
                .Where(s => s.SeriesId == seriesId)
                .OrderBy(s => s.SeasonNumber)
                .Select(s => new SeasonDto(
                    s.Id, s.SeriesId, s.SeasonNumber, s.Title,
                    s.ThumbnailPath != null ? $"/api/media/thumbnail/season/{s.Id}" : null,
                    s.Episodes.Count))
                .ToListAsync();
            return Results.Ok(seasons);
        });

        // Get episodes in a season
        group.MapGet("/season/{seasonId:guid}/episodes", async (
            Guid seasonId,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var items = await db.MediaItems
                .Where(m => m.SeasonId == seasonId)
                .OrderBy(m => m.EpisodeNumber)
                .ThenBy(m => m.Title)
                .ToListAsync();

            var progressMap = await db.WatchProgress
                .Where(w => w.UserId == userId && items.Select(i => i.Id).Contains(w.MediaItemId))
                .ToDictionaryAsync(w => w.MediaItemId);

            var dtos = items.Select(m =>
            {
                progressMap.TryGetValue(m.Id, out var prog);
                return ToDto(m, prog?.PositionSeconds, prog?.IsCompleted);
            });

            return Results.Ok(dtos);
        });

        // Get single item
        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var item = await db.MediaItems.FindAsync(id);
            if (item is null) return Results.NotFound();

            if (!await HasLibraryAccessAsync(db, userId, item.LibraryId, IsAdmin(principal)))
                return Results.Forbid();

            var prog = await db.WatchProgress
                .FirstOrDefaultAsync(w => w.UserId == userId && w.MediaItemId == id);

            return Results.Ok(ToDto(item, prog?.PositionSeconds, prog?.IsCompleted));
        });

        // Serve thumbnail image
        group.MapGet("/thumbnail/{itemId:guid}", async (Guid itemId, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var item = await db.MediaItems.FindAsync(itemId);
            if (item?.ThumbnailPath is null || !File.Exists(item.ThumbnailPath))
                return Results.NotFound();

            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (!await HasLibraryAccessAsync(db, userId, item.LibraryId, IsAdmin(principal)))
                return Results.Forbid();

            return Results.Stream(File.OpenRead(item.ThumbnailPath), "image/jpeg");
        });

        // Serve season thumbnail
        group.MapGet("/thumbnail/season/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var season = await db.Seasons
                .Include(s => s.Series)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (season?.ThumbnailPath is null || !File.Exists(season.ThumbnailPath))
                return Results.NotFound();

            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (!await HasLibraryAccessAsync(db, userId, season.Series.LibraryId, IsAdmin(principal)))
                return Results.Forbid();

            return Results.Stream(File.OpenRead(season.ThumbnailPath), "image/jpeg");
        });

        // Serve series thumbnail
        group.MapGet("/thumbnail/series/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var series = await db.Series.FindAsync(id);
            if (series?.ThumbnailPath is null || !File.Exists(series.ThumbnailPath))
                return Results.NotFound();

            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (!await HasLibraryAccessAsync(db, userId, series.LibraryId, IsAdmin(principal)))
                return Results.Forbid();

            return Results.Stream(File.OpenRead(series.ThumbnailPath), "image/jpeg");
        });

        // Continue watching — recent unfinished items for the current user (filtered by access)
        group.MapGet("/continue-watching", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = IsAdmin(principal);

            var accessibleLibraryIds = isAdmin
                ? await db.Libraries.Select(l => l.Id).ToListAsync()
                : await db.UserLibraryAccess.Where(a => a.UserId == userId).Select(a => a.LibraryId).ToListAsync();

            var progresses = await db.WatchProgress
                .Include(w => w.MediaItem)
                .Where(w => w.UserId == userId && !w.IsCompleted && w.PositionSeconds > 0
                    && accessibleLibraryIds.Contains(w.MediaItem.LibraryId))
                .OrderByDescending(w => w.LastWatched)
                .Take(20)
                .ToListAsync();

            var dtos = progresses.Select(w =>
                ToDto(w.MediaItem, w.PositionSeconds, w.IsCompleted));

            return Results.Ok(dtos);
        });

        // Save watch progress
        group.MapPost("/{id:guid}/progress", async (
            Guid id,
            ProgressRequest req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var prog = await db.WatchProgress
                .FirstOrDefaultAsync(w => w.UserId == userId && w.MediaItemId == id);

            if (prog is null)
            {
                prog = new Models.WatchProgress
                {
                    UserId = userId,
                    MediaItemId = id
                };
                db.WatchProgress.Add(prog);
            }

            prog.PositionSeconds = req.PositionSeconds;
            prog.DurationSeconds = req.DurationSeconds;
            prog.IsCompleted = req.IsCompleted;
            prog.LastWatched = DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Recent additions — filtered by user's library access
        group.MapGet("/recent", async (ClaimsPrincipal principal, AppDbContext db, int count = 20) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = IsAdmin(principal);

            var accessibleLibraryIds = isAdmin
                ? await db.Libraries.Select(l => l.Id).ToListAsync()
                : await db.UserLibraryAccess.Where(a => a.UserId == userId).Select(a => a.LibraryId).ToListAsync();

            var items = await db.MediaItems
                .Where(m => m.Type != Models.MediaType.Episode && accessibleLibraryIds.Contains(m.LibraryId))
                .OrderByDescending(m => m.DateAdded)
                .Take(count)
                .ToListAsync();

            return Results.Ok(items.Select(m => ToDto(m, null, null)));
        });
    }

    private static async Task<bool> HasLibraryAccessAsync(AppDbContext db, Guid userId, Guid libraryId, bool isAdmin)
    {
        if (isAdmin) return true;
        return await db.UserLibraryAccess.AnyAsync(a => a.UserId == userId && a.LibraryId == libraryId);
    }

    private static bool IsAdmin(ClaimsPrincipal p) =>
        p.FindFirst("isAdmin")?.Value == "true";

    private static MediaItemDto ToDto(
        Models.MediaItem m,
        double? position,
        bool? isCompleted)
        => new(
            m.Id, m.LibraryId, m.Title, m.Type.ToString(),
            m.ThumbnailPath is not null ? $"/api/media/thumbnail/{m.Id}" : null,
            m.DurationSeconds, m.Width, m.Height,
            m.VideoCodec, m.AudioCodec, m.FileSizeBytes,
            m.Year, m.Overview, m.DateAdded,
            m.SeriesId, m.SeasonId, m.EpisodeNumber,
            position, isCompleted,
            m.ExternalId, m.ExternalSource,
            m.FilePath);
}

public record ProgressRequest(double PositionSeconds, double DurationSeconds, bool IsCompleted);
