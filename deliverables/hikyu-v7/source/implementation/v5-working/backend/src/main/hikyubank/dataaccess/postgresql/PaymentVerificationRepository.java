package hikyubank.dataaccess.postgresql;
import java.util.*;import java.time.Instant;import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.stereotype.Repository;
@Repository public class PaymentVerificationRepository {
 private final JdbcTemplate jdbc;
 public PaymentVerificationRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public void lockUser(UUID user){jdbc.query("SELECT id FROM hikyu.users WHERE id=? FOR UPDATE",(rs,n)->rs.getObject(1),user);}
 public int recentCount(UUID user,Instant since){return jdbc.queryForObject("SELECT count(*) FROM hikyu.payment_verifications WHERE user_id=? AND created_at>?",Integer.class,user,Timestamp.from(since));}
 public void insert(UUID id,UUID user,String session,String payload,String code,String method,Instant now,Instant expires){jdbc.update("INSERT INTO hikyu.payment_verifications(id,user_id,session_hash,payload_hash,code_hash,method,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",id,user,session,payload,code,method,Timestamp.from(now),Timestamp.from(expires));}
 public List<Map<String,Object>> lock(UUID user,UUID id){return jdbc.queryForList("SELECT * FROM hikyu.payment_verifications WHERE id=? AND user_id=? FOR UPDATE",id,user);}
 public void failedAttempt(UUID id){jdbc.update("UPDATE hikyu.payment_verifications SET attempts=attempts+1 WHERE id=?",id);}
 public void consume(UUID id){jdbc.update("UPDATE hikyu.payment_verifications SET consumed=TRUE WHERE id=?",id);}
}
