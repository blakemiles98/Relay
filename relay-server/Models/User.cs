namespace Relay.Server.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public bool IsAdmin { get; set; }
    public string AvatarColor { get; set; } = "#6366f1";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WatchProgress> WatchProgress { get; set; } = [];
    public ICollection<UserLibraryAccess> LibraryAccess { get; set; } = [];
}
