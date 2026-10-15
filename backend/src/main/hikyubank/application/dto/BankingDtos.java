package hikyubank.application.dto;
import java.util.UUID;import java.math.BigDecimal;import java.time.Instant;
import jakarta.validation.constraints.*;
public final class BankingDtos {
 public record OperationInput(@NotBlank @Pattern(regexp="purchase|repayment|bill") String type,@NotNull UUID sourceAccountId,UUID targetAccountId,UUID payeeId,@Size(max=60) String payeeReference,
  @Size(max=100) String merchant,@Size(max=60) String category,@NotNull @DecimalMin("0.01") @DecimalMax("1000000") @Digits(integer=7,fraction=2) BigDecimal amount,
  @Size(max=250) String note,@NotNull UUID idempotencyKey,@Pattern(regexp="[0-9]{4}") String pin,UUID challengeId,@Pattern(regexp="[0-9]{6}") String verificationCode,@Pattern(regexp="sms|email") String method) {}
 public record OperationReceipt(UUID id,String type,UUID sourceAccountId,UUID targetAccountId,BigDecimal amount,String merchant,String category,String note,Instant createdAt,String status) {}
 public record PayeeInput(@NotBlank @Pattern(regexp="peer|biller") String kind,@NotBlank @Size(max=80) String identifier,@NotBlank @Size(max=60) String alias,@Size(max=60) String reference) {}
 public record PayeeEdit(@NotBlank @Size(max=60) String alias,@Size(max=60) String reference) {}
 public record Payee(UUID id,String kind,String identifier,String alias,String reference) {}
 public record Biller(String code,String name,String category) {}
 public record Card(UUID accountId,String name,String type,String suffix,String status,BigDecimal balance,boolean locked) {}
 public record CardLock(@NotNull Boolean locked) {}
 public record BudgetInput(@NotBlank @Pattern(regexp="[0-9]{4}-(0[1-9]|1[0-2])") String month,@NotBlank @Size(max=60) String category,
  @NotNull @DecimalMin("0.01") @DecimalMax("1000000") @Digits(integer=7,fraction=2) BigDecimal limit) {}
 public record Budget(UUID id,String month,String category,BigDecimal limit,BigDecimal spent,BigDecimal remaining,boolean exceeded) {}
}
