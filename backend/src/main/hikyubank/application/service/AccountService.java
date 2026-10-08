package hikyubank.application.service;

import hikyubank.application.dto.BankDtos.OpenAccountRequest;
import hikyubank.application.dto.BankDtos.AccountProduct;
import hikyubank.application.exception.BankException;
import hikyubank.application.model.Account;
import hikyubank.dataaccess.repository.AccountRepository;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AccountService {
    private final AccountRepository accounts;
    private final SecureRandom random = new SecureRandom();

    public AccountService(AccountRepository accounts) {
        this.accounts = accounts;
    }

    public List<Account> list(UUID userId) {
        return accounts.findAll(userId);
    }

    public Account get(UUID userId, UUID id) {
        return accounts.findById(userId, id).orElseThrow(() -> new BankException(
            404, "ACCOUNT_NOT_FOUND", "Account not found."
        ));
    }

    public List<AccountProduct> products(UUID userId) {
        return List.of(
            product(userId, "checking", "Checking", "A place for everyday money.", "▤"),
            product(userId, "savings", "Savings", "Give your next goal a home.", "◇"),
            product(userId, "credit", "Credit card", "Explore a simulated credit account.", "▱"),
            product(userId, "loan", "Loan", "Start a demo loan application.", "⌂"),
            product(userId, "investment", "Investment", "Explore a demo investment account.", "↗")
        );
    }

    private AccountProduct product(UUID userId, String type, String name, String description, String icon) {
        return new AccountProduct(type, name, description, icon, alreadyOpen(userId, type));
    }

    private boolean alreadyOpen(UUID userId, String type) {
        return Set.of("checking", "savings").contains(type)
            && list(userId).stream().anyMatch(account -> account.type().equals(type)
                && Set.of("active", "pending").contains(account.status()));
    }

    /** PostgreSQL's partial unique index also protects concurrent account applications. */
    @org.springframework.transaction.annotation.Transactional
    public synchronized Account open(UUID userId, OpenAccountRequest input) {
        boolean restricted = Set.of("checking", "savings").contains(input.type());
        if (alreadyOpen(userId, input.type())) {
            throw new BankException(
                409, "ACCOUNT_ALREADY_OPEN", "You have already opened this account."
            );
        }
        String status = restricted ? "active" : "pending";
        return accounts.save(userId, new Account(
            UUID.randomUUID(), input.type(), input.name().trim(),
            String.valueOf(1000 + random.nextInt(9000)), BigDecimal.ZERO,
            status, null, null, null
        ));
    }
}
