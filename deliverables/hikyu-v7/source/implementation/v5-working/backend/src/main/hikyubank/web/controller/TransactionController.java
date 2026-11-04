package hikyubank.web.controller;

import java.util.UUID;
import hikyubank.application.model.Transaction;
import hikyubank.application.service.TransactionService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {
    private final TransactionService transactions;

    public TransactionController(TransactionService transactions) {
        this.transactions = transactions;
    }

    @GetMapping
    public List<Transaction> list(
        @RequestAttribute("hikyu.userId") UUID userId,
        @RequestParam(required = false) UUID accountId
    ) {
        return transactions.list(userId, accountId);
    }
}
