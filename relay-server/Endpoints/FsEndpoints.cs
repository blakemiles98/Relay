using System.Security.Claims;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class FsEndpoints
{
    public static void MapFsEndpoints(this WebApplication app)
    {
        // Admin-only filesystem browser — used by the "Add Library" dialog
        var group = app.MapGroup("/api/fs").RequireAuthorization();

        // Returns the child directories of a given path.
        // Called with no path → returns drive roots (Windows) or top-level dirs (Linux/macOS).
        group.MapGet("/browse", (string? path, AuthService auth, ClaimsPrincipal principal) =>
        {
            var isAdmin = principal.FindFirstValue("isAdmin") == "true";
            if (!isAdmin) return Results.Forbid();

            try
            {
                if (string.IsNullOrWhiteSpace(path))
                {
                    // Root level: return drive letters on Windows, or / subdirs on Unix
                    if (OperatingSystem.IsWindows())
                    {
                        var drives = DriveInfo.GetDrives()
                            .Where(d => d.IsReady)
                            .Select(d => new DirEntry(d.RootDirectory.FullName, d.Name.TrimEnd('\\'), d.VolumeLabel))
                            .ToList();
                        return Results.Ok(new BrowseResult(null, drives));
                    }
                    else
                    {
                        path = "/";
                    }
                }

                var dir = new DirectoryInfo(path);
                if (!dir.Exists) return Results.NotFound();

                var parent = dir.Parent?.FullName;

                var children = dir.GetDirectories()
                    .Where(d => !d.Attributes.HasFlag(FileAttributes.Hidden) &&
                                !d.Attributes.HasFlag(FileAttributes.System))
                    .OrderBy(d => d.Name)
                    .Select(d => new DirEntry(d.FullName, d.Name, null))
                    .ToList();

                return Results.Ok(new BrowseResult(parent, children));
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Forbid();
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message);
            }
        });
    }

    record DirEntry(string FullPath, string Name, string? Label);
    record BrowseResult(string? Parent, List<DirEntry> Dirs);
}
