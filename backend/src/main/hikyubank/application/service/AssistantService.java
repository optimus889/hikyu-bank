package hikyubank.application.service;

import java.util.UUID;
import hikyubank.application.dto.BankDtos.AssistantResponse;
import hikyubank.application.integration.AssistantGateway;
import org.springframework.stereotype.Service;

@Service
public class AssistantService {
    private final AssistantGateway gateway;
    private final hikyubank.application.integration.AssistantRateLimiter limiter;
    private final AccountService accounts;
    private final TransactionService transactions;

    public AssistantService(
        AssistantGateway gateway,
        AccountService accounts,
        TransactionService transactions, hikyubank.application.integration.AssistantRateLimiter limiter
    ) {
        this.gateway = gateway; this.limiter = limiter;
        this.accounts = accounts;
        this.transactions = transactions;
    }

    public AssistantResponse ask(UUID userId, String message) {
        limiter.check(userId);
        return new AssistantResponse(
            gateway.reply(message, accounts.list(userId), transactions.list(userId, null).stream().filter(t -> !"transfer".equals(t.kind())).toList()),
            gateway.mode()
        );
    }
}
