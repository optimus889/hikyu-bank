package hikyubank.application.service;

import java.util.*;
import java.math.BigDecimal;
import java.time.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import hikyubank.application.dto.PaymentDtos.*;
import hikyubank.application.exception.BankException;
import hikyubank.application.model.Notification;
import hikyubank.dataaccess.postgresql.*;
import hikyubank.dataaccess.repository.*;

@Service
public class PaymentService {
    private final PaymentRepository payments;
    private final ExtensionRepository store;
    private final SecurityService security;
    private final AlertService alerts;
    private final NotificationRepository notifications;
    private final Clock clock;
    public PaymentService(PaymentRepository payments,ExtensionRepository store,SecurityService security,
            AlertService alerts,NotificationRepository notifications,Clock clock) {
        this.payments=payments;this.store=store;this.security=security;this.alerts=alerts;
        this.notifications=notifications;this.clock=clock;
    }
    private PaymentRepository.Destination destination(UUID sender,String username) {
        var destination=payments.destination(username);
        if(destination==null)throw new BankException(404,"RECIPIENT_NOT_FOUND","No eligible recipient Checking account was found.");
        if(destination.userId().equals(sender))throw new BankException(400,"SELF_PAYMENT","Use Between my accounts for your own accounts.");
        return destination;
    }
    public Recipient lookup(UUID sender,Lookup input) {
        var d=destination(sender,input.username());
        return new Recipient(d.username(),d.name(),"Checking ending "+d.suffix());
    }
    public List<Receipt> history(UUID user) { return payments.history(user); }
    @Transactional public Receipt send(UUID sender,Input input) {
        if(input.amount()==null || input.amount().signum()<=0 || input.amount().scale()>2 || input.amount().compareTo(new BigDecimal("1000000"))>0)
            throw new BankException(400,"INVALID_AMOUNT","Enter a positive amount with at most two decimal places.");
        security.verifyPin(sender,input.pin());
        var recipient=destination(sender,input.recipientUsername());
        payments.lockUsers(sender,recipient.userId());
        String note=input.note()==null?"":input.note().trim();
        var old=payments.existing(sender,input.idempotencyKey());
        if(old!=null) {
            if(!payments.sourceFor(old.id()).equals(input.sourceAccountId()) || !old.recipientUsername().equals(input.recipientUsername())
                || old.amount().compareTo(input.amount())!=0 || !old.note().equals(note))
                throw new BankException(409,"IDEMPOTENCY_CONFLICT","This request key belongs to a different payment.");
            return old;
        }
        var accounts=payments.lockAccounts(input.sourceAccountId(),recipient.accountId());
        var source=accounts.stream().filter(a->input.sourceAccountId().equals(a.get("id")) && sender.equals(a.get("user_id"))).findFirst().orElseThrow(()->new BankException(404,"ACCOUNT_NOT_FOUND","Source account not found."));
        var target=accounts.stream().filter(a->recipient.accountId().equals(a.get("id")) && recipient.userId().equals(a.get("user_id"))).findFirst().orElseThrow(()->new BankException(404,"RECIPIENT_NOT_FOUND","Recipient account not found."));
        if(!"active".equals(source.get("status")) || !List.of("checking","savings").contains(source.get("type")) || !"active".equals(target.get("status")))
            throw new BankException(400,"ACCOUNT_NOT_ELIGIBLE","Use active Checking or Saving accounts.");
        if(((BigDecimal)source.get("balance")).compareTo(input.amount())<0)
            throw new BankException(409,"INSUFFICIENT_FUNDS","The source account has insufficient funds.");
        UUID id=UUID.randomUUID();Instant now=clock.instant();
        String senderName=payments.senderName(sender);
        payments.insert(id,sender,recipient,input,note,now);
        store.adjustBalance(input.sourceAccountId(),input.amount().negate());
        store.adjustBalance(recipient.accountId(),input.amount());
        payments.leg(id,input.sourceAccountId(),true,recipient.name(),input.amount(),note,now);
        payments.leg(id,recipient.accountId(),false,senderName,input.amount(),note,now);
        notifyReceipt(sender,input.sourceAccountId(),"Payment sent","You sent $"+input.amount()+" to "+recipient.name()+".",now);
        notifyReceipt(recipient.userId(),recipient.accountId(),"Payment received",senderName+" sent you $"+input.amount()+".",now);
        trigger(sender,input.sourceAccountId(),id,input.amount(),now);
        trigger(recipient.userId(),recipient.accountId(),id,input.amount(),now);
        return payments.existing(sender,input.idempotencyKey());
    }
    private void notifyReceipt(UUID user,UUID account,String title,String text,Instant now) {
        notifications.save(user,new Notification(UUID.randomUUID(),null,account,title,text+" Simulation only. No external payment was made.",now.toString(),false,false,"payment"));
    }
    private void trigger(UUID user,UUID account,UUID payment,BigDecimal amount,Instant now) {
        var preferences=store.preferences(user);BigDecimal balance=store.balance(account);
        for(var rule:alerts.list(user)) {
            if(!rule.enabled() || !rule.accountId().equals(account))continue;
            boolean fire=("low_balance".equals(rule.type()) && preferences.lowBalance() && balance.compareTo(rule.amount())<0)
                || ("large_transaction".equals(rule.type()) && preferences.largeTransaction() && amount.compareTo(rule.amount())>=0);
            if(!fire || !payments.claim(payment,rule.id()))continue;
            UUID notification=UUID.randomUUID();
            notifications.save(user,new Notification(notification,rule.id(),account,rule.title(),"Your simulated payment triggered this reminder. Amount: $"+amount+". Balance: $"+balance+".",now.toString(),false,false,"payment"));
            payments.link(payment,rule.id(),notification);
        }
    }
}
