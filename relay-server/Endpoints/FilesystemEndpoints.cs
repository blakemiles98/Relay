using System.Runtime.InteropServices;
using System.Security.Claims;

namespace Relay.Server.Endpoints;

public static class FilesystemEndpoints
{
    public static void MapFilesystemEndpoints(this IEndpointRouteBuilder app)
    {
        // Browse directories on the server filesystem (admin only).
        // Always returns full absolute paths in Directories so the client
        // never needs to construct a path itself.
        // GET /api/fs/browse        → Windows: drive list, Linux: /
        // GET /api/fs/browse?path=C:\Users  → subdirs of that path
        app.MapGet("/api/fs/browse", (string? path, ClaimsPrincipal principal) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            // No path supplied → root
            if (string.IsNullOrWhiteSpace(path))
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    var drives = DriveInfo.GetDrives()
                        .Where(d => d.IsReady)
                        .Select(d => d.RootDirectory.FullName.TrimEnd('\\')) // "C:", "D:", …
                        .ToList();
                    // No parent at the virtual root, no current path
                    return Results.Ok(new BrowseResult(string.Empty, null, drives));
                }
                path = "/";
            }

            // On Windows a bare "C:" needs a trailing slash to be a valid dir
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                && path.Length == 2 && path[1] == ':')
            {
                path = path + "\\";
            }

            path = Path.GetFullPath(path);

            if (!Directory.Exists(path))
                return Results.BadRequest(new { error = $"Path does not exist: {path}" });

            List<string> dirs;
            try
            {
                dirs = Directory.GetDirectories(path)           // full paths
                    .Where(d => !Path.GetFileName(d).StartsWith('.'))
                    .OrderBy(d => Path.GetFileName(d), StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            catch (UnauthorizedAccessException)
            {
                dirs = [];
            }

            // Parent: null when we're at a drive root (Windows) or filesystem root (Linux)
            string? parent;
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var info = new DirectoryInfo(path);
                parent = info.Parent?.FullName; // null at drive root
            }
            else
            {
                parent = path == "/" ? null : Path.GetDirectoryName(path);
            }

            return Results.Ok(new BrowseResult(path, parent, dirs));
        }).RequireAuthorization();
    }
}

// Directories contains full absolute paths
public record BrowseResult(string Path, string? Parent, List<string> Directories);
