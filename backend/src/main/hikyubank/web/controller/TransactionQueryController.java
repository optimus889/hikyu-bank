package hikyubank.web.controller;
import java.util.*;import java.math.BigDecimal;import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;import org.springframework.format.annotation.DateTimeFormat;
import hikyubank.application.service.TransactionQueryService;import hikyubank.application.dto.ExtensionDtos.Page;import hikyubank.application.model.Transaction;
@RestController @RequestMapping("/api/v1/transactions")
public class TransactionQueryController {
 private final TransactionQueryService queries;
 public TransactionQueryController(TransactionQueryService queries){this.queries=queries;}
 @GetMapping("/{id}") public Transaction detail(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id){return queries.detail(user,id);}
 @GetMapping("/search") public Page search(@RequestAttribute("hikyu.userId") UUID user,
 @RequestParam(required=false) UUID accountId,
 @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
 @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
 @RequestParam(required=false) BigDecimal min,@RequestParam(required=false) BigDecimal max,
 @RequestParam(defaultValue="all") String kind,@RequestParam(defaultValue="") String q,
 @RequestParam(defaultValue="") String category,@RequestParam(defaultValue="date_desc") String sort,
 @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return queries.search(user,accountId,from,to,min,max,kind,q,category,sort,page,size);}
}
