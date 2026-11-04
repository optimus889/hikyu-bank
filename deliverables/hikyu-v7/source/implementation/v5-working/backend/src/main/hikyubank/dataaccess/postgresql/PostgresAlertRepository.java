package hikyubank.dataaccess.postgresql;

import java.util.UUID;
import hikyubank.application.model.Alert;
import hikyubank.dataaccess.repository.AlertRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Parameterized SQL; ownership is included in every query and write. */
@Repository
public class PostgresAlertRepository implements AlertRepository {
    private final JdbcTemplate jdbc;

    public PostgresAlertRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Alert> ROW = (rs, index) -> new Alert(
        rs.getObject("id", UUID.class), rs.getString("type"), rs.getObject("account_id", UUID.class),
        rs.getString("title"), rs.getString("channel"), rs.getBigDecimal("amount"),
        rs.getString("scheduled_date"), rs.getBoolean("enabled")
    );

    private static final String SELECT_OWNED = """
        SELECT record.* FROM hikyu.alerts record
        JOIN hikyu.accounts account ON account.id = record.account_id
        WHERE account.user_id = ?
        """;

    @Override
    public List<Alert> findAll(UUID userId) {
        return jdbc.query(SELECT_OWNED + " ORDER BY record.title, record.id", ROW, userId);
    }

    @Override
    public Optional<Alert> findById(UUID userId, UUID id) {
        return jdbc.query(SELECT_OWNED + " AND record.id = ?", ROW, userId, id)
            .stream().findFirst();
    }

    @Override
    public Alert save(UUID userId, Alert item) {
        int changed = jdbc.update("""
            INSERT INTO hikyu.alerts (id, account_id, type, title, channel, amount, scheduled_date, enabled)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
                SELECT 1 FROM hikyu.accounts WHERE id = ? AND user_id = ?
            )
            ON CONFLICT (id) DO UPDATE SET
                account_id = EXCLUDED.account_id,
                type = EXCLUDED.type,
                title = EXCLUDED.title,
                channel = EXCLUDED.channel,
                amount = EXCLUDED.amount,
                scheduled_date = EXCLUDED.scheduled_date,
                enabled = EXCLUDED.enabled
            WHERE EXISTS (
                SELECT 1 FROM hikyu.accounts
                WHERE accounts.id = alerts.account_id AND accounts.user_id = ?
            )
            """,
            item.id(), item.accountId(), item.type(), item.title(), item.channel(),
            item.amount(), item.date() == null ? null : java.sql.Date.valueOf(item.date()),
            item.enabled(),
            item.accountId(), userId, userId
        );
        if (changed != 1) {
            throw new org.springframework.dao.DataIntegrityViolationException(
                "Record ownership cannot be changed."
            );
        }
        return item;
    }

    @Override
    public void deleteById(UUID userId, UUID id) {
        jdbc.update("""
            DELETE FROM hikyu.alerts
            WHERE id = ? AND EXISTS (
                SELECT 1 FROM hikyu.accounts
                WHERE accounts.id = alerts.account_id AND accounts.user_id = ?
            )
            """, id, userId);
    }
}
