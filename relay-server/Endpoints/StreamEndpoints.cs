using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Relay.Server.Data;
using Relay.Server.Services;

namespace Relay.Server.Endpoints;

public static class StreamEndpoints
{
    public static void MapStreamEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/stream").RequireAuthorization();

        // Direct play — HTTP range requests for seeking without transcoding
        group.MapGet("/direct/{id:guid}", async (
            Guid id,
            HttpContext ctx,
            AppDbContext db) =>
        {
            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath))
                return Results.NotFound();

            var mimeType = GetMimeType(item.FilePath);
            return Results.Stream(File.OpenRead(item.FilePath), mimeType, enableRangeProcessing: true);
        });

        // HLS transcode — triggers transcode if not cached and returns the playlist.
        // Auth is via the httpOnly cookie sent automatically with same-origin requests
        // (all requests are proxied through Next.js). No token rewriting needed.
        group.MapGet("/hls/{id:guid}/index.m3u8", async (
            Guid id,
            int? maxHeight,
            HttpContext ctx,
            AppDbContext db,
            ITranscodeService transcode) =>
        {
            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath))
                return Results.NotFound();

            try
            {
                var playlistPath = await transcode.GetHlsPlaylistAsync(item.Id, item.FilePath, maxHeight);
                var content = await File.ReadAllTextAsync(playlistPath);
                return Results.Content(content, "application/vnd.apple.mpegurl");
            }
            catch (Exception ex)
            {
                // Log internally but don't expose exception details to the client
                var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("StreamEndpoints");
                logger.LogError(ex, "Transcode failed for media item {Id}", id);
                return Results.Problem("Transcode failed. Check server logs for details.");
            }
        });

        // Serve HLS segments
        group.MapGet("/hls/{id:guid}/{segment}", (
            Guid id,
            string segment,
            IConfiguration config) =>
        {
            // Reject any segment name that isn't a plain seg###.ts filename.
            // This prevents path traversal via crafted segment names like "../../etc/passwd".
            if (!System.Text.RegularExpressions.Regex.IsMatch(segment, @"^seg\d+\.ts$"))
                return Results.BadRequest();

            var cacheRoot = config["Transcode:CacheDir"];
            if (string.IsNullOrEmpty(cacheRoot))
                cacheRoot = Path.Combine(AppContext.BaseDirectory, "relay-transcode");

            // Segment filenames are like seg000.ts or from a quality subfolder
            var segPath = Path.Combine(cacheRoot, id.ToString(), "original", segment);
            if (!File.Exists(segPath))
            {
                // Try quality subdirs (e.g. 720p, 1080p)
                var itemDir = Path.Combine(cacheRoot, id.ToString());
                if (Directory.Exists(itemDir))
                {
                    foreach (var dir in Directory.GetDirectories(itemDir))
                    {
                        var candidate = Path.Combine(dir, segment);
                        if (File.Exists(candidate)) { segPath = candidate; break; }
                    }
                }
            }

            if (!File.Exists(segPath)) return Results.NotFound();
            // Results.File treats the path as virtual (wwwroot-relative) and fails for temp-dir paths.
            // Stream the file directly so there's no dependency on the file provider.
            return Results.Stream(File.OpenRead(segPath), "video/mp2t");
        });

        // Serve photos directly
        group.MapGet("/photo/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath))
                return Results.NotFound();

            var mime = GetImageMimeType(item.FilePath);
            return Results.Stream(File.OpenRead(item.FilePath), mime);
        });

        // Encoder info (for settings page)
        group.MapGet("/encoder-info", (ITranscodeService transcode) =>
            Results.Ok(new { encoder = transcode.DetectedEncoder.ToString() }));
    }

    private static string GetMimeType(string path) =>
        Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".mp4" or ".m4v" => "video/mp4",
            ".mkv" => "video/x-matroska",
            ".webm" => "video/webm",
            ".avi" => "video/x-msvideo",
            ".mov" => "video/quicktime",
            ".ts" or ".m2ts" => "video/mp2t",
            _ => "video/octet-stream"
        };

    private static string GetImageMimeType(string path) =>
        Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            _ => "image/octet-stream"
        };
}
