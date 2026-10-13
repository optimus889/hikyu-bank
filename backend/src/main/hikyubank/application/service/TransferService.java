package hikyubank.application.service;
import java.util.*;import java.math.BigDecimal;import java.time.*;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import hikyubank.application.dto.ExtensionDtos.*;
import hikyubank.application.exception.BankException;
import hikyubank.application.model.Notification;
import hikyubank.dataaccess.postgresql.ExtensionRepository;
import hikyubank.dataaccess.repository.NotificationRepository;
@Service
public class TransferService {
 private final ExtensionRepository store;private final AlertService alerts;private final NotificationRepository notifications;private final Clock clock;private final SecurityService security;
 public TransferService(ExtensionRepository store,AlertService alerts,NotificationRepository notifications,Clock clock,SecurityService security){this.store=store;this.alerts=alerts;this.notifications=notifications;this.clock=clock;this.security=security;}
 private BankException bad(String code,String message){return new BankException(400,code,message);}
 public List<Receipt> list(UUID user){return store.transfers(user);}
 @Transactional public Receipt transfer(UUID user,TransferInput input){return perform(user,input,true);}
 /** Called only after controller payment-code authorization. */
 @Transactional public Receipt transferVerified(UUID user,TransferInput input){return perform(user,input,false);}
 private Receipt perform(UUID user,TransferInput input,boolean requirePin){
  if(input.amount()==null || input.amount().signum()<=0 || input.amount().scale()>2 || input.amount().compareTo(new BigDecimal("1000000"))>0)throw bad("INVALID_AMOUNT","Enter a positive amount with at most two decimal places.");
  if(input.sourceAccountId().equals(input.targetAccountId()))throw bad("SAME_ACCOUNT","Choose two different accounts.");
  if(requirePin)security.verifyPin(user,input.pin());
  String note=input.note()==null?"":input.note().trim();
  // A persistent user-row lock serializes idempotency checks, even across app instances.
  store.lockUser(user);
  var old=store.receipt(user,input.idempotencyKey());
  if(old!=null){if(!old.sourceAccountId().equals(input.sourceAccountId()) || !old.targetAccountId().equals(input.targetAccountId()) || old.amount().compareTo(input.amount())!=0 || !old.note().equals(note))throw new BankException(409,"IDEMPOTENCY_CONFLICT","This request key belongs to a different transfer.");return old;}
  var rows=store.lockAccounts(user,input.sourceAccountId(),input.targetAccountId());
  if(rows.size()!=2)throw new BankException(404,"ACCOUNT_NOT_FOUND","Account not found.");
  BigDecimal source=null;
  for(var row:rows){if(!List.of("checking","savings").contains(row.get("type")) || !"active".equals(row.get("status")))throw bad("ACCOUNT_NOT_ELIGIBLE","Use active Checking and Saving accounts.");if(input.sourceAccountId().equals(row.get("id")))source=(BigDecimal)row.get("balance");}
  if(source.compareTo(input.amount())<0)throw new BankException(409,"INSUFFICIENT_FUNDS","The source account has insufficient funds.");
  UUID id=UUID.randomUUID();Instant now=clock.instant();
  store.insertTransfer(id,user,input,note,now);
  store.adjustBalance(input.sourceAccountId(),input.amount().negate());
  store.adjustBalance(input.targetAccountId(),input.amount());
  for(boolean debit:new boolean[]{true,false})store.insertLeg(UUID.randomUUID(),debit?input.sourceAccountId():input.targetAccountId(),debit,input.amount(),note,id,now);
  var prefs=store.preferences(user);
  for(var rule:alerts.list(user)){
   if(!rule.enabled() || (!rule.accountId().equals(input.sourceAccountId()) && !rule.accountId().equals(input.targetAccountId())))continue;
   BigDecimal balance=store.balance(rule.accountId());
   boolean fire=("low_balance".equals(rule.type()) && prefs.lowBalance() && balance.compareTo(rule.amount())<0) || ("large_transaction".equals(rule.type()) && prefs.largeTransaction() && input.amount().compareTo(rule.amount())>=0);
   if(!fire)continue;
   if(!store.claimEvent(id,rule.id()))continue;
   UUID notificationId=UUID.randomUUID();
   notifications.save(user,new Notification(notificationId,rule.id(),rule.accountId(),rule.title(),"Your simulated transfer triggered this reminder. Amount: $"+input.amount()+". Account balance: $"+balance+".",now.toString(),false,false,"transfer"));
   store.linkEvent(id,rule.id(),notificationId);
  }
  return new Receipt(id,input.sourceAccountId(),input.targetAccountId(),input.amount(),note,now,"completed");
 }
}
