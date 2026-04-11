namespace Relay.Server.DTOs.Media;

public record MediaItemDto(
    Guid Id,
    Guid LibraryId,
    string Title,
    string Type,
    string? ThumbnailUrl,
    double? DurationSeconds,
    int? Width,
    int? Height,
    string? VideoCodec,
    string? AudioCodec,
    long FileSizeBytes,
    int? Year,
    string? Overview,
    DateTime DateAdded,
    // Episode-specific
    Guid? SeriesId,
    Guid? SeasonId,
    int? EpisodeNumber,
    // Watch progress (per-user, optional)
    double? WatchPositionSeconds,
    bool? IsCompleted,
    // External metadata
    string? ExternalId,
    string? ExternalSource,
    // File info
    string FilePath
);

public record SeriesDto(
    Guid Id,
    Guid LibraryId,
    string Title,
    string? Overview,
    string? ThumbnailUrl,
    int? Year,
    int SeasonCount,
    int EpisodeCount
);

public record SeasonDto(
    Guid Id,
    Guid SeriesId,
    int SeasonNumber,
    string? Title,
    string? ThumbnailUrl,
    int EpisodeCount
);
