using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class SetupEndpoints
{
    public static void MapSetupEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/setup");

        // Returns whether setup has been completed — the frontend checks this on first load
        group.MapGet("/status", async (RelayDbContext db) =>
        {
            var settings = await db.AppSettings.FirstAsync();
            return Results.Ok(new { settings.SetupComplete });
        });

        // Step 1: Create admin account + first library
        group.MapPost("/complete", async (SetupRequest req, RelayDbContext db, AuthService auth) =>
        {
            var settings = await db.AppSettings.FirstAsync();
            if (settings.SetupComplete)
                return Results.BadRequest("Setup already completed.");

            if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest("Username and password are required.");

            var admin = new User
            {
                Username = req.Username.ToLower().Trim(),
                DisplayName = req.Username,
                PasswordHash = auth.HashPassword(req.Password),
                IsAdmin = true,
                IsHidden = true,
                Settings = new UserSettings()
            };
            db.Users.Add(admin);

            if (!string.IsNullOrWhiteSpace(req.TmdbApiKey))
                settings.TmdbApiKey = req.TmdbApiKey;

            settings.SetupComplete = true;
            await db.SaveChangesAsync();

            var token = auth.GenerateToken(admin);
            return Results.Ok(new { token, userId = admin.Id });
        });
    }
}

record SetupRequest(string Username, string Password, string? TmdbApiKey);
