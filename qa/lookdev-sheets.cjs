/* Assemble local captures only; no private game reference images are required. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out=path.resolve(process.env.QA_OUTPUT_DIR||'qa-output/lookdev');
const embed=p=>'data:image/jpeg;base64,'+fs.readFileSync(p).toString('base64');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  for(const engine of ['chrome','webkit'])for(const form of ['desktop','phone']){
   const looks=(process.env.LOOKDEV_ONLY==='B'?['B']:['A','B','C']);
   const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Landscape direction review</title><style>body{background:#142229;color:#eee;font:16px system-ui;padding:20px}section{display:grid;grid-template-columns:repeat(${looks.length},1fr);gap:12px}figure{margin:0}img{width:100%}h1{font:28px Georgia}</style><h1>Landscape study · ${engine} · ${form}</h1>${['world-x20','regional','close','essos'].map(pose=>`<h2>${pose}</h2><section>${looks.map(look=>`<figure><img src="${embed(path.join(out,`${look}-${engine}-${form}-${pose}.jpg`))}"><figcaption>${look} · synthetic landscape</figcaption></figure>`).join('')}</section>`).join('')}</html>`;
   const file=path.join(out,`comparison-${engine}-${form}`);
   fs.writeFileSync(file+'.html',html);await page.setContent(html);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await page.screenshot({path:file+'.jpg',fullPage:true,type:'jpeg',quality:72});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
