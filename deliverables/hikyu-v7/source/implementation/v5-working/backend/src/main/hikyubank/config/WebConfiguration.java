package hikyubank.config;

import hikyubank.web.security.ApiSessionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final ApiSessionInterceptor sessions;

    public WebConfiguration(ApiSessionInterceptor sessions) {
        this.sessions = sessions;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sessions).addPathPatterns("/api/v1/**");
    }
}
