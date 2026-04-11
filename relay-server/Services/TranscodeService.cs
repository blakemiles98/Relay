using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Relay.Server.Services;

public enum GpuEncoder { None, Nvenc, Amd }

public interface ITranscodeService
{
    Task<string> GetHlsPlaylistAsync(Guid mediaItemId, string filePath, int? maxHeight = null);
    GpuEncoder DetectedEncoder { get; }
}

public class TranscodeService(ILogger<TranscodeService> logger, IConfiguration config) : ITranscodeService
{
    private GpuEncoder? _detectedEncoder;
    private readonly string _cacheRoot = string.IsNullOrEmpty(config["Transcode:CacheDir"])
        ? Path.Combine(AppContext.BaseDirectory, "relay-transcode")
        : config["Transcode:CacheDir"]!;

    // Tracks in-progress transcodes so concurrent requests don't start a second ffmpeg
    private readonly ConcurrentDictionary<string, Task<string>> _active = new();

    public GpuEncoder DetectedEncoder => _detectedEncoder ??= DetectEncoder();

    // Resolve the ffmpeg executable path.
    // Priority: config override → user-profile install → common paths → rely on PATH.
    private string ResolveFfmpeg()
    {
        var configured = config["Transcode:FfmpegPath"];
        if (!string.IsNullOrEmpty(configured))
            return configured;

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var candidates = new[]
            {
                // Most common user install: the location documented in the project README
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    "ffmpeg", "bin", "ffmpeg.exe"),
                @"C:\ffmpeg\bin\ffmpeg.exe",
                @"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                @"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
            };
            foreach (var c in candidates)
                if (File.Exists(c)) { logger.LogInformation("ffmpeg resolved to: {Path}", c); return c; }
        }

        return "ffmpeg"; // fall through to OS PATH
    }

    private const int MinHeight = 240;
    private const int MaxHeight = 2160;

    public Task<string> GetHlsPlaylistAsync(Guid mediaItemId, string filePath, int? maxHeight = null)
    {
        if (maxHeight.HasValue)
            maxHeight = Math.Clamp(maxHeight.Value, MinHeight, MaxHeight);

        var quality = maxHeight.HasValue ? $"{maxHeight}p" : "original";
        var outputDir = Path.Combine(_cacheRoot, mediaItemId.ToString(), quality);
        var playlistPath = Path.Combine(outputDir, "index.m3u8");

        // Already fully transcoded and cached
        if (File.Exists(playlistPath))
            return Task.FromResult(playlistPath);

        // Join an in-progress transcode or start a new one
        var key = $"{mediaItemId}:{quality}";
        return _active.GetOrAdd(key, _ => RunTranscodeAsync(mediaItemId, filePath, maxHeight, outputDir, playlistPath, key));
    }

    private async Task<string> RunTranscodeAsync(
        Guid mediaItemId, string filePath, int? maxHeight,
        string outputDir, string playlistPath, string cacheKey)
    {
        try
        {
            return await RunTranscodeCoreAsync(mediaItemId, filePath, maxHeight, outputDir, playlistPath, cacheKey);
        }
        catch (Exception ex)
        {
            // Remove from active map so a retry attempt can start a fresh transcode
            _active.TryRemove(cacheKey, out _);
            logger.LogError(ex, "Transcode failed for [{Id}]", mediaItemId);
            throw;
        }
    }

    private async Task<string> RunTranscodeCoreAsync(
        Guid mediaItemId, string filePath, int? maxHeight,
        string outputDir, string playlistPath, string cacheKey)
    {
        Directory.CreateDirectory(outputDir);
        var ffmpeg = ResolveFfmpeg();

        // Try GPU encoder first; if it fails before the first segment, fall back to CPU.
        // This handles cases where NVENC/AMF is present in ffmpeg but fails at runtime
        // (e.g. CUDA not initialised, unsupported source codec, driver mismatch).
        if (DetectedEncoder != GpuEncoder.None)
        {
            try
            {
                return await RunFfmpegAsync(mediaItemId, filePath, maxHeight, outputDir, playlistPath, ffmpeg, DetectedEncoder, cacheKey);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "GPU ({Encoder}) transcode failed for [{Id}] — retrying with CPU (libx264)",
                    DetectedEncoder, mediaItemId);
                // Clean up any partial output so the CPU run starts clean
                try { Directory.Delete(outputDir, true); } catch { /* ignore */ }
                Directory.CreateDirectory(outputDir);
            }
        }

        return await RunFfmpegAsync(mediaItemId, filePath, maxHeight, outputDir, playlistPath, ffmpeg, GpuEncoder.None, cacheKey);
    }

    private async Task<string> RunFfmpegAsync(
        Guid mediaItemId, string filePath, int? maxHeight,
        string outputDir, string playlistPath, string ffmpeg,
        GpuEncoder encoder, string cacheKey)
    {
        var encoderName = encoder switch
        {
            GpuEncoder.Nvenc => "h264_nvenc",
            GpuEncoder.Amd  => "h264_amf",
            _               => "libx264"
        };

        var videoFilter = maxHeight.HasValue ? $"-vf scale=-2:{maxHeight}" : string.Empty;

        var hwArgs = encoder == GpuEncoder.Nvenc
            ? "-hwaccel cuda -hwaccel_output_format cuda"
            : string.Empty;

        // Build args as a list then join — avoids leading spaces from empty hwArgs
        var argParts = new List<string>();
        if (!string.IsNullOrEmpty(hwArgs)) argParts.Add(hwArgs);
        argParts.Add($"-i \"{filePath}\"");
        if (!string.IsNullOrEmpty(videoFilter)) argParts.Add(videoFilter);
        // H.264 encoders (AMF and most libx264 builds) only accept 8-bit input;
        // convert 10-bit sources (e.g. HEVC Main 10) transparently.
        argParts.Add("-pix_fmt yuv420p");
        argParts.Add($"-c:v {encoderName}");
        argParts.Add(encoder switch
        {
            GpuEncoder.Nvenc => "-rc:v vbr -cq:v 24",
            GpuEncoder.Amd   => "-rc cqp -qp_i 22 -qp_p 22 -qp_b 22",
            _                => "-preset veryfast -crf 22",
        });
        argParts.Add("-c:a aac -b:a 128k -ac 2");
        argParts.Add("-hls_time 6");
        argParts.Add("-hls_playlist_type vod");
        argParts.Add($"-hls_segment_filename \"{Path.Combine(outputDir, "seg%03d.ts")}\"");
        argParts.Add($"\"{playlistPath}\"");

        var args = string.Join(" ", argParts);
        logger.LogInformation("Starting transcode [{Id}] encoder={Encoder}", mediaItemId, encoderName);
        logger.LogInformation("ffmpeg command: {Ffmpeg} {Args}", ffmpeg, args);

        var psi = new ProcessStartInfo(ffmpeg, args)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true
        };

        var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start ffmpeg");

        // Drain stderr in background — required to prevent the process blocking on a full pipe buffer
        var stderrTask = process.StandardError.ReadToEndAsync();

        // ── Wait for the playlist file to appear (first few segments ready) ──
        // ffmpeg writes the .m3u8 once it has generated the first segment.
        // We return as soon as it exists; ffmpeg continues transcoding in the background.
        using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
        bool processHandedOff = false;
        try
        {
            while (!File.Exists(playlistPath))
            {
                if (process.HasExited)
                {
                    var err = await stderrTask;
                    var exitCode = process.ExitCode;
                    throw new InvalidOperationException(
                        $"ffmpeg [{encoderName}] exited (code {exitCode}) before creating playlist.\nStderr: {err}");
                }

                await Task.Delay(250, cts.Token);
            }

            processHandedOff = true; // success — background continuation will own disposal
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch { /* ignore */ }
            process.Dispose();
            throw new TimeoutException($"Transcode timed out waiting for first segment [{mediaItemId}]");
        }
        catch
        {
            process.Dispose();
            throw;
        }

        if (!processHandedOff) return playlistPath; // unreachable, satisfies compiler

        // Hand off background completion — log result, remove from active map when done
        _ = process.WaitForExitAsync().ContinueWith(async _ =>
        {
            var err = await stderrTask;
            if (process.ExitCode != 0)
                logger.LogError("Transcode failed [{Id}] code={Code}: {Err}", mediaItemId, process.ExitCode, err);
            else
                logger.LogInformation("Transcode complete [{Id}]", mediaItemId);

            _active.TryRemove(cacheKey, out var _removed);
            process.Dispose();
        }, TaskScheduler.Default);

        return playlistPath;
    }

    private GpuEncoder DetectEncoder()
    {
        var overrideEncoder = config["Transcode:Encoder"]?.ToLowerInvariant();
        if (overrideEncoder == "nvenc") return GpuEncoder.Nvenc;
        if (overrideEncoder is "amd" or "amf") return GpuEncoder.Amd;
        if (overrideEncoder == "cpu") return GpuEncoder.None;

        try
        {
            var psi = new ProcessStartInfo(ResolveFfmpeg(), "-encoders -v quiet")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi)!;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit();

            if (output.Contains("h264_nvenc")) { logger.LogInformation("GPU encoder: NVENC"); return GpuEncoder.Nvenc; }
            if (output.Contains("h264_amf"))  { logger.LogInformation("GPU encoder: AMF");   return GpuEncoder.Amd; }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not detect GPU encoder, falling back to CPU");
        }

        logger.LogInformation("GPU encoder: none, using libx264");
        return GpuEncoder.None;
    }
}
