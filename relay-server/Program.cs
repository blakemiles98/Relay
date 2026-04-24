using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RelayServer.Data;
using RelayServer.Endpoints;
using RelayServer.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────────────
// Dev override: use a local file so you don't need Docker running while coding
var connStr = builder.Environment.IsDevelopment()
    ? "Data Source=relay-dev.db"
    : builder.Configuration.GetConnectionString("Default")!;

builder.Services.AddDbContext<RelayDbContext>(opt => opt.UseSqlite(connStr));

// ── JWT Auth ──────────────────────────────────────────────────────────────────
// The JWT middleware reads this config and validates tokens on every request.
// It checks: signature valid? not expired? correct issuer/audience?
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwtKey,
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
        // Also read the token from the relay_cookie cookie (not just Authorization header)
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue("relay_cookie", out var token))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Serialize/deserialize enums as their string names instead of integers.
// This lets the frontend send "Movies" instead of 0, and receive "Movies" back.
builder.Services.ConfigureHttpJsonOptions(opt =>
    opt.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// ── CORS ──────────────────────────────────────────────────────────────────────
// During dev the frontend runs on localhost:3000, so we allow that origin.
// In production the Next.js container is served from the same host, so CORS
// is less critical — but we keep it explicit.
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.WithOrigins(
        "http://localhost:3000",
        builder.Configuration["FrontendUrl"] ?? "http://localhost:3000"
    )
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
));

// ── App Services ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<TranscodeService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<LibraryScannerService>();
builder.Services.AddScoped<MetadataService>();
builder.Services.AddScoped<TaskRunnerService>();
builder.Services.AddScoped<DiscordService>();
builder.Services.AddScoped<WhisperService>();
builder.Services.AddHttpClient();

// ── Build ─────────────────────────────────────────────────────────────────────
var app = builder.Build();

// Auto-migrate on startup — same as calling `dotnet ef database update` but
// happens automatically when the container starts.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<RelayDbContext>();
    db.Database.Migrate();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ── Route registration ────────────────────────────────────────────────────────
// Each Endpoints file maps its own routes. This keeps Program.cs clean.
app.MapSetupEndpoints();
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapLibraryEndpoints();
app.MapMediaEndpoints();
app.MapStreamEndpoints();
app.MapTaskEndpoints();
app.MapSettingsEndpoints();
app.MapFsEndpoints();

app.Run();
