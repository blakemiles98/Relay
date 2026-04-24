using Microsoft.EntityFrameworkCore;
using RelayServer.Data;
using RelayServer.Domain;
using TaskStatus = RelayServer.Domain.TaskStatus;

namespace RelayServer.Services;

public class TaskRunnerService(
    RelayDbContext db,
    LibraryScannerService scanner,
    MetadataService metadata,
    TranscodeService transcode,
    DiscordService discord,
    WhisperService whisper,
    ILogger<TaskRunnerService> logger)
{
    public async Task<TaskRun> RunTaskAsync(string key, CancellationToken ct = default)
    {
        var task = await db.ScheduledTasks.FirstOrDefaultAsync(t => t.Key == key, ct)
            ?? throw new KeyNotFoundException($"Unknown task key: {key}");

        var run = new TaskRun { ScheduledTaskId = task.Id, StartedAt = DateTime.UtcNow };
        db.TaskRuns.Add(run);
        task.LastRunAt = DateTime.UtcNow;
        task.LastStatus = TaskStatus.Running;
        await db.SaveChangesAsync(ct);

        var log = new System.Text.StringBuilder();

        try
        {
            await ExecuteAsync(key, log, ct);
            run.Status = TaskStatus.Success;
            task.LastStatus = TaskStatus.Success;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Task {Key} failed", key);
            log.AppendLine($"ERROR: {ex.Message}");
            run.Status = TaskStatus.Failed;
            task.LastStatus = TaskStatus.Failed;
            await discord.NotifyTaskFailedAsync(task.Name);
        }
        finally
        {
            run.CompletedAt = DateTime.UtcNow;
            run.Log = log.ToString();
            task.LastDurationSeconds = (int)(run.CompletedAt.Value - run.StartedAt).TotalSeconds;
            await db.SaveChangesAsync(CancellationToken.None);
        }

        return run;
    }

    private async Task ExecuteAsync(string key, System.Text.StringBuilder log, CancellationToken ct)
    {
        switch (key)
        {
            case "scan_libraries":
                var libraries = await db.Libraries.ToListAsync(ct);
                foreach (var lib in libraries)
                {
                    log.AppendLine($"Scanning: {lib.Name}");
                    await scanner.ScanLibraryAsync(lib, ct);
                    await discord.NotifyLibraryScanCompleteAsync(lib.Name);
                }
                break;

            case "refresh_metadata":
                var metaLibraries = await db.Libraries
                    .Where(l => l.MetadataEnabled)
                    .ToListAsync(ct);
                foreach (var lib in metaLibraries)
                {
                    log.AppendLine($"Refreshing metadata: {lib.Name}");
                    await metadata.RefreshLibraryMetadataAsync(lib, ct);
                }
                break;

            case "clean_transcode_cache":
                var cacheDir = transcode.GetHlsSegmentDir(0).Replace("/0", "");
                if (Directory.Exists(cacheDir))
                {
                    var cutoff = DateTime.UtcNow.AddDays(-7);
                    foreach (var dir in Directory.GetDirectories(cacheDir))
                    {
                        var lastWrite = Directory.GetLastWriteTimeUtc(dir);
                        if (lastWrite < cutoff)
                        {
                            Directory.Delete(dir, true);
                            log.AppendLine($"Deleted cache: {dir}");
                        }
                    }
                }
                break;

            case "optimize_database":
                await db.Database.ExecuteSqlRawAsync("VACUUM;", ct);
                await db.Database.ExecuteSqlRawAsync("ANALYZE;", ct);
                log.AppendLine("Database optimized");
                break;

            case "user_data_cleanup":
                var deletedItemIds = await db.MediaItems.Select(m => m.Id).ToHashSetAsync(ct);
                var orphanProgress = await db.WatchProgress
                    .Where(w => !deletedItemIds.Contains(w.MediaItemId)).ToListAsync(ct);
                var orphanWatchlist = await db.WatchlistItems
                    .Where(w => !deletedItemIds.Contains(w.MediaItemId)).ToListAsync(ct);
                db.WatchProgress.RemoveRange(orphanProgress);
                db.WatchlistItems.RemoveRange(orphanWatchlist);
                await db.SaveChangesAsync(ct);
                log.AppendLine($"Removed {orphanProgress.Count} orphan watch progress entries");
                log.AppendLine($"Removed {orphanWatchlist.Count} orphan watchlist entries");
                break;

            case "clean_activity_log":
                var cutoffDate = DateTime.UtcNow.AddDays(-90);
                var oldRuns = await db.TaskRuns.Where(r => r.StartedAt < cutoffDate).ToListAsync(ct);
                db.TaskRuns.RemoveRange(oldRuns);
                await db.SaveChangesAsync(ct);
                log.AppendLine($"Removed {oldRuns.Count} old task run records");
                break;

            case "whisper_queue":
                await whisper.ProcessQueueAsync(log, ct);
                break;

            case "generate_trickplay":
                await GenerateTrickplayAsync(log, ct);
                break;

            case "extract_chapters":
            case "extract_keyframes":
                log.AppendLine($"Task '{key}' not yet implemented");
                break;

            default:
                throw new NotImplementedException($"Task handler not implemented: {key}");
        }
    }

    private async Task GenerateTrickplayAsync(System.Text.StringBuilder log, CancellationToken ct)
    {
        var items = await db.MediaItems
            .Where(m => !m.TrickplayGenerated &&
                        (m.Type == MediaType.Movie ||
                         m.Type == MediaType.Episode ||
                         m.Type == MediaType.HomeVideo))
            .ToListAsync(ct);

        if (items.Count == 0)
        {
            log.AppendLine("No videos pending trickplay generation.");
            return;
        }

        log.AppendLine($"Generating trickplay for {items.Count} video(s)...");

        foreach (var item in items)
        {
            if (ct.IsCancellationRequested) break;

            log.AppendLine($"  Processing: {item.Title}");
            var ok = await transcode.GenerateTrickplayAsync(item.Id, item.FilePath, ct);

            if (ok)
            {
                item.TrickplayGenerated = true;
                await db.SaveChangesAsync(ct);
                log.AppendLine($"    ✓ Done");
            }
            else
            {
                log.AppendLine($"    ✗ Failed (check server logs)");
            }
        }
    }
}
