import pathlib,json,subprocess,os,time,signal,urllib.request
R=pathlib.Path('/workspace/hikyu-v7/work');p=None
def up():
 try:return urllib.request.urlopen('http://127.0.0.1:8196/health',timeout=1).status==200
 except Exception:return False
try:
 os.killpg(json.loads((R/'private/service-pids.json').read_text())['workflow'],signal.SIGTERM)
 for _ in range(30):
  if not up():break
  time.sleep(.2)
 with (R/'private/sla-runtime.log').open('ab') as log:p=subprocess.Popen(['bash',str(R/'implementation/start-workflow.sh')],env={**os.environ,'V6_REVIEW_TIMEOUT':'PT2S'},stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 for _ in range(50):
  if up():break
  time.sleep(.2)
 result=subprocess.run(['node',str(R/'implementation/saltcorn/test_sla.cjs')],capture_output=True,text=True,timeout=45)
 print(result.stdout)
 if result.returncode:raise RuntimeError(result.stderr)
finally:
 if p:
  try:os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=10)
  except ProcessLookupError:pass
 subprocess.run(['python3',str(R/'implementation/start-services.py')],check=True,timeout=30)
