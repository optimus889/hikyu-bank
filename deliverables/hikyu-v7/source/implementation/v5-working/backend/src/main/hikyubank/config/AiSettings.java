package hikyubank.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties("hikyu.ai")
public record AiSettings(String mode,String key,String model,String url,int timeoutSeconds,int maxTokens,int requestsPerMinute,boolean allowLocalHttp) {}
