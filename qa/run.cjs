/* Headless visual review using the local Playwright devDependency. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium, webkit } = require('playwright');
const { withServer, evidence } = require('./server.cjs');
let base;
const out = evidence;
fs.mkdirSync(out, { recursive: true });
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const summary = { date: new Date().toISOString(), uptime: execFileSync('uptime', { encoding: 'utf8' }).trim(), runs: [], errors: [] };
console.log(summary.uptime);
withServer(async ownedBase => {
  base = ownedBase; summary.base = base;
  for (const engine of ['chrome', 'webkit']) {
    const browser = engine === 'chrome' ? await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] }) : await webkit.launch({ headless: true });
    try {
      for (const [form, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await context.newPage(); const errors = [];
        page.on('console', msg => { if (msg.type() === 'error' || /WebGL.*(error|invalid)|GL_INVALID|shader error/i.test(msg.text())) errors.push({ story: page.url(), type: msg.type(), message: msg.text() }); });
        page.on('pageerror', err => errors.push({ story: page.url(), type: 'pageerror', message: err.message }));
        page.on('response', response => { if (response.status() >= 400) errors.push({ story: page.url(), type: 'http', message: `${response.status()} ${response.url()}` }); });
        page.on('requestfailed', req => errors.push({ story: page.url(), type: 'requestfailed', message: `${req.url()} ${req.failure()?.errorText}` }));
        await page.goto(base); await page.waitForFunction(() => window.__realmforge && document.body.dataset.ready, null, { timeout: 30000 });
        let stories = await page.evaluate(() => window.__realmforge.stories());
        if (process.env.QA_FILTER) stories = stories.filter(story => new RegExp(process.env.QA_FILTER).test(story.id));
        const run = { engine, form, viewport, stories: [], flows: [], errors };
        const folder = path.join(out, `${engine}-${form}`); fs.mkdirSync(folder, { recursive: true });
        const thumbnails = new Map();
        for (const story of stories) {
          const start = performance.now();
          try {
            await page.evaluate(id => { location.hash = `#${id}${id.startsWith("wildlings/") ? "?camera=Free+orbit" : ""}`; }, story.id);
            await page.waitForFunction(id => document.body.dataset.ready === id && window.__realmforge.ready(), story.id, { timeout: 30000 });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            if (['Materials', 'Effects', 'Dragons'].includes(story.category)) await page.waitForTimeout(story.category === 'Effects' ? 350 : story.category === 'Dragons' ? 1800 : 500);
            const stats = await page.evaluate(() => window.__realmforge.stats());
            const corners = await page.evaluate(() => window.__realmforge.framing());
            const framed = corners.every(p => Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 && p.z > -1);
            if (!framed) { errors.push({ story: story.id, type: 'framing', message: JSON.stringify(corners) }); console.error(`FRAMING FAILED ${story.id}`); }
            const screenshot = path.join(folder, `${slug(story.id)}.jpg`);
            await page.screenshot({ path: screenshot, type: 'jpeg', quality: 72 });
            const thumbnail = await page.locator('#stage').screenshot({ type: 'jpeg', quality: 72 });
            if (!thumbnails.has(story.category)) thumbnails.set(story.category, []);
            thumbnails.get(story.category).push({ title: story.title, image: `data:image/jpeg;base64,${thumbnail.toString('base64')}` });
            run.stories.push({ ...story, ...stats, framed, screenshot: path.relative(out, screenshot), captureMs: +(performance.now() - start).toFixed(2) });
            fs.writeFileSync(path.join(out, `progress-${engine}-${form}.json`), JSON.stringify(run, null, 2));
            console.log(`${engine}/${form} ${run.stories.length}/${stories.length} ${story.id} ${stats.triangles} triangles`);
          } catch (error) { errors.push({ story: story.id, type: 'capture', message: error.message }); console.error(`CAPTURE FAILED ${story.id}: ${error.message}`); }
        }
        // Exercise the real controls and URL reproducibility, drawer, catalogue, framing and sheet.
        if (!process.env.QA_FILTER) {
          try {
            await page.evaluate(() => { location.hash = '#castles/style-north'; });
            await page.waitForFunction(() => document.body.dataset.ready === 'castles/style-north');
            await page.getByLabel('Architecture', { exact: true }).selectOption('dorne');
            await page.getByLabel('Ground', { exact: true }).selectOption('snow');
            await page.getByLabel('Light', { exact: true }).selectOption('dusk');
            await page.getByLabel('Detailed geometry', { exact: true }).uncheck();
            await page.getByLabel('Bounding box', { exact: true }).check();
            const before = await page.evaluate(() => window.__realmforge.values());
            await page.reload(); await page.waitForFunction(() => window.__realmforge && document.body.dataset.ready === 'castles/style-north');
            const after = await page.evaluate(() => window.__realmforge.values());
            if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('URL values did not survive reload');
            run.flows.push('URL control roundtrip');
            if (form === 'phone') await page.getByRole('button', { name: 'Open catalogue' }).click();
            await page.getByRole('searchbox').fill('sheep');
            const links = await page.locator('#nav a').count(); if (links !== 1) throw new Error(`Search expected 1 entry, found ${links}`);
            await page.locator('#nav a').click(); await page.waitForFunction(() => document.body.dataset.ready === 'nature/sheep');
            if (form === 'phone' && await page.locator('body').evaluate(body => body.classList.contains('drawer'))) throw new Error('Drawer did not close');
            run.flows.push('Search and catalogue navigation');
            await page.evaluate(() => { location.hash = '#qa'; }); await page.waitForFunction(() => document.body.dataset.ready === 'qa', null, { timeout: 180000 });
            const cards = await page.locator('.qa-card').count(); if (cards !== stories.length) throw new Error(`Sheet has ${cards}/${stories.length} cards`);
            await page.screenshot({ path: path.join(folder, 'qa-sheet.jpg'), type: 'jpeg', quality: 72 });
            await page.locator('.qa-card').first().click(); await page.waitForFunction(() => document.body.dataset.ready !== 'qa' && document.body.dataset.ready !== 'qa-loading');
            run.flows.push(`QA sheet ${cards} thumbnails and return to stage`);
          } catch (error) { errors.push({ story: 'gallery-flows', type: 'interaction', message: error.message }); }
        }
        // Contact sheets are generated in the same browser without adding an image dependency.
        const contact = await context.newPage();
        for (const [category, items] of thumbnails) {
          const cols = 4, width = 1200, rows = Math.ceil(items.length / cols);
          await contact.setViewportSize({ width, height: Math.max(300, 90 + rows * 245) });
          await contact.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:22px;background:#182021;color:#eadfc6;font:13px system-ui}h1{font:25px Georgia;margin:0 0 6px}p{color:#a6b4a4;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:#28322e;border:1px solid #455245;border-radius:5px;overflow:hidden}img{width:100%;height:190px;object-fit:contain;background:#879277}.label{padding:9px 10px;height:40px}</style></head><body><h1>Realmforge · ${escape(category)}</h1><p>${engine} · ${form} ${viewport.width}×${viewport.height} · ${items.length} studies · JPEG q72</p><div class="grid">${items.map(item => `<div class="card"><img src="${item.image}"><div class="label">${escape(item.title)}</div></div>`).join('')}</div></body></html>`);
          await contact.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
          await contact.screenshot({ path: path.join(out, `contact-${slug(category)}-${engine}-${form}.jpg`), type: 'jpeg', quality: 72, fullPage: true });
        }
        await contact.close(); summary.runs.push(run); summary.errors.push(...errors.map(error => ({ engine, form, ...error })));
        await context.close();
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(summary, null, 2));
      }
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(`Visual QA complete: ${summary.runs.reduce((sum,run) => sum + run.stories.length, 0)} captures, ${summary.errors.length} errors.`);
  if (summary.errors.length) { console.error(JSON.stringify(summary.errors, null, 2)); process.exitCode = 1; }
}).catch(error => { summary.errors.push({ type: 'runner', message: error.stack }); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(summary, null, 2)); console.error(error); process.exitCode = 1; });
