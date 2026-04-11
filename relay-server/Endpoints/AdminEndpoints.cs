using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Relay.Server.Data;
using Relay.Server.Services;

namespace Relay.Server.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").RequireAuthorization();

        group.MapGet("/tasks", (IScheduledTaskService tasks, ClaimsPrincipal principal) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true") return Results.Forbid();
            return Results.Ok(tasks.GetStatuses());
        });

        group.MapPost("/tasks/{type}/run", async (
            string type,
            IScheduledTaskService tasks,
            ClaimsPrincipal principal) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true") return Results.Forbid();
            if (!Enum.TryParse<TaskType>(type, true, out var taskType))
                return Results.BadRequest(new { error = $"Unknown task: {type}" });
            await tasks.TriggerAsync(taskType);
            return Results.Accepted(null, new { message = $"{type} triggered" });
        });

        group.MapGet("/stats", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true") return Results.Forbid();
            var stats = new
            {
                libraries = await db.Libraries.CountAsync(),
                series = await db.Series.CountAsync(),
                movies = await db.MediaItems.CountAsync(m => m.Type == Models.MediaType.Movie),
                episodes = await db.MediaItems.CountAsync(m => m.Type == Models.MediaType.Episode),
                users = await db.Users.CountAsync(),
            };
            return Results.Ok(stats);
        });

        group.MapPut("/libraries/{id:guid}/metadata-provider", async (
            Guid id,
            UpdateMetadataProviderRequest req,
            ClaimsPrincipal principal,
            AppDbContext db) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true") return Results.Forbid();
            var library = await db.Libraries.FindAsync(id);
            if (library is null) return Results.NotFound();
            if (!Enum.TryParse<Models.MetadataProvider>(req.Provider, true, out var provider))
                return Results.BadRequest(new { error = $"Unknown provider: {req.Provider}" });
            library.MetadataProvider = provider;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapPost("/metadata/refresh/{type}/{id:guid}", async (
            string type,
            Guid id,
            ClaimsPrincipal principal,
            AppDbContext db,
            IMetadataService metaSvc) =>
        {
            if (principal.FindFirst("isAdmin")?.Value != "true") return Results.Forbid();
            var thumbnailRoot = Path.Combine(AppContext.BaseDirectory, "thumbnails");

            if (type == "series")
            {
                var series = await db.Series.Include(s => s.Library).FirstOrDefaultAsync(s => s.Id == id);
                if (series is null) return Results.NotFound();
                var result = await metaSvc.SearchSeriesAsync(series.Title, series.Year, series.Library.MetadataProvider);
                if (result is null) return Results.Ok(new { message = "No results found" });
                series.ExternalId = result.ExternalId;
                series.ExternalSource = result.Source;
                series.Overview = result.Overview;
                series.Year = result.Year;
                if (result.PosterUrl is not null)
                {
                    var imgBytes = await metaSvc.FetchImageAsync(result.PosterUrl);
                    if (imgBytes is not null)
                    {
                        var imgPath = Path.Combine(thumbnailRoot, "series", $"{series.Id}.jpg");
                        Directory.CreateDirectory(Path.GetDirectoryName(imgPath)!);
                        await File.WriteAllBytesAsync(imgPath, imgBytes);
                        series.ThumbnailPath = imgPath;
                    }
                }
                await db.SaveChangesAsync();
                return Results.Ok(new { message = "Metadata refreshed", title = result.Title });
            }
            else if (type == "movie")
            {
                var movie = await db.MediaItems.Include(m => m.Library).FirstOrDefaultAsync(m => m.Id == id);
                if (movie is null) return Results.NotFound();
                var result = await metaSvc.SearchMovieAsync(movie.Title, movie.Year);
                if (result is null) return Results.Ok(new { message = "No results found" });
                movie.ExternalId = result.ExternalId;
                movie.ExternalSource = result.Source;
                movie.Overview = result.Overview;
                movie.Year = result.Year;
                if (result.PosterUrl is not null)
                {
                    var imgBytes = await metaSvc.FetchImageAsync(result.PosterUrl);
                    if (imgBytes is not null)
                    {
                        var imgPath = Path.Combine(thumbnailRoot, "movies", $"{movie.Id}.jpg");
                        Directory.CreateDirectory(Path.GetDirectoryName(imgPath)!);
                        await File.WriteAllBytesAsync(imgPath, imgBytes);
                        movie.ThumbnailPath = imgPath;
                    }
                }
                await db.SaveChangesAsync();
                return Results.Ok(new { message = "Metadata refreshed", title = result.Title });
            }

            return Results.BadRequest(new { error = "type must be 'series' or 'movie'" });
        });
    }
}

public record UpdateMetadataProviderRequest(string Provider);
