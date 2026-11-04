package hikyubank.dataaccess.postgresql;
import java.util.*;
import java.math.BigDecimal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import hikyubank.application.dto.ExtensionDtos.*;
@Repository
public class ExtensionRepository {
 private final JdbcTemplate jdbc;
 public ExtensionRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public long authVersion(String username){return jdbc.queryForObject("SELECT auth_version FROM hikyu.users WHERE username=?",Long.class,username);}
 public Preferences preferences(UUID user){var rows=jdbc.query("SELECT low_balance,large_transaction FROM hikyu.user_preferences WHERE user_id=?",(rs,n)->new Preferences(rs.getBoolean(1),rs.getBoolean(2)),user);return rows.isEmpty()?new Preferences(true,true):rows.get(0);}
 public void preferences(UUID user,Preferences p){jdbc.update("INSERT INTO hikyu.user_preferences(user_id,low_balance,large_transaction) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET low_balance=EXCLUDED.low_balance,large_transaction=EXCLUDED.large_transaction",user,p.lowBalance(),p.largeTransaction());}
 public List<Receipt> transfers(UUID user){return jdbc.query("SELECT * FROM hikyu.transfers WHERE user_id=? ORDER BY created_at DESC,id LIMIT 100",(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getObject("source_account_id",UUID.class),rs.getObject("target_account_id",UUID.class),rs.getBigDecimal("amount"),rs.getString("note"),rs.getTimestamp("created_at").toInstant(),"completed"),user);}
 public Receipt receipt(UUID user,UUID key){var rows=jdbc.query("SELECT * FROM hikyu.transfers WHERE user_id=? AND idempotency_key=?",(rs,n)->new Receipt(rs.getObject("id",UUID.class),rs.getObject("source_account_id",UUID.class),rs.getObject("target_account_id",UUID.class),rs.getBigDecimal("amount"),rs.getString("note"),rs.getTimestamp("created_at").toInstant(),"completed"),user,key);return rows.isEmpty()?null:rows.get(0);}
 public void lockUser(UUID user){jdbc.query("SELECT id FROM hikyu.users WHERE id=? FOR UPDATE",(rs,n)->rs.getObject(1),user);}
 public List<Map<String,Object>> lockAccounts(UUID user,UUID source,UUID target){return jdbc.queryForList("SELECT id,type,status,balance FROM hikyu.accounts WHERE user_id=? AND id IN (?,?) ORDER BY id FOR UPDATE",user,source,target);}
 public void insertTransfer(UUID id,UUID user,hikyubank.application.dto.ExtensionDtos.TransferInput input,String note,java.time.Instant now){jdbc.update("INSERT INTO hikyu.transfers(id,user_id,source_account_id,target_account_id,amount,note,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?)",id,user,input.sourceAccountId(),input.targetAccountId(),input.amount(),note,input.idempotencyKey(),java.sql.Timestamp.from(now));}
 public void adjustBalance(UUID id,BigDecimal delta){jdbc.update("UPDATE hikyu.accounts SET balance=balance+? WHERE id=?",delta,id);}
 public void insertLeg(UUID id,UUID account,boolean debit,BigDecimal amount,String note,UUID transfer,java.time.Instant now){jdbc.update("INSERT INTO hikyu.transactions(id,account_id,name,category,posted_date,amount,icon,kind,note,transfer_id) VALUES (?,?,?,?,?,?,?,?,?,?)",id,account,debit?"Transfer out":"Transfer in","Internal transfer",java.sql.Date.valueOf(java.time.LocalDate.ofInstant(now,java.time.ZoneOffset.UTC)),debit?amount.negate():amount,"↔","transfer",note,transfer);}
 public BigDecimal balance(UUID account){return jdbc.queryForObject("SELECT balance FROM hikyu.accounts WHERE id=?",BigDecimal.class,account);}
 public boolean claimEvent(UUID transfer,UUID alert){return jdbc.update("INSERT INTO hikyu.alert_events(event_id,alert_id) VALUES (?,?) ON CONFLICT DO NOTHING",transfer,alert)==1;}
 public void linkEvent(UUID transfer,UUID alert,UUID notification){jdbc.update("UPDATE hikyu.alert_events SET notification_id=? WHERE event_id=? AND alert_id=?",notification,transfer,alert);}
 public void nickname(UUID user,UUID id,String name){jdbc.update("UPDATE hikyu.accounts SET name=? WHERE id=? AND user_id=?",name,id,user);}
 public String passwordHash(UUID user){return jdbc.queryForObject("SELECT password_hash FROM hikyu.users WHERE id=?",String.class,user);}
 public String pinHash(UUID user){return jdbc.queryForObject("SELECT pin_hash FROM hikyu.users WHERE id=?",String.class,user);}
 public boolean changePassword(UUID user,String old,String next){return jdbc.update("UPDATE hikyu.users SET password_hash=?,auth_version=auth_version+1 WHERE id=? AND password_hash=?",next,user,old)==1;}
 public boolean register(UUID user,String username,String first,String last,String hash,String pin){return jdbc.update("INSERT INTO hikyu.users(id,username,first_name,last_name,display_name,password_hash,pin_hash,masked_phone,masked_email,pin_initialized) VALUES (?,?,?,?,?,?,?,?,?,TRUE) ON CONFLICT(username) DO NOTHING",user,username,first,last,first+" "+last,hash,pin,"Demo SMS","Demo email")==1;}
 public void starterAccount(UUID user,boolean checking,String suffix){jdbc.update("INSERT INTO hikyu.accounts(id,user_id,type,name,suffix,balance,status) VALUES (?,?,?,?,?,?,?)",UUID.randomUUID(),user,checking?"checking":"savings",checking?"Everyday Checking":"Everyday Saving",suffix,checking?1000:200,"active");}
 public void changePin(UUID user,String pin){jdbc.update("UPDATE hikyu.users SET pin_hash=?,pin_initialized=TRUE,auth_version=auth_version+1 WHERE id=?",pin,user);}
 public void revoke(UUID user){jdbc.update("UPDATE hikyu.users SET auth_version=auth_version+1 WHERE id=?",user);}
 public List<Map<String,Object>> uninitializedPins(){return jdbc.queryForList("SELECT id,username FROM hikyu.users WHERE NOT pin_initialized ORDER BY id FOR UPDATE");}
 public void markPinInitialized(UUID user){jdbc.update("UPDATE hikyu.users SET pin_initialized=TRUE WHERE id=?",user);}
}
