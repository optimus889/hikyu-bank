package hikyubank.dataaccess.postgresql;

import hikyubank.application.model.Notification;
import hikyubank.dataaccess.repository.NotificationRepository;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Content and per-user inbox state are stored separately; responses stay compatible. */
@Repository
public class PostgresNotificationRepository implements NotificationRepository {
    private final JdbcTemplate jdbc;

    private static final String SELECT_OWNED = """
        SELECT n.*, COALESCE(a.account_id, direct.account_id) AS account_id,
            recipient.is_read, recipient.resolved
        FROM hikyu.notifications n
        JOIN hikyu.notification_recipients recipient ON recipient.notification_id = n.id
        LEFT JOIN hikyu.alerts a ON a.id = n.alert_id
        LEFT JOIN hikyu.notification_account_links direct ON direct.notification_id = n.id
        WHERE recipient.user_id = ?
        """;

    private static final RowMapper<Notification> ROW = (rs, index) -> new Notification(
        rs.getObject("id", UUID.class), rs.getObject("alert_id", UUID.class),
        rs.getObject("account_id", UUID.class), rs.getString("title"), rs.getString("body"),
        rs.getTimestamp("created_at").toInstant().toString(),
        rs.getBoolean("is_read"), rs.getBoolean("resolved"), rs.getString("source")
    );

    public PostgresNotificationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Notification> findAll(UUID userId) {
        return jdbc.query(SELECT_OWNED + " ORDER BY n.created_at DESC, n.id", ROW, userId);
    }

    @Override
    public Optional<Notification> findById(UUID userId, UUID id) {
        return jdbc.query(SELECT_OWNED + " AND n.id = ?", ROW, userId, id)
            .stream().findFirst();
    }

    @Override
    @Transactional
    public Notification save(UUID userId, Notification item) {
        validateSubject(userId, item);
        int inserted = jdbc.update("""
            INSERT INTO hikyu.notifications (id, alert_id, title, body, created_at, source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
            """,
            item.id(), item.alertId(), item.title(), item.body(),
            Timestamp.from(Instant.parse(item.createdAt())), item.source()
        );
        if (inserted == 1) {
            if (item.alertId() == null && item.accountId() != null) {
                jdbc.update("""
                    INSERT INTO hikyu.notification_account_links (notification_id, account_id)
                    VALUES (?, ?)
                    """, item.id(), item.accountId());
            }
            jdbc.update("""
                INSERT INTO hikyu.notification_recipients
                    (notification_id, user_id, is_read, resolved)
                VALUES (?, ?, ?, ?)
                """, item.id(), userId, item.read(), item.resolved());
        } else {
            // An existing ID cannot be claimed or have its subject rewritten.
            Notification current = findById(userId, item.id()).orElseThrow(() ->
                new DataIntegrityViolationException("Record ownership cannot be changed.")
            );
            if (!java.util.Objects.equals(current.alertId(), item.alertId())
                || !java.util.Objects.equals(current.accountId(), item.accountId())) {
                throw new DataIntegrityViolationException("Notification subject is immutable.");
            }
            jdbc.update("""
                UPDATE hikyu.notification_recipients SET is_read = ?, resolved = ?
                WHERE notification_id = ? AND user_id = ?
                """, item.read(), item.resolved(), item.id(), userId);
        }
        return findById(userId, item.id()).orElseThrow();
    }

    private void validateSubject(UUID userId, Notification item) {
        if (item.alertId() != null) {
            List<UUID> accounts = jdbc.query("""
                SELECT a.account_id FROM hikyu.alerts a
                JOIN hikyu.accounts acc ON acc.id = a.account_id
                WHERE a.id = ? AND acc.user_id = ? FOR UPDATE OF a
                """, (rs, index) -> rs.getObject(1, UUID.class), item.alertId(), userId);
            if (accounts.isEmpty() || !accounts.get(0).equals(item.accountId())) {
                throw new DataIntegrityViolationException("Invalid notification alert subject.");
            }
        } else if (item.accountId() != null) {
            Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM hikyu.accounts WHERE id = ? AND user_id = ?
                """, Integer.class, item.accountId(), userId);
            if (count == null || count != 1) {
                throw new DataIntegrityViolationException("Invalid notification account subject.");
            }
        }
    }

    @Override
    @Transactional
    public void deleteById(UUID userId, UUID id) {
        // Serialize recipient changes before pruning an event with no recipients.
        jdbc.query("""
            SELECT n.id FROM hikyu.notifications n
            JOIN hikyu.notification_recipients r ON r.notification_id = n.id
            WHERE n.id = ? AND r.user_id = ? FOR UPDATE OF n
            """, (rs, index) -> rs.getObject(1, UUID.class), id, userId);
        int changed = jdbc.update("""
            DELETE FROM hikyu.notification_recipients
            WHERE notification_id = ? AND user_id = ?
            """, id, userId);
        if (changed == 1) {
            jdbc.update("""
                DELETE FROM hikyu.notifications n WHERE n.id = ?
                AND NOT EXISTS (
                    SELECT 1 FROM hikyu.notification_recipients r WHERE r.notification_id = n.id
                )
                """, id);
        }
    }
}
