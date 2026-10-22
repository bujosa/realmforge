/* Explicit browser visual/performance evidence runner. Uses the existing game QA install. */
const { chromium, webkit } = require('/Users/davidbujosa/Documents/Workspace/games/swords-and-ravens-v3-p3/e2e/node_modules/playwright');
const fs = require('node:fs');
const { withArmyServer } = require('./armies-server.cjs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = process.env.ARMY_EVIDENCE || path.join(process.env.HOME, '.t3/userdata/project-handoffs/swords-v3-realism-20261018/evidence/rf-armies/r2');
const url = process.env.ARMY_URL || 'http://127.0.0.1:5211/';
const quick = process.argv.includes('--quick');
const types = ['footman', 'knight', 'siege-engine', 'ship', 'dragon'];
const houses = ['greyjoy', 'stark', 'lannister', 'baratheon', 'tyrell', 'martell'];
const states = ['idle', 'march', 'attack', 'charge', 'defend', 'rout', 'retreat', 'wounded', 'destroyed', 'victory'];
const results = { timestamp: new Date().toISOString(), url, mode: quick ? 'quick' : 'full', engines: {}, contracts: {}, errors: [], warnings: [], load: [] };
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'qa-results.json'), JSON.stringify({timestamp: results.timestamp, status: 'running'}, null, 2));
const out = relative => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); return file; };
const load = label => { const value = execFileSync('uptime', { encoding: 'utf8' }).trim(); results.load.push({ label, value }); console.log(label, value); };
function observe(page, label) {
  page.on('pageerror', error => results.errors.push({ label, type: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() });
    if (message.type() === 'warning') results.warnings.push({ label, message: message.text() });
  });
}
async function navigate(page, story) {
  await page.goto(`${url}#${story}`);
  if (story.startsWith('armies/')) await page.waitForFunction(() => window.__armyQA?.ready);
  await page.waitForTimeout(450);
}
async function screenshot(page, relative, clip) {
  await page.screenshot({ path: out(relative), type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
}
async function contracts(page) {
  await navigate(page, 'armies/state-player');
  return page.evaluate(() => {
    const sample = window.__armyQA.batch;
    const batch = new sample.constructor({ detail: 'balanced', capacityPerType: 3 });
    const near = (a, b) => Math.abs(a - b) < 0.0001;
    const checks = {};
    let invalid = false; try { new sample.constructor({capacityPerType: 0}); } catch { invalid = true; } checks.invalidCapacity = invalid;
    const a = batch.add({ type: 'footman', color: '#202020', seed: 5 });
    const b = batch.add({ type: 'footman', color: '#dddddd', seed: 5 });
    const c = batch.add({ type: 'footman', color: '#ae2927', seed: 6 });
    const Box = a.pool.mesh.geometry.boundingBox.constructor;
    new Box().setFromObject(batch.object);
    for (const u of batch.units) u.position.x = 100;
    batch.update(0);
    checks.movingBounds = new Box().setFromObject(batch.object).min.x > 90;
    for (const u of batch.units) u.position.x = 0;
    batch.update(0);
    let overflow = false;
    try { batch.add({ type: 'footman', color: '#000' }); } catch { overflow = true; }
    checks.capacity = overflow;
    a.setState('march', { path: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: -3 }], duration: 1, transition: 0.2 });
    for (let i = 0; i < 5; i++) batch.update(0.1);
    checks.arcLengthPath = near(a.position.x, 1) && near(a.position.z, -1);
    const weights = Array.from(a.weights); a.setState('defend');
    checks.interruptedTransition = weights.every((v, i) => near(v, a.weights[i]));
    batch.update(0.1); const time = batch.time, frozen = Array.from(a.weights); batch.setPaused(true); batch.update(0.1);
    checks.pause = near(batch.time, time) && frozen.every((v, i) => near(v, a.weights[i]));
    batch.setPaused(false); batch.setMotionScale(0); a.setState('march', { path: [{ x: 0, z: 0 }, { x: 3, z: 2 }], duration: 10 }); batch.update(0.1);
    checks.reducedMotion = near(a.position.x, 3) && near(a.position.z, 2) && near(a.weights[0], 1);
    batch.setMotionScale(1); batch.update(.01);
    checks.resumeKeepsEndpoint = near(a.position.x, 3) && near(a.position.z, 2) && near(a.weights[0], 1);
    a.setState('destroyed'); for(let i=0;i<5;i++) batch.update(.1);
    const death = a.deathProgress; a.setState('idle'); batch.update(.01);
    checks.deathTransition = a.deathProgress > 0 && a.deathProgress <= death;
    batch.setMotionScale(0); a.setState('destroyed'); batch.update(.1);
    batch.setMotionScale(1); batch.update(.01); checks.reducedDeathStaysDestroyed = near(a.deathProgress, 1);
    a.setState('idle', {transition: 0}); batch.update(0);
    b.remove(); checks.compaction = c.slot === 1 && c.pool.units[c.slot] === c && batch.units.length === 2;
    const d = batch.add({ type: 'footman', color: '#777', seed: 5 }); checks.reuse = batch.units.length === 3 && d.slot === 2;
    checks.seedDeterminism = a.seed === d.seed;
    batch.setMotionScale(1); const beforeNaN = batch.time; batch.update(NaN); checks.finiteClock = batch.time === beforeNaN;
    batch.setMotionScale(.5); batch.update(.1); checks.speedClock = near(batch.time - beforeNaN, .05);
    batch.setMotionScale(0); const zero = batch.time; batch.update(.1); checks.zeroClock = batch.time === zero;
    const camera = window.__armyQA.camera, saved = camera.position.clone();
    camera.position.set(0, 500, 0); camera.updateMatrixWorld(true); batch.update(0, camera);
    checks.farLOD = a.pool.far && batch.stats.draws === 2;
    camera.position.set(0, 2, 2); camera.updateMatrixWorld(true); batch.update(0, camera);
    checks.nearLOD = !a.pool.far && batch.stats.draws <= 4;
    a.lod = 'far'; batch.update(0, camera); checks.pinnedFarLOD = a.pool.far;
    a.lod = 'near'; batch.update(0, camera); checks.pinnedNearLOD = !a.pool.far;
    a.setState('defend', {transition: 0}); batch.update(0); checks.instantTransition = near(a.weights[3], 1);
    camera.position.copy(saved); camera.updateMatrixWorld(true);
    batch.dispose(); batch.dispose();
    checks.dispose = batch.units.length === 0 && a.removed && c.removed && d.removed && batch.object.children.length === 0;
    let rejected = false; try { batch.add({ type: 'ship', color: '#fff' }); } catch { rejected = true; } checks.disposedGuard = rejected;
    return checks;
  });
}
async function performanceRun(page, engine, viewport, story) {
  load(`${engine}/${viewport}/${story}`);
  await navigate(page, story);
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__armyQA.resetMetrics());
  await page.waitForTimeout(quick ? 2000 : 6000);
  const metrics = await page.evaluate(() => window.__armyQA.metrics());
  const detail = story.endsWith('balanced') ? 'balanced' : 'high';
  metrics.geometryPass = metrics.draws <= (detail === 'high' ? 40 : 20) && metrics.triangles <= (detail === 'high' ? 400000 : 160000);
  metrics.programPass = metrics.latePrograms === 0;
  if (metrics.webglError !== 0) results.errors.push({label: `${engine}/${viewport}/${story}`, type: "webgl", message: String(metrics.webglError)});
  metrics.framePass = metrics.frameP95 <= 16.7;
  console.log(engine, viewport, detail, JSON.stringify(metrics));
  return metrics;
}
async function video(browser, engine, viewportName, viewport, story) {
  const tempDir = fs.mkdtempSync(out(`videos/${engine}-${viewportName}-${story.split('/')[1]}-`));
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, recordVideo: { dir: tempDir, size: viewport } });
  const page = await context.newPage(); observe(page, `${engine}/${viewportName}/video/${story}`);
  await navigate(page, story);
  if (story.endsWith('state-player')) {
    for (const state of states) {
      await page.getByLabel('State', { exact: true }).selectOption(state);
      await page.waitForTimeout(1100);
    }
  } else await page.waitForTimeout(11000);
  const recording = page.video(); await context.close();
  await recording.saveAs(out(`videos/${engine}-${viewportName}-${story.split('/')[1]}.webm`));
  await recording.delete();
  fs.rmdirSync(tempDir);
}
async function contactSheets(browser) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); observe(page, 'chrome/contact-sheets');
  await navigate(page, 'armies/state-player');
  const stage = await page.locator('#stage').boundingBox();
  const crop = {x: stage.x + stage.width * .06, y: stage.y + stage.height * .12, width: stage.width * .88, height: stage.height * .72};
  const all = {};
  for (const type of types) {
    const cells = [];
    for (const state of states) for (const house of houses) {
      await page.evaluate(({ type, house, state }) => {
        const qa = window.__armyQA; qa.batch.setPaused(false); qa.setUnit(type, house, state);
        for (let i = 0; i < (state === 'destroyed' ? 5 : 4); i++) qa.batch.update(0.1);
        qa.batch.setPaused(true);
      }, { type, house, state });
      await page.waitForTimeout(50);
      const file = `states/${type}-${house}-${state}.jpg`;
      await screenshot(page, file, crop);
      cells.push({ house, state, src: `data:image/jpeg;base64,${fs.readFileSync(out(file)).toString('base64')}` });
    }
    all[type] = cells;
    console.log('contact captured', type, cells.length);
  }
  // Direct top and side inspection of the horse silhouette.
  await page.evaluate(() => { const q=window.__armyQA; q.batch.setPaused(false); q.setUnit('knight','greyjoy','idle'); });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__armyQA.camera.position.set(0,5,0.001); });
  await page.waitForTimeout(70); await screenshot(page, 'views/cavalry-top.jpg');
  await page.evaluate(() => { window.__armyQA.camera.position.set(4,1.5,0); });
  await page.waitForTimeout(70); await screenshot(page, 'views/cavalry-side.jpg');
  await context.close();
  const sheet = await browser.newPage({ viewport: { width: 1320, height: 2500 }, deviceScaleFactor: 1 });
  for (const type of types) {
    const cells = all[type];
    await sheet.setContent(`<html><body style="margin:0;background:#17262b;color:#e5d5ae;font:16px system-ui"><h1 style="font:32px Georgia;margin:22px">REALMFORGE / ${type.toUpperCase()}</h1><p style="margin:22px;color:#aebdb7">Six houses × ten states · procedural companies · Chrome · static pose samples (destroyed: mid-fall)</p><div style="display:grid;grid-template-columns:repeat(6,220px)">${cells.map(c => `<figure style="margin:0;height:232px"><img src="${c.src}" style="width:220px;height:205px;object-fit:cover"/><figcaption style="font-size:12px;text-align:center">${c.house} / ${c.state}</figcaption></figure>`).join('')}</div></body></html>`);
    await sheet.locator('img').last().waitFor();
    await screenshot(sheet, `contact-${type}.jpg`);
  }
  const comparisons = ['chrome-desktop-armies-before-after.jpg','chrome-phone-armies-before-after.jpg'];
  await sheet.setViewportSize({width:1440,height:1100});
  await sheet.setContent(`<html><body style="margin:0;background:#17262b;color:#e5d5ae;font:16px system-ui"><h1 style="font:32px Georgia;margin:22px">REALMFORGE / BEFORE & AFTER</h1><p style="margin:22px">Same numeric scale · current sculpts vs company v2 · desktop and compact gallery</p><div style="display:flex;align-items:start;gap:16px">${comparisons.map((file,i)=>`<img style="width:${i?330:1080}px" src="data:image/jpeg;base64,${fs.readFileSync(out('screenshots/'+file)).toString('base64')}"/>`).join('')}</div></body></html>`);
  await screenshot(sheet,'contact-before-after.jpg');
  await sheet.close();
}
let activeBrowser;
withArmyServer(url, async () => {
 try {
  load('start');
  for (const [engine, launch] of [
    ['chrome', () => chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })],
    ['webkit', () => webkit.launch({ headless: true })],
  ]) {
    const browser = activeBrowser = await launch(); results.engines[engine] = { version: browser.version(), views: {}, perf: {}, baseline: {} };
    for (const [viewportName, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage(); observe(page, `${engine}/${viewportName}`);
      await navigate(page, 'armies/state-player');
      if (viewportName === 'desktop') {
        results.contracts[engine] = await contracts(page);
        for (const [name, passed] of Object.entries(results.contracts[engine])) assert.equal(passed, true, `${engine} contract: ${name}`);
      }
      const stories = await page.locator('#nav a').evaluateAll(links => links.map(a => a.dataset.id).filter(id => id.startsWith('armies/')));
      const metrics = {};
      for (const story of stories) {
        await navigate(page, story);
        await screenshot(page, `screenshots/${engine}-${viewportName}-${story.replaceAll('/', '-')}.jpg`);
        if (story.startsWith('armies/')) metrics[story] = await page.evaluate(() => ({...window.__armyQA.metrics(), pixelBounds: window.__armyQA.pixelBounds?.()}));
        if (!quick && /armies\/.+-(near|far)$/.test(story)) {
          for (const house of houses) {
            await page.getByLabel('House', { exact: true }).selectOption(house);
            await page.waitForTimeout(450);
            await screenshot(page, `screenshots/${engine}-${viewportName}-${story.replaceAll('/', '-')}-${house}.jpg`);
          }
        }
      }
      results.engines[engine].views[viewportName] = { width: viewport.width, height: viewport.height, stories, metrics };
      results.engines[engine].perf[viewportName] = {};
      for (const story of ['armies/board-high', 'armies/board-balanced']) results.engines[engine].perf[viewportName][story] = await performanceRun(page, engine, viewportName, story);
      // Empty-board baseline separates browser refresh cadence from army cost.
      await page.evaluate(() => { const q = window.__armyQA; while(q.batch.units.length) q.batch.units[0].remove(); q.resetMetrics(); });
      await page.waitForTimeout(quick ? 1000 : 3000);
      results.engines[engine].baseline[viewportName] = await page.evaluate(() => window.__armyQA.metrics());
      // Exercise native controls, keyboard access, selection and reduced motion.
      await navigate(page, 'armies/state-player');
      await page.getByLabel('Unit', { exact: true }).selectOption('footman');
      await page.getByLabel('House', { exact: true }).selectOption('stark');
      await page.getByLabel('State', { exact: true }).selectOption('defend');
      await page.getByLabel('Reduced motion', { exact: true }).check();
      await page.getByLabel('Table plinth', { exact: true }).check();
      await page.getByRole('button', { name: 'Play or pause' }).click();
      await page.keyboard.press('Tab');
      await screenshot(page, `screenshots/${engine}-${viewportName}-controls-table-reduced.jpg`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${engine}/${viewportName}: horizontal document overflow`);
      await context.close();
      if (!quick) for (const story of ['armies/state-player', 'armies/battle']) await video(browser, engine, viewportName, viewport, story);
    }
    if (engine === 'chrome' && !quick) await contactSheets(browser);
    await browser.close(); activeBrowser = undefined;
  }
  load('finish');
  const perfs = Object.values(results.engines).flatMap(e => Object.values(e.perf).flatMap(v => Object.values(v)));
  results.verdict = results.errors.length === 0 && perfs.every(m => m.geometryPass && m.programPass && m.framePass) ? 'GO' : 'NO-GO';
  fs.writeFileSync(out('qa-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ verdict: results.verdict, errors: results.errors, contracts: results.contracts, output: root }, null, 2));
  if (results.verdict !== 'GO') process.exitCode = 1;
 } finally { await activeBrowser?.close(); }
}).catch(error => { results.failure = error.stack; fs.writeFileSync(out('qa-results.json'), JSON.stringify(results, null, 2)); console.error(error); process.exitCode = 1; });
