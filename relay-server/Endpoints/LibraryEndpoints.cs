using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Relay.Server.Data;
using Relay.Server.DTOs.Libraries;
using Relay.Server.Models;
using Relay.Server.Services;

namespace Relay.Server.Endpoints;

public static class LibraryEndpoints
{
    public static void MapLibraryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/libraries").RequireAuthorization();

        // List libraries — admins see all, non-admins see only their granted libraries
        group.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = principal.FindFirst("isAdmin")?.Value == "true";

            IQueryable<Library> query = db.Libraries;

            if (!isAdmin)
                query = query.Where(l => l.UserAccess.Any(a => a.UserId == userId));

            var libraries = await query
                .Select(l => new LibraryDto(
                    l.Id, l.Name, l.Path, l.Type.ToString(),
                    l.CreatedAt, l.LastScanned,
                    l.Type == LibraryType.Shows
                        ? l.Series.Count
                        : l.Type == LibraryType.Mixed
                            ? l.Series.Count + l.MediaItems.Count(m => m.Type == MediaType.Movie)
                            : l.MediaItems.Count,
                    l.MediaItems.Count,
                    l.MetadataProvider.ToString()))
                .ToListAsync();

            return Results.Ok(libraries);
        });

        // Get single library — enforce access
        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var isAdmin = principal.FindFirst("isAdmin")?.Value == "true";

            var l = await db.Libraries.FindAsync(id);
            if (l is null) return Results.NotFound();

            if (!isAdmin && !await db.UserLibraryAccess.AnyAsync(a => a.UserId == userId && a.LibraryId == id))
                return Results.Forbid();

            var logicalCount = l.Type == LibraryType.Shows
                ? await db.Series.CountAsync(s => s.LibraryId == id)
                : l.Type == LibraryType.Mixed
                    ? await db.Series.CountAsync(s => s.LibraryId == id)
                      + await db.MediaItems.CountAsync(m => m.LibraryId == id && m.Type == MediaType.Movie)
                    : await db.MediaItems.CountAsync(m => m.LibraryId == id);
            var totalCount = await db.MediaItems.CountAsync(m => m.LibraryId == id);
            return Results.Ok(new LibraryDto(l.Id, l.Name, l.Path, l.Type.ToString(),
                l.CreatedAt, l.LastScanned, logicalCount, totalCount, l.MetadataProvider.ToString()));
        });

        // Create library (admin only)
        group.MapPost("/", async (CreateLibraryRequest req, ClaimsPrincipal principal, AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            if (!Directory.Exists(req.Path))
                return Results.BadRequest(new { error = $"Path does not exist: {req.Path}" });

            if (!Enum.TryParse<LibraryType>(req.Type, true, out var libType))
                return Results.BadRequest(new { error = $"Invalid type: {req.Type}" });

            Models.MetadataProvider metaProvider;
            if (!string.IsNullOrEmpty(req.MetadataProvider) &&
                Enum.TryParse<Models.MetadataProvider>(req.MetadataProvider, true, out var parsedProvider))
            {
                metaProvider = parsedProvider;
            }
            else
            {
                metaProvider = libType is LibraryType.HomeVideos or LibraryType.Photos
                    ? Models.MetadataProvider.None
                    : Models.MetadataProvider.TMDb;
            }

            var library = new Library { Name = req.Name, Path = req.Path, Type = libType, MetadataProvider = metaProvider };
            db.Libraries.Add(library);
            await db.SaveChangesAsync();

            return Results.Created($"/api/libraries/{library.Id}",
                new LibraryDto(library.Id, library.Name, library.Path,
                    library.Type.ToString(), library.CreatedAt, null, 0, 0, library.MetadataProvider.ToString()));
        });

        // Delete library (admin only)
        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();
            db.Libraries.Remove(library);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Trigger a library scan (admin only)
        group.MapPost("/{id:guid}/scan", async (
            Guid id,
            ClaimsPrincipal principal,
            ILibraryScannerService scanner,
            AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();

            // Fire and forget — scan runs in background
            _ = Task.Run(() => scanner.ScanLibraryAsync(id));
            return Results.Accepted(null, new { message = "Scan started" });
        });

        // Scan all libraries (admin only)
        group.MapPost("/scan-all", async (ClaimsPrincipal principal, ILibraryScannerService scanner) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true")
                return Results.Forbid();

            _ = Task.Run(() => scanner.ScanAllLibrariesAsync());
            return Results.Accepted(null, new { message = "Full scan started" });
        });
    }
}
