package hikyubank.application.service;
import java.util.*;import java.security.SecureRandom;import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;import org.springframework.security.crypto.password.PasswordEncoder;
import hikyubank.application.dto.SecurityDtos.*;import hikyubank.application.exception.BankException;import hikyubank.dataaccess.postgresql.ExtensionRepository;
@Service
public class SecurityService {
 private final ExtensionRepository store;private final PasswordEncoder encoder;private final SecureRandom random=new SecureRandom();
 public SecurityService(ExtensionRepository store,PasswordEncoder encoder){this.store=store;this.encoder=encoder;}
 public static String demoPin(String username){return switch(username){case "chengyang.lee"->"1037";case "gospelhope.david"->"5842";case "mingyu.fan"->"9061";default->null;};}
 private void validPassword(String value){if(value.getBytes(StandardCharsets.UTF_8).length>72 || !value.matches("(?s).*[A-Za-z].*") || !value.matches("(?s).*\\d.*"))throw new BankException(400,"WEAK_PASSWORD","Use at least 12 characters, a letter and a number; maximum 72 UTF-8 bytes.");}
 @Transactional public Registered register(Registration input){validPassword(input.password());String first=input.firstName().trim(),last=input.lastName().trim();if(first.isEmpty() || last.isEmpty())throw new BankException(400,"INVALID_NAME","Enter your first and last name.");UUID user=UUID.randomUUID();String pin=input.pin();
  boolean changed=store.register(user,input.username(),first,last,encoder.encode(input.password()),encoder.encode(pin));
  if(!changed)throw new BankException(409,"USERNAME_TAKEN","This username is already registered.");
  for(boolean checking:new boolean[]{true,false})store.starterAccount(user,checking,String.format(java.util.Locale.ROOT,"%04d",random.nextInt(10000)));
  return new Registered(user,input.username(),"Your selected PIN is saved as a hash. Your accounts contain synthetic starter balances.");
 }
 public void verifyPassword(UUID user,String password){String hash=store.passwordHash(user);if(password.getBytes(StandardCharsets.UTF_8).length>72 || !encoder.matches(password,hash))throw new BankException(400,"WRONG_PASSWORD","Current password is incorrect.");}
 private record PinAttempts(int count,long lockedUntil) {}
 private final java.util.concurrent.ConcurrentHashMap<UUID,PinAttempts> attempts=new java.util.concurrent.ConcurrentHashMap<>();
 public void verifyPin(UUID user,String pin){long now=System.currentTimeMillis();var previous=attempts.get(user);if(previous!=null && previous.lockedUntil()>now)throw new BankException(429,"PIN_LOCKED","Too many incorrect PIN attempts. Wait 30 seconds.");
  boolean valid=pin!=null && pin.matches("[0-9]{4}") && encoder.matches(pin,store.pinHash(user));
  if(valid){attempts.remove(user);return;}attempts.compute(user,(id,a)->{int count=a==null || (a.lockedUntil()!=0 && a.lockedUntil()<=now)?1:a.count()+1;return new PinAttempts(count,count>=5?now+30000:0);});throw new BankException(400,"INVALID_PIN","Card PIN is incorrect.");
 }
 @Transactional public String rotatePin(UUID user,String password,String newPin){store.lockUser(user);verifyPassword(user,password);if(newPin==null || !newPin.matches("[0-9]{4}"))throw new BankException(400,"INVALID_PIN","Enter exactly four digits for your card PIN.");String pin=newPin;String old=store.pinHash(user);if(encoder.matches(pin,old))throw new BankException(400,"UNCHANGED_PIN","Choose a different PIN.");store.changePin(user,encoder.encode(pin));return pin;}
 @Transactional public void revoke(UUID user,String password){store.lockUser(user);verifyPassword(user,password);store.revoke(user);}
 @Transactional public void initializePins(){for(var user:store.uninitializedPins()){String pin=demoPin((String)user.get("username"));if(pin!=null)store.changePin((UUID)user.get("id"),encoder.encode(pin));else store.markPinInitialized((UUID)user.get("id"));}}
}
