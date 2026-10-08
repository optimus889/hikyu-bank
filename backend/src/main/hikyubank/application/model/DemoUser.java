package hikyubank.application.model;

import java.util.UUID;

/** Immutable data exchanged through repository boundaries. */
public record DemoUser(
    UUID id,
    String demoCode,
    String username,
    String name,
    String firstName,
    String lastName,
    String passwordHash,
    String pinHash,
    String maskedPhone,
    String maskedEmail
) {
}
