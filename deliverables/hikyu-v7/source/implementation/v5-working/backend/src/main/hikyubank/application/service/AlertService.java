package hikyubank.application.service;

import hikyubank.application.dto.BankDtos.AlertRequest;
import hikyubank.application.exception.BankException;
import hikyubank.application.model.Alert;
import hikyubank.dataaccess.repository.AlertRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
@org.springframework.transaction.annotation.Transactional
public class AlertService {
    private static final Set<String> AMOUNT_TYPES = Set.of(
        "low_balance", "large_transaction", "savings_goal"
    );
    private static final Set<String> DATE_TYPES = Set.of("payment_due", "scheduled");
    private final AlertRepository alerts;
    private final AccountService accounts;
    private final hikyubank.dataaccess.repository.NotificationRepository notifications;

    public AlertService(
        AlertRepository alerts,
        AccountService accounts,
        hikyubank.dataaccess.repository.NotificationRepository notifications
    ) {
        this.alerts = alerts;
        this.accounts = accounts;
        this.notifications = notifications;
    }

    public List<Alert> list(UUID userId) {
        return alerts.findAll(userId);
    }

    public Alert get(UUID userId, UUID id) {
        return alerts.findById(userId, id).orElseThrow(() -> new BankException(
            404, "ALERT_NOT_FOUND", "Alert rule not found."
        ));
    }

    public Alert create(UUID userId, AlertRequest input) {
        return alerts.save(userId, validate(userId, UUID.randomUUID(), input, true));
    }

    public synchronized Alert update(UUID userId, UUID id, AlertRequest input) {
        var current = get(userId, id);
        if (!current.accountId().equals(input.accountId())
            && notifications.findAll(userId).stream().anyMatch(item -> id.equals(item.alertId()))) {
            throw new BankException(409, "ALERT_IN_USE",
                "Remove linked notifications before changing the alert account.");
        }
        return alerts.save(userId, validate(userId, id, input, current.enabled()));
    }

    public synchronized void remove(UUID userId, UUID id) {
        get(userId, id);
        if (notifications.findAll(userId).stream().anyMatch(item -> id.equals(item.alertId()))) {
            throw new BankException(409, "ALERT_IN_USE",
                "Remove linked notifications before deleting this alert.");
        }
        alerts.deleteById(userId, id);
    }

    private Alert validate(UUID userId, UUID id, AlertRequest input, boolean enabled) {
        if (!AMOUNT_TYPES.contains(input.type()) && !DATE_TYPES.contains(input.type())) {
            throw invalid("Choose a valid alert type.");
        }
        accounts.get(userId, input.accountId());
        BigDecimal amount = null;
        String date = null;
        if (AMOUNT_TYPES.contains(input.type())) {
            amount = input.amount();
            if (amount == null || amount.compareTo(new BigDecimal("0.01")) < 0
                || amount.compareTo(new BigDecimal("1000000")) > 0) {
                throw invalid("Enter an amount between $0.01 and $1,000,000.");
            }
        } else {
            amount = input.amount();
            try {
                date = LocalDate.parse(input.date() == null ? "" : input.date()).toString();
            } catch (DateTimeParseException error) {
                throw invalid("Choose a valid date.");
            }
        }
        return new Alert(
            id, input.type(), input.accountId(),
            input.title().trim(), input.channel(), amount, date, enabled
        );
    }

    public synchronized Alert toggle(UUID userId, UUID id, boolean enabled) {
        return alerts.save(userId, get(userId, id).withEnabled(enabled));
    }

    private BankException invalid(String message) {
        return new BankException(400, "INVALID_ALERT", message);
    }
}
