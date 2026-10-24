/* Brief-requested bounded headless evidence capture, not an assertion/snapshot suite. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
process.env.QA_PORT ||= '5260';
if(+process.env.QA_PORT<5260||+process.env.QA_PORT>5269)throw new Error('Seat capture requires port 5260–5269');
if(!process.env.QA_OUTPUT_DIR)throw new Error('Set QA_OUTPUT_DIR to the external handoff evidence directory');
fs.mkdirSync(path.resolve(process.env.QA_OUTPUT_DIR),{recursive:true});
const {withServer,evidence}=require('./server.cjs');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const mode=process.argv[2]||'full',result={uptime:execFileSync('uptime',{encoding:'utf8'}).trim(),mode,runs:[],errors:[]};
const immersive='#app{display:block!important}#catalogue,header,#inspector,.stage-badge,.stage-hint,#stats{display:none!important}#workspace,#view,#stage{display:block!important;width:100vw!important;height:100vh!important;min-height:0!important}#story-overlay,#story-hud{display:none!important}';
async function open(page,base,kind,variant='A'){
 await page.goto(`${base}#seats/${kind}?${new URLSearchParams({variant:variant==='A'?({capital:'A · Steep crown city',island:'A · Dragon towers',north:'A · Winter enclosure'}[kind]):({capital:'B · Harbour metropolis',island:'B · Carved dragon ridge',north:'B · Long northern ward'}[kind]),'view.grid':'false','view.navigation':'fly','view.ratio':'1'})}`);
 await page.waitForFunction(()=>window.__seats?.stats().ready&&window.__realmforge.ready());await page.waitForTimeout(600);
}
withServer(async base=>{
 for(const engine of ['video','inspect','reference'].includes(mode)?['chrome']:['chrome','webkit']){
  const browser=await(engine==='chrome'?chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']}):webkit.launch({headless:true}));
  try{for(const [form,viewport]of ['video','inspect','reference'].includes(mode)?[['desktop',{width:1440,height:900}]]:[['desktop',{width:1440,height:900}],['phone',{width:390,height:844}]]){
   const context=await browser.newContext({viewport,hasTouch:form==='phone'});try{
    const page=await context.newPage();page.on('pageerror',e=>result.errors.push({engine,form,error:e.stack}));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*error|shader error/i.test(m.text()))result.errors.push({engine,form,error:m.text()});});
    await page.addInitScript(()=>{window.__seatPrograms=0;for(const proto of[WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const original=proto.createProgram;proto.createProgram=function(...args){window.__seatPrograms++;return original.apply(this,args);};}});
    for(const kind of mode==='controls'?[]:mode==='north'?['north']:['capital','island','north'])for(const variant of ['video','inspect','reference'].includes(mode)?['B']:['A','B']){
     await open(page,base,kind,variant);
     if(engine==='chrome'&&form==='desktop'&&variant==='B')await page.screenshot({path:path.join(evidence,`${kind}-gallery.jpg`),type:'jpeg',quality:72});
     await page.addStyleTag({content:immersive});await page.waitForTimeout(250);
     if(mode==='video'){
      const data=await page.evaluate(async()=>{const stream=document.querySelector('#stage canvas').captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000}),parts=[],times=[],calls=[],triangles=[];const initialPrograms=window.__seatPrograms;let last=performance.now(),raf;const sample=t=>{times.push(t-last);last=t;const stats=window.__realmforge.stats();calls.push(stats.calls);triangles.push(stats.triangles);raf=requestAnimationFrame(sample);};raf=requestAnimationFrame(sample);recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};const done=new Promise(r=>recorder.onstop=r);recorder.start();window.__seats.startOrbit();await new Promise(r=>setTimeout(r,20000));recorder.stop();await done;cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(parts).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));times.shift();times.sort((a,b)=>a-b);return {data:btoa(s),metrics:{frameP95:times[Math.floor(times.length*.95)],maxDraws:Math.max(...calls),maxTriangles:Math.max(...triangles),newPrograms:window.__seatPrograms-initialPrograms,samples:times.length}};});fs.writeFileSync(path.join(evidence,`${kind}-orbit-20s.webm`),Buffer.from(data.data,'base64'));result.runs.push({kind,variant,engine,form,...data.metrics});console.log(`${kind}: orbit saved, +${data.metrics.newPrograms} programs`);continue;
     }
     for(const pose of ['Overview','Regional','Close']){await page.evaluate(p=>window.__seats.setPose(p),pose);await page.waitForTimeout(400);await page.screenshot({path:path.join(evidence,`${kind}-${variant}-${engine}-${form}-${pose.toLowerCase()}.jpg`),type:'jpeg',quality:72});}
     if(engine==='chrome'&&form==='desktop'&&variant==='A'){
      const url=new URL(page.url()),[id,query]=url.hash.slice(1).split('?'),params=new URLSearchParams(query);params.set('reference','true');url.hash=id+'?'+params;await page.goto(url.href);await page.waitForFunction(()=>window.__seats?.stats().ready);await page.addStyleTag({content:immersive});
      for(const pose of ['Overview','Regional','Close']){await page.evaluate(p=>window.__seats.setPose(p),pose);await page.waitForTimeout(400);await page.screenshot({path:path.join(evidence,`${kind}-reference-${pose.toLowerCase()}.jpg`),type:'jpeg',quality:72});}
      await open(page,base,kind,variant);await page.addStyleTag({content:immersive});
     }
     if(mode==='inspect'||mode==='reference')continue;
     await page.evaluate(()=>window.__seats.setPose('Regional'));await page.waitForTimeout(600);
     const uptime=execFileSync('uptime',{encoding:'utf8'}).trim();
     const metrics=await page.evaluate(async()=>{const before=window.__seatPrograms,intervals=[],calls=[],tris=[];let last=performance.now(),start=last;window.__seats.startOrbit();await new Promise(resolve=>{function frame(t){intervals.push(t-last);last=t;const s=window.__realmforge.stats();calls.push(s.calls);tris.push(s.triangles);if(t-start<3000)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});intervals.shift();intervals.sort((a,b)=>a-b);const info={...window.__realmforge.stats(),...window.__seats.stats(),frameP95:intervals[Math.floor(intervals.length*.95)],maxDraws:Math.max(...calls),maxTriangles:Math.max(...tris),newPrograms:window.__seatPrograms-before,samples:intervals.length};window.__seats.setPose('Regional');return info;});
     result.runs.push({engine,form,kind,variant,uptime,...metrics});console.log(`${engine}/${form}/${kind}/${variant}: ${metrics.maxDraws} draws, ${metrics.maxTriangles} triangles, p95 ${metrics.frameP95.toFixed(1)} ms, +${metrics.newPrograms} programs`);fs.writeFileSync(path.join(evidence,`${mode}-results.json`),JSON.stringify(result,null,2));
    }
    if(mode==='full'||mode==='controls'){
     // Exercise the visible controls and disposal in the real gallery, without screenshot assertions.
     for(const kind of ['capital','island','north']){
      await page.goto(`${base}#seats/${kind}?view.grid=false`);
      await page.waitForFunction(()=>window.__seats?.stats().ready);
      (result.defaults ||= []).push({engine,form,kind,...await page.evaluate(()=>({variant:window.__seats.stats().variant}))});
     }
     await open(page,base,'north','A');
     await page.evaluate(()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('#app{display:block!important}'))s.remove();}));
     await page.getByLabel('Seat variant',{exact:true}).selectOption('B · Long northern ward');
     await page.waitForFunction(()=>window.__seats?.stats().ready);
     await page.getByLabel('Camera preset',{exact:true}).selectOption('Close');
     await page.waitForFunction(()=>window.__seats?.stats().ready);
     await page.getByLabel('Extracted game reference',{exact:true}).check();
     await page.waitForFunction(()=>window.__seats?.stats().ready);
     await page.getByLabel('Extracted game reference',{exact:true}).uncheck();
     await page.waitForFunction(()=>window.__seats?.stats().ready);
     await page.getByRole('button',{name:'Play 20 s orbit',exact:true}).focus();
     await page.keyboard.press('Enter');await page.waitForTimeout(400);
     await page.screenshot({path:path.join(evidence,`controls-${engine}-${form}.jpg`),type:'jpeg',quality:72});
     await page.getByRole('button',{name:'Release camera',exact:true}).click();
     const before=await page.evaluate(()=>window.__seats.stats().camera);
     await page.locator('#stage canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(180);await page.keyboard.up('w');
     const after=await page.evaluate(()=>window.__seats.stats().camera);
     (result.controls ||= []).push({engine,form,keyboardCameraDistance:Math.hypot(...before.map((v,i)=>after[i]-v))});
     await page.goto(`${base}#explore/westeros-sampler`);await page.waitForFunction(()=>document.body.dataset.ready==='explore/westeros-sampler'&&window.__realmforge.ready());
     await page.waitForTimeout(300);await page.screenshot({path:path.join(evidence,`after-disposal-${engine}-${form}.jpg`),type:'jpeg',quality:72});
    }
   }finally{await context.close();}
  }}finally{await browser.close();}
 }
}).catch(e=>{result.errors.push({error:e.stack});console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(evidence,`${mode}-results.json`),JSON.stringify(result,null,2));if(result.errors.length){console.error(result.errors);process.exitCode=1;}});
