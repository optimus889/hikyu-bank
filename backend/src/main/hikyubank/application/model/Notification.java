package hikyubank.application.model;

import java.util.UUID;

/** Immutable data exchanged through repository boundaries. */
public record Notification(
    UUID id,
    UUID alertId,
    UUID accountId,
    String title,
    String body,
    String createdAt,
    boolean read,
    boolean resolved,
    String source
) {

    public Notification withState(boolean nextRead, boolean nextResolved) {
        return new Notification(
            id, alertId, accountId, title, body, createdAt,
            nextRead, nextResolved, source
        );
    }
}
