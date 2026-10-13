package hikyubank.application.service;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import hikyubank.dataaccess.postgresql.ExtensionRepository;
import hikyubank.dataaccess.repository.DemoUserRepository;
import hikyubank.application.dto.ExtensionDtos.*;
import hikyubank.application.exception.BankException;
@Service
public class SettingsService {
 private final ExtensionRepository store;private final PasswordEncoder encoder;private final AccountService accounts;
 public SettingsService(ExtensionRepository store,PasswordEncoder encoder,AccountService accounts){this.store=store;this.encoder=encoder;this.accounts=accounts;}
 public Preferences preferences(UUID user){return store.preferences(user);}
 @Transactional public Preferences preferences(UUID user,Preferences p){store.preferences(user,p);return p;}
 @Transactional public Object nickname(UUID user,UUID id,Nickname input){accounts.get(user,id);String name=input.name().trim();if(name.isEmpty())throw new BankException(400,"INVALID_NAME","Enter an account nickname.");store.nickname(user,id,name);return accounts.get(user,id);}
 @Transactional public void password(UUID user,Password p){
  if(p.newPassword().getBytes(StandardCharsets.UTF_8).length>72 || p.currentPassword().getBytes(StandardCharsets.UTF_8).length>72)throw new BankException(400,"INVALID_PASSWORD","Passwords must be at most 72 UTF-8 bytes.");
  String hash=store.passwordHash(user);
  if(!encoder.matches(p.currentPassword(),hash))throw new BankException(400,"WRONG_PASSWORD","Current password is incorrect.");
  if(p.newPassword().equals(p.currentPassword()) || !p.newPassword().matches("(?s).*[A-Za-z].*") || !p.newPassword().matches("(?s).*\\d.*"))throw new BankException(400,"WEAK_PASSWORD","Use a different password with at least 12 characters, a letter and a number.");
  if(!store.changePassword(user,hash,encoder.encode(p.newPassword())))throw new BankException(409,"PASSWORD_CHANGED","Password changed concurrently. Sign in again.");
 }
}
