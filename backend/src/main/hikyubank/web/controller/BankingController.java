package hikyubank.web.controller;
import java.util.*;import java.time.LocalDate;
import jakarta.validation.Valid;import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;import org.springframework.http.*;
import hikyubank.application.dto.BankingDtos.*;import hikyubank.application.service.*;
@RestController @RequestMapping("/api/v1") public class BankingController {
 private final BankingService banking;private final PaymentAuthorizationService auth;
 public BankingController(BankingService banking,PaymentAuthorizationService auth){this.banking=banking;this.auth=auth;}
 @GetMapping("/banking/catalog") public Map<String,Object> catalog(){return Map.of("categories",BankingService.CATEGORIES,"billers",BankingService.BILLERS,"simulation",true);}
 @PostMapping("/banking/verifications") public Object verification(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody OperationInput p,HttpServletRequest request){banking.validate(user,p);return auth.issueBound(user,request.getSession().getId(),banking.fingerprint(p),p.method());}
 @PostMapping("/banking/operations") @ResponseStatus(HttpStatus.CREATED) public OperationReceipt operation(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody OperationInput p,HttpServletRequest request){return auth.execute(user,request.getSession().getId(),banking.fingerprint(p),p.challengeId(),p.verificationCode(),()->banking.execute(user,p));}
 @GetMapping("/banking/operations") public List<OperationReceipt> history(@RequestAttribute("hikyu.userId") UUID user){return banking.history(user);}
 @GetMapping("/payees") public List<Payee> payees(@RequestAttribute("hikyu.userId") UUID user){return banking.payees(user);}
 @PostMapping("/payees") @ResponseStatus(HttpStatus.CREATED) public Payee savePayee(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody PayeeInput p){return banking.savePayee(user,p);}
 @PatchMapping("/payees/{id}") public Payee editPayee(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id,@Valid @RequestBody PayeeEdit p){return banking.editPayee(user,id,p);}
 @DeleteMapping("/payees/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deletePayee(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id){banking.deletePayee(user,id);}
 @GetMapping("/cards") public List<Card> cards(@RequestAttribute("hikyu.userId") UUID user){return banking.cards(user);}
 @PatchMapping("/cards/{id}") public Card card(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id,@Valid @RequestBody CardLock p){return banking.lockCard(user,id,p.locked());}
 @GetMapping("/budgets") public List<Budget> budgets(@RequestAttribute("hikyu.userId") UUID user,@RequestParam String month){return banking.budgets(user,month);}
 @PostMapping("/budgets") @ResponseStatus(HttpStatus.CREATED) public Budget budget(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody BudgetInput p){return banking.saveBudget(user,null,p);}
 @PutMapping("/budgets/{id}") public Budget budget(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id,@Valid @RequestBody BudgetInput p){return banking.saveBudget(user,id,p);}
 @DeleteMapping("/budgets/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteBudget(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id){banking.deleteBudget(user,id);}
 @GetMapping(value="/statements.csv",produces="text/csv") public ResponseEntity<String> statement(@RequestAttribute("hikyu.userId") UUID user,@RequestParam(required=false) UUID accountId,@RequestParam LocalDate from,@RequestParam LocalDate to){return ResponseEntity.ok().contentType(new MediaType("text","csv",java.nio.charset.StandardCharsets.UTF_8)).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"hikyu-statement.csv\"").header(HttpHeaders.CACHE_CONTROL,"no-store").body(banking.statement(user,accountId,from,to));}
}
