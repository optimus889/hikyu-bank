package hikyubank.application.model;

import java.util.UUID;

/** Immutable data exchanged through repository boundaries. */
public record Account(
    UUID id,
    String type,
    String name,
    String suffix,
    java.math.BigDecimal balance,
    String status,
    java.math.BigDecimal limit,
    java.math.BigDecimal minimumDue,
    String dueDate
) {
}
