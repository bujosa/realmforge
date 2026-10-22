/* Focused final UI persistence and visual inspection; run after the full evidence matrix. */
const {chromium,webkit}=require('/Users/davidbujosa/Documents/Workspace/games/swords-and-ravens-v3-p3/e2e/node_modules/playwright');
const {withWildlingServer}=require('./wildlings-server.cjs');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.join(process.env.HOME,'.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-wild/r2');
const results={errors:[],checks:[],timestamp:new Date().toISOString()};fs.mkdirSync(root,{recursive:true});
withWildlingServer(async url=>{
 for(const [engine,type]of [['chrome',chromium],['webkit',webkit]]){
  let browser;
  try{
   browser=await type.launch({headless:true,...(engine==='chrome'?{channel:'chrome',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']}:{} )});
   for(const [name,viewport]of Object.entries({desktop:{width:1440,height:900},phone:{width:390,height:844}})){
    const page=await browser.newPage({viewport});
    page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
    await page.goto(`${url}#wildlings/track?strength=0&camera=Wall&view.grid=false`);
    await page.waitForFunction(()=>window.__wildlingQA?.ready);
    await page.getByLabel('Public threat strength',{exact:true}).focus();await page.keyboard.press('End');
    assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.strength),12);
    await page.getByLabel('Quality',{exact:true}).selectOption('balanced');await page.waitForFunction(()=>window.__wildlingQA?.ready);
    assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.strength),12);
    await page.getByLabel('Reduced motion',{exact:true}).check();await page.waitForFunction(()=>window.__wildlingQA?.ready);
    assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.strength),12);
    await page.getByRole('button',{name:'Threshold',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.cameraPath.length),0);
    await page.getByRole('button',{name:'Skip all',exact:true}).focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Watch holds',exact:true}).click();
    await page.getByLabel('Quality',{exact:true}).selectOption('high');await page.waitForFunction(()=>window.__wildlingQA?.ready);
    assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.strength),0);
    await page.getByLabel('Reduced motion',{exact:true}).uncheck();await page.waitForFunction(()=>window.__wildlingQA?.ready);
    await page.evaluate(()=>window.__wildlingQA.setStrength(12,false));
    for(const view of ['World','Wall']){
     await page.evaluate(view=>window.__wildlingQA.setView(view),view);await page.waitForTimeout(100);
     await page.screenshot({path:path.join(root,`screens/final-${engine}-${name}-${view}.jpg`),type:'jpeg',quality:72});
    }
    await page.evaluate(()=>{window.__wildlingQA.setView('World');window.__wildlingQA.play('wildling-victory');});await page.waitForTimeout(600);
    await page.screenshot({path:path.join(root,`screens/final-${engine}-${name}-wave.jpg`),type:'jpeg',quality:72});
    assert.equal(await page.evaluate(()=>window.__wildlingQA.renderer.getContext().getError()),0);
    results.checks.push({engine,viewport:name,qualityPreservesStrength:true,reducedPreservesStrength:true,watchResetPersists:true,keyboardSkip:true});
    console.log('PASS',engine,name);await page.close();
   }
  }finally{await browser?.close();}
 }
 assert.equal(results.errors.length,0);results.status='PASS';
}).then(()=>fs.writeFileSync(path.join(root,'ui-smoke.json'),JSON.stringify(results,null,2))).catch(e=>{results.status='FAIL';results.failure=e.stack;fs.writeFileSync(path.join(root,'ui-smoke.json'),JSON.stringify(results,null,2));console.error(e);process.exitCode=1;});
