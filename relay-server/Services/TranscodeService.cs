namespace RelayServer.Services;

public class TranscodeService(IConfiguration config, ILogger<TranscodeService> logger)
{
    private readonly string _cacheDir = config["Transcode:CacheDir"] ?? "/config/transcode-cache";
    private readonly string _encoderOverride = config["Transcode:Encoder"] ?? "auto";
    private string? _detectedEncoder;

    public string Encoder => _detectedEncoder ?? _encoderOverride;

    // Called once at startup to probe ffmpeg for available hardware encoders.
    public async Task DetectEncoderAsync()
    {
        if (_encoderOverride != "auto")
        {
            _detectedEncoder = _encoderOverride;
            return;
        }

        try
        {
            var result = await RunProcessAsync("ffmpeg", "-encoders -v quiet");
            if (result.Contains("h264_nvenc"))       _detectedEncoder = "h264_nvenc";
            else if (result.Contains("h264_amf"))    _detectedEncoder = "h264_amf";
            else                                      _detectedEncoder = "libx264";

            logger.LogInformation("Transcode encoder selected: {Encoder}", _detectedEncoder);
        }
        catch
        {
            _detectedEncoder = "libx264";
            logger.LogWarning("ffmpeg probe failed — falling back to libx264");
        }
    }

    public string GetHlsSegmentDir(int mediaItemId)
    {
        var dir = Path.Combine(_cacheDir, "hls", mediaItemId.ToString());
        Directory.CreateDirectory(dir);
        return dir;
    }

    public string GetTrickplayDir(int mediaItemId)
    {
        var dir = Path.Combine(_cacheDir, "trickplay", mediaItemId.ToString());
        Directory.CreateDirectory(dir);
        return dir;
    }

    // Extracts one thumbnail every TrickplayIntervalSeconds from the source video.
    // Frames are saved as 1.jpg, 2.jpg, 3.jpg … in the trickplay directory.
    // The frontend uses this to show a seek-bar preview on hover.
    public const int TrickplayIntervalSeconds = 10;
    public const int TrickplayWidth = 160;
    public const int TrickplayHeight = 90;

    public async Task<bool> GenerateTrickplayAsync(int mediaItemId, string filePath, CancellationToken ct)
    {
        var dir = GetTrickplayDir(mediaItemId);

        // Skip if already generated (any .jpg present)
        if (Directory.GetFiles(dir, "*.jpg").Length > 0) return true;

        // fps=1/10 → one frame every 10 s; scale with letterbox padding to keep 16:9
        var filter = $"fps=1/{TrickplayIntervalSeconds}," +
                     $"scale={TrickplayWidth}:{TrickplayHeight}:" +
                     $"force_original_aspect_ratio=decrease," +
                     $"pad={TrickplayWidth}:{TrickplayHeight}:-1:-1:color=black";

        var args = $"-i \"{filePath}\" -vf \"{filter}\" -q:v 3 \"{dir}/%d.jpg\"";

        try
        {
            await RunProcessAsync("ffmpeg", args);
            return Directory.GetFiles(dir, "*.jpg").Length > 0;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Trickplay generation failed for item {Id}", mediaItemId);
            return false;
        }
    }

    private static async Task<string> RunProcessAsync(string exe, string args)
    {
        var psi = new System.Diagnostics.ProcessStartInfo(exe, args)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        using var proc = System.Diagnostics.Process.Start(psi)!;
        var stdout = await proc.StandardOutput.ReadToEndAsync();
        var stderr = await proc.StandardError.ReadToEndAsync();
        await proc.WaitForExitAsync();
        return stdout + stderr;
    }
}
