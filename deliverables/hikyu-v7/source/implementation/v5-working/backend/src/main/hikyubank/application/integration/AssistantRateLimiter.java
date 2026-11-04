package hikyubank.application.integration;
import java.util.*;import java.util.concurrent.ConcurrentHashMap;import java.time.Clock;
import org.springframework.stereotype.Component;import hikyubank.config.AiSettings;import hikyubank.application.exception.BankException;
@Component
public class AssistantRateLimiter {
 private record Window(long minute,int count) {}
 private final Map<UUID,Window> windows=new ConcurrentHashMap<>();private final Clock clock;private final AiSettings settings;
 public AssistantRateLimiter(Clock clock,AiSettings settings){this.clock=clock;this.settings=settings;}
 public void check(UUID user){if(!"openai".equals(settings.mode()) || settings.key().isBlank() || settings.model().isBlank())return;if(settings.requestsPerMinute()<1 || settings.requestsPerMinute()>60)throw new BankException(503,"AI_NOT_CONFIGURED","AI service is not configured.");long minute=clock.millis()/60000;
 windows.compute(user,(id,w)->{int count=w==null || w.minute()!=minute?0:w.count();if(count>=settings.requestsPerMinute())throw new BankException(429,"AI_REQUEST_LIMIT","Please wait before asking another question.");return new Window(minute,count+1);});}
}
