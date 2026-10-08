package hikyubank;

import hikyubank.application.model.Account;
import hikyubank.dataaccess.repository.AccountRepository;
import hikyubank.dataaccess.repository.DemoUserRepository;
import hikyubank.dataaccess.repository.NotificationRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL constraints, UUID binding and ownership checks. */
@SpringBootTest
@Transactional
class PostgresConstraintTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired AccountRepository accounts;
    @Autowired DemoUserRepository users;
    @Autowired NotificationRepository notifications;
    @Autowired hikyubank.dataaccess.repository.TransactionRepository transactions;
    @Autowired hikyubank.dataaccess.repository.AlertRepository alerts;
    @Autowired hikyubank.storage.DemoDataSeeder seeder;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        BankApiIntegrationTest.databaseProperties(properties);
    }

    private UUID owner(String username) {
        return users.findByUsername(username).orElseThrow().id();
    }

    private Account checking() {
        return accounts.findAll(owner("chengyang.lee")).stream()
            .filter(item -> item.type().equals("checking")).findFirst().orElseThrow();
    }

    @Test
    void repositoryRejectsAnotherUsersAccountWithoutRedundantUserColumn() {
        var item = new hikyubank.application.model.Transaction(
            UUID.randomUUID(), checking().id(), "Invalid link", "Other", "2026-10-01",
            BigDecimal.ONE, "x"
        );
        assertThrows(DataIntegrityViolationException.class, () ->
            transactions.save(owner("mingyu.fan"), item));
    }

    @Test
    void databaseRejectsDuplicateCheckingEvenWithoutServiceGuard() {
        assertThrows(DataIntegrityViolationException.class, () -> accounts.save(
            owner("chengyang.lee"), new Account(
                UUID.randomUUID(), "checking", "Another name", "9999",
                BigDecimal.ZERO, "pending", null, null, null
            )
        ));
    }

    @Test
    void repositoryCannotReassignAnExistingRecordToAnotherOwner() {
        Account item = checking();
        assertThrows(DataIntegrityViolationException.class, () ->
            accounts.save(owner("mingyu.fan"), item));
        assertTrue(accounts.findById(owner("chengyang.lee"), item.id()).isPresent());
        assertTrue(accounts.findById(owner("mingyu.fan"), item.id()).isEmpty());
    }

    @Test
    void restartingSeedDoesNotRestoreDeletedNotifications() throws Exception {
        UUID userId = owner("chengyang.lee");
        UUID id = notifications.findAll(userId).get(0).id();
        notifications.deleteById(userId, id);
        seeder.run(new org.springframework.boot.DefaultApplicationArguments());
        assertTrue(notifications.findById(userId, id).isEmpty());
    }

    @Test
    void credentialsAreHashedAndMoneyUsesExactDecimalValues() {
        String hash = jdbc.queryForObject(
            "SELECT password_hash FROM hikyu.users WHERE id = ?", String.class, owner("chengyang.lee")
        );
        assertNotEquals("HikyuDemo2026!", hash);
        assertTrue(hash.startsWith("$2"));
        assertEquals(new BigDecimal("8240.20"), checking().balance());
    }

    @Test
    void databaseRejectsAnotherUsersNotificationRecipient() {
        UUID alertId = alerts.findAll(owner("chengyang.lee")).get(0).id();
        UUID notificationId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO hikyu.notifications (id, alert_id, title, body, created_at, source)
            VALUES (?, ?, 'Example', 'Snapshot', NOW(), 'demo')
            """, notificationId, alertId);
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
            INSERT INTO hikyu.notification_recipients (notification_id, user_id)
            VALUES (?, ?)
            """, notificationId, owner("mingyu.fan")));
    }

    @Test
    void uuidPrimaryAndForeignKeysAreNativeTypes() {
        assertEquals("uuid", jdbc.queryForObject("""
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = 'hikyu' AND table_name = 'accounts' AND column_name = 'id'
            """, String.class));
        assertEquals(0, jdbc.queryForObject("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'hikyu' AND table_name IN ('transactions', 'alerts')
                AND column_name = 'user_id'
            """, Integer.class));
    }

    @Test
    void missingAccountForeignKeyIsRejected() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
            INSERT INTO hikyu.transactions (account_id, name, category, posted_date, amount, icon)
            VALUES (?, 'Example', 'Other', CURRENT_DATE, 1, 'x')
            """, UUID.randomUUID()));
    }

    @Test
    void directAccountNotificationCannotAlsoReferenceAlert() {
        UUID id = UUID.randomUUID();
        UUID alertId = alerts.findAll(owner("chengyang.lee")).get(0).id();
        jdbc.update("""
            INSERT INTO hikyu.notifications (id, alert_id, title, body, created_at, source)
            VALUES (?, ?, 'Example', 'Snapshot', NOW(), 'demo')
            """, id, alertId);
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
            INSERT INTO hikyu.notification_account_links (notification_id, account_id)
            VALUES (?, ?)
            """, id, checking().id()));
    }

    @Test
    void directSqlCannotChangeAccountOwner() {
        UUID id = checking().id();
        UUID foreignOwner = owner("mingyu.fan");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
            "UPDATE hikyu.accounts SET user_id = ? WHERE id = ?", foreignOwner, id));
    }

    @Test
    void generalNotificationRecipientsHaveIndependentStateAndDeletion() {
        UUID id = UUID.randomUUID();
        UUID lee = owner("chengyang.lee");
        UUID fan = owner("mingyu.fan");
        jdbc.update("""
            INSERT INTO hikyu.notifications (id, title, body, created_at, source)
            VALUES (?, 'System update', 'Shared event snapshot', NOW(), 'demo')
            """, id);
        jdbc.update("""
            INSERT INTO hikyu.notification_recipients (notification_id, user_id)
            VALUES (?, ?), (?, ?)
            """, id, lee, id, fan);
        notifications.save(lee, notifications.findById(lee, id).orElseThrow().withState(true, false));
        assertFalse(notifications.findById(fan, id).orElseThrow().read());
        notifications.deleteById(lee, id);
        assertTrue(notifications.findById(lee, id).isEmpty());
        assertTrue(notifications.findById(fan, id).isPresent());
    }

    @Test
    void defaultUuidIsGeneratedAndOrdinaryRenameKeepsIdentity() {
        UUID id = jdbc.queryForObject("""
            INSERT INTO hikyu.accounts (user_id, type, name, suffix, status)
            VALUES (?, 'loan', 'Original nickname', '1234', 'pending') RETURNING id
            """, UUID.class, owner("chengyang.lee"));
        jdbc.update("UPDATE hikyu.accounts SET name = 'New nickname' WHERE id = ?", id);
        assertEquals("New nickname", accounts.findById(owner("chengyang.lee"), id)
            .orElseThrow().name());
    }
}
