const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const file=path.join(ROOT,'private/v8-runtime.json');
const configuration=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const APP_URL='http://127.0.0.1:'+(configuration.app_port||8197);
const WORKFLOW_URL='http://127.0.0.1:'+(configuration.workflow_port||8196);
function environment(){return {V6_ROOT:ROOT,HIKYU_APP_URL:APP_URL,HIKYU_WORKFLOW_URL:WORKFLOW_URL,HIKYU_WORKFLOW_PORT:String(configuration.workflow_port||8196),HIKYU_EVIDENCE_DIR:path.join(ROOT,'evidence/v8/runtime')};}
module.exports={ROOT,APP_URL,WORKFLOW_URL,environment};
