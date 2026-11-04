const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const cfg=JSON.parse(fs.readFileSync('/workspace/hikyu-v7/work/private/saltcorn-env.json','utf8'));
const result=spawnSync(path.join(__dirname,'node_modules/.bin/saltcorn'),process.argv.slice(2),{env:{...process.env,...cfg},stdio:'inherit'});process.exit(result.status??1);
