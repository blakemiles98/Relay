namespace Relay.Server.Models;

public class MediaItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LibraryId { get; set; }
    public Library Library { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public MediaType Type { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string? ThumbnailPath { get; set; }

    // Video/Audio metadata (populated by ffprobe)
    public double? DurationSeconds { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public string? Container { get; set; }
    public long FileSizeBytes { get; set; }

    // General metadata
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public DateTime DateAdded { get; set; } = DateTime.UtcNow;
    public string? ExternalId { get; set; }
    public string? ExternalSource { get; set; }

    // TV episode links
    public Guid? SeriesId { get; set; }
    public Series? Series { get; set; }
    public Guid? SeasonId { get; set; }
    public Season? Season { get; set; }
    public int? EpisodeNumber { get; set; }

    public ICollection<WatchProgress> WatchProgress { get; set; } = [];
}
