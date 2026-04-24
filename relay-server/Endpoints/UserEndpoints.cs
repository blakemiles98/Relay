using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/users").RequireAuthorization();

        // Admin: list all users
        group.MapGet("/", async (RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var users = await db.Users
                .Select(u => new { u.Id, u.Username, u.DisplayName, u.AvatarPath, u.IsAdmin, u.IsHidden, u.CreatedAt })
                .ToListAsync();
            return Results.Ok(users);
        });

        // Admin: create user
        group.MapPost("/", async (CreateUserRequest req, RelayDbContext db, AuthService auth, DiscordService discord, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();

            if (await db.Users.AnyAsync(u => u.Username == req.Username.ToLower().Trim()))
                return Results.Conflict("Username already taken.");

            var newUser = new User
            {
                Username = req.Username.ToLower().Trim(),
                DisplayName = req.DisplayName ?? req.Username,
                PasswordHash = string.IsNullOrEmpty(req.Password) ? null : auth.HashPassword(req.Password),
                IsAdmin = req.IsAdmin,
                IsHidden = req.IsHidden,
                Settings = new UserSettings()
            };
            db.Users.Add(newUser);
            await db.SaveChangesAsync();

            // Grant access to all libraries by default
            var libraries = await db.Libraries.ToListAsync();
            foreach (var lib in libraries)
                db.UserLibraryAccess.Add(new UserLibraryAccess { UserId = newUser.Id, LibraryId = lib.Id });
            await db.SaveChangesAsync();

            await discord.NotifyUserCreatedAsync(newUser.Username);
            return Results.Created($"/api/users/{newUser.Id}", new { newUser.Id, newUser.Username, newUser.DisplayName });
        });

        // Admin: update user
        group.MapPut("/{id:int}", async (int id, UpdateUserRequest req, RelayDbContext db, AuthService auth, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var target = await db.Users.FindAsync(id);
            if (target is null) return Results.NotFound();

            if (!string.IsNullOrEmpty(req.DisplayName)) target.DisplayName = req.DisplayName;
            if (req.IsHidden.HasValue) target.IsHidden = req.IsHidden.Value;
            if (req.IsAdmin.HasValue) target.IsAdmin = req.IsAdmin.Value;
            if (req.Password is not null)
                target.PasswordHash = string.IsNullOrEmpty(req.Password) ? null : auth.HashPassword(req.Password);

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Admin: delete user
        group.MapDelete("/{id:int}", async (int id, RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var target = await db.Users.FindAsync(id);
            if (target is null) return Results.NotFound();
            db.Users.Remove(target);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Admin: set library access for a user
        group.MapPut("/{id:int}/library-access", async (int id, LibraryAccessRequest req, RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var existing = await db.UserLibraryAccess.Where(a => a.UserId == id).ToListAsync();
            db.UserLibraryAccess.RemoveRange(existing);
            foreach (var libId in req.LibraryIds)
                db.UserLibraryAccess.Add(new UserLibraryAccess { UserId = id, LibraryId = libId });
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Current user: get own settings
        group.MapGet("/me/settings", async (RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();
            return Results.Ok(user.Settings);
        });

        // Current user: update own settings
        group.MapPut("/me/settings", async (UserSettingsRequest req, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            if (req.DefaultSubtitleLanguage is not null) user.Settings.DefaultSubtitleLanguage = req.DefaultSubtitleLanguage;
            if (req.DefaultAudioLanguage is not null) user.Settings.DefaultAudioLanguage = req.DefaultAudioLanguage;
            if (req.PlaybackQuality is not null) user.Settings.PlaybackQuality = req.PlaybackQuality;

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Watchlist
        group.MapGet("/me/watchlist", async (RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var items = await db.WatchlistItems
                .Where(w => w.UserId == user.Id)
                .Include(w => w.MediaItem)
                .OrderByDescending(w => w.AddedAt)
                .Select(w => new { w.MediaItem.Id, w.MediaItem.Title, w.MediaItem.PosterPath, w.MediaItem.Type, w.AddedAt })
                .ToListAsync();
            return Results.Ok(items);
        });

        group.MapPost("/me/watchlist/{mediaItemId:int}", async (int mediaItemId, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();
            if (await db.WatchlistItems.AnyAsync(w => w.UserId == user.Id && w.MediaItemId == mediaItemId))
                return Results.Ok();
            db.WatchlistItems.Add(new WatchlistItem { UserId = user.Id, MediaItemId = mediaItemId });
            await db.SaveChangesAsync();
            return Results.Created("", null);
        });

        group.MapDelete("/me/watchlist/{mediaItemId:int}", async (int mediaItemId, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();
            var item = await db.WatchlistItems.FirstOrDefaultAsync(w => w.UserId == user.Id && w.MediaItemId == mediaItemId);
            if (item is not null) { db.WatchlistItems.Remove(item); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";
}

record CreateUserRequest(string Username, string? DisplayName, string? Password, bool IsAdmin, bool IsHidden);
record UpdateUserRequest(string? DisplayName, string? Password, bool? IsAdmin, bool? IsHidden);
record LibraryAccessRequest(List<int> LibraryIds);
record UserSettingsRequest(string? DefaultSubtitleLanguage, string? DefaultAudioLanguage, string? PlaybackQuality);
