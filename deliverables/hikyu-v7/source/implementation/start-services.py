#!/usr/bin/env python3
import subprocess,pathlib,json,os,time,urllib.request
ROOT=pathlib.Path('/workspace/hikyu-v7/work'); PRIVATE=ROOT/'private'; PRIVATE.mkdir(exist_ok=True)
def ready(url):
 try:
  with urllib.request.urlopen(url,timeout=2) as r:return r.status==200
 except Exception:return False
jobs=[('workflow',['bash',str(ROOT/'implementation/start-workflow.sh')],'http://127.0.0.1:8196/health'),('saltcorn',['node',str(ROOT/'implementation/saltcorn/run.cjs'),'serve','-h','127.0.0.1','-p','8197'],'http://127.0.0.1:8197/auth/login')]
pids={}
for name,cmd,url in jobs:
 if not ready(url):
  with (PRIVATE/(name+'-server.log')).open('ab') as log:
   p=subprocess.Popen(cmd,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);pids[name]=p.pid
  for _ in range(30):
   if ready(url):break
   if p.poll() is not None:raise SystemExit(name+' exited; inspect private logs')
   time.sleep(0.5)
  if not ready(url):raise SystemExit(name+' readiness timed out')
 print(name+': ready')
syncPid=PRIVATE/'sync.pid';alive=False
if syncPid.exists():
 try:os.kill(int(syncPid.read_text()),0);alive=not pathlib.Path('/proc').exists() or pathlib.Path('/proc',syncPid.read_text().strip(),'stat').read_text().split()[2]!='Z'
 except (ProcessLookupError,ValueError,FileNotFoundError):pass
if not alive:
 with (PRIVATE/'lcnc-sync.log').open('ab') as log:p=subprocess.Popen(['node',str(ROOT/'implementation/saltcorn/sync.cjs')],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 syncPid.write_text(str(p.pid));pids['sync']=p.pid
if pids:
 f=PRIVATE/'service-pids.json';previous=json.loads(f.read_text()) if f.exists() else {};f.write_text(json.dumps({**previous,**pids},indent=2))
workerPid=PRIVATE/'v7-worker.pid'
alive=False
if workerPid.exists():
 try:os.kill(int(workerPid.read_text()),0);alive=not pathlib.Path('/proc').exists() or pathlib.Path('/proc',workerPid.read_text().strip(),'stat').read_text().split()[2]!='Z'
 except (ProcessLookupError,ValueError,FileNotFoundError):pass
if not alive:
 with (PRIVATE/'v7-worker.log').open('ab') as log:p=subprocess.Popen(['node',str(ROOT/'implementation/v7/integration/worker.cjs')],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 workerPid.write_text(str(p.pid))
print('LCNC workflow reconciliation and V7 integration worker: started or retained')
