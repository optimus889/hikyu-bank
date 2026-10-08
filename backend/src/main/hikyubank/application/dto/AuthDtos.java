package hikyubank.application.dto;

import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AuthDtos {
    private AuthDtos() {}

    public record LoginRequest(
        @NotBlank @Size(max = 80) String username,
        @NotBlank @Size(max = 128) String password
    ) {}

    public record CodeRequest(
        @NotBlank String challengeId,
        @Pattern(regexp = "sms|email") @NotBlank String method
    ) {}

    public record VerifyRequest(
        @NotBlank String challengeId,
        @Pattern(regexp = "sms|email") @NotBlank String method,
        @Pattern(regexp = "[0-9]{6}") @NotBlank String code,
        @Size(max = 4) String pin
    ) {}

    public record ContactMethod(String id, String destination) {}

    public record LoginResponse(
        String challengeId,
        long expiresAt,
        List<ContactMethod> methods
    ) {}

    public record CodeResponse(long expiresAt, long resendAt, String demoCode) {}

    public record UserProfile(
        UUID id,
        String username,
        String name,
        String firstName,
        String lastName
    ) {}

    public record SessionResponse(UserProfile user, long expiresAt) {}
}
