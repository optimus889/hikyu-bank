package hikyubank.dataaccess.repository;

import java.util.UUID;
import hikyubank.application.model.Account;
import java.util.List;
import java.util.Optional;

/** Data access contract. All operations are scoped to the authenticated owner. */
public interface AccountRepository {
    List<Account> findAll(UUID userId);

    Optional<Account> findById(UUID userId, UUID id);

    Account save(UUID userId, Account item);
}
