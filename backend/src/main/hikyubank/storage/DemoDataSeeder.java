package hikyubank.storage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import hikyubank.application.model.*;
import hikyubank.dataaccess.repository.*;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Bootstrap only: template keys are resolved to new, stable persisted UUIDs. */
@Component
@ConditionalOnProperty(name = "hikyu.demo.seed-enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final DemoUserRepository users;
    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final AlertRepository alerts;
    private final NotificationRepository notifications;
    private final PasswordEncoder encoder;
    private final ObjectMapper mapper;
    private final String password;
    private final String pin;

    public DemoDataSeeder(
        org.springframework.jdbc.core.JdbcTemplate jdbc,
        DemoUserRepository users,
        AccountRepository accounts,
        TransactionRepository transactions,
        AlertRepository alerts,
        NotificationRepository notifications,
        PasswordEncoder encoder,
        ObjectMapper mapper,
        @Value("${hikyu.demo.password}") String password,
        @Value("${hikyu.demo.pin}") String pin
    ) {
        this.jdbc = jdbc;
        this.users = users;
        this.accounts = accounts;
        this.transactions = transactions;
        this.alerts = alerts;
        this.notifications = notifications;
        this.encoder = encoder;
        this.mapper = mapper;
        this.password = password;
        this.pin = pin;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void run(ApplicationArguments arguments) throws IOException {
        jdbc.execute("SELECT pg_advisory_xact_lock(472901)");
        JsonNode data;
        try (var stream = new ClassPathResource("seed/demo-data.json").getInputStream()) {
            data = mapper.readTree(stream);
        }
        seed(data, "user-cl", "chengyang.lee", "Cheng-Yang", "Lee", "1.00", "0148");
        seed(data, "user-gd", "gospelhope.david", "Gospelhope", "David", "0.80", "0149");
        seed(data, "user-mf", "mingyu.fan", "Mingyu", "Fan", "1.20", "0150");
    }

    private void seed(
        JsonNode data,
        String demoCode,
        String username,
        String firstName,
        String lastName,
        String multiplier,
        String phoneSuffix
    ) {
        // Never recreate records removed from an existing profile.
        if (users.findByUsername(username).isPresent()) {
            return;
        }
        UUID userId = UUID.randomUUID();
        users.save(new DemoUser(
            userId, demoCode, username, firstName + " " + lastName, firstName, lastName,
            encoder.encode(password), encoder.encode(pin),
            "+1 ••• ••• " + phoneSuffix,
            firstName.substring(0, 1).toLowerCase() + "••••@example.com"
        ));
        BigDecimal factor = new BigDecimal(multiplier);
        Map<String, UUID> accountIds = new HashMap<>();
        for (JsonNode row : data.path("accounts")) {
            UUID id = UUID.randomUUID();
            accountIds.put(row.path("key").asText(), id);
            accounts.save(userId, new Account(
                id, row.path("type").asText(), row.path("name").asText(),
                row.path("suffix").asText(), money(row, "balance").multiply(factor),
                row.path("status").asText(), money(row, "limit"),
                money(row, "minimumDue"), text(row, "dueDate")
            ));
        }
        for (JsonNode row : data.path("transactions")) {
            transactions.save(userId, new Transaction(
                UUID.randomUUID(), requireAccount(accountIds, row),
                row.path("name").asText(), row.path("category").asText(),
                row.path("date").asText(), money(row, "amount").multiply(factor)
                    .setScale(2, java.math.RoundingMode.HALF_UP),
                row.path("icon").asText()
            ));
        }
        for (JsonNode row : data.path("alerts")) {
            alerts.save(userId, new Alert(
                UUID.randomUUID(), row.path("type").asText(),
                requireAccount(accountIds, row), row.path("title").asText(),
                row.path("channel").asText(), money(row, "amount"),
                text(row, "date"), row.path("enabled").asBoolean()
            ));
        }
        notifications.save(userId, new Notification(
            UUID.randomUUID(), null, null, "Welcome, " + firstName,
            "Your accounts and reminders are private to your demo profile.",
            "2026-10-02T12:00:00Z", false, false, "demo"
        ));
    }

    private UUID requireAccount(Map<String, UUID> ids, JsonNode row) {
        UUID id = ids.get(row.path("accountKey").asText());
        if (id == null) {
            throw new IllegalStateException("Unknown demo account template key.");
        }
        return id;
    }

    private BigDecimal money(JsonNode row, String field) {
        return row.hasNonNull(field) ? row.get(field).decimalValue() : null;
    }

    private String text(JsonNode row, String field) {
        return row.hasNonNull(field) ? row.get(field).asText() : null;
    }
}
