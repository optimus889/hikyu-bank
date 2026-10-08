package hikyubank.application.integration;

import hikyubank.application.model.Account;
import hikyubank.application.model.Transaction;
import java.util.List;

/** Swap the demo implementation for a backend REST AI adapter later. */
public interface AssistantGateway {
    String reply(String message, List<Account> accounts, List<Transaction> transactions);
}
