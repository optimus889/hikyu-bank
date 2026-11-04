package hikyubank.application.service;

import java.util.*;
import java.util.function.Supplier;
import java.math.BigDecimal;
import java.time.*;
import java.sql.Timestamp;
import java.security.*;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import hikyubank.dataaccess.postgresql.PaymentVerificationRepository;
import jakarta.validation.constraints.*;
import hikyubank.application.dto.ExtensionDtos.TransferInput;
import hikyubank.application.dto.PaymentDtos.Input;
import hikyubank.application.dto.PaymentDtos.Lookup;
import hikyubank.application.exception.BankException;

/** Demo-only payment step-up. Codes are never sent to external messaging providers. */
@Service
public class PaymentAuthorizationService {
 public record ChallengeRequest(@NotBlank @Pattern(regexp="internal|peer") String type,@NotNull UUID sourceAccountId,
  UUID targetAccountId,String recipientUsername,@NotNull @DecimalMin("0.01") @DecimalMax("1000000") @Digits(integer=7,fraction=2) BigDecimal amount,
  @Size(max=250) String note,@NotNull UUID idempotencyKey,@NotBlank @Pattern(regexp="sms|email") String method) {}
 public record Challenge(UUID challengeId,String method,Instant expiresAt,String demoCode,String message) {}
 private final PaymentVerificationRepository store;private final Clock clock;private final AccountService accounts;private final PaymentService payments;
 private final TransactionTemplate verificationTx, financialTx;
 private final SecureRandom random=new SecureRandom();
 public PaymentAuthorizationService(PaymentVerificationRepository store,Clock clock,AccountService accounts,PaymentService payments,PlatformTransactionManager manager){this.store=store;this.clock=clock;this.accounts=accounts;this.payments=payments;this.verificationTx=new TransactionTemplate(manager);this.verificationTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);this.financialTx=new TransactionTemplate(manager);}
 private static String payload(String type,UUID source,String destination,BigDecimal amount,String note,UUID key){
  // Length-prefixed fields prevent delimiter collisions; canonical cents support 1 / 1.00 retries.
  var fields=List.of(type,source.toString(),destination,amount.setScale(2).toPlainString(),note==null?"":note.trim(),key.toString());
  StringBuilder out=new StringBuilder();for(String value:fields)out.append(value.length()).append(':').append(value);return hash(out.toString());
 }
 public static String internal(TransferInput p){return payload("internal",p.sourceAccountId(),String.valueOf(p.targetAccountId()),p.amount(),p.note(),p.idempotencyKey());}
 public static String peer(Input p){return payload("peer",p.sourceAccountId(),p.recipientUsername(),p.amount(),p.note(),p.idempotencyKey());}
 public static String hash(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 @Transactional public Challenge issue(UUID user,String session,ChallengeRequest p){
  if(!List.of("sms","email").contains(p.method()) || !List.of("internal","peer").contains(p.type()))throw new BankException(400,"INVALID_VERIFICATION_METHOD","Choose SMS or email.");
  var source=accounts.get(user,p.sourceAccountId());
  if(!"active".equals(source.status()) || !List.of("checking","savings").contains(source.type()))throw new BankException(400,"ACCOUNT_NOT_ELIGIBLE","Choose an active deposit account.");
  String destination;
  if("internal".equals(p.type())){if(p.targetAccountId()==null || p.targetAccountId().equals(p.sourceAccountId()))throw new BankException(400,"INVALID_TARGET","Choose a different destination account.");var target=accounts.get(user,p.targetAccountId());if(!"active".equals(target.status()) || !List.of("checking","savings").contains(target.type()))throw new BankException(400,"ACCOUNT_NOT_ELIGIBLE","Choose an active deposit account.");destination=p.targetAccountId().toString();}
  else {if(p.recipientUsername()==null || !p.recipientUsername().matches("[a-z0-9][a-z0-9._-]{2,79}"))throw new BankException(400,"INVALID_RECIPIENT","Enter a Hikyu username.");destination=payments.lookup(user,new Lookup(p.recipientUsername())).username();}
  return issueBound(user,session,payload(p.type(),p.sourceAccountId(),destination,p.amount(),p.note(),p.idempotencyKey()),p.method());
 }
 @Transactional public Challenge issueBound(UUID user,String session,String fingerprint,String method){
  if(!List.of("sms","email").contains(method==null?"":method))throw new BankException(400,"INVALID_VERIFICATION_METHOD","Choose SMS or email.");
  store.lockUser(user);Instant now=clock.instant();
  if(store.recentCount(user,now.minusSeconds(600))>=10)throw new BankException(429,"VERIFICATION_RATE_LIMIT","Too many payment codes. Try again in 10 minutes.");
  UUID id=UUID.randomUUID();String code=String.format(Locale.ROOT,"%06d",random.nextInt(1000000));Instant expires=now.plusSeconds(300);
  store.insert(id,user,hash(session),fingerprint,hash(id+":"+code),method,now,expires);
  return new Challenge(id,method,expires,code,"Demo verification code only. No SMS or email was sent.");
 }
 public <T> T execute(UUID user,String session,String payload,UUID challenge,String code,Supplier<T> action){
  // Commit unsuccessful-code attempts separately, without committing failed financial operations.
  BankException rejected=verificationTx.execute(tx->{var row=locked(user,session,payload,challenge,code);if(!hash(challenge+":"+code).equals(row.get("code_hash"))){store.failedAttempt(challenge);return new BankException(400,"INVALID_PAYMENT_CODE","The payment verification code is incorrect.");}return null;});
  if(rejected!=null)throw rejected;
  return financialTx.execute(tx->{locked(user,session,payload,challenge,code);T receipt=action.get();store.consume(challenge);return receipt;});
 }
 private Map<String,Object> locked(UUID user,String session,String payload,UUID challenge,String code){
  if(challenge==null || code==null || !code.matches("[0-9]{6}"))throw new BankException(400,"PAYMENT_VERIFICATION_REQUIRED","Request and enter a six-digit payment verification code.");
  var rows=store.lock(user,challenge);
  if(rows.isEmpty())throw new BankException(400,"INVALID_PAYMENT_VERIFICATION","Payment verification was not found.");var row=rows.get(0);
  if(!hash(session).equals(row.get("session_hash")) || !payload.equals(row.get("payload_hash")))throw new BankException(400,"PAYMENT_VERIFICATION_MISMATCH","Payment details changed. Request a new verification code.");
  if(((Integer)row.get("attempts"))>=5)throw new BankException(429,"PAYMENT_VERIFICATION_LOCKED","Too many incorrect codes. Request a new code.");
  if(!Boolean.TRUE.equals(row.get("consumed")) && !((Timestamp)row.get("expires_at")).toInstant().isAfter(clock.instant()))throw new BankException(400,"PAYMENT_VERIFICATION_EXPIRED","Payment code expired. Request a new code.");
  return row;
 }
}
