package hikyubank.dataaccess.postgresql;

import java.util.UUID;
import hikyubank.application.model.DemoUser;
import hikyubank.dataaccess.repository.DemoUserRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Credentials remain server-side; this repository is only used by authentication/seeding. */
@Repository
public class PostgresDemoUserRepository implements DemoUserRepository {
    private final JdbcTemplate jdbc;
    private static final RowMapper<DemoUser> ROW = (rs, index) -> new DemoUser(
        rs.getObject("id", UUID.class), rs.getString("demo_code"), rs.getString("username"),
        rs.getString("display_name") == null
            ? rs.getString("first_name") + " " + rs.getString("last_name")
            : rs.getString("display_name"),
        rs.getString("first_name"), rs.getString("last_name"),
        rs.getString("password_hash"), rs.getString("pin_hash"),
        rs.getString("masked_phone"), rs.getString("masked_email")
    );

    public PostgresDemoUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<DemoUser> findAll() {
        return jdbc.query("SELECT * FROM hikyu.users ORDER BY username", ROW);
    }

    @Override
    public Optional<DemoUser> findByUsername(String username) {
        return jdbc.query(
            "SELECT * FROM hikyu.users WHERE username = ?", ROW, username
        ).stream().findFirst();
    }

    @Override
    public DemoUser save(DemoUser item) {
        jdbc.update("""
            INSERT INTO hikyu.users (
                id, demo_code, username, first_name, last_name, password_hash,
                pin_hash, masked_phone, masked_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (username) DO NOTHING
            """,
            item.id(), item.demoCode(), item.username(), item.firstName(), item.lastName(),
            item.passwordHash(), item.pinHash(), item.maskedPhone(), item.maskedEmail()
        );
        return findByUsername(item.username()).orElseThrow();
    }
}
