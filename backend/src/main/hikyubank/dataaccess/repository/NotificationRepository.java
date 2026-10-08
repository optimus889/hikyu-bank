package hikyubank.dataaccess.repository;

import java.util.UUID;
import hikyubank.application.model.Notification;
import java.util.List;
import java.util.Optional;

/** Data access contract. All operations are scoped to the authenticated owner. */
public interface NotificationRepository {
    List<Notification> findAll(UUID userId);

    Optional<Notification> findById(UUID userId, UUID id);

    Notification save(UUID userId, Notification item);

    void deleteById(UUID userId, UUID id);
}
