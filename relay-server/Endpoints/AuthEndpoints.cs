using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        // Returns visible profiles for the profile-picker screen
        group.MapGet("/profiles", async (RelayDbContext db) =>
        {
            var profiles = await db.Users
                .Where(u => !u.IsHidden)
                .Select(u => new
                {
                    u.Id,
                    u.DisplayName,
                    u.AvatarPath,
                    HasPassword = u.PasswordHash != null
                })
                .ToListAsync();
            return Results.Ok(profiles);
        });

        // Login by profile Id (visible profiles — may or may not have a password)
        group.MapPost("/login", async (LoginRequest req, RelayDbContext db, AuthService auth, HttpContext ctx) =>
        {
            var user = await db.Users
                .Include(u => u.Settings)
                .FirstOrDefaultAsync(u => u.Id == req.UserId);

            if (user is null) return Results.Unauthorized();

            if (user.PasswordHash is not null)
            {
                if (string.IsNullOrEmpty(req.Password)) return Results.Ok(new { requiresPassword = true });
                if (!auth.VerifyPassword(req.Password, user.PasswordHash)) return Results.Unauthorized();
            }

            var token = auth.GenerateToken(user);
            ctx.Response.Cookies.Append("relay_cookie", token, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(30)
            });
            return Results.Ok(new { token, userId = user.Id, displayName = user.DisplayName, isAdmin = user.IsAdmin });
        });

        // Login by username + password (for hidden profiles like admin)
        group.MapPost("/login/manual", async (ManualLoginRequest req, RelayDbContext db, AuthService auth, HttpContext ctx) =>
        {
            var user = await db.Users
                .Include(u => u.Settings)
                .FirstOrDefaultAsync(u => u.Username == req.Username.ToLower().Trim());

            if (user is null || user.PasswordHash is null) return Results.Unauthorized();
            if (!auth.VerifyPassword(req.Password, user.PasswordHash)) return Results.Unauthorized();

            var token = auth.GenerateToken(user);
            ctx.Response.Cookies.Append("relay_cookie", token, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(30)
            });
            return Results.Ok(new { token, userId = user.Id, displayName = user.DisplayName, isAdmin = user.IsAdmin });
        });

        group.MapPost("/logout", (HttpContext ctx) =>
        {
            ctx.Response.Cookies.Delete("relay_cookie");
            return Results.Ok();
        }).RequireAuthorization();
    }
}

record LoginRequest(int UserId, string? Password);
record ManualLoginRequest(string Username, string Password);
