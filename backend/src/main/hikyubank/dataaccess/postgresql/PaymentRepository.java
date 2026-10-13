package hikyubank.dataaccess.postgresql;

import java.util.*;
import java.math.BigDecimal;
import java.time.*;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import hikyubank.application.dto.PaymentDtos.*;

@Repository
public class PaymentRepository {
    private final JdbcTemplate jdbc;
    public PaymentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Destination(UUID userId,UUID accountId,String username,String name,String suffix) {}
    public Destination destination(String username) {
        var rows = jdbc.query("""
            SELECT u.id AS user_id,a.id AS account_id,u.username,u.first_name,u.last_name,a.suffix
            FROM hikyu.users u JOIN hikyu.accounts a ON a.user_id=u.id
            WHERE u.username=? AND a.type='checking' AND a.status='active' ORDER BY a.id LIMIT 1
            """, (rs,n) -> new Destination(rs.getObject("user_id",UUID.class),rs.getObject("account_id",UUID.class),
                rs.getString("username"),rs.getString("first_name")+" "+rs.getString("last_name"),rs.getString("suffix")),username);
        return rows.isEmpty() ? null : rows.get(0);
    }
    public void lockUsers(UUID sender,UUID recipient) {
        jdbc.query("SELECT id FROM hikyu.users WHERE id IN (?,?) ORDER BY id FOR UPDATE",(rs,n)->rs.getObject(1),sender,recipient);
    }
    public List<Map<String,Object>> lockAccounts(UUID source,UUID target) {
        return jdbc.queryForList("SELECT id,user_id,type,status,balance FROM hikyu.accounts WHERE id IN (?,?) ORDER BY id FOR UPDATE",source,target);
    }
    private static final String SELECT = """
        SELECT p.*,s.username AS sender_username,s.first_name||' '||s.last_name AS sender_name,
            r.username AS recipient_username,r.first_name||' '||r.last_name AS recipient_name
        FROM hikyu.peer_payments p JOIN hikyu.users s ON s.id=p.sender_id JOIN hikyu.users r ON r.id=p.recipient_id
        """;
    private Receipt row(java.sql.ResultSet rs,UUID user) throws java.sql.SQLException {
        return new Receipt(rs.getObject("id",UUID.class),rs.getString("sender_username"),rs.getString("sender_name"),
            rs.getString("recipient_username"),rs.getString("recipient_name"),rs.getBigDecimal("amount"),rs.getString("note"),
            rs.getTimestamp("created_at").toInstant(),user.equals(rs.getObject("sender_id",UUID.class))?"sent":"received","completed");
    }
    public Receipt existing(UUID sender,UUID key) {
        var rows=jdbc.query(SELECT+" WHERE p.sender_id=? AND p.idempotency_key=?",(rs,n)->row(rs,sender),sender,key);
        return rows.isEmpty()?null:rows.get(0);
    }
    public String senderName(UUID id) { return jdbc.queryForObject("SELECT first_name||' '||last_name FROM hikyu.users WHERE id=?",String.class,id); }
    public UUID sourceFor(UUID id) { return jdbc.queryForObject("SELECT source_account_id FROM hikyu.peer_payments WHERE id=?",UUID.class,id); }
    public List<Receipt> history(UUID user) {
        return jdbc.query(SELECT+" WHERE p.sender_id=? OR p.recipient_id=? ORDER BY p.created_at DESC,p.id LIMIT 100",(rs,n)->row(rs,user),user,user);
    }
    public void insert(UUID id,UUID sender,Destination recipient,Input input,String note,Instant now) {
        jdbc.update("INSERT INTO hikyu.peer_payments(id,sender_id,recipient_id,source_account_id,target_account_id,amount,note,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id,sender,recipient.userId(),input.sourceAccountId(),recipient.accountId(),input.amount(),note,input.idempotencyKey(),Timestamp.from(now));
    }
    public void leg(UUID payment,UUID account,boolean debit,String counterparty,BigDecimal amount,String note,Instant now) {
        jdbc.update("INSERT INTO hikyu.transactions(id,account_id,name,category,posted_date,amount,icon,kind,note,peer_payment_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
            UUID.randomUUID(),account,(debit?"Payment to ":"Payment from ")+counterparty,"Peer transfer",
            java.sql.Date.valueOf(LocalDate.ofInstant(now,ZoneOffset.UTC)),debit?amount.negate():amount,"↔","peer_transfer",note,payment);
    }
    public boolean claim(UUID payment,UUID alert) {
        return jdbc.update("INSERT INTO hikyu.peer_alert_events(payment_id,alert_id) VALUES (?,?) ON CONFLICT DO NOTHING",payment,alert)==1;
    }
    public void link(UUID payment,UUID alert,UUID notification) {
        jdbc.update("UPDATE hikyu.peer_alert_events SET notification_id=? WHERE payment_id=? AND alert_id=?",notification,payment,alert);
    }
}
