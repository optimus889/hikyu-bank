const {init,db,state}=require('../saltcorn/sdk.cjs');
(async()=>{await init();await state.getState().setConfig('site_name','Hikyu Bank V8');await db.close();console.log('V8 application title set; business schema and workflow unchanged.');})().catch(()=>{console.error('V8 setup failed. Inspect private local logs.');process.exit(1);});
