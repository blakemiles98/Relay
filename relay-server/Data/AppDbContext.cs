using Microsoft.EntityFrameworkCore;
using Relay.Server.Models;

namespace Relay.Server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<MediaItem> MediaItems => Set<MediaItem>();
    public DbSet<Series> Series => Set<Series>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<WatchProgress> WatchProgress => Set<WatchProgress>();
    public DbSet<UserLibraryAccess> UserLibraryAccess => Set<UserLibraryAccess>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // User
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // Library
        modelBuilder.Entity<Library>()
            .Property(l => l.Type)
            .HasConversion<string>();

        modelBuilder.Entity<Library>()
            .Property(l => l.MetadataProvider)
            .HasConversion<string>();

        // MediaItem
        modelBuilder.Entity<MediaItem>()
            .Property(m => m.Type)
            .HasConversion<string>();

        modelBuilder.Entity<MediaItem>()
            .HasOne(m => m.Library)
            .WithMany(l => l.MediaItems)
            .HasForeignKey(m => m.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaItem>()
            .HasOne(m => m.Series)
            .WithMany()
            .HasForeignKey(m => m.SeriesId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<MediaItem>()
            .HasOne(m => m.Season)
            .WithMany(s => s.Episodes)
            .HasForeignKey(m => m.SeasonId)
            .OnDelete(DeleteBehavior.SetNull);

        // Series
        modelBuilder.Entity<Series>()
            .HasOne(s => s.Library)
            .WithMany(l => l.Series)
            .HasForeignKey(s => s.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        // Season
        modelBuilder.Entity<Season>()
            .HasOne(s => s.Series)
            .WithMany(s => s.Seasons)
            .HasForeignKey(s => s.SeriesId)
            .OnDelete(DeleteBehavior.Cascade);

        // UserLibraryAccess — composite PK
        modelBuilder.Entity<UserLibraryAccess>()
            .HasKey(a => new { a.UserId, a.LibraryId });

        modelBuilder.Entity<UserLibraryAccess>()
            .HasOne(a => a.User)
            .WithMany(u => u.LibraryAccess)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserLibraryAccess>()
            .HasOne(a => a.Library)
            .WithMany(l => l.UserAccess)
            .HasForeignKey(a => a.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        // WatchProgress — unique per user+item
        modelBuilder.Entity<WatchProgress>()
            .HasIndex(w => new { w.UserId, w.MediaItemId })
            .IsUnique();

        modelBuilder.Entity<WatchProgress>()
            .HasOne(w => w.User)
            .WithMany(u => u.WatchProgress)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WatchProgress>()
            .HasOne(w => w.MediaItem)
            .WithMany(m => m.WatchProgress)
            .HasForeignKey(w => w.MediaItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
