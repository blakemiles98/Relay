namespace Relay.Server.DTOs.Auth;

public record LoginResponse(string Token, UserDto User);

public record UserDto(Guid Id, string Username, bool IsAdmin, string AvatarColor);
