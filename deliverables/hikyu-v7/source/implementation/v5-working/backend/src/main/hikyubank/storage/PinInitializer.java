package hikyubank.storage;
import org.springframework.stereotype.Component;import org.springframework.core.annotation.Order;import org.springframework.boot.*;import hikyubank.application.service.SecurityService;
@Component @Order(100) public class PinInitializer implements ApplicationRunner {
 private final SecurityService security;public PinInitializer(SecurityService security){this.security=security;}
 public void run(ApplicationArguments args){security.initializePins();}
}
