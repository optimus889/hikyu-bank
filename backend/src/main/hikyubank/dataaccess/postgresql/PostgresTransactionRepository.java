package hikyubank.dataaccess.postgresql;

import java.util.UUID;
import hikyubank.application.model.Transaction;
import hikyubank.dataaccess.repository.TransactionRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Parameterized SQL; ownership is included in every query and write. */
@Repository
public class PostgresTransactionRepository implements TransactionRepository {
    private final JdbcTemplate jdbc;

    public PostgresTransactionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Transaction> ROW = (rs, index) -> new Transaction(
        rs.getObject("id", UUID.class), rs.getObject("account_id", UUID.class), rs.getString("name"),
        rs.getString("category"), rs.getString("posted_date"),
        rs.getBigDecimal("amount"), rs.getString("icon")
    );

    private static final String SELECT_OWNED = """
        SELECT record.* FROM hikyu.transactions record
        JOIN hikyu.accounts account ON account.id = record.account_id
        WHERE account.user_id = ?
        """;

    @Override
    public List<Transaction> findAll(UUID userId) {
        return jdbc.query(SELECT_OWNED + " ORDER BY record.posted_date DESC, record.id", ROW, userId);
    }

    @Override
    public Optional<Transaction> findById(UUID userId, UUID id) {
        return jdbc.query(SELECT_OWNED + " AND record.id = ?", ROW, userId, id)
            .stream().findFirst();
    }

    @Override
    public Transaction save(UUID userId, Transaction item) {
        int changed = jdbc.update("""
            INSERT INTO hikyu.transactions (id, account_id, name, category, posted_date, amount, icon)
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
                SELECT 1 FROM hikyu.accounts WHERE id = ? AND user_id = ?
            )
            ON CONFLICT (id) DO UPDATE SET
                account_id = EXCLUDED.account_id,
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                posted_date = EXCLUDED.posted_date,
                amount = EXCLUDED.amount,
                icon = EXCLUDED.icon
            WHERE EXISTS (
                SELECT 1 FROM hikyu.accounts
                WHERE accounts.id = transactions.account_id AND accounts.user_id = ?
            )
            """,
            item.id(), item.accountId(), item.name(), item.category(),
            java.sql.Date.valueOf(item.date()), item.amount(), item.icon(),
            item.accountId(), userId, userId
        );
        if (changed != 1) {
            throw new org.springframework.dao.DataIntegrityViolationException(
                "Record ownership cannot be changed."
            );
        }
        return item;
    }
}
