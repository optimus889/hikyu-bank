package hikyubank.application.model;
import java.util.UUID;import java.math.BigDecimal;
public record Transaction(UUID id,UUID accountId,String name,String category,String date,BigDecimal amount,String icon,String kind,String note,UUID transferId,UUID peerPaymentId,UUID operationId) {
 public Transaction(UUID id,UUID accountId,String name,String category,String date,BigDecimal amount,String icon,String kind,String note,UUID transferId,UUID peerPaymentId){this(id,accountId,name,category,date,amount,icon,kind,note,transferId,peerPaymentId,null);}
 public Transaction(UUID id,UUID accountId,String name,String category,String date,BigDecimal amount,String icon,String kind,String note,UUID transferId){this(id,accountId,name,category,date,amount,icon,kind,note,transferId,null);}
 public Transaction(UUID id,UUID accountId,String name,String category,String date,BigDecimal amount,String icon){this(id,accountId,name,category,date,amount,icon,amount.signum()>=0?"income":"expense","",null);}
}
