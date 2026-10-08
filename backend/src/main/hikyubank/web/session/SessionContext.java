package hikyubank.web.session;

import hikyubank.application.auth.AuthState;
import jakarta.servlet.http.HttpSession;

/** Transport-specific session storage stays out of business services. */
public final class SessionContext {
    private static final String AUTH_STATE = "hikyu.auth.state";

    private SessionContext() {}

    public static AuthState find(HttpSession session) {
        return session == null ? null : (AuthState) session.getAttribute(AUTH_STATE);
    }

    public static AuthState getOrCreate(HttpSession session) {
        synchronized (session) {
            AuthState state = find(session);
            if (state == null) {
                state = new AuthState();
                session.setAttribute(AUTH_STATE, state);
            }
            return state;
        }
    }
}
