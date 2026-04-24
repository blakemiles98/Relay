using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;

namespace RelayServer.Services;

public class WhisperService(
    RelayDbContext db,
    IHttpClientFactory http,
    IConfiguration config,
    ILogger<WhisperService> logger)
{
    // The faster-whisper sidecar URL — defaults to the Docker service name
    private readonly string _whisperUrl = config["Whisper:Url"] ?? "http://whisper:9000";

    // Process every home-media video that hasn't been transcribed yet in
    // libraries that have WhisperEnabled = true.
    public async Task ProcessQueueAsync(System.Text.StringBuilder log, CancellationToken ct)
    {
        var items = await db.MediaItems
            .Include(m => m.Library)
            .Where(m =>
                m.Library.WhisperEnabled &&
                m.Type == MediaType.HomeVideo &&
                !m.WhisperQueued &&
                !m.WhisperCompleted)
            .ToListAsync(ct);

        if (items.Count == 0)
        {
            log.AppendLine("No videos queued for Whisper transcription.");
            return;
        }

        log.AppendLine($"Found {items.Count} video(s) to transcribe.");

        foreach (var item in items)
        {
            if (ct.IsCancellationRequested) break;

            item.WhisperQueued = true;
            await db.SaveChangesAsync(ct);

            try
            {
                log.AppendLine($"Transcribing: {item.Title}");
                var srtPath = await TranscribeAsync(item.FilePath, ct);

                if (srtPath is not null)
                {
                    // Register the generated subtitle file in the database
                    var existing = await db.SubtitleTracks
                        .FirstOrDefaultAsync(s => s.MediaItemId == item.Id && s.FilePath == srtPath, ct);

                    if (existing is null)
                    {
                        db.SubtitleTracks.Add(new SubtitleTrack
                        {
                            MediaItemId = item.Id,
                            Language = "eng",
                            Label = "English (Auto)",
                            FilePath = srtPath,
                            IsExternal = true
                        });
                    }

                    item.WhisperCompleted = true;
                    await db.SaveChangesAsync(ct);
                    log.AppendLine($"  ✓ Saved: {Path.GetFileName(srtPath)}");
                }
                else
                {
                    // Leave WhisperQueued=true so it won't be re-queued, but
                    // WhisperCompleted=false so the admin can see it didn't finish
                    log.AppendLine($"  ✗ Transcription returned no output for: {item.Title}");
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Whisper failed for item {Id} ({Title})", item.Id, item.Title);
                log.AppendLine($"  ✗ Error: {ex.Message}");
                // Reset queued flag so it will be retried on the next run
                item.WhisperQueued = false;
                await db.SaveChangesAsync(ct);
            }
        }
    }

    private async Task<string?> TranscribeAsync(string videoPath, CancellationToken ct)
    {
        // The faster-whisper webservice accepts a multipart form POST with the
        // audio file. It returns the transcript as plain SRT text.
        // Docs: https://github.com/ahmetoner/whisper-asr-webservice
        var url = $"{_whisperUrl}/asr?task=transcribe&language=en&output=srt&encode=true";

        await using var fileStream = File.OpenRead(videoPath);
        using var content = new MultipartFormDataContent();
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/mpeg");
        content.Add(fileContent, "audio_file", Path.GetFileName(videoPath));

        var client = http.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(60); // long videos can take a while

        using var response = await client.PostAsync(url, content, ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Whisper returned {Status} for {Path}", response.StatusCode, videoPath);
            return null;
        }

        var srt = await response.Content.ReadAsStringAsync(ct);
        if (string.IsNullOrWhiteSpace(srt)) return null;

        // Write the .srt file alongside the source video
        var srtPath = Path.ChangeExtension(videoPath, ".en.srt");
        await File.WriteAllTextAsync(srtPath, srt, ct);
        return srtPath;
    }
}
