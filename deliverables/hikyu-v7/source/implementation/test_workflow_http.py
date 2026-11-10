import unittest,urllib.request,urllib.error,json,pathlib,uuid
ROOT=pathlib.Path(__file__).resolve().parent.parent; roles={r['id']:r for r in json.loads((ROOT/'private/roles.json').read_text())}; events=[]
def call(actor,path,data=None):
 h={'Content-Type':'application/json'}
 if actor: h['Authorization']='Bearer '+roles[actor]['token']
 req=urllib.request.Request(('http://127.0.0.1:'+str(json.loads((ROOT/'private/v8-runtime.json').read_text()).get('workflow_port',8196)))+path,data=None if data is None else json.dumps(data).encode(),headers=h)
 try:
  r=urllib.request.urlopen(req,timeout=15); code=r.status; body=json.load(r)
 except urllib.error.HTTPError as e: code=e.code;body=json.load(e)
 events.append({'actor':actor,'path':path,'input':data,'status':code,'output':body});return code,body
class WorkflowHttp(unittest.TestCase):
 def submit(self):
  b={'business_id':'v6-'+str(uuid.uuid4()),'description':'My card is locked and purchases are blocked'}; c,r=call('requester.demo','/requests',b);self.assertEqual(201,c);return b,r
 def decision(self,r,actor,decision):return call(actor,'/requests/'+r['process_instance_id']+'/decision',{'expected_sequence':r['sequence'],'decision':decision,'comment':'Synthetic local role simulation'})
 def test_handoff_ai_and_completion(self):
  _,r=self.submit();self.assertEqual('succeeded',r['ai_status']);self.assertEqual('card_access',json.loads(r['ai_result'])['category']);c,r=self.decision(r,'service.alpha','continue');self.assertEqual(200,c);self.assertEqual('reviewerReview',r['stage']);c,r=self.decision(r,'reviewer.beta','complete');self.assertEqual(200,c);self.assertEqual('completed',r['stage']);(ROOT/'evidence/persistence-probe.json').write_text(json.dumps(r,indent=2))
 def test_duplicate_same_input(self):
  b,r=self.submit();c,r2=call('requester.demo','/requests',b);self.assertEqual(200,c);self.assertEqual(r['process_instance_id'],r2['process_instance_id'])
 def test_duplicate_changed_input(self):
  b,r=self.submit();b['description']='Different information';c,_=call('requester.demo','/requests',b);self.assertEqual(409,c)
 def test_invalid_input(self):
  for desc in ['', ' ', 'x', 'a'*2001]:
   c,_=call('requester.demo','/requests',{'business_id':'v6-'+str(uuid.uuid4()),'description':desc});self.assertEqual(400,c)
 def test_anonymous(self):self.assertEqual(401,call(None,'/requests',{})[0])
 def test_other_requester_isolation(self):
  _,r=self.submit();self.assertEqual(403,call('requester.other','/requests/'+r['process_instance_id'])[0])
 def test_wrong_task_role(self):
  _,r=self.submit();self.assertEqual(403,self.decision(r,'reviewer.beta','complete')[0])
 def test_stale_decision(self):
  _,r=self.submit();c,n=self.decision(r,'service.alpha','continue');self.assertEqual(200,c);self.assertEqual(409,self.decision(r,'reviewer.beta','complete')[0])
 def test_return_then_reject(self):
  _,r=self.submit();c,r=self.decision(r,'service.alpha','return');self.assertEqual(200,c);self.assertEqual('requesterCorrection',r['stage']);c,r=call('requester.demo','/requests/'+r['process_instance_id']+'/decision',{'expected_sequence':r['sequence'],'decision':'continue','comment':'Added context','description':'Where is my payment receipt'});self.assertEqual(200,c);self.assertEqual('agentReview',r['stage']);c,r=self.decision(r,'service.alpha','reject');self.assertEqual(200,c);self.assertEqual('rejected',r['stage'])
if __name__=='__main__':
 try:
  program=unittest.main(exit=False)
  raise SystemExit(0 if program.result.wasSuccessful() else 1)
 finally:(ROOT/'evidence/workflow-http-events.json').write_text(json.dumps({'test_kind':'Local HTTP integration; single-person role simulation; no LCNC connection','events':events},indent=2))
