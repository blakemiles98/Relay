namespace Relay.Server.Models;

public class WatchProgress
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid MediaItemId { get; set; }
    public MediaItem MediaItem { get; set; } = null!;
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime LastWatched { get; set; } = DateTime.UtcNow;
}
