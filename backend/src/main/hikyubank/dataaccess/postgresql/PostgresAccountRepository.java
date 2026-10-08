package hikyubank.dataaccess.postgresql;

import java.util.UUID;
import hikyubank.application.model.Account;
import hikyubank.dataaccess.repository.AccountRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Parameterized SQL; ownership is included in every query and write. */
@Repository
public class PostgresAccountRepository implements AccountRepository {
    private final JdbcTemplate jdbc;

    public PostgresAccountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Account> ROW = (rs, index) -> new Account(
        rs.getObject("id", UUID.class), rs.getString("type"), rs.getString("name"),
        rs.getString("suffix"), rs.getBigDecimal("balance"), rs.getString("status"),
        rs.getBigDecimal("credit_limit"), rs.getBigDecimal("minimum_due"),
        rs.getString("due_date")
    );

    @Override
    public List<Account> findAll(UUID userId) {
        return jdbc.query(
            """
            SELECT * FROM hikyu.accounts WHERE user_id = ?
            ORDER BY CASE type
                WHEN 'checking' THEN 1 WHEN 'savings' THEN 2 WHEN 'credit' THEN 3 ELSE 4
            END, name, id
            """, ROW, userId
        );
    }

    @Override
    public Optional<Account> findById(UUID userId, UUID id) {
        return jdbc.query(
            "SELECT * FROM hikyu.accounts WHERE user_id = ? AND id = ?",
            ROW, userId, id
        ).stream().findFirst();
    }

    @Override
    public Account save(UUID userId, Account item) {
        int changed = jdbc.update("""
            INSERT INTO hikyu.accounts (
                id, user_id, type, name, suffix,
                balance, status, credit_limit, minimum_due, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                type = EXCLUDED.type,
                name = EXCLUDED.name,
                suffix = EXCLUDED.suffix,
                balance = EXCLUDED.balance,
                status = EXCLUDED.status,
                credit_limit = EXCLUDED.credit_limit,
                minimum_due = EXCLUDED.minimum_due,
                due_date = EXCLUDED.due_date
            WHERE accounts.user_id = EXCLUDED.user_id
            """,
            item.id(), userId, item.type(),
            item.name(), item.suffix(), item.balance(),
            item.status(), item.limit(), item.minimumDue(),
            item.dueDate() == null ? null : java.sql.Date.valueOf(item.dueDate())
        );
        if (changed != 1) {
            throw new org.springframework.dao.DataIntegrityViolationException(
                "Record ownership cannot be changed."
            );
        }
        return item;
    }
}
