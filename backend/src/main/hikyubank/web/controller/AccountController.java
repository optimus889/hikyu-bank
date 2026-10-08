package hikyubank.web.controller;

import java.util.UUID;
import hikyubank.application.dto.BankDtos.OpenAccountRequest;
import hikyubank.application.dto.BankDtos.AccountProduct;
import hikyubank.application.model.Account;
import hikyubank.application.service.AccountService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/accounts")
public class AccountController {
    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public List<Account> list(
        @RequestAttribute("hikyu.userId") UUID userId
    ) {
        return accounts.list(userId);
    }

    @GetMapping("/products")
    public List<AccountProduct> products(
        @RequestAttribute("hikyu.userId") UUID userId
    ) {
        return accounts.products(userId);
    }

    @GetMapping("/{id}")
    public Account get(
        @RequestAttribute("hikyu.userId") UUID userId,
        @PathVariable UUID id
    ) {
        return accounts.get(userId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Account open(
        @RequestAttribute("hikyu.userId") UUID userId,
        @Valid @RequestBody OpenAccountRequest input
    ) {
        return accounts.open(userId, input);
    }
}
