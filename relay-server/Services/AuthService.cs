using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Relay.Server.Data;
using Relay.Server.Models;

namespace Relay.Server.Services;

public interface IAuthService
{
    Task<string?> LoginAsync(string username, string? password);
    Task<User> CreateUserAsync(string username, string? password, string avatarColor, bool isAdmin, List<Guid>? libraryIds = null);
    Task SetLibraryAccessAsync(Guid userId, List<Guid> libraryIds);
    Task<bool> IsSetupCompleteAsync();
}

public class AuthService(AppDbContext db, IConfiguration config, ILogger<AuthService> logger) : IAuthService
{
    public async Task<bool> IsSetupCompleteAsync()
        => await db.Users.AnyAsync(u => u.IsAdmin);

    public async Task<string?> LoginAsync(string username, string? password)
    {
        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == username.ToLower());

        if (user is null)
        {
            logger.LogWarning("Failed login: unknown username '{Username}'", username);
            return null;
        }

        // If the user has no password set, allow login without one
        if (user.PasswordHash is not null)
        {
            if (string.IsNullOrEmpty(password))
            {
                logger.LogWarning("Failed login: no password provided for '{Username}'", username);
                return null;
            }
            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            {
                logger.LogWarning("Failed login: wrong password for '{Username}'", username);
                return null;
            }
        }

        logger.LogInformation("Successful login for '{Username}'", username);
        return GenerateToken(user);
    }

    public async Task<User> CreateUserAsync(string username, string? password, string avatarColor, bool isAdmin, List<Guid>? libraryIds = null)
    {
        var user = new User
        {
            Username = username,
            PasswordHash = string.IsNullOrEmpty(password) ? null : BCrypt.Net.BCrypt.HashPassword(password),
            AvatarColor = avatarColor,
            IsAdmin = isAdmin
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        if (!isAdmin && libraryIds is { Count: > 0 })
            await SetLibraryAccessAsync(user.Id, libraryIds);

        return user;
    }

    public async Task SetLibraryAccessAsync(Guid userId, List<Guid> libraryIds)
    {
        var existing = await db.UserLibraryAccess
            .Where(a => a.UserId == userId)
            .ToListAsync();

        db.UserLibraryAccess.RemoveRange(existing);

        foreach (var libId in libraryIds.Distinct())
            db.UserLibraryAccess.Add(new Models.UserLibraryAccess { UserId = userId, LibraryId = libId });

        await db.SaveChangesAsync();
    }

    private string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret not configured")));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("isAdmin", user.IsAdmin.ToString().ToLower())
        };

        var token = new JwtSecurityToken(
            issuer: "relay",
            audience: "relay",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
