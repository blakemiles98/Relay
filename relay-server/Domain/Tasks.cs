namespace RelayServer.Domain;

public enum TaskStatus
{
    Idle,
    Running,
    Success,
    Failed
}

public class ScheduledTask
{
    public int Id { get; set; }
    public string Key { get; set; } = "";        // e.g. "scan_library"
    public string Name { get; set; } = "";       // display name
    public string Category { get; set; } = "";   // "Library" or "Maintenance"
    public string? CronSchedule { get; set; }    // standard cron expression
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRunAt { get; set; }
    public int? LastDurationSeconds { get; set; }
    public TaskStatus LastStatus { get; set; } = TaskStatus.Idle;

    public ICollection<TaskRun> Runs { get; set; } = [];
}

public class TaskRun
{
    public int Id { get; set; }
    public int ScheduledTaskId { get; set; }
    public ScheduledTask ScheduledTask { get; set; } = null!;

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.Running;
    public string? Log { get; set; }
}
