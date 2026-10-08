package hikyubank.application.auth;

import hikyubank.application.dto.AuthDtos.*;
import hikyubank.application.exception.BankException;
import hikyubank.dataaccess.repository.DemoUserRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Owns credentials, one-time verification, expiry and session rules. */
@Service
public class AuthService {
    private static final int MAX_ATTEMPTS = 5;
    private final DemoUserRepository users;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AuthService(
        DemoUserRepository users,
        PasswordEncoder encoder,
        Clock clock
    ) {
        this.users = users;
        this.encoder = encoder;
        this.clock = clock;
    }

    public LoginResponse login(AuthState state, LoginRequest input) {
        synchronized (state) {
            long now = clock.millis();
            if (now < state.lockedUntil) {
                throw error(429, "RATE_LIMITED", "Wait 30 seconds before trying again.");
            }
            state.challengeId = null;
            state.sessionExpiresAt = 0;
            var user = users.findByUsername(input.username());
            if (user.isEmpty() || !encoder.matches(input.password(), user.get().passwordHash())) {
                state.failedLogins++;
                if (state.failedLogins >= MAX_ATTEMPTS) {
                    state.failedLogins = 0;
                    state.lockedUntil = now + 30_000;
                }
                throw error(401, "INVALID_CREDENTIALS", "The username or password is incorrect.");
            }
            state.failedLogins = 0;
            state.username = user.get().username();
            state.challengeId = UUID.randomUUID().toString();
            state.challengeExpiresAt = now + 600_000;
            state.attempts = 0;
            state.code = null;
            state.resendAt = 0;
            return new LoginResponse(
                state.challengeId, state.challengeExpiresAt,
                List.of(
                    new ContactMethod("sms", user.get().maskedPhone()),
                    new ContactMethod("email", user.get().maskedEmail())
                )
            );
        }
    }

    public CodeResponse sendCode(AuthState state, CodeRequest input) {
        synchronized (state) {
            requireChallenge(state, input.challengeId());
            long now = clock.millis();
            if (now < state.resendAt) {
                throw error(429, "RATE_LIMITED", "Wait before requesting another code.");
            }
            state.code = String.format("%06d", random.nextInt(1_000_000));
            state.method = input.method();
            state.codeExpiresAt = now + 300_000;
            state.resendAt = now + 30_000;
            // Local simulator only. A production delivery adapter must not return the code.
            return new CodeResponse(state.codeExpiresAt, state.resendAt, state.code);
        }
    }

    public SessionResponse verify(AuthState state, VerifyRequest input) {
        synchronized (state) {
            requireChallenge(state, input.challengeId());
            if (state.code == null || !input.method().equals(state.method)) {
                throw error(400, "CODE_REQUIRED", "Request a code for this method first.");
            }
            if (clock.millis() >= state.codeExpiresAt) {
                throw error(400, "CODE_EXPIRED", "This code expired. Request a new code.");
            }
            var user = users.findByUsername(state.username).orElseThrow();
            boolean validPin = input.method().equals("sms")
                || (input.pin() != null && input.pin().matches("[0-9]{4}")
                    && encoder.matches(input.pin(), user.pinHash()));
            if (!state.code.equals(input.code()) || !validPin) {
                state.attempts++;
                int remaining = MAX_ATTEMPTS - state.attempts;
                if (remaining == 0) {
                    throw error(429, "ATTEMPTS_EXCEEDED", "Start sign-in again.");
                }
                throw error(400, "INVALID_VERIFICATION",
                    "Check your code and PIN. " + remaining + " attempts remain.");
            }
            state.sessionExpiresAt = clock.millis() + 1_800_000;
            state.challengeId = null;
            state.code = null;
            return session(state);
        }
    }

    public SessionResponse session(AuthState state) {
        if (state == null) {
            return null;
        }
        synchronized (state) {
            if (clock.millis() >= state.sessionExpiresAt) {
                return null;
            }
            var user = users.findByUsername(state.username).orElseThrow();
            return new SessionResponse(
                new UserProfile(
                    user.id(), user.username(), user.name(), user.firstName(), user.lastName()
                ),
                state.sessionExpiresAt
            );
        }
    }

    private void requireChallenge(AuthState state, String id) {
        if (state.challengeId == null || !state.challengeId.equals(id)) {
            throw error(400, "CHALLENGE_INVALID", "Sign in again to start verification.");
        }
        if (clock.millis() >= state.challengeExpiresAt) {
            throw error(400, "CHALLENGE_EXPIRED", "Your sign-in request expired.");
        }
        if (state.attempts >= MAX_ATTEMPTS) {
            throw error(429, "ATTEMPTS_EXCEEDED", "Start sign-in again.");
        }
    }

    private BankException error(int status, String code, String message) {
        return new BankException(status, code, message);
    }
}
