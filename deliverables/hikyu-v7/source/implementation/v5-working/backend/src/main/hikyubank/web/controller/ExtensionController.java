package hikyubank.web.controller;
import java.util.*;import jakarta.validation.Valid;import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;import org.springframework.http.HttpStatus;
import hikyubank.application.dto.ExtensionDtos.*;import hikyubank.application.service.*;
@RestController @RequestMapping("/api/v1")
public class ExtensionController {
 private final TransferService transfers;private final SettingsService settings;private final PaymentAuthorizationService authorization;
 public ExtensionController(TransferService transfers,SettingsService settings,PaymentAuthorizationService authorization){this.transfers=transfers;this.settings=settings;this.authorization=authorization;}
 @PostMapping("/transfers") @ResponseStatus(HttpStatus.CREATED) public Receipt transfer(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody TransferInput input,HttpServletRequest request){return authorization.execute(user,request.getSession().getId(),PaymentAuthorizationService.internal(input),input.challengeId(),input.verificationCode(),()->transfers.transferVerified(user,input));}
 @GetMapping("/transfers") public List<Receipt> history(@RequestAttribute("hikyu.userId") UUID user){return transfers.list(user);}
 @PatchMapping("/accounts/{id}/nickname") public Object nickname(@RequestAttribute("hikyu.userId") UUID user,@PathVariable UUID id,@Valid @RequestBody Nickname p){return settings.nickname(user,id,p);}
 @GetMapping("/settings/preferences") public Preferences preferences(@RequestAttribute("hikyu.userId") UUID user){return settings.preferences(user);}
 @PutMapping("/settings/preferences") public Preferences preferences(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Preferences p){return settings.preferences(user,p);}
 @PostMapping("/settings/password") @ResponseStatus(HttpStatus.NO_CONTENT) public void password(@RequestAttribute("hikyu.userId") UUID user,@Valid @RequestBody Password p,HttpServletRequest request){settings.password(user,p);request.getSession().invalidate();}
}
