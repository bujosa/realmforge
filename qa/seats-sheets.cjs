/* Contact sheets from the brief's external captures. No server and no network assets. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.env.QA_OUTPUT_DIR)throw new Error('Set the external QA_OUTPUT_DIR');
const out=path.resolve(process.env.QA_OUTPUT_DIR),embed=name=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(out,name)).toString('base64');
const titles={capital:'Capital of the Three Hills',island:'Dragon-carved Island Keep',north:'Granite Seat of the North'};
const style='<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#17262c;color:#eee8d8;font:14px/1.5 system-ui}h1{font:30px Georgia;margin:0 0 6px}p{color:#b9c6c4;margin:0 0 18px}.grid{display:grid;gap:12px}figure{margin:0;background:#22343b}img{width:100%;display:block}figcaption{padding:9px 12px;color:#e6dcc1}h2{font:20px Georgia;margin:18px 0 8px}</style>';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});try{
 async function save(name,html,width=1860){
  const doc=`<!doctype html><html lang="en"><meta charset="utf-8">${style}${html}</html>`;fs.writeFileSync(path.join(out,name+'.html'),doc);
  const page=await browser.newPage({viewport:{width,height:1000}});
  try{
   await page.setContent(doc);await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready;});
   const height=await page.evaluate(()=>Math.ceil(document.body.getBoundingClientRect().height));await page.setViewportSize({width,height});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:72,fullPage:true});
  }finally{await page.close();}
 }

 for(const kind of Object.keys(titles)){
  for(const engine of ['chrome','webkit'])for(const form of ['desktop','phone']){
   await save(`${kind}-sheet-${engine}-${form}`,`<h1>${titles[kind]}</h1><p>Look B / ${engine} / ${form} · Columns: overview, regional 2 km, close 600 m · Rows: A, B · identical optical camera presets</p><div class="grid" style="grid-template-columns:repeat(3,1fr)">${['A','B'].flatMap(variant=>['overview','regional','close'].map(pose=>`<figure><img src="${embed(`${kind}-${variant}-${engine}-${form}-${pose}.jpg`)}"><figcaption>${variant} · ${pose}</figcaption></figure>`)).join('')}</div>`,form==='phone'?1170:1860);
  }
 }
 const previous=path.resolve(process.env.SEAT_PREVIOUS_DIR||path.join(path.dirname(out),'r2'));
 for(const kind of Object.keys(titles)){
  for(const engine of ['chrome','webkit'])for(const form of ['desktop','phone'])await save(`${kind}-B-sheet-${engine}-${form}`,`<h1>${titles[kind]} / selected B</h1><p>Round 3 / Look B / ${engine} / ${form} · Overview, regional 2 km, close 600 m · 38° FOV; portrait crops horizontal context.</p><div class="grid" style="grid-template-columns:repeat(3,1fr)">${['overview','regional','close'].map(pose=>`<figure><img src="${embed(`${kind}-B-${engine}-${form}-${pose}.jpg`)}"><figcaption>B · ${pose}</figcaption></figure>`).join('')}</div>`,form==='phone'?1170:1860);
  await save(`${kind}-round2-vs-round3`,`<h1>${titles[kind]} / B · round 2 → round 3</h1><p>Same B optical presets and focus. Left: archived round 2. Right: round 3 art pass. Both are procedural studies, not live-game screenshots.</p>${['overview','regional','close'].map(pose=>`<h2>${pose}</h2><div class="grid" style="grid-template-columns:1fr 1fr"><figure><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(previous,`${kind}-B-chrome-desktop-${pose}.jpg`)).toString('base64')}"><figcaption>Round 2 B</figcaption></figure><figure><img src="${embed(`${kind}-B-chrome-desktop-${pose}.jpg`)}"><figcaption>Round 3 B</figcaption></figure></div>`).join('')}`,1440);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
