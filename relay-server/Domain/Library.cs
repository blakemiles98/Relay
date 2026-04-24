namespace RelayServer.Domain;

public enum LibraryType
{
    Movies,
    TvShows,
    Mixed,
    HomeMedia
}

public class Library
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public LibraryType Type { get; set; }
    public string RootPath { get; set; } = "";
    public bool MetadataEnabled { get; set; } = true;
    public int MetadataRefreshIntervalHours { get; set; } = 24;
    public bool WhisperEnabled { get; set; }
    public DateTime? LastScannedAt { get; set; }
    public DateTime? LastMetadataRefreshAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<MediaItem> Items { get; set; } = [];
    public ICollection<Series> Series { get; set; } = [];
    public ICollection<UserLibraryAccess> UserAccess { get; set; } = [];
}

public class UserLibraryAccess
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int LibraryId { get; set; }
    public Library Library { get; set; } = null!;
}
