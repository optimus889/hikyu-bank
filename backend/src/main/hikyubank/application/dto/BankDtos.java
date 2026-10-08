package hikyubank.application.dto;

import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public final class BankDtos {
    private BankDtos() {}

    public record OpenAccountRequest(
        @NotBlank @Pattern(regexp = "checking|savings|credit|loan|investment") String type,
        @NotBlank @Size(max = 60) String name
    ) {}

    public record AccountProduct(
        String type,
        String name,
        String description,
        String icon,
        boolean alreadyOpen
    ) {}

    public record AlertRequest(
        @NotBlank String type,
        @NotNull UUID accountId,
        @NotBlank @Size(max = 80) String title,
        @NotBlank @Pattern(regexp = "Email|SMS|In-app|Calendar") String channel,
        @jakarta.validation.constraints.Digits(integer = 7, fraction = 2) BigDecimal amount,
        String date
    ) {}

    public record ToggleAlertRequest(@NotNull Boolean enabled) {}

    public record NotificationUpdate(Boolean read, Boolean resolved) {}

    public record TestNotificationRequest(UUID alertId) {}

    public record AssistantRequest(@NotBlank @Size(max = 1000) String message) {}

    public record AssistantResponse(String reply, String mode) {}
}
