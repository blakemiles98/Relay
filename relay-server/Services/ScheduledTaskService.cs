using Relay.Server.Data;
using Relay.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace Relay.Server.Services;

public enum TaskType { ScanLibraries, FetchMetadata, CleanTranscodeCache }

public record ScheduledTaskStatus(TaskType Type, string Name, bool Running, DateTime? LastRun, string? LastResult);

public interface IScheduledTaskService
{
    IReadOnlyList<ScheduledTaskStatus> GetStatuses();
    Task TriggerAsync(TaskType type, CancellationToken ct = default);
}

public class ScheduledTaskService(
    IServiceScopeFactory scopeFactory,
    ILogger<ScheduledTaskService> logger,
    IConfiguration config) : BackgroundService, IScheduledTaskService
{
    private readonly Dictionary<TaskType, (bool Running, DateTime? LastRun, string? LastResult)> _state = new()
    {
        [TaskType.ScanLibraries]       = (false, null, null),
        [TaskType.FetchMetadata]       = (false, null, null),
        [TaskType.CleanTranscodeCache] = (false, null, null),
    };
    private readonly SemaphoreSlim _triggerScan     = new(0, 1);
    private readonly SemaphoreSlim _triggerMeta     = new(0, 1);
    private readonly SemaphoreSlim _triggerClean    = new(0, 1);

    public IReadOnlyList<ScheduledTaskStatus> GetStatuses() =>
    [
        new(TaskType.ScanLibraries,       "Scan Libraries",        _state[TaskType.ScanLibraries].Running,       _state[TaskType.ScanLibraries].LastRun,       _state[TaskType.ScanLibraries].LastResult),
        new(TaskType.FetchMetadata,       "Fetch Metadata",        _state[TaskType.FetchMetadata].Running,       _state[TaskType.FetchMetadata].LastRun,       _state[TaskType.FetchMetadata].LastResult),
        new(TaskType.CleanTranscodeCache, "Clean Transcode Cache", _state[TaskType.CleanTranscodeCache].Running, _state[TaskType.CleanTranscodeCache].LastRun, _state[TaskType.CleanTranscodeCache].LastResult),
    ];

    public Task TriggerAsync(TaskType type, CancellationToken ct = default)
    {
        var sem = type switch
        {
            TaskType.ScanLibraries       => _triggerScan,
            TaskType.FetchMetadata       => _triggerMeta,
            TaskType.CleanTranscodeCache => _triggerClean,
            _ => throw new ArgumentOutOfRangeException()
        };
        sem.TryRelease();
        return Task.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _ = RunOnScheduleAsync(TaskType.CleanTranscodeCache, TimeSpan.FromHours(6), _triggerClean, CleanTranscodeCacheAsync, stoppingToken);
        _ = RunOnScheduleAsync(TaskType.ScanLibraries, TimeSpan.FromHours(24), _triggerScan, ScanLibrariesAsync, stoppingToken);
        _ = RunOnScheduleAsync(TaskType.FetchMetadata, TimeSpan.FromHours(24), _triggerMeta, FetchMetadataAsync, stoppingToken);

        await Task.Delay(Timeout.Infinite, stoppingToken).ConfigureAwait(false);
    }

    private async Task RunOnScheduleAsync(TaskType type, TimeSpan interval, SemaphoreSlim trigger,
        Func<CancellationToken, Task<string>> work, CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts.CancelAfter(interval);
                try { await trigger.WaitAsync(cts.Token); } catch (OperationCanceledException) { /* timer fired */ }

                if (stoppingToken.IsCancellationRequested) break;
                await RunAsync(type, work, stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogError(ex, "Scheduler loop error for {Type}", type); }
        }
    }

    private async Task RunAsync(TaskType type, Func<CancellationToken, Task<string>> work, CancellationToken stoppingToken)
    {
        _state[type] = (true, _state[type].LastRun, _state[type].LastResult);
        try
        {
            var result = await work(stoppingToken);
            _state[type] = (false, DateTime.UtcNow, result);
            logger.LogInformation("Task {Type} completed: {Result}", type, result);
        }
        catch (Exception ex)
        {
            _state[type] = (false, DateTime.UtcNow, $"Error: {ex.Message}");
            logger.LogError(ex, "Task {Type} failed", type);
        }
    }

    private async Task<string> ScanLibrariesAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var scanner = scope.ServiceProvider.GetRequiredService<ILibraryScannerService>();
        await scanner.ScanAllLibrariesAsync();
        return "Scan complete";
    }

    private async Task<string> FetchMetadataAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var metaSvc = scope.ServiceProvider.GetRequiredService<IMetadataService>();
        var thumbnailRoot = Path.Combine(AppContext.BaseDirectory, "thumbnails");

        int updated = 0;

        var seriesList = await db.Series
            .Include(s => s.Library)
            .Where(s => s.ExternalId == null && s.Library.MetadataProvider != MetadataProvider.None)
            .ToListAsync(ct);

        foreach (var series in seriesList)
        {
            var result = await metaSvc.SearchSeriesAsync(series.Title, series.Year, series.Library.MetadataProvider);
            if (result is null) continue;
            series.ExternalId = result.ExternalId;
            series.ExternalSource = result.Source;
            series.Overview ??= result.Overview;
            series.Year ??= result.Year;
            if (series.ThumbnailPath is null && result.PosterUrl is not null)
            {
                var imgBytes = await metaSvc.FetchImageAsync(result.PosterUrl);
                if (imgBytes is not null)
                {
                    var imgPath = Path.Combine(thumbnailRoot, "series", $"{series.Id}.jpg");
                    Directory.CreateDirectory(Path.GetDirectoryName(imgPath)!);
                    await File.WriteAllBytesAsync(imgPath, imgBytes, ct);
                    series.ThumbnailPath = imgPath;
                }
            }
            updated++;
        }

        var movies = await db.MediaItems
            .Include(m => m.Library)
            .Where(m => m.ExternalId == null && m.Type == MediaType.Movie
                        && m.Library.MetadataProvider != MetadataProvider.None)
            .ToListAsync(ct);

        foreach (var movie in movies)
        {
            var result = await metaSvc.SearchMovieAsync(movie.Title, movie.Year);
            if (result is null) continue;
            movie.ExternalId = result.ExternalId;
            movie.ExternalSource = result.Source;
            movie.Overview ??= result.Overview;
            movie.Year ??= result.Year;
            if (movie.ThumbnailPath is null && result.PosterUrl is not null)
            {
                var imgBytes = await metaSvc.FetchImageAsync(result.PosterUrl);
                if (imgBytes is not null)
                {
                    var imgPath = Path.Combine(thumbnailRoot, "movies", $"{movie.Id}.jpg");
                    Directory.CreateDirectory(Path.GetDirectoryName(imgPath)!);
                    await File.WriteAllBytesAsync(imgPath, imgBytes, ct);
                    movie.ThumbnailPath = imgPath;
                }
            }
            updated++;
        }

        await db.SaveChangesAsync(ct);
        return $"Updated {updated} items";
    }

    private Task<string> CleanTranscodeCacheAsync(CancellationToken ct)
    {
        var cacheDir = config["Transcode:CacheDir"];
        if (string.IsNullOrEmpty(cacheDir))
            cacheDir = Path.Combine(AppContext.BaseDirectory, "relay-transcode");

        if (!Directory.Exists(cacheDir))
            return Task.FromResult("No cache directory");

        int removed = 0;
        var cutoff = DateTime.UtcNow.AddHours(-24);

        foreach (var itemDir in Directory.GetDirectories(cacheDir))
        {
            try
            {
                var lastWrite = Directory.GetLastWriteTimeUtc(itemDir);
                if (lastWrite < cutoff)
                {
                    Directory.Delete(itemDir, true);
                    removed++;
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "Could not clean {Dir}", itemDir); }
        }

        return Task.FromResult($"Removed {removed} cached transcode(s)");
    }
}

static file class SemaphoreExtensions
{
    public static void TryRelease(this SemaphoreSlim sem)
    {
        try { sem.Release(); } catch (SemaphoreFullException) { }
    }
}
