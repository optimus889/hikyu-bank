package hikyubank.application.service;

import java.util.UUID;
import hikyubank.application.model.Transaction;
import hikyubank.dataaccess.repository.TransactionRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TransactionService {
    private final TransactionRepository transactions;
    private final AccountService accounts;

    public TransactionService(TransactionRepository transactions, AccountService accounts) {
        this.transactions = transactions;
        this.accounts = accounts;
    }

    public List<Transaction> list(UUID userId, UUID accountId) {
        if (accountId != null) {
            accounts.get(userId, accountId);
        }
        return transactions.findAll(userId).stream()
            .filter(item -> accountId == null
                || item.accountId().equals(accountId))
            .sorted(Comparator.comparing(Transaction::date).reversed())
            .toList();
    }
}
