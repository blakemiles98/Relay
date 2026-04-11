namespace Relay.Server.Models;

public class Library
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public LibraryType Type { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastScanned { get; set; }

    public MetadataProvider MetadataProvider { get; set; } = MetadataProvider.TMDb;

    public ICollection<MediaItem> MediaItems { get; set; } = [];
    public ICollection<Series> Series { get; set; } = [];
    public ICollection<UserLibraryAccess> UserAccess { get; set; } = [];
}
