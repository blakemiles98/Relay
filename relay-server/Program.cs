using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Relay.Server.Data;
using Relay.Server.Endpoints;
using Relay.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────────────────
var dbPath = Path.Combine(AppContext.BaseDirectory, "relay.db");
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite($"Data Source={dbPath}"));

// ── Auth ──────────────────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret must be set in appsettings.json");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "relay",
            ValidAudience = "relay",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        // Read token from httpOnly cookie set at login.
        // The ?token= query string approach is no longer used — all API calls
        // (including HLS segments) are proxied through Next.js as same-origin
        // requests, so the cookie is sent automatically.
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue("relay_token", out var cookie))
                    ctx.Token = cookie;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IFfprobeService, FfprobeService>();
builder.Services.AddSingleton<ITranscodeService, TranscodeService>();
builder.Services.AddScoped<ILibraryScannerService, LibraryScannerService>();
builder.Services.AddScoped<IMetadataService, MetadataService>();
builder.Services.AddSingleton<ScheduledTaskService>();
builder.Services.AddSingleton<IScheduledTaskService>(sp => sp.GetRequiredService<ScheduledTaskService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<ScheduledTaskService>());

// ── HTTP Clients ──────────────────────────────────────────────────────────────
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("tmdb", c =>
    c.BaseAddress = new Uri("https://api.themoviedb.org"));
builder.Services.AddHttpClient("anilist", c =>
    c.BaseAddress = new Uri("https://graphql.anilist.co"));

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(
                "http://localhost:3000",   // Next.js dev
                "http://localhost:3001"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

var app = builder.Build();

// ── Migrate DB on startup ─────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ── Security headers ──────────────────────────────────────────────────────────
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

// ── Endpoints ─────────────────────────────────────────────────────────────────
app.MapSetupEndpoints();
app.MapAuthEndpoints();
app.MapLibraryEndpoints();
app.MapMediaEndpoints();
app.MapStreamEndpoints();
app.MapFilesystemEndpoints();
app.MapAdminEndpoints();

// Health check
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", version = "1.0.0" }));

app.Run();
