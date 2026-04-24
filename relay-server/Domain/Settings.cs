namespace RelayServer.Domain;

public class AppSettings
{
    public int Id { get; set; }
    public bool SetupComplete { get; set; }
    public string? TmdbApiKey { get; set; }

    // Discord notifications
    public string? DiscordWebhookUrl { get; set; }
    public bool NotifyOnLibraryScanComplete { get; set; }
    public bool NotifyOnNewMediaAdded { get; set; }
    public bool NotifyOnTaskFailed { get; set; }
    public bool NotifyOnWhisperComplete { get; set; }
    public bool NotifyOnUserCreated { get; set; }
}
