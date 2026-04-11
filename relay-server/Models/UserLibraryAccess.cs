namespace Relay.Server.Models;

public class UserLibraryAccess
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid LibraryId { get; set; }
    public Library Library { get; set; } = null!;
}
