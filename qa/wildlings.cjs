/* Explicit visual, public-contract and performance evidence. No application dependencies added. */
const {chromium,webkit}=require('/Users/davidbujosa/Documents/Workspace/games/swords-and-ravens-v3-p3/e2e/node_modules/playwright');
const {withWildlingServer}=require('./wildlings-server.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.join(process.env.HOME,'.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-wild');
const out=file=>{const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});return p;};
const results={timestamp:new Date().toISOString(),errors:[],warnings:[],load:[],engines:{},contracts:{},frameToleranceMs:.5,vsyncFloorMs:1000/60};
const levels=[0,2,4,6,8,10,12];
const sizes={desktop:{width:1440,height:900},phone:{width:390,height:844}};
const quick=process.argv.includes('--quick');
function load(label){const value=execFileSync('uptime',{encoding:'utf8'}).trim();results.load.push({label,value});console.log(label,value);}
function observe(page,label){page.on('pageerror',e=>results.errors.push({label,type:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')results.errors.push({label,type:'console',message:m.text()});if(m.type()==='warning')results.warnings.push({label,message:m.text()});});}
async function frames(page,n){await page.evaluate(n=>new Promise(resolve=>{let i=0;const frame=()=>{if(++i>=n)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}),n);}
async function navigate(page,url,story='track',query=''){await page.goto(`${url}#wildlings/${story}?view.grid=false&${query}`);await page.waitForFunction(()=>window.__wildlingQA?.ready);await frames(page,4);}
async function contracts(page){return page.evaluate(()=>{
 const sample=window.__wildlingQA,Ctor=sample.threat.constructor;
 const region={minX:-12,maxX:12,northZ:-24,wallZ:0,wallHeight:4.26,beacons:[{x:-10,z:0},{x:0,z:0},{x:10,z:0}]};
 const events=[],captions=[],reveals=[],paths=[];let highlights=0;
 const t=new Ctor({region,groundHeight:()=>0,onCue:x=>events.push(x),onCaption:x=>captions.push(x),onReveal:x=>reveals.push(x),onCameraPath:x=>paths.push(x),onHighlightRegions:()=>highlights++});
 const checks={},near=(a,b)=>Math.abs(a-b)<.001;
 t.setStrength(-20,{animate:false});checks.clampLow=t.state.strength===0;
 t.setStrength(99,{animate:false});checks.clampHigh=t.state.strength===12;
 t.setStrength(7,{animate:false});checks.evenPublicTrack=t.state.strength===8;
 t.setStrength(NaN,{animate:false});checks.finiteTrack=t.state.strength===0;
 t.setStrength(12);checks.noPop=t.state.visualStrength===0;t.update(.8);checks.crossfade=near(t.state.visualStrength,6);t.update(.8);checks.transitionComplete=near(t.state.visualStrength,12);
 t.setStrength(0);t.update(.4);const interrupted=t.state.visualStrength;t.setStrength(8);checks.interruptedCrossfade=near(t.state.visualStrength,interrupted);t.update(1.6);
 const pos=sample.camera.position.toArray().join(',');t.play('threshold');checks.thresholdCaption=captions.includes('The wildlings gather: 8/12');checks.pathAsData=t.state.cameraPath.length===2;t.update(2.5);checks.thresholdDuration=t.state.beat===null;checks.noCameraOwnership=pos===sample.camera.position.toArray().join(',');
 t.reducedMotion=true;t.play('threshold');checks.reducedNoCamera=t.state.cameraPath.length===0;t.update(2.5);checks.reducedCaption=captions.includes('The wildlings gather: 8/12');t.reducedMotion=false;
 events.length=0;reveals.length=0;t.play('attack');t.update(5.001);checks.threeHorns=events.filter(x=>x==='horn').length===3;checks.publicRevealSlots=reveals.join(',')==='bids,card';checks.attackDuration=t.state.beat===null;
 events.length=0;reveals.length=0;t.play('attack');t.skip();checks.skipStep=t.state.step==='horn-2';t.skip('all');checks.skipAllCancelsReveals=reveals.length===0&&t.state.beat===null;
 t.setStrength(12,{animate:false});t.play('nights-watch-victory');t.update(3);checks.watchReset=t.state.strength===0&&t.state.visualStrength===0&&t.state.beat===null;
 t.setStrength(12,{animate:false});t.play('wildling-victory');t.update(3);checks.publicAffectedRegionHook=highlights===1;checks.wildlingOutcomeKeepsPublicTrack=t.state.strength===12;
 const before=t.state.visualStrength;t.update(NaN);t.update(-1);checks.invalidDeltaIgnored=t.state.visualStrength===before;
 t.play('threshold');const savedParent=t.object.parent;t.warmup(sample.renderer,sample.camera);checks.warmupPreservesParent=t.object.parent===savedParent;checks.warmupNoEvents=t.state.step==='gather';
 const elevated=new Ctor({region,groundHeight:()=>100});elevated.play('threshold');const thresholdAbove=elevated.state.cameraPath.every(k=>k.position[1]>=100&&k.target[1]>=100);elevated.play('attack');checks.absoluteGroundCamera=thresholdAbove&&elevated.state.cameraPath.every(k=>k.position[1]>=100&&k.target[1]>=100);elevated.dispose();
 t.dispose();t.dispose();t.setStrength(4);t.play('attack');t.update(1);t.skip();checks.idempotentDisposal=t.object.children.length===0;
 let invalid=false;try{new Ctor({region:{...region,maxX:-20},groundHeight:()=>0});}catch{invalid=true;}checks.invalidRegion=invalid;
 let badGround=false;try{new Ctor({region,groundHeight:()=>NaN});}catch{badGround=true;}checks.invalidGround=badGround;
 return checks;
});}
function framePass(metrics,floor){
 // RAF in WebKit is integer-ms quantized; compare to an observed floor and retain the physical 60 Hz target.
 return floor.frameP50<=17.5 && floor.frameP95<=18.5 && metrics.frameP50<=Math.max(results.vsyncFloorMs,floor.frameP50)+results.frameToleranceMs && metrics.frameP95<=Math.max(results.vsyncFloorMs,floor.frameP95)+results.frameToleranceMs;
}
async function beatPrograms(page){return page.evaluate(()=>{
 const q=window.__wildlingQA;q.pause(true);const before=q.renderer.info.programs.length;const budgets=[];
 for(const strength of [0,2,4,6,8,10,12]){q.setStrength(strength,false);budgets.push({strength,...q.measurePresenter()});}
 for(const beat of ['threshold','attack','nights-watch-victory','wildling-victory']){
   q.setStrength(12,false);q.play(beat);q.pause(true);
   for(let i=0;i<91;i++){q.step(.1);q.measurePresenter();}
 }
 q.threat.reducedMotion=true;q.play('attack');q.pause(true);for(let i=0;i<60;i++){q.step(.1);q.measurePresenter();}
 const after=q.renderer.info.programs.length;q.threat.skip('all');q.threat.reducedMotion=false;q.pause(false);q.setStrength(12,false);
 return {before,after,newPrograms:after-before,budgets};
});}
async function shot(page,file){await page.screenshot({path:out(file),type:'jpeg',quality:72});}
async function contactSheets(browser,engine,cells){
 const page=await browser.newPage({viewport:{width:1400,height:1520},deviceScaleFactor:1});observe(page,`${engine}/sheets`);
 for(const viewport of Object.keys(sizes))for(const view of ['World','Wall']){
   const entries=cells.filter(c=>c.viewport===viewport&&c.view===view);
   const html=`<!doctype html><html><body style="margin:0;background:#111e27;color:#edf1e8;font:14px system-ui"><header style="padding:24px"><h1 style="margin:0;font:28px Georgia">The burning North · ${engine} · ${viewport} · ${view}</h1><p>Public strength only · High · 38° lens · synthetic North patch</p></header><main style="display:grid;grid-template-columns:repeat(${viewport==='phone'?4:2},1fr);gap:12px;padding:0 20px 20px">${entries.map(c=>`<figure style="margin:0;background:#1b2d38"><figcaption style="padding:10px">${c.strength}/12 ${c.strength===12?'· IMMINENT':''}</figcaption><img style="width:100%;display:block" src="data:image/jpeg;base64,${fs.readFileSync(out(c.crop)).toString('base64')}"></figure>`).join('')}</main></body></html>`;
   fs.writeFileSync(out(`sheets/${engine}-${viewport}-${view}.html`),html);
   await page.setContent(html);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
   await page.screenshot({path:out(`sheets/${engine}-${viewport}-${view}.jpg`),fullPage:true,type:'jpeg',quality:72});
 }
 await page.close();
}
async function video(browser,engine,url,kind){
 const dir=out(`videos/.${engine}-${kind}`);fs.mkdirSync(dir,{recursive:true});
 const ctx=await browser.newContext({viewport:sizes.desktop,deviceScaleFactor:1,recordVideo:{dir,size:sizes.desktop}});
 const page=await ctx.newPage();observe(page,`${engine}/video/${kind}`);
 try{
   await navigate(page,url,kind==='threshold'?'threshold':'attack',`strength=${kind==='threshold'?6:12}&camera=World`);
   if(kind==='threshold'){
     await page.evaluate(()=>{window.__wildlingQA.setStrength(8);window.__wildlingQA.play('threshold');});await page.waitForTimeout(3200);
   }else{
     await page.getByRole('button',{name:'Attack',exact:true}).click();await page.waitForTimeout(5050);
     await page.getByRole('button',{name:kind==='watch'?'Watch holds':'Wildlings prevail',exact:true}).click();await page.waitForTimeout(3300);
   }
 }finally{
   const recording=page.video();await ctx.close();await recording.saveAs(out(`videos/${engine}-${kind}.webm`));await recording.delete();fs.rmdirSync(dir);
 }
}
async function engineRun(engine,browser,url){
 const data=results.engines[engine]={};const cells=[];
 for(const [viewportName,viewport]of Object.entries(sizes)){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();observe(page,`${engine}/${viewportName}`);
   try{
     data[viewportName]={};
     for(const quality of ['high','balanced']){
       load(`${engine}/${viewportName}/${quality}`);
       await navigate(page,url,'track',`strength=0&quality=${quality}&camera=World`);
       if(viewportName==='desktop'&&quality==='high'){
         results.contracts[engine]=await contracts(page);
         const programs=await beatPrograms(page);data.programSweep=programs;assert.equal(programs.newPrograms,0,'New presenter shader after warmup');
       }
       // Matched empty-gallery control: same DOM, animation loop and browser, with only story geometry hidden.
       await page.evaluate(()=>{const q=window.__wildlingQA;q.pause(true);q.threat.object.parent.visible=false;q.resetMetrics();});
       await frames(page,quick?35:125);
       const floor=await page.evaluate(()=>window.__wildlingQA.metrics());
       data[viewportName][`${quality}Floor`]=floor;
       await page.evaluate(()=>{const q=window.__wildlingQA;q.threat.object.parent.visible=true;q.pause(false);q.resetMetrics();});
       data[viewportName][quality]=[];
       for(const strength of levels){
         await page.evaluate(n=>{const q=window.__wildlingQA;q.threat.skip('all');q.setView('World');q.setStrength(n,false);q.resetMetrics();},strength);
         await frames(page,quick?35:125);
         const metrics=await page.evaluate(()=>window.__wildlingQA.metrics());
         const measured=await page.evaluate(()=>window.__wildlingQA.measurePresenter());
         const row={strength,...metrics,measured};row.budgetPass=measured.draws<=(quality==='high'?12:6)&&measured.triangles<=(quality==='high'?60000:25000);
         row.framePass=framePass(metrics,floor);row.programPass=metrics.latePrograms===0;
         data[viewportName][quality].push(row);
         if(metrics.webglError)results.errors.push({label:`${engine}/${viewportName}/${quality}/${strength}`,type:'webgl',message:String(metrics.webglError)});
         assert(row.budgetPass,'Presenter geometry budget exceeded');assert(row.programPass,'New shader after warmup');
         if(quality==='high'){
           for(const view of ['World','Wall']){
             await page.evaluate(view=>window.__wildlingQA.setView(view),view);await frames(page,3);
             const stem=`${engine}-${viewportName}-${view}-${strength}`;await shot(page,`screens/${stem}.jpg`);
             await page.locator('#stage').screenshot({path:out(`crops/${stem}.jpg`),type:'jpeg',quality:72});
             cells.push({viewport:viewportName,view,strength,crop:`crops/${stem}.jpg`});
           }
         }
         console.log(engine,viewportName,quality,strength,JSON.stringify({p95:metrics.frameP95,draws:measured.draws,triangles:measured.triangles,late:metrics.latePrograms}));
       }
     }
     data[viewportName].beats=[];
     for(const quality of ['high','balanced']){
       await navigate(page,url,'attack',`strength=12&quality=${quality}&camera=Wall`);
       load(`${engine}/${viewportName}/${quality}/beats`);
       for(const [beat,count]of [['threshold',160],['attack',310],['nights-watch-victory',190],['wildling-victory',190]]){
         await page.evaluate(beat=>{const q=window.__wildlingQA;q.setStrength(12,false);q.play(beat);q.resetMetrics();},beat);
         await frames(page,quick?35:count);
         const metrics=await page.evaluate(()=>window.__wildlingQA.metrics());
         const row={beat,quality,...metrics,framePass:framePass(metrics,data[viewportName][`${quality}Floor`]),programPass:metrics.latePrograms===0};
         assert(row.programPass,'Late beat shader');if(metrics.webglError)results.errors.push({label:`${engine}/${viewportName}/${quality}/${beat}`,type:'webgl',message:String(metrics.webglError)});
         data[viewportName].beats.push(row);
         console.log(engine,viewportName,quality,beat,JSON.stringify({p95:metrics.frameP95,late:metrics.latePrograms}));
       }
     }
     // Comparison reference and reduced motion are explicitly reviewed in both viewport sizes.
     await navigate(page,url,'current','strength=12&camera=Wall');await frames(page,12);await shot(page,`screens/${engine}-${viewportName}-current.jpg`);
     await navigate(page,url,'threshold','strength=8&camera=Wall&reducedMotion=true');
     const before=await page.evaluate(()=>window.__wildlingQA.camera.position.toArray());
     await page.getByRole('button',{name:'Threshold',exact:true}).click();await frames(page,20);await shot(page,`screens/${engine}-${viewportName}-reduced.jpg`);
     const reduced=await page.evaluate(()=>({path:window.__wildlingQA.threat.state.cameraPath.length,camera:window.__wildlingQA.camera.position.toArray(),caption:window.__wildlingQA.threat.state.caption}));
     assert.equal(reduced.path,0);assert.deepEqual(reduced.camera,before);assert(reduced.caption.includes('8/12'));
     // Keyboard accessibility: play/skip controls remain native focusable buttons.
     await page.getByRole('button',{name:'Skip all',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__wildlingQA.threat.state.beat),null);
     data[viewportName].reduced=reduced;
   }finally{await context.close();}
 }
 await contactSheets(browser,engine,cells);
 if(!quick)for(const kind of ['threshold','watch','wildlings'])await video(browser,engine,url,kind);
}
withWildlingServer(async url=>{
 fs.mkdirSync(root,{recursive:true});
 for(const [engine,type]of [['chrome',chromium],['webkit',webkit]]){
   let browser;
   try{
     load(`${engine}/launch`);
     browser=await type.launch({headless:true,...(engine==='chrome'?{channel:'chrome',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']}:{} )});
     await engineRun(engine,browser,url);
   }finally{await browser?.close();fs.writeFileSync(out('qa-results.json'),JSON.stringify(results,null,2));}
 }
 assert.equal(results.errors.length,0,'Browser or WebGL errors');
 for(const [engine,checks]of Object.entries(results.contracts))for(const [name,passed]of Object.entries(checks))assert(passed,`${engine}: ${name}`);
 const rows=Object.values(results.engines).flatMap(e=>Object.values(e).filter(v=>v&&v.high).flatMap(v=>[...v.high,...v.balanced,...v.beats]));
 results.frameGate=rows.every(row=>row.framePass);results.status=results.frameGate?'GO':'NO-GO';
 fs.writeFileSync(out('qa-results.json'),JSON.stringify(results,null,2));
 console.log('DONE',results.status,'errors',results.errors.length,'contracts',results.contracts);
 if(!results.frameGate)process.exitCode=1;
}).catch(e=>{results.status='NO-GO';results.failure=e.stack;fs.writeFileSync(out('qa-results.json'),JSON.stringify(results,null,2));console.error(e);process.exitCode=1;});
