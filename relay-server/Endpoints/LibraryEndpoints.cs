using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class LibraryEndpoints
{
    public static void MapLibraryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/libraries").RequireAuthorization();

        // List libraries the current user has access to
        group.MapGet("/", async (RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            IQueryable<Library> query = db.Libraries;
            if (!user.IsAdmin)
            {
                var accessIds = await db.UserLibraryAccess
                    .Where(a => a.UserId == user.Id)
                    .Select(a => a.LibraryId)
                    .ToHashSetAsync();
                query = query.Where(l => accessIds.Contains(l.Id));
            }

            var libraries = await query
                .Select(l => new { l.Id, l.Name, l.Type, l.RootPath, l.MetadataEnabled, l.WhisperEnabled, l.LastScannedAt })
                .ToListAsync();
            return Results.Ok(libraries);
        });

        // Admin: create library
        group.MapPost("/", async (CreateLibraryRequest req, RelayDbContext db, ClaimsPrincipal principal) =>
        {
            if (!IsAdmin(principal)) return Results.Forbid();

            var library = new Library
            {
                Name = req.Name,
                Type = req.Type,
                RootPath = req.RootPath,
                MetadataEnabled = req.Type != LibraryType.HomeMedia && req.MetadataEnabled,
                MetadataRefreshIntervalHours = req.MetadataRefreshIntervalHours ?? 24,
                WhisperEnabled = req.Type == LibraryType.HomeMedia && req.WhisperEnabled
            };
            db.Libraries.Add(library);
            await db.SaveChangesAsync();

            // Give all existing users access
            var userIds = await db.Users.Select(u => u.Id).ToListAsync();
            foreach (var uid in userIds)
                db.UserLibraryAccess.Add(new UserLibraryAccess { UserId = uid, LibraryId = library.Id });
            await db.SaveChangesAsync();

            return Results.Created($"/api/libraries/{library.Id}", new { library.Id, library.Name });
        });

        // Admin: update library settings
        group.MapPut("/{id:int}", async (int id, UpdateLibraryRequest req, RelayDbContext db, ClaimsPrincipal principal) =>
        {
            if (!IsAdmin(principal)) return Results.Forbid();
            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();

            if (!string.IsNullOrEmpty(req.Name)) library.Name = req.Name;
            if (req.MetadataEnabled.HasValue) library.MetadataEnabled = req.MetadataEnabled.Value;
            if (req.WhisperEnabled.HasValue) library.WhisperEnabled = req.WhisperEnabled.Value;
            if (req.MetadataRefreshIntervalHours.HasValue) library.MetadataRefreshIntervalHours = req.MetadataRefreshIntervalHours.Value;

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Admin: delete library
        group.MapDelete("/{id:int}", async (int id, RelayDbContext db, ClaimsPrincipal principal) =>
        {
            if (!IsAdmin(principal)) return Results.Forbid();
            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();
            db.Libraries.Remove(library);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Admin: trigger scan of a single library
        group.MapPost("/{id:int}/scan", async (int id, RelayDbContext db, LibraryScannerService scanner, ClaimsPrincipal principal) =>
        {
            if (!IsAdmin(principal)) return Results.Forbid();
            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();

            // Fire-and-forget — return immediately, scan runs in background
            _ = Task.Run(() => scanner.ScanLibraryAsync(library));
            return Results.Accepted();
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";
}

record CreateLibraryRequest(string Name, LibraryType Type, string RootPath, bool MetadataEnabled, bool WhisperEnabled, int? MetadataRefreshIntervalHours);
record UpdateLibraryRequest(string? Name, bool? MetadataEnabled, bool? WhisperEnabled, int? MetadataRefreshIntervalHours);
