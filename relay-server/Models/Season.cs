namespace Relay.Server.Models;

public class Season
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SeriesId { get; set; }
    public Series Series { get; set; } = null!;
    public int SeasonNumber { get; set; }
    public string? Title { get; set; }
    public string? ThumbnailPath { get; set; }

    public ICollection<MediaItem> Episodes { get; set; } = [];
}
