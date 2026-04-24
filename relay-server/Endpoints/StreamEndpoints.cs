using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class StreamEndpoints
{
    public static void MapStreamEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/stream").RequireAuthorization();

        // Direct play — streams the raw file with range request support.
        // The browser checks if it can play the codec natively; if so it hits this endpoint.
        // Range requests are what allow seeking without downloading the whole file.
        group.MapGet("/direct/{id:int}", async (int id, RelayDbContext db, AuthService auth, ClaimsPrincipal principal, HttpContext ctx) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath)) return Results.NotFound();

            var ext = Path.GetExtension(item.FilePath).TrimStart('.').ToLower();
            var mime = ext switch
            {
                "mp4" => "video/mp4",
                "mkv" => "video/x-matroska",
                "mov" => "video/quicktime",
                "avi" => "video/x-msvideo",
                "webm" => "video/webm",
                _ => "application/octet-stream"
            };

            return Results.File(item.FilePath, mime, enableRangeProcessing: true);
        });

        // HLS transcode — tells ffmpeg to split the video into small .ts segments
        // and returns a .m3u8 playlist. HLS.js on the frontend reads the playlist
        // and fetches segments as the user watches.
        group.MapGet("/hls/{id:int}/master.m3u8", async (int id, RelayDbContext db, AuthService auth, TranscodeService transcode, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath)) return Results.NotFound();

            var segDir = transcode.GetHlsSegmentDir(id);
            var playlistPath = Path.Combine(segDir, "master.m3u8");

            if (!File.Exists(playlistPath))
                await StartHlsTranscodeAsync(item.FilePath, segDir, transcode.Encoder);

            // Wait up to 10s for the playlist to appear (ffmpeg takes a moment to write first segments)
            for (var i = 0; i < 20 && !File.Exists(playlistPath); i++)
                await Task.Delay(500);

            if (!File.Exists(playlistPath))
                return Results.Problem("Transcode failed to start.");

            return Results.File(playlistPath, "application/vnd.apple.mpegurl");
        });

        // Serve individual HLS segments (.ts files)
        group.MapGet("/hls/{id:int}/{segment}", async (int id, string segment, TranscodeService transcode, ClaimsPrincipal principal) =>
        {
            if (!principal.Identity?.IsAuthenticated ?? false) return Results.Unauthorized();
            var segDir = transcode.GetHlsSegmentDir(id);
            var segPath = Path.Combine(segDir, segment);
            if (!File.Exists(segPath)) return Results.NotFound();
            return Results.File(segPath, "video/MP2T");
        });

        // Serve trickplay sprite images for seek bar previews
        group.MapGet("/trickplay/{id:int}/{file}", (int id, string file, TranscodeService transcode) =>
        {
            var dir = transcode.GetTrickplayDir(id);
            var path = Path.Combine(dir, file);
            if (!File.Exists(path)) return Results.NotFound();
            return Results.File(path, "image/jpeg");
        });

        // Serve photo files
        group.MapGet("/photo/{id:int}", async (int id, RelayDbContext db, AuthService auth, ClaimsPrincipal principal) =>
        {
            var user = await auth.GetUserFromClaimsAsync(principal);
            if (user is null) return Results.Unauthorized();

            var item = await db.MediaItems.FindAsync(id);
            if (item is null || !File.Exists(item.FilePath)) return Results.NotFound();

            var ext = Path.GetExtension(item.FilePath).TrimStart('.').ToLower();
            var mime = ext switch
            {
                "jpg" or "jpeg" => "image/jpeg",
                "png" => "image/png",
                "webp" => "image/webp",
                "gif" => "image/gif",
                _ => "application/octet-stream"
            };

            return Results.File(item.FilePath, mime);
        });
    }

    private static async Task StartHlsTranscodeAsync(string inputPath, string outputDir, string encoder)
    {
        Directory.CreateDirectory(outputDir);
        var playlist = Path.Combine(outputDir, "master.m3u8");
        var segment = Path.Combine(outputDir, "seg%05d.ts");

        var args = $"-i \"{inputPath}\" " +
                   $"-c:v {encoder} -preset fast -crf 22 " +
                   $"-c:a aac -b:a 192k " +
                   $"-f hls -hls_time 6 -hls_list_size 0 " +
                   $"-hls_segment_filename \"{segment}\" " +
                   $"\"{playlist}\"";

        var psi = new System.Diagnostics.ProcessStartInfo("ffmpeg", args)
        {
            UseShellExecute = false,
            RedirectStandardError = true
        };
        System.Diagnostics.Process.Start(psi); // fire-and-forget; ffmpeg writes segments to disk
    }
}
