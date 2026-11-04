import pathlib,os,json,signal,subprocess,time,urllib.request
ROOT=pathlib.Path('/workspace/hikyu-v7/work');pidfile=ROOT/'private/service-pids.json';fixture=ROOT/'private/ai-fault-fixture.py'
fixture.write_text("import os,sys,time,json\njson.load(sys.stdin)\nmode=os.environ['V6_AI_FAULT_MODE']\nif mode=='timeout':time.sleep(20)\nif mode=='process_failure':sys.exit(2)\nprint(json.dumps({'category':'approved','confidence':2,'needs_human_review':False}))\n")
def up():
 try:return urllib.request.urlopen('http://127.0.0.1:8196/health',timeout=1).status==200
 except Exception:return False
p=None
try:
 old=json.loads(pidfile.read_text())['workflow'];os.killpg(old,signal.SIGTERM)
 for _ in range(30):
  if not up():break
  time.sleep(.2)
 for mode in ['timeout','malformed_output','process_failure']:
  env={**os.environ,'V6_AI_SCRIPT':str(fixture),'V6_AI_FAULT_MODE':mode}
  with (ROOT/'private/ai-fault-runtime.log').open('ab') as log:p=subprocess.Popen(['bash',str(ROOT/'implementation/start-workflow.sh')],env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  for _ in range(50):
   if up():break
   time.sleep(.2)
  if not up():raise RuntimeError('Fault-test engine failed to start')
  result=subprocess.run(['node',str(ROOT/'implementation/saltcorn/fault_submit.cjs'),mode],capture_output=True,text=True,timeout=35)
  if result.returncode:raise RuntimeError(result.stderr)
  print(result.stdout.strip());os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=10);p=None
finally:
 if p:
  try:os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=10)
  except ProcessLookupError:pass
 result=subprocess.run(['python3',str(ROOT/'implementation/start-services.py')],capture_output=True,text=True,timeout=30)
 if result.returncode:raise RuntimeError('Normal services could not be restored')
 print('Normal classifier restored; no fault mode remains configured.')
