package hikyubank.web.controller;
import java.util.Map;import org.springframework.web.bind.annotation.*;import hikyubank.config.AiSettings;
@RestController @RequestMapping("/api/v1/assistant") public class AiStatusController {
 private final AiSettings settings;public AiStatusController(AiSettings settings){this.settings=settings;}
 @GetMapping("/status") public Map<String,Object> status(){return Map.of("mode",settings.mode(),"configured","demo".equals(settings.mode()) || (!settings.key().isBlank() && !settings.model().isBlank()),"description","demo".equals(settings.mode())?"Local rules; no external request.":"Your question and necessary financial aggregates are sent to OpenAI.");}
}
