using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class MediaEndpoints
{
    public static void MapMediaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/media").RequireAuthorization();

        // Library contents — returns movies, home media items, or TV series depending on library type
        group.MapGet("/library/{libraryId:int}", async (int libraryId, string? search, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();
            if (!await CanAccessLibrary(user, libraryId, db)) return Results.Forbid();

            var library = await db.Libraries.FindAsync(libraryId);
            if (library is null) return Results.NotFound();

            if (library.Type is LibraryType.TvShows or LibraryType.Mixed)
            {
                var series = await db.Series
                    .Where(s => s.LibraryId == libraryId &&
                        (search == null || s.Title.Contains(search, StringComparison.OrdinalIgnoreCase)))
                    .OrderBy(s => s.SortTitle ?? s.Title)
                    .Select(s => new { s.Id, s.Title, s.PosterPath, s.Year, s.ImdbScore, Type = "series" })
                    .ToListAsync();

                var movies = library.Type == LibraryType.Mixed
                    ? await db.MediaItems
                        .Where(m => m.LibraryId == libraryId && m.Type == MediaType.Movie &&
                            (search == null || m.Title.Contains(search, StringComparison.OrdinalIgnoreCase)))
                        .OrderBy(m => m.SortTitle ?? m.Title)
                        .Select(m => new { m.Id, m.Title, m.PosterPath, m.Year, m.ImdbScore, Type = "movie" })
                        .ToListAsync()
                    : [];

                return Results.Ok(new { series, movies });
            }

            var items = await db.MediaItems
                .Where(m => m.LibraryId == libraryId && m.SeasonId == null &&
                    (search == null || m.Title.Contains(search, StringComparison.OrdinalIgnoreCase)))
                .OrderBy(m => m.SortTitle ?? m.Title)
                .Select(m => new { m.Id, m.Title, m.PosterPath, m.FolderPath, m.Year, m.Type, m.AddedAt })
                .ToListAsync();
            return Results.Ok(items);
        });

        // Series detail + seasons
        group.MapGet("/series/{id:int}", async (int id, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var series = await db.Series
                .Include(s => s.Seasons).ThenInclude(s => s.Episodes)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (series is null) return Results.NotFound();
            if (!await CanAccessLibrary(user, series.LibraryId, db)) return Results.Forbid();

            return Results.Ok(series);
        });

        // Season episodes
        group.MapGet("/season/{id:int}", async (int id, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var season = await db.Seasons
                .Include(s => s.Episodes)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (season is null) return Results.NotFound();

            var series = await db.Series.FindAsync(season.SeriesId);
            if (!await CanAccessLibrary(user, series!.LibraryId, db)) return Results.Forbid();

            var episodes = season.Episodes.OrderBy(e => e.EpisodeNumber).ToList();
            return Results.Ok(new { season, episodes });
        });

        // Single media item detail
        group.MapGet("/{id:int}", async (int id, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var item = await db.MediaItems
                .Include(m => m.Subtitles)
                .Include(m => m.AudioTracks)
                .FirstOrDefaultAsync(m => m.Id == id);
            if (item is null) return Results.NotFound();
            if (!await CanAccessLibrary(user, item.LibraryId, db)) return Results.Forbid();

            // Include this user's watch progress for this item
            var progress = await db.WatchProgress
                .FirstOrDefaultAsync(w => w.UserId == user.Id && w.MediaItemId == id);

            return Results.Ok(new { item, progress });
        });

        // Save watch progress
        group.MapPost("/{id:int}/progress", async (int id, ProgressRequest req, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var progress = await db.WatchProgress
                .FirstOrDefaultAsync(w => w.UserId == user.Id && w.MediaItemId == id);

            if (progress is null)
            {
                progress = new WatchProgress { UserId = user.Id, MediaItemId = id };
                db.WatchProgress.Add(progress);
            }

            progress.PositionSeconds = req.PositionSeconds;
            progress.IsCompleted = req.IsCompleted;
            if (req.LastAudioLanguage is not null) progress.LastAudioLanguage = req.LastAudioLanguage;
            if (req.LastSubtitleLanguage is not null) progress.LastSubtitleLanguage = req.LastSubtitleLanguage;
            progress.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Home screen data — continue watching + recently added
        group.MapGet("/home", async (RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var accessibleLibraryIds = user.IsAdmin
                ? await db.Libraries.Select(l => l.Id).ToHashSetAsync()
                : await db.UserLibraryAccess.Where(a => a.UserId == user.Id).Select(a => a.LibraryId).ToHashSetAsync();

            var continueWatching = await db.WatchProgress
                .Where(w => w.UserId == user.Id && !w.IsCompleted && accessibleLibraryIds.Contains(w.MediaItem.LibraryId))
                .Include(w => w.MediaItem)
                .OrderByDescending(w => w.UpdatedAt)
                .Take(20)
                .Select(w => new
                {
                    w.MediaItem.Id, w.MediaItem.Title, w.MediaItem.PosterPath, w.MediaItem.Type,
                    w.PositionSeconds, w.MediaItem.DurationSeconds
                })
                .ToListAsync();

            var recentlyAdded = await db.MediaItems
                .Where(m => m.SeasonId == null && accessibleLibraryIds.Contains(m.LibraryId))
                .OrderByDescending(m => m.AddedAt)
                .Take(20)
                .Select(m => new { m.Id, m.Title, m.PosterPath, m.Type, m.AddedAt })
                .ToListAsync();

            return Results.Ok(new { continueWatching, recentlyAdded });
        });

        // Folder contents for Home Media (browse by folder path)
        group.MapGet("/folder", async (string path, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var accessibleLibraryIds = user.IsAdmin
                ? await db.Libraries.Select(l => l.Id).ToHashSetAsync()
                : await db.UserLibraryAccess.Where(a => a.UserId == user.Id).Select(a => a.LibraryId).ToHashSetAsync();

            var decodedPath = Uri.UnescapeDataString(path);

            // Sub-folders
            var subFolders = Directory.Exists(decodedPath)
                ? Directory.GetDirectories(decodedPath).Select(d => new { name = Path.GetFileName(d), fullPath = d }).ToList()
                : [];

            // Media items in this folder
            var items = await db.MediaItems
                .Where(m => m.FolderPath == decodedPath && accessibleLibraryIds.Contains(m.LibraryId))
                .OrderBy(m => m.Title)
                .Select(m => new { m.Id, m.Title, m.Type, m.PosterPath })
                .ToListAsync();

            return Results.Ok(new { subFolders, items });
        });
    }

    private static async Task<bool> CanAccessLibrary(User user, int libraryId, RelayDbContext db)
    {
        if (user.IsAdmin) return true;
        return await db.UserLibraryAccess.AnyAsync(a => a.UserId == user.Id && a.LibraryId == libraryId);
    }
}

record ProgressRequest(int PositionSeconds, bool IsCompleted, string? LastAudioLanguage, string? LastSubtitleLanguage);
