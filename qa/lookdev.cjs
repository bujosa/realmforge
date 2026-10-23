/* Bounded visual/performance capture requested by the look-development brief. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
process.env.QA_PORT ||= '5250';
if (+process.env.QA_PORT < 5250 || +process.env.QA_PORT > 5259) throw new Error('Look-development QA requires port 5250–5259');
process.env.QA_OUTPUT_DIR ||= 'qa-output/lookdev';
const {withServer,evidence}=require('./server.cjs');
const {chromium,webkit}=require('playwright');
const repetitions=Number(process.env.LOOKDEV_REPEATS||1);
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>5)throw new Error('LOOKDEV_REPEATS must be 1–5');
const mode=process.argv[2]||'full';const result={uptime:execFileSync('uptime',{encoding:'utf8'}).trim(),mode,runs:[],errors:[]};
if(process.env.LOOKDEV_RESUME){result.runs=JSON.parse(fs.readFileSync(process.env.LOOKDEV_RESUME,'utf8')).runs;result.resumedFrom=path.basename(process.env.LOOKDEV_RESUME);}
const completed=(engine,form,look)=>mode==='full'&&['High','Balanced'].every(quality=>result.runs.some(r=>r.engine===engine&&r.form===form&&r.look===look&&r.quality===quality));
const directions=(process.env.LOOKDEV_ONLY==='B'?['B · Grounded realism']:['A · Painterly realism','B · Grounded realism','C · Series mood']);
const immersive=`#app{display:block!important}#catalogue,header,#inspector,.stage-badge,.stage-hint,#stats{display:none!important}#workspace,#view,#stage{display:block!important;width:100vw!important;height:100vh!important;min-height:0!important}#story-overlay{top:20px!important}#story-hud{max-width:75%!important;bottom:20px!important}`;
async function open(page,base,direction,quality='High',pose='World x20'){
 const p=new URLSearchParams({direction,quality,pose,'view.navigation':'fly','view.grid':'false','view.ratio':'1'});
 await page.goto(`${base}#lookdev/landscape?${p}`);
 await page.waitForFunction(()=>window.__lookdev?.stats().ready && window.__realmforge.ready(),null,{timeout:60000});
 await page.waitForTimeout(900);
}
async function measure(page){
 return page.evaluate(async()=>{
  const load=window.__ldPrograms,before=window.__realmforge.stats().programs;
  const times=[],draws=[],triangles=[],start=performance.now();let last=start;
  window.__lookdev.startFlight();
  await new Promise(resolve=>{function frame(t){times.push(t-last);const stats=window.__realmforge.stats();draws.push(stats.calls);triangles.push(stats.triangles);last=t;if(t-start<3000)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
  times.shift();times.sort((a,b)=>a-b);
  const m={...window.__realmforge.stats(),frameP95:times[Math.floor(times.length*.95)],samples:times.length,maxDraws:Math.max(...draws),maxTriangles:Math.max(...triangles),newPrograms:window.__ldPrograms-load,programDelta:window.__realmforge.stats().programs-before,...window.__lookdev.stats()};
  window.__lookdev.setPose('World x20');return m;
 });
}
withServer(async base=>{
 for(const engine of(mode==='inspect'||mode==='video'?['chrome']:['chrome','webkit'])){
  const browser=await(engine==='chrome'?chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']}):webkit.launch({headless:true}));
  try{
   for(const [form,viewport] of(mode==='inspect'||mode==='video'?[['desktop',{width:1440,height:900}]]:[['desktop',{width:1440,height:900}],['phone',{width:390,height:844}]])){
    if(mode==='full'&&['A','B','C'].every(look=>completed(engine,form,look)))continue;
    const context=await browser.newContext({viewport,hasTouch:form==='phone'});
    try{
     const page=await context.newPage();
     page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*error|shader error/i.test(m.text())){result.errors.push({engine,form,error:m.text()});console.error(m.text().slice(0,500));}});
     page.on('pageerror',e=>{result.errors.push({engine,form,error:e.stack});console.error(e.message);});
     await page.addInitScript(()=>{window.__ldPrograms=0;for(const proto of[WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const original=proto.createProgram;proto.createProgram=function(...args){window.__ldPrograms++;return original.apply(this,args)}}});
     for(const direction of(mode==='inspect'?[directions[1]]:directions)){
      if(completed(engine,form,direction[0]))continue;
      await open(page,base,direction);
      const look=direction[0];
      if(form==='desktop'&&engine==='chrome')await page.screenshot({path:path.join(evidence,`${look}-gallery.jpg`),type:'jpeg',quality:72});
      await page.addStyleTag({content:immersive});await page.waitForTimeout(300);
      if(mode==='video'){
       // Capture the canvas with MediaRecorder: precisely 30 s, no shell or leading setup.
       const video=await page.evaluate(async()=>{
        const canvas=document.querySelector('#stage canvas'),stream=canvas.captureStream(24);
        const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000}),parts=[];
        const startPrograms=window.__ldPrograms,frameTimes=[],draws=[],triangles=[];let previous=performance.now(),raf;
        const sample=t=>{frameTimes.push(t-previous);previous=t;const s=window.__realmforge.stats();draws.push(s.calls);triangles.push(s.triangles);raf=requestAnimationFrame(sample)};raf=requestAnimationFrame(sample);
        recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
        const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();window.__lookdev.startFlight();
        await new Promise(r=>setTimeout(r,30000));recorder.stop();await done;cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());
        const bytes=new Uint8Array(await new Blob(parts).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));frameTimes.sort((a,b)=>a-b);return {data:btoa(str),metrics:{newPrograms:window.__ldPrograms-startPrograms,frameP95:frameTimes[Math.floor(frameTimes.length*.95)],frames:frameTimes.length,maxDraws:Math.max(...draws),maxTriangles:Math.max(...triangles)}};
       });
       fs.writeFileSync(path.join(evidence,`${look}-flight-30s.webm`),Buffer.from(video.data,'base64'));result.runs.push({look,engine,form,...video.metrics});console.log(`${look} video captured`);continue;
      }
      for(const pose of['World x20','Regional','Close','Essos']){
       await page.evaluate(p=>window.__lookdev.setPose(p),pose);await page.waitForTimeout(700);
       await page.screenshot({path:path.join(evidence,`${look}-${engine}-${form}-${pose.replaceAll(' ','-').toLowerCase()}.jpg`),type:'jpeg',quality:72});
      }
      if(mode==='inspect'||mode==='stills'){result.runs.push(await page.evaluate(()=>({...window.__realmforge.stats(),...window.__lookdev.stats()})));continue;}
      for(const quality of['High','Balanced']){
       if(quality==='Balanced'){await open(page,base,direction,quality);await page.addStyleTag({content:immersive});}
       await page.evaluate(()=>window.__lookdev.setPose('World x20'));await page.waitForTimeout(500);
       for(let sample=1;sample<=repetitions;sample++){
       await page.evaluate(()=>window.__lookdev.setPose('World x20'));await page.waitForTimeout(500);
       await page.evaluate(()=>window.__realmforge.resetMetrics());await page.waitForTimeout(2500);
       const defaultStats=await page.evaluate(()=>({...window.__realmforge.metrics(),...window.__lookdev.stats()}));
       const uptime=execFileSync('uptime',{encoding:'utf8'}).trim();
       const flight=await measure(page);result.runs.push({engine,form,quality,look,sample,uptime,default:defaultStats,motion:flight});
       console.log(`${engine}/${form}/${look}/${quality}: ${defaultStats.calls} draws ${defaultStats.triangles} tris; flight p95 ${flight.frameP95.toFixed(1)} ms / +${flight.newPrograms} programs`);
       fs.writeFileSync(path.join(evidence,`${mode}-results.json`),JSON.stringify(result,null,2));
       }
      }
     }
     if(mode==='full'){
      // Exercise live controls in the real gallery layout, then review disposal.
      await page.evaluate(()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('#app{display:block!important}'))s.remove()}));
      await page.getByLabel('Art direction',{exact:true}).selectOption(directions[0]);
      await page.waitForFunction(()=>window.__lookdev?.stats().ready);await page.getByLabel('Camera preset',{exact:true}).selectOption('Essos');
      await page.waitForFunction(()=>window.__lookdev?.stats().ready);await page.getByRole('button',{name:'Release camera',exact:true}).click();
      await page.locator('#stage canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(150);await page.keyboard.up('w');
      await page.goto(`${base}#explore/westeros-sampler`);await page.waitForFunction(()=>document.body.dataset.ready==='explore/westeros-sampler'&&window.__realmforge.ready());
      await page.screenshot({path:path.join(evidence,`existing-sampler-${engine}-${form}.jpg`),type:'jpeg',quality:72});
     }
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
}).catch(e=>{result.errors.push({error:e.stack});console.error(e.stack);process.exitCode=1;}).finally(()=>{
 fs.writeFileSync(path.join(evidence,`${mode}-results.json`),JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
});
