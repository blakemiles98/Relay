using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Services;

namespace RelayServer.Endpoints;

public static class TaskEndpoints
{
    public static void MapTaskEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tasks").RequireAuthorization();

        group.MapGet("/", async (RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var tasks = await db.ScheduledTasks
                .OrderBy(t => t.Category).ThenBy(t => t.Name)
                .ToListAsync();
            return Results.Ok(tasks);
        });

        group.MapPut("/{id:int}", async (int id, UpdateTaskRequest req, RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var task = await db.ScheduledTasks.FindAsync(id);
            if (task is null) return Results.NotFound();
            if (req.IsEnabled.HasValue) task.IsEnabled = req.IsEnabled.Value;
            if (req.CronSchedule is not null) task.CronSchedule = req.CronSchedule;
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        group.MapPost("/{id:int}/run", async (int id, RelayDbContext db, TaskRunnerService runner, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var task = await db.ScheduledTasks.FindAsync(id);
            if (task is null) return Results.NotFound();
            _ = Task.Run(() => runner.RunTaskAsync(task.Key));
            return Results.Accepted();
        });

        group.MapGet("/{id:int}/runs", async (int id, RelayDbContext db, ClaimsPrincipal user) =>
        {
            if (!IsAdmin(user)) return Results.Forbid();
            var runs = await db.TaskRuns
                .Where(r => r.ScheduledTaskId == id)
                .OrderByDescending(r => r.StartedAt)
                .Take(50)
                .ToListAsync();
            return Results.Ok(runs);
        });
    }

    private static bool IsAdmin(ClaimsPrincipal user) =>
        user.FindFirstValue("isAdmin") == "true";
}

record UpdateTaskRequest(bool? IsEnabled, string? CronSchedule);
