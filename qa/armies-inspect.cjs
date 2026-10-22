const { chromium } = require('/Users/davidbujosa/Documents/Workspace/games/swords-and-ravens-v3-p3/e2e/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(m.type(),m.text());});page.on('pageerror',e=>console.log('ERROR',e.message));
 await page.goto('http://127.0.0.1:5211/#armies/state-player');await page.waitForTimeout(3000);
 const result=await page.evaluate(()=>({ready:window.__armyQA?.ready,metrics:window.__armyQA?.metrics()}));console.log(JSON.stringify(result,null,2));
 await page.screenshot({path:process.env.HOME+'/.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-armies/inspect.jpg',type:'jpeg',quality:72});
 await page.goto('http://127.0.0.1:5211/#armies/board-high');await page.waitForTimeout(2000);console.log('high',await page.evaluate(()=>window.__armyQA?.metrics()));
 await page.goto('http://127.0.0.1:5211/#armies/board-balanced');await page.waitForTimeout(2000);console.log('balanced',await page.evaluate(()=>window.__armyQA?.metrics()));
 await browser.close();
})();
