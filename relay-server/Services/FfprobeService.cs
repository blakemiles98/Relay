using System.Diagnostics;
using System.Text.Json;

namespace Relay.Server.Services;

public interface IFfprobeService
{
    Task<MediaProbeResult?> ProbeAsync(string filePath);
    Task<bool> ExtractThumbnailAsync(string filePath, string outputPath, double atSeconds = 0);
}

public record MediaProbeResult(
    double DurationSeconds,
    int Width,
    int Height,
    string? VideoCodec,
    string? AudioCodec,
    string Container
);

public class FfprobeService(ILogger<FfprobeService> logger) : IFfprobeService
{
    private static readonly string[] VideoExtensions =
        [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".m2ts"];

    public async Task<MediaProbeResult?> ProbeAsync(string filePath)
    {
        try
        {
            var args = $"-v quiet -print_format json -show_streams -show_format \"{filePath}\"";
            var result = await RunAsync("ffprobe", args);
            if (result is null) return null;

            using var doc = JsonDocument.Parse(result);
            var root = doc.RootElement;

            var streams = root.GetProperty("streams");
            var format = root.GetProperty("format");

            double duration = 0;
            if (format.TryGetProperty("duration", out var durProp))
                double.TryParse(durProp.GetString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out duration);

            string? videoCodec = null, audioCodec = null;
            int width = 0, height = 0;

            foreach (var stream in streams.EnumerateArray())
            {
                var codecType = stream.TryGetProperty("codec_type", out var ct) ? ct.GetString() : null;
                if (codecType == "video" && videoCodec is null)
                {
                    videoCodec = stream.TryGetProperty("codec_name", out var vc) ? vc.GetString() : null;
                    stream.TryGetProperty("width", out var wProp);
                    stream.TryGetProperty("height", out var hProp);
                    width = wProp.ValueKind == JsonValueKind.Number ? wProp.GetInt32() : 0;
                    height = hProp.ValueKind == JsonValueKind.Number ? hProp.GetInt32() : 0;
                }
                else if (codecType == "audio" && audioCodec is null)
                {
                    audioCodec = stream.TryGetProperty("codec_name", out var ac) ? ac.GetString() : null;
                }
            }

            var container = Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();

            return new MediaProbeResult(duration, width, height, videoCodec, audioCodec, container);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ffprobe failed for {Path}", filePath);
            return null;
        }
    }

    public async Task<bool> ExtractThumbnailAsync(string filePath, string outputPath, double atSeconds = 0)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
            var time = TimeSpan.FromSeconds(atSeconds).ToString(@"hh\:mm\:ss");
            var args = $"-v quiet -ss {time} -i \"{filePath}\" -vframes 1 -q:v 2 -y \"{outputPath}\"";
            var result = await RunAsync("ffmpeg", args);
            return File.Exists(outputPath);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Thumbnail extraction failed for {Path}", filePath);
            return false;
        }
    }

    private static async Task<string?> RunAsync(string executable, string args)
    {
        var psi = new ProcessStartInfo(executable, args)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process is null) return null;

        var output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();
        return process.ExitCode == 0 ? output : null;
    }
}
