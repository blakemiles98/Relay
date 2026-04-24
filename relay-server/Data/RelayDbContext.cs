using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using RelayServer.Domain;
using TaskStatus = RelayServer.Domain.TaskStatus;

namespace RelayServer.Data;

public class RelayDbContext(DbContextOptions<RelayDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<UserLibraryAccess> UserLibraryAccess => Set<UserLibraryAccess>();
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<Series> Series => Set<Series>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<MediaItem> MediaItems => Set<MediaItem>();
    public DbSet<SubtitleTrack> SubtitleTracks => Set<SubtitleTrack>();
    public DbSet<AudioTrackInfo> AudioTracks => Set<AudioTrackInfo>();
    public DbSet<WatchProgress> WatchProgress => Set<WatchProgress>();
    public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
    public DbSet<ScheduledTask> ScheduledTasks => Set<ScheduledTask>();
    public DbSet<TaskRun> TaskRuns => Set<TaskRun>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        // Store string arrays as delimited strings in SQLite.
        // The ValueComparer tells EF how to detect changes to array contents.
        var arrayComparer = new ValueComparer<string[]?>(
            (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
            a => a == null ? 0 : a.Aggregate(0, (h, s) => HashCode.Combine(h, s.GetHashCode())),
            a => a == null ? null : a.ToArray());

        model.Entity<Series>()
            .Property(s => s.Genres)
            .HasConversion(
                v => v == null ? null : string.Join(',', v),
                v => v == null ? null : v.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .Metadata.SetValueComparer(arrayComparer);

        model.Entity<MediaItem>()
            .Property(m => m.Genres)
            .HasConversion(
                v => v == null ? null : string.Join(',', v),
                v => v == null ? null : v.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .Metadata.SetValueComparer(arrayComparer);

        model.Entity<MediaItem>()
            .Property(m => m.Cast)
            .HasConversion(
                v => v == null ? null : string.Join('|', v),
                v => v == null ? null : v.Split('|', StringSplitOptions.RemoveEmptyEntries))
            .Metadata.SetValueComparer(arrayComparer);

        // Unique constraints
        model.Entity<User>().HasIndex(u => u.Username).IsUnique();
        model.Entity<UserLibraryAccess>().HasIndex(a => new { a.UserId, a.LibraryId }).IsUnique();
        model.Entity<WatchProgress>().HasIndex(w => new { w.UserId, w.MediaItemId }).IsUnique();
        model.Entity<WatchlistItem>().HasIndex(w => new { w.UserId, w.MediaItemId }).IsUnique();
        model.Entity<ScheduledTask>().HasIndex(t => t.Key).IsUnique();

        // Seed the default app settings row
        model.Entity<AppSettings>().HasData(new AppSettings { Id = 1, SetupComplete = false });

        // Seed scheduled tasks with their default schedules
        model.Entity<ScheduledTask>().HasData(
            new ScheduledTask { Id = 1,  Key = "scan_libraries",        Name = "Scan Media Libraries",         Category = "Library",     CronSchedule = "0 2 * * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 2,  Key = "refresh_metadata",      Name = "Refresh Metadata",             Category = "Library",     CronSchedule = "0 3 * * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 3,  Key = "generate_trickplay",    Name = "Generate Trickplay Images",    Category = "Library",     CronSchedule = "0 4 * * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 4,  Key = "extract_chapters",      Name = "Extract Chapter Images",       Category = "Library",     CronSchedule = "0 4 * * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 5,  Key = "extract_keyframes",     Name = "Keyframe Extractor",           Category = "Library",     CronSchedule = null,         IsEnabled = false, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 6,  Key = "whisper_queue",         Name = "Whisper Transcription Queue",  Category = "Library",     CronSchedule = "0 1 * * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 7,  Key = "clean_transcode_cache", Name = "Clean Transcode Cache",        Category = "Maintenance", CronSchedule = "0 0 * * 0",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 8,  Key = "clean_logs",            Name = "Clean Log Directory",          Category = "Maintenance", CronSchedule = "0 0 * * 0",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 9,  Key = "clean_activity_log",    Name = "Clean Activity Log",           Category = "Maintenance", CronSchedule = "0 0 1 * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 10, Key = "optimize_database",     Name = "Optimize Database",            Category = "Maintenance", CronSchedule = "0 0 1 * *",  IsEnabled = true, LastStatus = TaskStatus.Idle },
            new ScheduledTask { Id = 11, Key = "user_data_cleanup",     Name = "User Data Cleanup",            Category = "Maintenance", CronSchedule = "0 0 1 * *",  IsEnabled = true, LastStatus = TaskStatus.Idle }
        );
    }
}
