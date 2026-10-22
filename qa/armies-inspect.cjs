const { chromium } = require('playwright');
const { withArmyServer } = require('./armies-server.cjs');
const { base } = require('./server.cjs');
withArmyServer(base, async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(m.type(),m.text());});page.on('pageerror',e=>console.log('ERROR',e.message));
 await page.goto(`${base}#armies/state-player`);await page.waitForTimeout(3000);
 const result=await page.evaluate(()=>({ready:window.__armyQA?.ready,metrics:window.__armyQA?.metrics()}));console.log(JSON.stringify(result,null,2));
 await page.screenshot({path:require('node:path').join(require('./server.cjs').evidence, 'inspect.jpg'),type:'jpeg',quality:72});
 await page.goto(`${base}#armies/board-high`);await page.waitForTimeout(2000);console.log('high',await page.evaluate(()=>window.__armyQA?.metrics()));
 await page.goto(`${base}#armies/board-balanced`);await page.waitForTimeout(2000);console.log('balanced',await page.evaluate(()=>window.__armyQA?.metrics()));
 } finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode = 1; });
