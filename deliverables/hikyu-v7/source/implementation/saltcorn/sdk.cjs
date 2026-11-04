const fs=require('fs'),path=require('path'),{createRequire}=require('module');
Object.assign(process.env,JSON.parse(fs.readFileSync('/workspace/hikyu-v7/work/private/saltcorn-env.json','utf8')));
const cli=path.dirname(require.resolve('@saltcorn/cli/package.json'));
const sc=createRequire(path.join(cli,'package.json'));
module.exports={sc,init:()=>require(path.join(cli,'src/common')).init_some_tenants(),db:sc('@saltcorn/data/db'),Table:sc('@saltcorn/data/models/table'),Field:sc('@saltcorn/data/models/field'),View:sc('@saltcorn/data/models/view'),Page:sc('@saltcorn/data/models/page'),User:sc('@saltcorn/data/models/user'),Trigger:sc('@saltcorn/data/models/trigger'),state:sc('@saltcorn/data/db/state')};
