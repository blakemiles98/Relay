namespace Relay.Server.DTOs.Setup;

public record SetupRequest(
    string AdminUsername,
    string? AdminPassword,
    string AvatarColor,
    List<InitialLibrary> Libraries
);

public record InitialLibrary(string Name, string Path, string Type);
