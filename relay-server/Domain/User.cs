namespace RelayServer.Domain;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? PasswordHash { get; set; }
    public string? AvatarPath { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsHidden { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserSettings Settings { get; set; } = new();
    public ICollection<WatchProgress> WatchProgress { get; set; } = [];
    public ICollection<WatchlistItem> Watchlist { get; set; } = [];
    public ICollection<UserLibraryAccess> LibraryAccess { get; set; } = [];
}

public class UserSettings
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string DefaultSubtitleLanguage { get; set; } = "eng";
    public string DefaultAudioLanguage { get; set; } = "eng";
    public string PlaybackQuality { get; set; } = "auto"; // auto, 1080p, 4k
}
