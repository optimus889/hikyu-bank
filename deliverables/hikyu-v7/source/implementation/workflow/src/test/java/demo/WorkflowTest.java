package demo;
import org.flowable.engine.*;import org.flowable.engine.delegate.*;import org.flowable.task.api.Task;import org.junit.jupiter.api.*;
import java.util.*;import java.nio.file.*;import java.util.concurrent.TimeUnit;import static org.junit.jupiter.api.Assertions.*;
class WorkflowTest {
 ProcessEngine e; static Path evidence=Path.of("../../evidence");
 @BeforeEach void setup(){
  final String engineRunId=UUID.randomUUID().toString();
  JavaDelegate triage=x->{
   try{
    if(Boolean.TRUE.equals(x.getVariable("forceAiFailure")))throw new IllegalStateException("Injected AI failure");
    Process p=new ProcessBuilder("python3","../ai/local_classifier.py").start();
    String input="{\"description\":\""+x.getVariable("description").toString().replace("\\","\\\\").replace("\"","\\\"")+"\"}";
    p.getOutputStream().write(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));p.getOutputStream().close();
    if(!p.waitFor(5,TimeUnit.SECONDS)){p.destroyForcibly();throw new IllegalStateException("AI timeout");}
    String output=new String(p.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
    if(p.exitValue()!=0||!output.contains("\"needs_human_review\": true"))throw new IllegalStateException("Invalid AI output");
    x.setVariable("aiResult",output);x.setVariable("aiInput",input);x.setVariable("aiStatus","succeeded");
    Files.createDirectories(evidence);Files.writeString(evidence.resolve("ai-runtime-"+engineRunId+"-"+x.getProcessInstanceId()+"-"+UUID.randomUUID()+".json"),"{\"processInstanceId\":\""+x.getProcessInstanceId()+"\",\"input\":"+input+",\"output\":"+output+"}");
   }catch(Exception ex){x.setVariable("aiStatus","failed");throw new BpmnError("AI_FAILURE");}
  };
  var cfg=ProcessEngineConfiguration.createStandaloneInMemProcessEngineConfiguration().setJdbcUrl("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1").setDatabaseSchemaUpdate("true").setAsyncExecutorActivate(false); cfg.setBeans(Map.of("triageDelegate",triage,"stageListener",(org.flowable.task.service.delegate.TaskListener)t->{},"endListener",(org.flowable.engine.delegate.ExecutionListener)x->{})); e=cfg.buildProcessEngine();
  e.getRepositoryService().createDeployment().addClasspathResource("transaction-support.bpmn20.xml").deploy();
 }
 @AfterEach void close(){e.close();}
 String start(boolean fail){return e.getRuntimeService().startProcessInstanceByKey("transactionSupportReview","synthetic-business-"+UUID.randomUUID(),new HashMap<>(Map.of("description","My card is locked and purchases are blocked","requesterId","requester.demo","supportDecision","continue","resolution","reject","forceAiFailure",fail,"reviewTimeout","PT24H"))).getId();}
 Task task(String id){return e.getTaskService().createTaskQuery().processInstanceId(id).singleResult();}
 void complete(String id,String actor,Map<String,Object> vars){Task t=task(id);String group=switch(t.getTaskDefinitionKey()){case "agentReview","manualTriage"->"service.alpha";case "reviewerReview"->"reviewer.beta";case "supervisorReview"->"supervisor.gamma";default->"requester.demo";};if(!group.equals(actor))throw new SecurityException("Role mismatch");e.getTaskService().claim(t.getId(),actor);e.getTaskService().complete(t.getId(),vars);}
 @Test void successHandoffAndActualLocalAi()throws Exception{String id=start(false);assertEquals("agentReview",task(id).getTaskDefinitionKey());assertEquals("succeeded",e.getRuntimeService().getVariable(id,"aiStatus"));complete(id,"service.alpha",Map.of("supportDecision","continue"));assertEquals("reviewerReview",task(id).getTaskDefinitionKey());complete(id,"reviewer.beta",Map.of("resolution","complete"));assertEquals("completed",e.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(id).singleResult().getEndActivityId());var h=e.getHistoryService().createHistoricTaskInstanceQuery().processInstanceId(id).finished().list();assertEquals(Set.of("service.alpha","reviewer.beta"),new HashSet<>(h.stream().map(t->t.getAssignee()).toList()));Files.writeString(evidence.resolve("workflow-success.txt"),"Real Flowable 7.1.0 embedded engine; single-person synthetic role simulation\nProcess instance: "+id+"\nCompleted actors: "+h.stream().map(t->t.getAssignee()).toList()+"\nEnd: completed\nBubble/Budibase not connected in this test.\n");}
 @Test void reject(){String id=start(false);complete(id,"service.alpha",Map.of("supportDecision","reject"));assertEquals("rejected",e.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(id).singleResult().getEndActivityId());}
 @Test void returnAndResubmit(){String id=start(false);complete(id,"service.alpha",Map.of("supportDecision","return"));assertEquals("requesterCorrection",task(id).getTaskDefinitionKey());complete(id,"requester.demo",Map.of("description","I cannot find the payment receipt","supportDecision","continue"));assertEquals("agentReview",task(id).getTaskDefinitionKey());}
 @Test void aiFailureRequiresHuman(){String id=start(true);assertEquals("manualTriage",task(id).getTaskDefinitionKey());assertEquals("failed",e.getRuntimeService().getVariable(id,"aiStatus"));complete(id,"service.alpha",Map.of());assertEquals("agentReview",task(id).getTaskDefinitionKey());}
 @Test void humanTimeoutEscalates(){String id=start(false);complete(id,"service.alpha",Map.of());var timer=e.getManagementService().createTimerJobQuery().processInstanceId(id).singleResult();assertNotNull(timer);var job=e.getManagementService().moveTimerToExecutableJob(timer.getId());e.getManagementService().executeJob(job.getId());assertEquals("supervisorReview",task(id).getTaskDefinitionKey());complete(id,"supervisor.gamma",Map.of("resolution","reject"));assertNull(task(id));}
 @Test void roleWrapperRejectsOtherActor(){String id=start(false);assertThrows(SecurityException.class,()->complete(id,"reviewer.beta",Map.of()));assertEquals("agentReview",task(id).getTaskDefinitionKey());}
}
