package hikyubank.web.controller;
import java.util.*;import jakarta.validation.Valid;import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;import org.springframework.http.HttpStatus;
import hikyubank.application.dto.SecurityDtos.*;import hikyubank.application.service.SecurityService;
@RestController @RequestMapping("/api/v1") public class SecurityController {
 private final SecurityService security;private final hikyubank.web.security.RegistrationLimiter limiter;public SecurityController(SecurityService security,hikyubank.web.security.RegistrationLimiter limiter){this.security=security;this.limiter=limiter;}
 @PostMapping("/auth/register") @ResponseStatus(HttpStatus.CREATED) public Registered register(@Valid @RequestBody Registration input,HttpServletRequest request){limiter.check(request.getRemoteAddr());return security.register(input);}
 @GetMapping("/settings/security") public Map<String,Object> settings(){return Map.of("emailRequiresPin",true,"smsRequiresPin",true,"pinStoredAsHash",true,"smsVerification","simulated","sessionDurationMinutes",30);}
 @PostMapping("/settings/security/pin") public Map<String,String> pin(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Confirmation p,HttpServletRequest request){security.rotatePin(user,p.password(),p.newPin());request.getSession().invalidate();return Map.of("message","Your selected PIN is saved. All sessions have been signed out.");}
 @PostMapping("/settings/security/logout-all") @ResponseStatus(HttpStatus.NO_CONTENT) public void revoke(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Confirmation p,HttpServletRequest request){security.revoke(user,p.password());request.getSession().invalidate();}
}
