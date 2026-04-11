using Relay.Server.Data;
using Relay.Server.DTOs.Setup;
using Relay.Server.Models;
using Relay.Server.Services;

namespace Relay.Server.Endpoints;

public static class SetupEndpoints
{
    public static void MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/setup");

        // Returns whether first-run setup is needed
        group.MapGet("/status", async (IAuthService auth) =>
        {
            var complete = await auth.IsSetupCompleteAsync();
            return Results.Ok(new { IsComplete = complete });
        });

        // First-run setup: creates admin + initial libraries
        group.MapPost("/", async (SetupRequest req, IAuthService auth, AppDbContext db) =>
        {
            if (await auth.IsSetupCompleteAsync())
                return Results.Conflict(new { error = "Setup already complete" });

            // Create admin user
            var admin = await auth.CreateUserAsync(
                req.AdminUsername, req.AdminPassword, req.AvatarColor, isAdmin: true);

            await db.SaveChangesAsync();

            return Results.Ok(new { message = "Setup complete", adminId = admin.Id });
        });
    }
}
