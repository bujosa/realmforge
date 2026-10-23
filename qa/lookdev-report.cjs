/* Summarize measured evidence; no invented cleanup, validation or release claims. */
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUTPUT_DIR||'qa-output/lookdev');
const data=JSON.parse(fs.readFileSync(path.join(out,'full-results.json'),'utf8'));
const runs=data.runs;
const rows=runs.map(r=>`| ${r.look} | ${r.engine} | ${r.form} | ${r.quality} | ${r.default.calls} | ${r.default.triangles} | ${r.motion.frameP95.toFixed(1)} | ${r.motion.newPrograms} |`).join('\n');
const pass=runs.length>0&&data.errors.length===0&&runs.every(r=>r.default.calls<=(r.quality==='High'?250:120)&&r.default.triangles<=(r.quality==='High'?1200000:500000)&&r.motion.newPrograms===0);
fs.writeFileSync(path.join(out,'capture-report.md'),`# Landscape capture summary\n\n${pass?'GO':'NO-GO'} for the measured capture budgets only. See full-results.json for raw measurements; this does not certify visual approval, parity or cleanup.\n\n| Look | Engine | Viewport | Quality | Draws | Triangles | Flight p95 ms | New programs |\n|---|---|---|---|---:|---:|---:|---:|\n${rows}\n\nBrowser errors: ${data.errors.length}. Frame intervals are browser RAF measurements, not GPU timings.\n`);
