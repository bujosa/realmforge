/* Full drawing-buffer benchmark, separate from the gallery's smaller stage pane. */
const { chromium, webkit } = require('playwright');
const { withArmyServer } = require('./armies-server.cjs');
const { base } = require('./server.cjs');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.QA_OUTPUT_DIR || 'qa-output');
fs.mkdirSync(root, { recursive: true });
const results = { timestamp: new Date().toISOString(), cases: [], errors: [] };
let activeBrowser;
withArmyServer(base, async () => {
  try {
    for (const [engine, launch] of [
      ['chrome', () => chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })],
      ['webkit', () => webkit.launch({ headless: true })],
    ]) {
      const browser = activeBrowser = await launch();
      for (const [viewport, size] of [['desktop', {width:1440,height:900}], ['phone', {width:390,height:844}]]) {
        const context = await browser.newContext({viewport:size, deviceScaleFactor:1});
        const page = await context.newPage();
        page.on('pageerror', error => results.errors.push({engine, viewport, message:error.message}));
        page.on('console', message => { if(message.type() === 'error') results.errors.push({engine, viewport, message:message.text()}); });
        for (const detail of ['high', 'balanced']) {
          await page.goto(`${base}#armies/board-${detail}`);
          await page.waitForFunction(() => window.__armyQA?.ready);
          await page.evaluate(({width,height}) => {
            const q = window.__armyQA;
            q.renderer.setPixelRatio(1); q.renderer.setSize(width,height,false);
            q.camera.aspect = width/height; q.camera.updateProjectionMatrix();
          }, size);
          await page.waitForTimeout(1000);
          const load = execFileSync('uptime', {encoding:'utf8'}).trim();
          console.log(engine, viewport, detail, load);
          await page.evaluate(() => window.__armyQA.resetMetrics());
          await page.waitForTimeout(6000);
          const metrics = await page.evaluate(() => {
            const q = window.__armyQA;
            return {...q.metrics(), renderWidth:q.renderer.domElement.width, renderHeight:q.renderer.domElement.height};
          });
          if (metrics.renderWidth !== size.width || metrics.renderHeight !== size.height) throw new Error('Drawing buffer dimensions changed during benchmark');
          await page.evaluate(() => {const q=window.__armyQA; while(q.batch.units.length) q.batch.units[0].remove(); q.resetMetrics();});
          await page.waitForTimeout(3000);
          const baseline = await page.evaluate(() => window.__armyQA.metrics());
          const result = {engine, version:browser.version(), viewport, detail, load, ...metrics, baseline,
            geometryPass:metrics.draws <= (detail === 'high' ? 40:20) && metrics.triangles <= (detail === 'high' ? 400000:160000),
            programPass:metrics.latePrograms === 0, framePass:metrics.frameP95 <= 16.7};
          results.cases.push(result); console.log(JSON.stringify(result));
        }
        await context.close();
      }
      await browser.close(); activeBrowser = undefined;
    }
    results.verdict = results.errors.length === 0 && results.cases.every(c => c.geometryPass && c.programPass && c.framePass && c.webglError === 0) ? 'GO':'NO-GO';
    if (results.verdict !== 'GO') process.exitCode = 1;
  } finally {
    await activeBrowser?.close();
  }
}).catch(error => {results.failure=error.stack; console.error(error); process.exitCode=1;}).finally(() => {
  fs.writeFileSync(path.join(root,'full-buffer-perf.json'), JSON.stringify(results,null,2)+'\n');
});
