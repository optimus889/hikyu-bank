package hikyubank.web.controller;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import hikyubank.application.service.PaymentAuthorizationService;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import hikyubank.application.dto.PaymentDtos.*;
import hikyubank.application.service.PaymentService;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {
    private final PaymentService payments;private final PaymentAuthorizationService authorization;
    public PaymentController(PaymentService payments,PaymentAuthorizationService authorization) { this.payments=payments;this.authorization=authorization; }
    @PostMapping("/recipient") public Recipient lookup(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Lookup input) { return payments.lookup(user,input); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Receipt send(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Input input,HttpServletRequest request) { return authorization.execute(user,request.getSession().getId(),PaymentAuthorizationService.peer(input),input.challengeId(),input.verificationCode(),()->payments.send(user,input)); }
    @GetMapping public List<Receipt> history(@RequestAttribute("hikyu.userId") UUID user) { return payments.history(user); }
}
