package demo;
import com.sun.net.httpserver.*;
import com.fasterxml.jackson.databind.*;
import org.flowable.engine.*;import org.flowable.engine.delegate.*;import org.flowable.task.api.Task;
import java.net.*;import java.nio.file.*;import java.io.*;import java.util.*;import java.util.concurrent.*;import java.security.*;
/** Local feasibility runtime. Not a replacement for LCNC UI or a production bank. */
public class WorkflowServer {
 static final ObjectMapper JSON=new ObjectMapper(); static ProcessEngine engine; static Map<String,Identity> tokens=new HashMap<>(); static Path root; static String runId=UUID.randomUUID().toString();
 record Identity(String id,String role){}
 static class HttpFailure extends RuntimeException {final int code;HttpFailure(int c,String m){super(m);code=c;}}
 public static void main(String[] args)throws Exception{
  root=Path.of(System.getenv().getOrDefault("V6_ROOT","/workspace/hikyu-v7/work"));
  JsonNode cfg=JSON.readTree(Files.readString(Path.of(System.getenv().getOrDefault("V6_TOKENS_PATH",root+"/private/roles.json"))));
  cfg.forEach(x->tokens.put(x.get("token").asText(),new Identity(x.get("id").asText(),x.get("role").asText())));
  JavaDelegate triage=x->{
   try{
    String input=JSON.writeValueAsString(Map.of("description",x.getVariable("description")));
    Process p=new ProcessBuilder("python3",System.getenv().getOrDefault("V6_AI_SCRIPT",root+"/implementation/ai/local_classifier.py")).start();
    p.getOutputStream().write(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));p.getOutputStream().close();
    if(!p.waitFor(5,TimeUnit.SECONDS)){p.destroyForcibly();throw new IOException("AI timeout");}
    String output=new String(p.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);JsonNode result=JSON.readTree(output);
    if(p.exitValue()!=0||!result.has("category")||!result.has("confidence")||!result.path("model_version").asText().equals("synthetic-nb-v1")||!result.path("known_tokens").isIntegralNumber()||result.path("known_tokens").asInt()<0||!result.path("needs_human_review").asBoolean()||!Set.of("card_access","payment_tracking","general_support","unclassified").contains(result.path("category").asText())||!result.path("confidence").isNumber()||result.path("confidence").asDouble()<0||result.path("confidence").asDouble()>1)throw new IOException("Invalid model output");
    x.setVariable("aiStatus","succeeded");x.setVariable("aiInput",input);x.setVariable("aiResult",output);
    Files.writeString(root.resolve("evidence/ai-live-"+runId+"-"+x.getProcessInstanceId()+"-"+UUID.randomUUID()+".json"),JSON.writeValueAsString(Map.of("engine_run_id",runId,"process_instance_id",x.getProcessInstanceId(),"input",JSON.readTree(input),"output",result,"time",java.time.Instant.now().toString())));
   }catch(Exception ex){x.setVariable("aiStatus","failed");throw new BpmnError("AI_FAILURE");}
  };
  var pc=ProcessEngineConfiguration.createStandaloneProcessEngineConfiguration().setJdbcUrl("jdbc:h2:file:"+root+"/private/workflow;DB_CLOSE_ON_EXIT=FALSE").setJdbcUsername("sa").setJdbcPassword("").setDatabaseSchemaUpdate("true").setAsyncExecutorActivate(true);
  pc.setBeans(Map.of("triageDelegate",triage,"stageListener",(org.flowable.task.service.delegate.TaskListener)t->{Object n=t.getVariable("sequence");t.setVariable("sequence",n==null?1L:((Number)n).longValue()+1);t.setVariable("stateUpdatedAt",java.time.Instant.now().toString());},"endListener",(org.flowable.engine.delegate.ExecutionListener)x->{Object n=x.getVariable("sequence");x.setVariable("sequence",n==null?1L:((Number)n).longValue()+1);x.setVariable("stateUpdatedAt",java.time.Instant.now().toString());}));engine=pc.buildProcessEngine();
  engine.getRepositoryService().createDeployment().name("Hikyu V6 Transaction Support Review").enableDuplicateFiltering().addClasspathResource("transaction-support.bpmn20.xml").deploy();
  HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",8196),0);server.createContext("/",WorkflowServer::handle);server.setExecutor(Executors.newFixedThreadPool(4));server.start();
  Runtime.getRuntime().addShutdownHook(new Thread(()->{server.stop(0);engine.close();}));System.out.println("V6 workflow API started on loopback port 8096; engine_run_id="+runId);
 }
 static synchronized void handle(HttpExchange h)throws IOException{
  try{
   if(h.getRequestURI().getPath().equals("/health")){reply(h,200,Map.of("ready",true));return;}
   String auth=h.getRequestHeaders().getFirst("Authorization");Identity who=auth!=null&&auth.startsWith("Bearer ")?tokens.get(auth.substring(7)):null;if(who==null)throw new HttpFailure(401,"Authentication required");
   String path=h.getRequestURI().getPath();
   if(path.equals("/requests")&&h.getRequestMethod().equals("POST")){
    if(!Set.of("connector","requester").contains(who.role()))throw new HttpFailure(403,"Submission role required");
    JsonNode b=body(h);String bid=text(b,"business_id",80),desc=text(b,"description",2000),owner=who.role().equals("connector")?text(b,"requester_id",100):who.id();
    if(desc.length()<3)throw new HttpFailure(400,"Description is too short");
    String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(List.of(owner,desc))));
    var old=engine.getHistoryService().createHistoricProcessInstanceQuery().processInstanceBusinessKey(bid).list();
    if(!old.isEmpty()){
     String pid=old.get(0).getId();Object previous=historic(pid,"requestHash");if(!hash.equals(previous))throw new HttpFailure(409,"Idempotency key reused with different input");reply(h,200,status(pid,who));return;
    }
    String pid=engine.getRuntimeService().startProcessInstanceByKey("transactionSupportReview",bid,new HashMap<>(Map.of("description",desc,"requesterId",owner,"requestHash",hash,"sequence",1L,"supportDecision","continue","resolution","reject","reviewTimeout",System.getenv().getOrDefault("V6_REVIEW_TIMEOUT","PT24H")))).getId();reply(h,201,status(pid,who));return;
   }
   String[] parts=path.split("/");
   if(parts.length>=3&&parts[1].equals("requests")){
    String pid=parts[2];Map<String,Object> before=status(pid,who);
    if(parts.length==3&&h.getRequestMethod().equals("GET")){reply(h,200,before);return;}
    if(parts.length==4&&parts[3].equals("decision")&&h.getRequestMethod().equals("POST")){
     Task t=engine.getTaskService().createTaskQuery().processInstanceId(pid).singleResult();if(t==null)throw new HttpFailure(409,"Process already ended");
     String key=t.getTaskDefinitionKey();String required=switch(key){case "agentReview","manualTriage"->"service_agent";case "reviewerReview"->"reviewer";case "supervisorReview"->"supervisor";default->"requester";};
     if(!required.equals(who.role())||key.equals("requesterCorrection")&&!who.id().equals(historic(pid,"requesterId")))throw new HttpFailure(403,"Task role or ownership mismatch");
     if((key.equals("reviewerReview")||key.equals("supervisorReview"))&&who.id().equals(historic(pid,"serviceActor")))throw new HttpFailure(403,"Independent review required");
     JsonNode b=body(h);long expected=b.path("expected_sequence").asLong(-1),seq=((Number)historic(pid,"sequence")).longValue();if(expected!=seq)throw new HttpFailure(409,"Stale task version");
     String decision=text(b,"decision",20),comment=text(b,"comment",2000);Map<String,Object> vars=new HashMap<>();vars.put("sequence",seq+1);vars.put("lastComment",comment);vars.put("lastActor",who.id());
     Set<String> allowed=key.equals("agentReview")?Set.of("continue","return","reject"):key.equals("reviewerReview")||key.equals("supervisorReview")?Set.of("complete","reject"):Set.of("continue");if(!allowed.contains(decision))throw new HttpFailure(400,"Unsupported decision");
     if(key.equals("agentReview")){vars.put("supportDecision",decision);vars.put("serviceActor",who.id());}else if(key.equals("reviewerReview")||key.equals("supervisorReview"))vars.put("resolution",decision);
     if(key.equals("requesterCorrection"))vars.put("description",text(b,"description",2000));
     engine.getIdentityService().setAuthenticatedUserId(who.id());try{engine.getTaskService().claim(t.getId(),who.id());engine.getTaskService().complete(t.getId(),vars);}finally{engine.getIdentityService().setAuthenticatedUserId(null);}
     reply(h,200,status(pid,who));return;
    }
   }
   throw new HttpFailure(404,"Unknown endpoint");
  }catch(HttpFailure f){reply(h,f.code,Map.of("error",f.getMessage()));}catch(Exception ex){reply(h,500,Map.of("error","Workflow operation failed"));}
 }
 static Object historic(String pid,String name){var v=engine.getHistoryService().createHistoricVariableInstanceQuery().processInstanceId(pid).variableName(name).singleResult();return v==null?null:v.getValue();}
 static Map<String,Object> status(String pid,Identity who){var p=engine.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(pid).singleResult();if(p==null)throw new HttpFailure(404,"Unknown request");Object owner=historic(pid,"requesterId");if(who.role().equals("requester")&&!who.id().equals(owner))throw new HttpFailure(403,"Record ownership mismatch");Task t=engine.getTaskService().createTaskQuery().processInstanceId(pid).singleResult();String stage=t==null?p.getEndActivityId():t.getTaskDefinitionKey();Map<String,Object> out=new LinkedHashMap<>();out.put("business_id",p.getBusinessKey());out.put("process_instance_id",pid);out.put("stage",stage);out.put("sequence",historic(pid,"sequence"));out.put("requester_id",owner);out.put("ai_status",historic(pid,"aiStatus"));out.put("ai_result",historic(pid,"aiResult"));out.put("last_actor",historic(pid,"lastActor"));out.put("last_comment",historic(pid,"lastComment"));out.put("updated_at",historic(pid,"stateUpdatedAt"));return out;}
 static JsonNode body(HttpExchange h)throws IOException{byte[] b=h.getRequestBody().readNBytes(8193);if(b.length>8192)throw new HttpFailure(413,"Payload too large");try{return JSON.readTree(b);}catch(Exception ex){throw new HttpFailure(400,"Invalid JSON");}}
 static String text(JsonNode b,String key,int max){String v=b==null||!b.path(key).isTextual()?"":b.path(key).asText().trim();if(v.isEmpty()||v.length()>max)throw new HttpFailure(400,"Invalid "+key);return v;}
 static void reply(HttpExchange h,int code,Object data)throws IOException{byte[] b=JSON.writeValueAsBytes(data);h.getResponseHeaders().set("Content-Type","application/json");h.getResponseHeaders().set("Cache-Control","no-store");h.sendResponseHeaders(code,b.length);h.getResponseBody().write(b);h.close();}
}
