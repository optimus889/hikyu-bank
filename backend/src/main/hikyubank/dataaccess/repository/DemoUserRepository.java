package hikyubank.dataaccess.repository;

import java.util.UUID;
import hikyubank.application.model.DemoUser;
import java.util.List;
import java.util.Optional;

/** Data access contract. Credential access is restricted to authentication and explicit seeding. */
public interface DemoUserRepository {
    List<DemoUser> findAll();

    Optional<DemoUser> findByUsername(String username);

    DemoUser save(DemoUser item);
}
