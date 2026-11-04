package hikyubank.application.dto;

import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;

public final class PaymentDtos {
    public record Lookup(@NotBlank @Pattern(regexp="[a-z0-9][a-z0-9._-]{2,79}") String username) {}
    public record Recipient(String username, String name, String accountLabel) {}
    public record Input(@NotNull UUID sourceAccountId,
        @NotBlank @Pattern(regexp="[a-z0-9][a-z0-9._-]{2,79}") String recipientUsername,
        @NotNull @DecimalMin("0.01") @DecimalMax("1000000") @Digits(integer=7,fraction=2) BigDecimal amount,
        @Size(max=250) String note, @NotNull UUID idempotencyKey,
        @NotBlank @Pattern(regexp="[0-9]{4}") String pin, UUID challengeId, @Pattern(regexp="[0-9]{6}") String verificationCode) {
 public Input(UUID sourceAccountId,String recipientUsername,BigDecimal amount,String note,UUID idempotencyKey,String pin) {this(sourceAccountId,recipientUsername,amount,note,idempotencyKey,pin,null,null);}
 }
    public record Receipt(UUID id,String senderUsername,String senderName,String recipientUsername,
        String recipientName,BigDecimal amount,String note,Instant createdAt,String direction,String status) {}
}
