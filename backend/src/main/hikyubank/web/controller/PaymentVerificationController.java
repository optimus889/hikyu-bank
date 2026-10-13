package hikyubank.web.controller;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import hikyubank.application.service.PaymentAuthorizationService;
import hikyubank.application.service.PaymentAuthorizationService.*;
@RestController @RequestMapping("/api/v1/payment-verifications")
public class PaymentVerificationController {
 private final PaymentAuthorizationService service;
 public PaymentVerificationController(PaymentAuthorizationService service){this.service=service;}
 @PostMapping public Challenge issue(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody ChallengeRequest p,HttpServletRequest request){return service.issue(user,request.getSession().getId(),p);}
}
