namespace Relay.Server.DTOs.Libraries;

public record LibraryDto(
    Guid Id, string Name, string Path, string Type,
    DateTime CreatedAt, DateTime? LastScanned,
    int ItemCount, int TotalItemCount,
    string MetadataProvider);

public record CreateLibraryRequest(string Name, string Path, string Type, string? MetadataProvider = null);
