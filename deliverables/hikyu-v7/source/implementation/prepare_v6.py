#!/usr/bin/env python3
"""Prepare only this standalone V6 directory; no old deployment is contacted."""
import argparse,pathlib,os,json,secrets,shutil,subprocess,urllib.parse,xml.etree.ElementTree as ET,hashlib,socket
ROOT=pathlib.Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--start-only',action='store_true');a=parser.parse_args()
def run(args,env=None):subprocess.run(args,cwd=ROOT,env=env,check=True)
if a.check:
 required=['implementation/saltcorn/package-lock.json','implementation/workflow/pom.xml','implementation/ai/local_classifier.py','implementation/v5-working/backend/mvnw','deliverables/Saltcorn_V6_Application_Pack.json']
 for name in required:
  if not (ROOT/name).is_file():raise SystemExit('Missing '+name)
 print('V6 source, lockfile, model, V5 wrapper and native export are present. Fresh installation is a separate check.');raise SystemExit(0)
# The cloud task used a fixed path. Relocate only new V6 source paths, never the preserved V5 source.
old='/workspace/hikyu-v7/work'
if str(ROOT)!=old:
 for base in [ROOT/'implementation/saltcorn',ROOT/'implementation/workflow/src',ROOT/'implementation/ai']:
  for p in base.rglob('*'):
   if p.is_file() and 'node_modules' not in p.parts and p.suffix in ['.js','.cjs','.py','.java','.xml','.json']:
    p.write_text(p.read_text().replace(old,str(ROOT)))
 for p in (ROOT/'implementation').glob('*'):
  if p.is_file() and p.suffix in ['.py','.sh','.yaml']:p.write_text(p.read_text().replace(old,str(ROOT)))
private=ROOT/'private';private.mkdir(exist_ok=True);private.chmod(0o700)
javac=shutil.which('javac')
jdk=pathlib.Path(os.environ.get('JAVA_HOME','')) if os.environ.get('JAVA_HOME') else None
if not jdk or not (jdk/'bin/javac').is_file():
 if javac:jdk=pathlib.Path(javac).resolve().parent.parent
 elif pathlib.Path('/workspace/hikyu-setup/jdk/bin/javac').is_file():jdk=pathlib.Path('/workspace/hikyu-setup/jdk')
 else:raise SystemExit('Install a trusted JDK 17+ and set JAVA_HOME; no JDK compiler is available.')
for cmd in ['node','npm','python3','docker']:
 if not shutil.which(cmd):raise SystemExit('Required executable missing: '+cmd)
if not (private/'saltcorn-env.json').exists():
 password=secrets.token_urlsafe(36)
 port=os.environ.get('V6_DB_PORT')
 if not port:
  for candidate in range(55436,55457):
   try:
    probe=socket.socket();probe.bind(('127.0.0.1',candidate));probe.close();port=str(candidate);break
   except OSError:probe.close()
  if not port:raise SystemExit('No free local PostgreSQL port in the task range.')
 cfg={'PGHOST':'127.0.0.1','PGPORT':port,'PGDATABASE':'saltcorn_v7','PGUSER':'v6_demo','PGPASSWORD':password,'SALTCORN_SESSION_SECRET':secrets.token_hex(32),'SALTCORN_JWT_SECRET':secrets.token_hex(32),'SALTCORN_FILE_STORE':str(private/'saltcorn-files'),'SALTCORN_NWORKERS':'1','XDG_CONFIG_HOME':str(private/'xdg-config'),'XDG_DATA_HOME':str(private/'xdg-data')}
 (private/'saltcorn-env.json').write_text(json.dumps(cfg,indent=2));(private/'saltcorn-env.json').chmod(0o600)
else:cfg=json.loads((private/'saltcorn-env.json').read_text())
env={**os.environ,'V6_DB_PASSWORD':cfg['PGPASSWORD'],'V6_DB_PORT':cfg['PGPORT'],'JAVA_HOME':str(jdk)};env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
trust=pathlib.Path('/etc/ssl/certs/java/cacerts')
if trust.exists():env['MAVEN_OPTS']=env.get('MAVEN_OPTS','')+' -Djavax.net.ssl.trustStore='+str(trust)
settings=ET.Element('settings',xmlns='http://maven.apache.org/SETTINGS/1.2.0');proxy=env.get('HTTPS_PROXY')
if proxy:
 u=urllib.parse.urlparse(proxy);p=ET.SubElement(ET.SubElement(settings,'proxies'),'proxy')
 for k,v in {'id':'managed-proxy','active':'true','protocol':'http','host':u.hostname,'port':str(u.port or 80),'nonProxyHosts':'localhost|127.0.0.1'}.items():ET.SubElement(p,k).text=v
ET.ElementTree(settings).write(ROOT/'implementation/maven-settings.xml',encoding='unicode')
rolefile=private/'roles.json'
if not rolefile.exists():
 roles=[{'id':i,'role':r,'token':secrets.token_urlsafe(40)} for i,r in [('connector.local','connector'),('requester.demo','requester'),('requester.other','requester'),('service.alpha','service_agent'),('reviewer.beta','reviewer'),('supervisor.gamma','supervisor')]]
 rolefile.write_text(json.dumps(roles,indent=2));rolefile.chmod(0o600)
project='hikyu-v7-'+hashlib.sha256(str(ROOT).encode()).hexdigest()[:10]
(private/'deployment.json').write_text(json.dumps({'compose_project':project,'database_port':cfg['PGPORT']},indent=2))
compose=['docker','compose','-p',project,'-f',str(ROOT/'implementation/compose.v6.yaml')]
run(compose+['up','-d','--wait'],env)
if a.start_only:
 run(['python3',str(ROOT/'implementation/start-services.py')],env)
 raise SystemExit(0)
# Only task-specific fresh databases are created; no database is reset or dropped.
for name in ['saltcorn_v7','hikyu_bank_test','hikyu_v7_demo']:
 q=compose+['exec','-T','database','psql','-U','v6_demo','-d','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='"+name+"'"]
 r=subprocess.run(q,env=env,text=True,capture_output=True,check=True)
 if r.stdout.strip()!='1':run(compose+['exec','-T','database','psql','-U','v6_demo','-d','postgres','-c','CREATE DATABASE '+name+';'],env)
run(['npm','ci','--legacy-peer-deps','--prefix',str(ROOT/'implementation/saltcorn')],env)
cli=['node',str(ROOT/'implementation/saltcorn/run.cjs')]
if not (private/'v6-initialized').exists():run(cli+['add-schema','-f'],env)
run(['node',str(ROOT/'implementation/saltcorn/bootstrap.cjs')],env)
if not (private/'v6-initialized').exists():run(cli+['install-plugin','--directory',str(ROOT/'implementation/saltcorn/hikyu-plugin')],env)
run(['node',str(ROOT/'implementation/saltcorn/setup-support.cjs')],env)
run(['node',str(ROOT/'implementation/saltcorn/setup-banking.cjs')],env)
run(['node',str(ROOT/'implementation/saltcorn/protect.cjs')],env)
(private/'v6-initialized').write_text('Initialized by V6 standalone setup. Never reset automatically.\n')
start=ROOT/'implementation/start-workflow.sh';start.write_text('#!/bin/bash\nset -euo pipefail\ncd "'+str(ROOT/'implementation/workflow')+'"\nexec "'+str(jdk/'bin/java')+'" -cp "target/classes:$(cat classpath.txt)" demo.WorkflowServer\n')
with (private/'model-training.log').open('w') as out:subprocess.run(['python3',str(ROOT/'implementation/ai/local_classifier.py'),'--train'],env=env,stdout=out,check=True)
subprocess.run(['bash',str(ROOT/'implementation/v5-working/backend/mvnw'),'-B','-ntp','-s',str(ROOT/'implementation/maven-settings.xml'),'package','dependency:build-classpath','-Dmdep.outputFile=classpath.txt'],cwd=ROOT/'implementation/workflow',env=env,check=True)
run(['python3',str(ROOT/'implementation/start-services.py')],env)
print('V6 prepared. Credentials remain in the private local directory. Review the demo guide and declared parity gaps.')
