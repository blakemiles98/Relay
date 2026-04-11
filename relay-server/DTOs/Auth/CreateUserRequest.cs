namespace Relay.Server.DTOs.Auth;

public record CreateUserRequest(string Username, string? Password, string AvatarColor, bool IsAdmin = false, List<Guid>? LibraryIds = null);
