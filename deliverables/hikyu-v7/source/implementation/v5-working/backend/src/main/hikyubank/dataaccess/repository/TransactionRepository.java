package hikyubank.dataaccess.repository;

import java.util.UUID;
import hikyubank.application.model.Transaction;
import java.util.List;
import java.util.Optional;

/** Data access contract. All operations are scoped to the authenticated owner. */
public interface TransactionRepository {
    List<Transaction> findAll(UUID userId);

    Optional<Transaction> findById(UUID userId, UUID id);

    Transaction save(UUID userId, Transaction item);
}
