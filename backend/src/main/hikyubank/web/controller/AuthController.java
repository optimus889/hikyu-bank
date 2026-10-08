package hikyubank.web.controller;

import hikyubank.application.auth.AuthService;
import hikyubank.application.dto.AuthDtos.*;
import hikyubank.application.exception.BankException;
import hikyubank.web.session.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public LoginResponse login(
        @Valid @RequestBody LoginRequest input,
        HttpServletRequest request
    ) {
        return auth.login(SessionContext.getOrCreate(request.getSession()), input);
    }

    @PostMapping("/code")
    public CodeResponse sendCode(
        @Valid @RequestBody CodeRequest input,
        HttpServletRequest request
    ) {
        return auth.sendCode(SessionContext.getOrCreate(request.getSession()), input);
    }

    @PostMapping("/verify")
    public SessionResponse verify(
        @Valid @RequestBody VerifyRequest input,
        HttpServletRequest request
    ) {
        var result = auth.verify(SessionContext.getOrCreate(request.getSession()), input);
        request.changeSessionId();
        return result;
    }

    @GetMapping("/session")
    public SessionResponse session(HttpServletRequest request) {
        var result = auth.session(SessionContext.find(request.getSession(false)));
        if (result == null) {
            throw new BankException(401, "SESSION_REQUIRED", "Please sign in.");
        }
        return result;
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
