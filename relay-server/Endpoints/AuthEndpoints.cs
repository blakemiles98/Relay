using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Relay.Server.Data;
using Relay.Server.DTOs.Auth;
using Relay.Server.Services;

namespace Relay.Server.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        // Returns list of all profiles (no passwords needed — Jellyfin style)
        group.MapGet("/profiles", async (AppDbContext db) =>
        {
            var users = await db.Users
                .OrderBy(u => u.IsAdmin ? 0 : 1)
                .ThenBy(u => u.Username)
                .Select(u => new UserDto(u.Id, u.Username, u.IsAdmin, u.AvatarColor))
                .ToListAsync();

            return Results.Ok(users);
        });

        // Returns whether a profile has a password set
        group.MapGet("/profiles/{id:guid}/has-password", async (Guid id, AppDbContext db) =>
        {
            var user = await db.Users.FindAsync(id);
            if (user is null) return Results.NotFound();
            return Results.Ok(new { hasPassword = user.PasswordHash is not null });
        });

        // Login — sets httpOnly cookie and returns user info
        group.MapPost("/login", async (LoginRequest req, HttpContext ctx, IAuthService auth) =>
        {
            var token = await auth.LoginAsync(req.Username, req.Password);
            if (token is null)
                return Results.Unauthorized();

            ctx.Response.Cookies.Append("relay_token", token, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(30)
            });

            return Results.Ok(new { message = "ok" });
        });

        // Logout — clears the auth cookie
        group.MapPost("/logout", (HttpContext ctx) =>
        {
            ctx.Response.Cookies.Append("relay_token", "", new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UnixEpoch
            });
            return Results.NoContent();
        });

        // Create a new user (admin only)
        group.MapPost("/users", async (CreateUserRequest req, ClaimsPrincipal principal, IAuthService auth) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var user = await auth.CreateUserAsync(req.Username, req.Password, req.AvatarColor, req.IsAdmin, req.LibraryIds);
            return Results.Created($"/api/auth/users/{user.Id}",
                new UserDto(user.Id, user.Username, user.IsAdmin, user.AvatarColor));
        }).RequireAuthorization();

        // Get a user's library access (admin only)
        group.MapGet("/users/{id:guid}/libraries", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var libraryIds = await db.UserLibraryAccess
                .Where(a => a.UserId == id)
                .Select(a => a.LibraryId)
                .ToListAsync();

            return Results.Ok(libraryIds);
        }).RequireAuthorization();

        // Update a user's library access (admin only)
        group.MapPut("/users/{id:guid}/libraries", async (
            Guid id,
            List<Guid> libraryIds,
            ClaimsPrincipal principal,
            IAuthService auth,
            AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var user = await db.Users.FindAsync(id);
            if (user is null) return Results.NotFound();

            // Admins always have full access — no need to store access rows
            if (!user.IsAdmin)
                await auth.SetLibraryAccessAsync(id, libraryIds);

            return Results.NoContent();
        }).RequireAuthorization();

        // Update a user (admin or self)
        group.MapPut("/users/{id:guid}", async (
            Guid id,
            CreateUserRequest req,
            ClaimsPrincipal principal,
            IAuthService auth,
            AppDbContext db) =>
        {
            var currentUserId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = principal.FindFirst("isAdmin")?.Value == "true";

            if (currentUserId != id && !isAdmin)
                return Results.Forbid();

            var user = await db.Users.FindAsync(id);
            if (user is null) return Results.NotFound();

            user.Username = req.Username;
            user.AvatarColor = req.AvatarColor;

            if (req.Password is not null)
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

            await db.SaveChangesAsync();

            // Update library access if admin is editing another user
            if (isAdmin && !user.IsAdmin && req.LibraryIds is not null)
                await auth.SetLibraryAccessAsync(id, req.LibraryIds);

            return Results.Ok(new UserDto(user.Id, user.Username, user.IsAdmin, user.AvatarColor));
        }).RequireAuthorization();

        // Delete a user (admin only)
        group.MapDelete("/users/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var user = await db.Users.FindAsync(id);
            if (user is null) return Results.NotFound();
            if (user.IsAdmin && await db.Users.CountAsync(u => u.IsAdmin) == 1)
                return Results.BadRequest(new { error = "Cannot delete the last admin" });

            db.Users.Remove(user);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        // Get current user info
        group.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var user = await db.Users.FindAsync(userId);
            if (user is null) return Results.NotFound();
            return Results.Ok(new UserDto(user.Id, user.Username, user.IsAdmin, user.AvatarColor));
        }).RequireAuthorization();
    }
}
