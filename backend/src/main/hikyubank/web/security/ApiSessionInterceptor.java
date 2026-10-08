package hikyubank.web.security;

import hikyubank.application.auth.AuthService;
import hikyubank.application.exception.BankException;
import hikyubank.web.session.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ApiSessionInterceptor implements HandlerInterceptor {
    private final AuthService auth;

    public ApiSessionInterceptor(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public boolean preHandle(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler
    ) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        boolean write = !Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
        // Same-origin UI only; no permissive CORS configuration is installed.
        // A cross-origin browser cannot send this header without a CORS preflight.
        if (write && !"web".equals(request.getHeader("X-Hikyu-Request"))) {
            throw new BankException(403, "REQUEST_REJECTED", "Missing application request header.");
        }
        String path = request.getRequestURI();
        if (path.startsWith("/api/v1/auth/") || path.equals("/api/v1/health")) {
            return true;
        }
        var session = auth.session(SessionContext.find(request.getSession(false)));
        if (session == null) {
            throw new BankException(401, "SESSION_REQUIRED", "Please sign in.");
        }
        request.setAttribute("hikyu.userId", session.user().id());
        return true;
    }
}
