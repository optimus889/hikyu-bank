package hikyubank.dataaccess.postgresql;
import java.util.*;import java.math.BigDecimal;import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.stereotype.Repository;
import hikyubank.application.dto.ExtensionDtos.Page;import hikyubank.application.model.Transaction;
@Repository
public class TransactionQueryRepository {
 private final JdbcTemplate jdbc;
 public TransactionQueryRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
 private Transaction row(java.sql.ResultSet rs,int n)throws java.sql.SQLException{return new Transaction(rs.getObject("id",UUID.class),rs.getObject("account_id",UUID.class),rs.getString("name"),rs.getString("category"),rs.getString("posted_date"),rs.getBigDecimal("amount"),rs.getString("icon"),rs.getString("kind"),rs.getString("note"),rs.getObject("transfer_id",UUID.class),rs.getObject("peer_payment_id",UUID.class),rs.getObject("operation_id",UUID.class));}
 public Transaction detail(UUID user,UUID id){var list=jdbc.query("SELECT t.* FROM hikyu.transactions t JOIN hikyu.accounts a ON a.id=t.account_id WHERE a.user_id=? AND t.id=?",this::row,user,id);return list.isEmpty()?null:list.get(0);}
 public Page search(UUID user,UUID account,LocalDate from,LocalDate to,BigDecimal min,BigDecimal max,String kind,String q,String category,String order,int page,int size){
  StringBuilder where=new StringBuilder(" FROM hikyu.transactions t JOIN hikyu.accounts a ON a.id=t.account_id WHERE a.user_id=?");List<Object> args=new ArrayList<>();args.add(user);
  if(account!=null){where.append(" AND t.account_id=?");args.add(account);}
  if(from!=null){where.append(" AND t.posted_date>=?");args.add(java.sql.Date.valueOf(from));}
  if(to!=null){where.append(" AND t.posted_date<=?");args.add(java.sql.Date.valueOf(to));}
  if(min!=null){where.append(" AND abs(t.amount)>=?");args.add(min);}
  if(max!=null){where.append(" AND abs(t.amount)<=?");args.add(max);}
  if(kind.equals("income")){where.append(" AND (t.kind='income' OR (t.kind='peer_transfer' AND t.amount>0))");}
  else if(kind.equals("expense")){where.append(" AND (t.kind='expense' OR (t.kind='peer_transfer' AND t.amount<0))");}
  else if(!kind.equals("all")){where.append(" AND t.kind=?");args.add(kind);}
  if(!q.isBlank()){where.append(" AND position(lower(?) in lower(t.name || ' ' || t.category || ' ' || t.note))>0");args.add(q);}
  if(!category.isBlank()){where.append(" AND t.category=?");args.add(category);}
  long total=jdbc.queryForObject("SELECT count(*)"+where,Long.class,args.toArray());
  String sort=switch(order){case "date_asc"->"t.posted_date ASC";case "amount_desc"->"abs(t.amount) DESC";case "amount_asc"->"abs(t.amount) ASC";default->"t.posted_date DESC";};
  args.add(size);args.add(page*size);
  return new Page(jdbc.query("SELECT t.*"+where+" ORDER BY "+sort+", t.id LIMIT ? OFFSET ?",this::row,args.toArray()),total,page,size);
 }
}
