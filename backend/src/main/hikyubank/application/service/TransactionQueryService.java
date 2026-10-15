package hikyubank.application.service;
import java.util.*;import java.time.LocalDate;import java.math.BigDecimal;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*;
import hikyubank.dataaccess.postgresql.TransactionQueryRepository;import hikyubank.application.dto.ExtensionDtos.Page;import hikyubank.application.model.Transaction;import hikyubank.application.exception.BankException;
@Service
public class TransactionQueryService {
 private final TransactionQueryRepository store;private final AccountService accounts;
 public TransactionQueryService(TransactionQueryRepository store,AccountService accounts){this.store=store;this.accounts=accounts;}
 public Transaction detail(UUID user,UUID id){var t=store.detail(user,id);if(t==null)throw new BankException(404,"TRANSACTION_NOT_FOUND","Transaction not found.");return t;}
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Page search(UUID user,UUID account,LocalDate from,LocalDate to,BigDecimal min,BigDecimal max,String kind,String q,String category,String sort,int page,int size){
  if(page<0 || page>100000 || size<1 || size>50 || q.length()>100 || category.length()>60 || !List.of("all","income","expense","transfer","peer_transfer","credit_payment").contains(kind) || !List.of("date_desc","date_asc","amount_desc","amount_asc").contains(sort) || (from!=null && to!=null && from.isAfter(to)) || (min!=null && min.signum()<0) || (max!=null && max.signum()<0) || (min!=null && max!=null && min.compareTo(max)>0))throw new BankException(400,"INVALID_FILTER","Check dates, amounts, sort and pagination.");
  if(account!=null)accounts.get(user,account);
  return store.search(user,account,from,to,min,max,kind,q.trim(),category,sort,page,size);
 }
}
