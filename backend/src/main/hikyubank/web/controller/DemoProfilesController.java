package hikyubank.web.controller;

import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import hikyubank.dataaccess.repository.DemoUserRepository;
import hikyubank.application.service.SecurityService;

@RestController
@RequestMapping("/api/v1/auth")
public class DemoProfilesController {
    private final DemoUserRepository users;
    private final PasswordEncoder encoder;
    private final String initialPassword;

    public DemoProfilesController(DemoUserRepository users, PasswordEncoder encoder,
                                 @Value("${hikyu.demo.password}") String initialPassword) {
        this.users = users;
        this.encoder = encoder;
        this.initialPassword = initialPassword;
    }

    public record DemoProfile(String username, String name, String defaultPin,
                              boolean pinChanged, String defaultPassword, boolean passwordChanged) {}

    @GetMapping("/demo-profiles")
    public List<DemoProfile> profiles() {
        return List.of("chengyang.lee", "gospelhope.david", "mingyu.fan").stream()
            .flatMap(name -> users.findByUsername(name).stream())
            .map(user -> {
                String defaultPin = SecurityService.demoPin(user.username());
                boolean pinMatches = encoder.matches(defaultPin, user.pinHash());
                boolean passwordMatches = "HikyuDemo2026!".equals(initialPassword)
                    && encoder.matches("HikyuDemo2026!", user.passwordHash());
                return new DemoProfile(user.username(), user.name(), pinMatches ? defaultPin : null,
                    !pinMatches, passwordMatches ? "HikyuDemo2026!" : null, !passwordMatches);
            }).toList();
    }
}
