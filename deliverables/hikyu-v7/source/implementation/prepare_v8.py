#!/usr/bin/env python3
"""Prepare an isolated V8 installation with fresh private configuration."""
import pathlib,subprocess,sys,os,json,time,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
args=sys.argv[1:]
if args not in [[],['--check'],['--start-only']]:raise SystemExit('Usage: prepare_v8.py [--check | --start-only]')
if args==['--check']:
 for f in ['implementation/v8/runtime.cjs','implementation/v8/ui/controller.js','implementation/v8/ui/progress.cjs','implementation/v7/plugin.cjs']:
  if not (root/f).is_file():raise SystemExit('Missing '+f)
 print('V8 source structure present; this is not a runtime or external-platform test.');raise SystemExit(0)
private=root/'private';private.mkdir(exist_ok=True,mode=0o700)
file=private/'v8-runtime.json'
if not file.exists() and (private/'saltcorn-env.json').exists():raise SystemExit('Existing private V7 configuration detected. Extract V8 into its own directory; existing credentials and databases are not adopted automatically.')
if not file.exists():file.write_text(json.dumps({'app_port':8297,'workflow_port':8296},indent=2));file.chmod(0o600)
(root/'evidence/v8/runtime').mkdir(parents=True,exist_ok=True)
env={**os.environ,'HIKYU_DATABASE':'saltcorn_v8','HIKYU_COMPOSE_PREFIX':'hikyu-v8','V6_DB_PORT':os.environ.get('V6_DB_PORT','55586')}
subprocess.run([sys.executable,str(root/'implementation/prepare_v7.py'),*args],env=env,check=True)
subprocess.run(['node',str(root/'implementation/v8/setup-v8.cjs')],env=env,check=True)
# Saltcorn caches native pages and view metadata; reload only this installation after migration.
pids=private/'service-pids.json'
if pids.exists():
 pid=json.loads(pids.read_text()).get('saltcorn')
 if pid:
  try:
   import signal
   os.killpg(pid,signal.SIGTERM)
  except ProcessLookupError:pass
  runtime=json.loads(file.read_text())
  for attempt in range(40):
   try:
    with urllib.request.urlopen('http://127.0.0.1:'+str(runtime['app_port'])+'/auth/login',timeout=0.3):pass
   except Exception:break
   time.sleep(0.05)
  else:raise SystemExit('The current V8 Saltcorn service did not stop; inspect its own private logs before restart.')
subprocess.run([sys.executable,str(root/'implementation/start-services.py')],env=env,check=True)
print('Hikyu Bank V8 ready. Read private/v8-runtime.json for loopback ports; external relay is disabled until securely configured.')
