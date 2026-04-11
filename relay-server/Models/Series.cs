namespace Relay.Server.Models;

public class Series
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LibraryId { get; set; }
    public Library Library { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public string? ThumbnailPath { get; set; }
    public int? Year { get; set; }
    public string FolderPath { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? ExternalSource { get; set; }

    public ICollection<Season> Seasons { get; set; } = [];
}
