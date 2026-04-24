namespace RelayServer.Domain;

public enum MediaType
{
    Movie,
    Episode,
    HomeVideo,
    Photo
}

public class Series
{
    public int Id { get; set; }
    public int LibraryId { get; set; }
    public Library Library { get; set; } = null!;

    public string Title { get; set; } = "";
    public string? SortTitle { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public double? ImdbScore { get; set; }
    public int? RottenTomatoesScore { get; set; }
    public string[]? Genres { get; set; }
    public int? Year { get; set; }
    public DateTime? MetadataRefreshedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Season> Seasons { get; set; } = [];
}

public class Season
{
    public int Id { get; set; }
    public int SeriesId { get; set; }
    public Series Series { get; set; } = null!;

    public int SeasonNumber { get; set; }
    public string? Title { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public int? Year { get; set; }

    public ICollection<MediaItem> Episodes { get; set; } = [];
}

public class MediaItem
{
    public int Id { get; set; }
    public int LibraryId { get; set; }
    public Library Library { get; set; } = null!;
    public int? SeasonId { get; set; }
    public Season? Season { get; set; }

    public MediaType Type { get; set; }
    public string Title { get; set; } = "";
    public string? SortTitle { get; set; }
    public string FilePath { get; set; } = "";
    public string? FolderPath { get; set; }
    public long FileSizeBytes { get; set; }
    public int? DurationSeconds { get; set; }
    public int? EpisodeNumber { get; set; }

    // Metadata (movies + episodes)
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public double? ImdbScore { get; set; }
    public int? RottenTomatoesScore { get; set; }
    public string[]? Genres { get; set; }
    public string[]? Cast { get; set; }
    public int? Year { get; set; }
    public DateTime? AiredAt { get; set; }
    public DateTime? MetadataRefreshedAt { get; set; }

    // Transcode state
    public bool TrickplayGenerated { get; set; }
    public bool KeyframesExtracted { get; set; }
    public bool WhisperQueued { get; set; }
    public bool WhisperCompleted { get; set; }

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WatchProgress> WatchProgress { get; set; } = [];
    public ICollection<WatchlistItem> WatchlistItems { get; set; } = [];
    public ICollection<SubtitleTrack> Subtitles { get; set; } = [];
    public ICollection<AudioTrackInfo> AudioTracks { get; set; } = [];
}

public class SubtitleTrack
{
    public int Id { get; set; }
    public int MediaItemId { get; set; }
    public MediaItem MediaItem { get; set; } = null!;

    public string Language { get; set; } = "eng";
    public string Label { get; set; } = "";
    public string FilePath { get; set; } = "";
    public bool IsExternal { get; set; } = true;
    public int? StreamIndex { get; set; }
}

public class AudioTrackInfo
{
    public int Id { get; set; }
    public int MediaItemId { get; set; }
    public MediaItem MediaItem { get; set; } = null!;

    public int StreamIndex { get; set; }
    public string Language { get; set; } = "und";
    public string Label { get; set; } = "";
    public string Codec { get; set; } = "";
    public int Channels { get; set; }
}
