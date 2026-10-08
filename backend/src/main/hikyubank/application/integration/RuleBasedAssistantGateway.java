package hikyubank.application.integration;

import hikyubank.application.model.Account;
import hikyubank.application.model.Transaction;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Rule-based adapter for synthetic insights; no external AI provider. */
@Component
public class RuleBasedAssistantGateway implements AssistantGateway {
    @Override
    public String reply(String message, List<Account> accounts, List<Transaction> transactions) {
        String question = message.toLowerCase(Locale.ROOT);
        Map<String, BigDecimal> categories = new HashMap<>();
        BigDecimal income = BigDecimal.ZERO;
        for (var transaction : transactions) {
            if (transaction.amount().signum() < 0) {
                categories.merge(
                    transaction.category(), transaction.amount().negate(), BigDecimal::add
                );
            } else {
                income = income.add(transaction.amount());
            }
        }
        BigDecimal total = categories.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (question.contains("subscription")) {
            return "Your recorded subscriptions total "
                + money(categories.getOrDefault("Subscriptions", BigDecimal.ZERO))
                + ". Review the Transactions page before your next renewal.";
        }
        if (question.matches(".*(grocer|food|dining|meal).*")) {
            return "Recorded grocery spending is "
                + money(categories.getOrDefault("Groceries", BigDecimal.ZERO))
                + ", and dining spending is "
                + money(categories.getOrDefault("Dining", BigDecimal.ZERO)) + ".";
        }
        if (question.contains("balance")) {
            var balance = accounts.stream()
                .filter(item -> List.of("checking", "savings").contains(item.type()))
                .map(Account::balance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            return "Your checking and savings balances total " + money(balance)
                + ". Credit debt is shown separately in Overview.";
        }
        if (question.contains("sav")) {
            return "Recorded income is " + money(income) + " and spending is " + money(total)
                + ", leaving " + money(income.subtract(total))
                + " before unrecorded expenses. This is a simulation; no money is moved.";
        }
        if (question.matches(".*(spend|spent|expense|biggest|category).*")) {
            var largest = categories.entrySet().stream()
                .max(Map.Entry.comparingByValue());
            return "Recorded spending totals " + money(total) + ". "
                + largest.map(item -> item.getKey() + " is the largest category at "
                    + money(item.getValue()) + ".").orElse("No spending is recorded.");
        }
        return "Ask about your recorded spending, subscriptions, savings or balances. "
            + "These insights use synthetic data and a rule-based assistant.";
    }

    private String money(BigDecimal value) {
        return NumberFormat.getCurrencyInstance(Locale.US).format(value);
    }
}
