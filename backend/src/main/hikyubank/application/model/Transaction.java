package hikyubank.application.model;

import java.util.UUID;

/** Immutable data exchanged through repository boundaries. */
public record Transaction(
    UUID id,
    UUID accountId,
    String name,
    String category,
    String date,
    java.math.BigDecimal amount,
    String icon
) {
}
