package hikyubank.application.integration;
import java.util.*;import java.math.BigDecimal;import java.net.*;import java.net.http.*;import java.time.Duration;import java.io.IOException;
import org.springframework.stereotype.Component;import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import hikyubank.config.AiSettings;import hikyubank.application.model.*;import hikyubank.application.exception.BankException;
@Component @ConditionalOnProperty(name="hikyu.ai.mode",havingValue="openai")
public class OpenAiAssistantGateway implements AssistantGateway {
 private final AiSettings settings;private final ObjectMapper mapper;
 public OpenAiAssistantGateway(AiSettings settings,ObjectMapper mapper){this.settings=settings;this.mapper=mapper;}
 public String mode(){return "external-ai";}
 private BankException error(int status,String code,String message){return new BankException(status,code,message);}
 public String reply(String question,List<Account> accounts,List<Transaction> transactions){
  if(settings.key().isBlank() || settings.model().isBlank())throw error(503,"AI_NOT_CONFIGURED","AI service is not configured.");
  URI uri;
  try{uri=URI.create(settings.url());}catch(IllegalArgumentException e){throw error(503,"AI_NOT_CONFIGURED","AI service is not configured.");}
  boolean local=settings.allowLocalHttp() && "http".equals(uri.getScheme()) && uri.getHost()!=null && List.of("127.0.0.1","localhost").contains(uri.getHost());
  if(uri.getHost()==null || uri.getUserInfo()!=null || uri.getFragment()!=null || !("https".equals(uri.getScheme()) || local) || settings.timeoutSeconds()<1 || settings.timeoutSeconds()>30 || settings.maxTokens()<64 || settings.maxTokens()>2048)throw error(503,"AI_NOT_CONFIGURED","AI service is not configured.");
  Map<String,BigDecimal> spending=new TreeMap<>(),balances=new TreeMap<>();BigDecimal income=BigDecimal.ZERO;
  for(var a:accounts)balances.merge(a.type(),a.balance(),BigDecimal::add);
  for(var t:transactions){if("transfer".equals(t.kind()))continue;if(t.amount().signum()<0)spending.merge(t.category(),t.amount().negate(),BigDecimal::add);else income=income.add(t.amount());}
  var summary=Map.of("balancesByType",balances,"spendingByCategory",spending,"recordedIncome",income);
  var payload=Map.of("model",settings.model(),"store",false,"max_completion_tokens",settings.maxTokens(),"messages",List.of(Map.of("role","system","content","You explain simulated finances. Use only supplied figures; history may be incomplete. Internal transfers are excluded from income/spending. No money-moving tools are available. Summary: "+summary),Map.of("role","user","content",question)));
  // No client is created in Demo mode or when configuration is incomplete.
  try{
   var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(settings.timeoutSeconds())).followRedirects(HttpClient.Redirect.NEVER).build();
   var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(settings.timeoutSeconds())).header("Content-Type","application/json").header("Authorization","Bearer "+settings.key()).POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload))).build();
   var response=client.send(request,HttpResponse.BodyHandlers.ofString());int status=response.statusCode();
   if(status==401 || status==403)throw error(502,"AI_AUTH_FAILED","AI provider authentication failed.");
   if(status==429)throw error(503,"AI_RATE_LIMITED","AI provider is busy. Try again later.");
   if(status<200 || status>=300)throw error(502,"AI_REJECTED","AI provider rejected the request.");
   if(response.body().length()>100000)throw error(502,"AI_INVALID_RESPONSE","AI provider returned an invalid response.");
   var body=mapper.readTree(response.body());if(body==null)throw error(502,"AI_INVALID_RESPONSE","AI provider returned an empty response.");
   var text=body.path("choices").path(0).path("message").path("content");
   if(!text.isTextual() || text.asText().isBlank() || text.asText().length()>12000)throw error(502,"AI_INVALID_RESPONSE","AI provider returned an invalid response.");
   return text.asText();
  }catch(HttpTimeoutException e){throw error(504,"AI_TIMEOUT","AI service timed out.");}
   catch(InterruptedException e){Thread.currentThread().interrupt();throw error(503,"AI_INTERRUPTED","AI request was interrupted.");}
   catch(IOException e){throw error(502,"AI_UNAVAILABLE","AI service returned an unreadable response.");}
 }
}
