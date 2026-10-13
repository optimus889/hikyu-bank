package hikyubank.application.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import hikyubank.application.model.Transaction;
public final class ExtensionDtos {
 public record TransferInput(@NotNull UUID sourceAccountId,@NotNull UUID targetAccountId,
  @NotNull @DecimalMin("0.01") @DecimalMax("1000000") @Digits(integer=7,fraction=2) BigDecimal amount,
  @Size(max=250) String note,@NotNull UUID idempotencyKey,@Pattern(regexp="[0-9]{4}") String pin, UUID challengeId, @Pattern(regexp="[0-9]{6}") String verificationCode) {
 public TransferInput(UUID sourceAccountId,UUID targetAccountId,BigDecimal amount,String note,UUID idempotencyKey,String pin) {this(sourceAccountId,targetAccountId,amount,note,idempotencyKey,pin,null,null);}
 }
 public record Receipt(UUID id,UUID sourceAccountId,UUID targetAccountId,BigDecimal amount,String note,Instant createdAt,String status) {}
 public record Nickname(@NotBlank @Size(max=60) String name) {}
 public record Preferences(@NotNull Boolean lowBalance,@NotNull Boolean largeTransaction) {}
 public record Password(@NotBlank @Size(max=72) String currentPassword,
  @NotBlank @Size(min=12,max=72) String newPassword) {}
 public record Page(List<Transaction> items,long total,int page,int size) {}
}
