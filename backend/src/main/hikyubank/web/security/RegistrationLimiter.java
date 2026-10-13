package hikyubank.web.security;
import java.util.*;import java.util.concurrent.ConcurrentHashMap;import java.time.Clock;import org.springframework.stereotype.Component;import hikyubank.application.exception.BankException;
@Component public class RegistrationLimiter {
 private record Window(long hour,int count) {}
 private final Map<String,Window> windows=new ConcurrentHashMap<>();private final Clock clock;
 public RegistrationLimiter(Clock clock){this.clock=clock;}
 public void check(String address){long hour=clock.millis()/3600000;windows.entrySet().removeIf(e->e.getValue().hour()!=hour);if(windows.size()>10000)throw new BankException(429,"REGISTRATION_LIMIT","Registration is busy. Try later.");windows.compute(address,(id,w)->{int count=w==null || w.hour()!=hour?0:w.count();if(count>=20)throw new BankException(429,"REGISTRATION_LIMIT","Too many registration attempts. Try later.");return new Window(hour,count+1);});}
}
