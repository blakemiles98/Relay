using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;

namespace RelayServer.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/settings").RequireAuthorization();

        group.MapGet("/", async (RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var settings = await db.AppSettings.FirstAsync();
            return Results.Ok(new
            {
                settings.TmdbApiKey,
                settings.DiscordWebhookUrl,
                settings.NotifyOnLibraryScanComplete,
                settings.NotifyOnNewMediaAdded,
                settings.NotifyOnTaskFailed,
                settings.NotifyOnWhisperComplete,
                settings.NotifyOnUserCreated
            });
        });

        group.MapPut("/", async (UpdateSettingsRequest req, RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var settings = await db.AppSettings.FirstAsync();

            if (req.TmdbApiKey is not null) settings.TmdbApiKey = req.TmdbApiKey;
            if (req.DiscordWebhookUrl is not null) settings.DiscordWebhookUrl = req.DiscordWebhookUrl;
            if (req.NotifyOnLibraryScanComplete.HasValue) settings.NotifyOnLibraryScanComplete = req.NotifyOnLibraryScanComplete.Value;
            if (req.NotifyOnNewMediaAdded.HasValue) settings.NotifyOnNewMediaAdded = req.NotifyOnNewMediaAdded.Value;
            if (req.NotifyOnTaskFailed.HasValue) settings.NotifyOnTaskFailed = req.NotifyOnTaskFailed.Value;
            if (req.NotifyOnWhisperComplete.HasValue) settings.NotifyOnWhisperComplete = req.NotifyOnWhisperComplete.Value;
            if (req.NotifyOnUserCreated.HasValue) settings.NotifyOnUserCreated = req.NotifyOnUserCreated.Value;

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        group.MapGet("/encoder", (RelayServer.Services.TranscodeService transcode, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            return Results.Ok(new { encoder = transcode.Encoder });
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";
}

record UpdateSettingsRequest(
    string? TmdbApiKey,
    string? DiscordWebhookUrl,
    bool? NotifyOnLibraryScanComplete,
    bool? NotifyOnNewMediaAdded,
    bool? NotifyOnTaskFailed,
    bool? NotifyOnWhisperComplete,
    bool? NotifyOnUserCreated);
