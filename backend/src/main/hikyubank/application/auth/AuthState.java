package hikyubank.application.auth;

/** Session-owned workflow state. Secrets never enter browser storage. */
public final class AuthState {
    String username;
    String challengeId;
    String method;
    String code;
    long challengeExpiresAt;
    long codeExpiresAt;
    long resendAt;
    long sessionExpiresAt;
    int attempts;
    int failedLogins;
    long lockedUntil;
}
