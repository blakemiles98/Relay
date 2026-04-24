using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;

namespace RelayServer.Services;

public class DiscordService(RelayDbContext db, IHttpClientFactory http, ILogger<DiscordService> logger)
{
    public async Task SendAsync(string message, Func<Domain.AppSettings, bool> shouldSend)
    {
        var settings = await db.AppSettings.FirstOrDefaultAsync();
        if (settings is null || string.IsNullOrEmpty(settings.DiscordWebhookUrl)) return;
        if (!shouldSend(settings)) return;

        try
        {
            var client = http.CreateClient();
            var body = JsonSerializer.Serialize(new { content = message });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            await client.PostAsync(settings.DiscordWebhookUrl, content);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Discord notification failed");
        }
    }

    public Task NotifyLibraryScanCompleteAsync(string libraryName) =>
        SendAsync($"📚 Library scan complete: **{libraryName}**", s => s.NotifyOnLibraryScanComplete);

    public Task NotifyNewMediaAsync(string title) =>
        SendAsync($"🎬 New media added: **{title}**", s => s.NotifyOnNewMediaAdded);

    public Task NotifyTaskFailedAsync(string taskName) =>
        SendAsync($"❌ Scheduled task failed: **{taskName}**", s => s.NotifyOnTaskFailed);

    public Task NotifyWhisperCompleteAsync(string title) =>
        SendAsync($"🎙️ Whisper transcription complete: **{title}**", s => s.NotifyOnWhisperComplete);

    public Task NotifyUserCreatedAsync(string username) =>
        SendAsync($"👤 New user created: **{username}**", s => s.NotifyOnUserCreated);
}
