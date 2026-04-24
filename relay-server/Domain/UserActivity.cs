namespace RelayServer.Domain;

public class WatchProgress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int MediaItemId { get; set; }
    public MediaItem MediaItem { get; set; } = null!;

    public int PositionSeconds { get; set; }
    public bool IsCompleted { get; set; }
    public string? LastAudioLanguage { get; set; }
    public string? LastSubtitleLanguage { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class WatchlistItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int MediaItemId { get; set; }
    public MediaItem MediaItem { get; set; } = null!;
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
