/* Bounded, deterministic before/after captures for the protected-story gate. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
process.env.QA_PORT ||= '5260';
process.env.QA_OUTPUT_DIR ||= 'qa-output/seats';
if (+process.env.QA_PORT < 5260 || +process.env.QA_PORT > 5269) throw new Error('Use port 5260–5269');
const { withServer, evidence } = require('./server.cjs');
fs.mkdirSync(evidence,{recursive:true});
const result = { captures: [], errors: [] };
withServer(async base => {
  const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    await page.addInitScript(() => {
      // Freeze the gallery clock and randomness; async loading still uses real timers.
      performance.now = () => 1000;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => raf(() => cb(1000));
      let seed = 7; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    });
    page.on('pageerror', e => result.errors.push(e.message));
    page.on('console', m => { if(m.type()==='error') result.errors.push(m.text()); });
    await page.goto(base);
    await page.waitForFunction(() => window.__realmforge?.ready());
    const stories = await page.evaluate(() => window.__realmforge.stories().filter(s => /^(armies|wildlings|heraldry)\//.test(s.id)));

    for (const story of stories) {
      const params = new URLSearchParams({'view.turntable':'false', 'view.ratio':'1'});
      if(story.direction) params.set('direction',story.direction);
      await page.goto(`${base}#${story.id}?${params}`);
      // Full reload isolates each story's clock, resources and injected demo marks.
      await page.reload();
      await page.waitForFunction(id => document.body.dataset.ready===id && window.__realmforge.ready() && (!id.startsWith('lookdev/') || window.__lookdev?.stats().ready), story.id, {timeout:60000});
      await page.waitForTimeout(600);
      const name = (story.direction?.[0] || story.id).replaceAll('/','-');
      const bytes = await page.locator('#stage canvas').screenshot({path:path.join(evidence,`${name}.png`)});
      result.captures.push({name, sha256:createHash('sha256').update(bytes).digest('hex')});
      console.log(name);
    }
  } finally { await browser.close(); }
}).catch(e => { result.errors.push(e.stack); process.exitCode=1; }).finally(() => {
  fs.writeFileSync(path.join(evidence,'parity.json'),JSON.stringify(result,null,2));
  if(result.errors.length) process.exitCode=1;
});
