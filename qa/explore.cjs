/* Recorded interaction review, with an owned preview lifetime (no persistent listener). */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium, webkit } = require('playwright');
const { withServer, evidence } = require('./server.cjs');
const output = path.join(evidence, 'exploration'); fs.mkdirSync(output, { recursive: true });
const results = { uptime: execFileSync('uptime', { encoding:'utf8' }).trim(), runs: [], errors: [] };
console.log(results.uptime);
withServer(async base => {
  for (const engine of ['chrome','webkit']) {
    const browser = engine === 'chrome' ? await chromium.launch({ channel:'chrome', args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] }) : await webkit.launch();
    try {
      for (const [form, viewport] of [['desktop',{width:1440,height:900}],['phone',{width:390,height:844}]]) {
        const context = await browser.newContext({ viewport, hasTouch:form==='phone', recordVideo:{dir:output,size:viewport} });
        try {
          const page = await context.newPage();
          page.on('console', message => { if (message.type()==='error' || /WebGL.*(error|invalid)|GL_INVALID|shader error/i.test(message.text())) results.errors.push({engine,form,message:message.text()}); });
          page.on('pageerror', error => results.errors.push({engine,form,message:error.message}));
          const open = async id => {
            await page.goto(`${base}#${id}`);
            await page.waitForFunction(id=>document.body.dataset.ready===id && window.__realmforge.ready(),id,{timeout:30000});
          };
          await open('explore/kings-landing');
          await page.getByLabel('Navigation mode',{exact:true}).selectOption('walk');
          const start = await page.evaluate(()=>window.__realmforge.navigation());
          const canvas = page.locator('#stage canvas'), box = await canvas.boundingBox();
          if (form==='phone') {
            const forward=page.getByRole('button',{name:'Move forward',exact:true});
            await forward.dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch'});
            await page.waitForTimeout(2400);
            await forward.dispatchEvent('pointerup',{pointerId:91,pointerType:'touch'});
            // Actual touch-pointer handlers: one-finger look, then two-finger translation/pinch.
            await canvas.dispatchEvent('pointerdown',{pointerId:21,pointerType:'touch',clientX:box.x+150,clientY:box.y+180});
            for(let i=1;i<=12;i++)await canvas.dispatchEvent('pointermove',{pointerId:21,pointerType:'touch',clientX:box.x+150+i*3,clientY:box.y+180});
            await canvas.dispatchEvent('pointerup',{pointerId:21,pointerType:'touch'});
          } else {
            await canvas.click({position:{x:box.width/2,y:box.height/2}});
            await page.keyboard.down('w'); await page.waitForTimeout(2400); await page.keyboard.up('w');
            await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,box.y+box.height/2-35,{steps:15});await page.mouse.up();
          }
          const walked = await page.evaluate(()=>window.__realmforge.navigation());
          if(Math.hypot(...walked.position.map((n,i)=>n-start.position[i]))<0.015)throw new Error('Walking did not move through the city street');
          await page.screenshot({path:path.join(output,`${engine}-${form}-city-street.jpg`),type:'jpeg',quality:72});
          await page.waitForTimeout(800);
          // Walk mode is a URL contract; reload must return to the authored entrance.
          await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='explore/kings-landing');
          if((await page.evaluate(()=>window.__realmforge.navigation())).mode!=='walk')throw new Error('Navigation mode did not survive reload');
          if(form==='desktop') {
            await canvas.focus();await page.keyboard.press('Escape');await page.keyboard.press('e');
            if((await page.evaluate(()=>window.__realmforge.navigation())).mode!=='fly')throw new Error('E did not enter flight');
            await page.keyboard.press('g');
            if((await page.evaluate(()=>window.__realmforge.navigation())).mode!=='walk')throw new Error('G did not enter walking');
          }
          await open('explore/westeros-sampler');await page.waitForTimeout(1200);
          await page.evaluate(()=>window.__realmforge.resetMetrics());await page.waitForTimeout(5000);
          const metrics=await page.evaluate(()=>window.__realmforge.metrics());
          const before=await page.evaluate(()=>window.__realmforge.navigation());
          await page.getByLabel('Navigation mode',{exact:true}).selectOption('fly');
          if(form==='phone') {
            const forward=page.getByRole('button',{name:'Move forward',exact:true});
            await forward.dispatchEvent('pointerdown',{pointerId:92,pointerType:'touch'});await page.waitForTimeout(2200);await forward.dispatchEvent('pointerup',{pointerId:92,pointerType:'touch'});
            const rect=await canvas.boundingBox();
            await canvas.dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',clientX:rect.x+120,clientY:rect.y+160});
            await canvas.dispatchEvent('pointerdown',{pointerId:32,pointerType:'touch',clientX:rect.x+220,clientY:rect.y+160});
            for(let i=1;i<=12;i++) {await canvas.dispatchEvent('pointermove',{pointerId:31,pointerType:'touch',clientX:rect.x+120-i,clientY:rect.y+160+i});await canvas.dispatchEvent('pointermove',{pointerId:32,pointerType:'touch',clientX:rect.x+220+i,clientY:rect.y+160+i});}
            await canvas.dispatchEvent('pointerup',{pointerId:31,pointerType:'touch'});await canvas.dispatchEvent('pointerup',{pointerId:32,pointerType:'touch'});
          } else {
            await canvas.focus();await page.keyboard.down('w');await page.keyboard.down('Shift');await page.waitForTimeout(2200);await page.keyboard.up('Shift');await page.keyboard.up('w');
            await page.keyboard.down('q');await page.waitForTimeout(900);await page.keyboard.up('q');
          }
          const flown=await page.evaluate(()=>window.__realmforge.navigation());
          if(Math.hypot(...flown.position.map((n,i)=>n-before.position[i]))<0.1)throw new Error('Fly controls did not move');
          await page.screenshot({path:path.join(output,`${engine}-${form}-sampler-flight.jpg`),type:'jpeg',quality:72});
          await page.getByLabel('Navigation mode',{exact:true}).selectOption('orbit');await page.locator('#reset').evaluate(button=>button.click());
          const rect=await canvas.boundingBox();const pivotBefore=await page.evaluate(()=>window.__realmforge.navigation());
          await canvas.dblclick({position:{x:rect.width*.5,y:rect.height*.57}});await page.waitForTimeout(1200);
          const approached=await page.evaluate(()=>window.__realmforge.navigation());
          if(Math.hypot(...approached.position.map((n,i)=>n-pivotBefore.position[i]))<0.01)throw new Error('Double-click did not approach a surface');
          if(!(approached.near>0 && approached.near<=0.001))throw new Error('Close-up near plane did not adapt');
          await page.waitForTimeout(500);
          results.runs.push({engine,form,metrics,start,walked,flown,approached,video:path.basename(await page.video().path())});
          console.log(`${engine}/${form}: walk + fly + approach; sampler p95 ${metrics.frameP95.toFixed(2)} ms`);
        } catch(error) {results.errors.push({engine,form,message:error.stack});console.error(error.message);} finally {await context.close();}
      }
    } finally {await browser.close();}
  }
}).catch(error=>{results.errors.push({message:error.stack});}).finally(()=>{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));if(results.errors.length)process.exitCode=1;});
