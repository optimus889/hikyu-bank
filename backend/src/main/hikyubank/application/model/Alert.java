package hikyubank.application.model;

import java.util.UUID;

/** Immutable data exchanged through repository boundaries. */
public record Alert(
    UUID id,
    String type,
    UUID accountId,
    String title,
    String channel,
    java.math.BigDecimal amount,
    String date,
    boolean enabled
) {

    public Alert withEnabled(boolean value) {
        return new Alert(id, type, accountId, title, channel, amount, date, value);
    }
}
