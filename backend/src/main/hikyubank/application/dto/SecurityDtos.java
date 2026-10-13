package hikyubank.application.dto;
import jakarta.validation.constraints.*;import java.util.UUID;
public final class SecurityDtos {
 public record Registration(@NotBlank @Pattern(regexp="[a-z0-9][a-z0-9._-]{2,29}") String username,
  @NotBlank @Size(max=40) String firstName,@NotBlank @Size(max=40) String lastName,
  @NotBlank @Size(min=12,max=72) String password,@NotBlank @Pattern(regexp="[0-9]{4}") String pin) {}
 public record Confirmation(@NotBlank @Size(max=72) String password,@Pattern(regexp="[0-9]{4}") String newPin) {}
 public record Registered(UUID userId,String username,String message) {}
}
