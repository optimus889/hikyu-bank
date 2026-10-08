package hikyubank.dataaccess.repository;

import java.util.UUID;
import hikyubank.application.model.Alert;
import java.util.List;
import java.util.Optional;

/** Data access contract. All operations are scoped to the authenticated owner. */
public interface AlertRepository {
    List<Alert> findAll(UUID userId);

    Optional<Alert> findById(UUID userId, UUID id);

    Alert save(UUID userId, Alert item);

    void deleteById(UUID userId, UUID id);
}
