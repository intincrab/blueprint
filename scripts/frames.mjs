#!/usr/bin/env node
// Render a scene frozen at chosen moments into one contact sheet PNG, and
// report runtime errors. Needs Playwright (npm i && npx playwright install chromium in the skill folder).
//
//   node scripts/frames.mjs examples/small/cache.js --out /tmp/cache.png
//   node scripts/frames.mjs scene.js --frames "s1:end,s2:0.5,s3:end,end" --paper linen
//   (--src scene.js works too)
//
// Frames: "sN:end" = end of step N, "sN:0.5" = halfway through step N,
// "t:4.2" = 4.2 s in, "end" = the finished drawing. Default: the middle and
// end of every step. A file with several scenes renders the first; pick another with --scene <id>.
// --lang zh shows the captions of a scene written in several languages in that one.
// Exit code 1 when the scene has errors or the page throws.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { jsonScript } from './lib/inline.mjs';
import { launchChromium } from './lib/chromium.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Options take a value; the scene file can be given bare, like the other scripts, or as --src.
const argv = process.argv.slice(2), args = {}, files = [];
for (let i = 0; i < argv.length; i++) {
  const v = argv[i];
  if (!v.startsWith('--')) { files.push(v); continue; }
  args[v.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const USAGE = 'usage: frames.mjs scene.js [--out sheet.png] [--scene id] [--frames "s1:end,s2:0.5,end"] [--paper blue|linen] [--lang code] [--cols 2] [--width 520]';
for (const k of ['src', 'out', 'scene', 'frames', 'paper', 'lang', 'cols', 'width']) if (args[k] === true) { console.error(`--${k} needs a value\n${USAGE}`); process.exit(2); }
for (const k of Object.keys(args)) if (!['src', 'out', 'scene', 'frames', 'paper', 'lang', 'cols', 'width'].includes(k)) { console.error(`unknown option --${k}\n${USAGE}`); process.exit(2); }
if (files.length > (args.src ? 0 : 1)) { console.error(`frames.mjs renders one scene file; got ${[args.src, ...files].filter(Boolean).join(', ')}\n${USAGE}`); process.exit(2); }
args.src = args.src || files[0];
if (!args.src) { console.error(USAGE); process.exit(2); }

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { try { playwright = require('playwright-core'); } catch { console.error('Playwright not found. Run npm i && npx playwright install chromium in the skill folder, or in a scratch dir: npm i playwright@1.56.1 && npx playwright install chromium, then NODE_PATH=<scratch>/node_modules node frames.mjs ...'); process.exit(2); } }

const runtime = resolve(here, '../runtime/blueprint.js');
const src = resolve(args.src);
const out = resolve(args.out || src.replace(/\.js$/, '') + '.frames.png');
const cols = +(args.cols || 2), width = +(args.width || 520);

const page = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#d9dde3;font:12px ui-monospace,Menlo,monospace;color:#111}
#g{display:grid;grid-template-columns:repeat(${cols},${width}px);gap:14px}
.f b{display:block;margin:0 0 4px;font-weight:600}
</style><div id="g"></div>
<script src="${pathToFileURL(runtime)}"></script><script src="${pathToFileURL(src)}"></script>
<script>
window.__errors=[];window.addEventListener('error',e=>__errors.push(String(e.message)));
const ids=Object.keys(BLUEPRINT.scenes),want_id=${jsonScript(args.scene || '')};
if(!ids.length)throw new Error('the file defines no scene');
if(want_id&&!BLUEPRINT.scenes[want_id])throw new Error('no scene "'+want_id+'" in the file (it has: '+ids.join(', ')+')');
const id=want_id||ids[0],spec=BLUEPRINT.scenes[id];
const lang=${jsonScript(args.lang || '')}||undefined;
const L=BLUEPRINT.layout(spec);const tl=BLUEPRINT.compile(spec,L,1,lang);
window.__report={id:id,ids:ids,errors:L.errors,warnings:L.warnings,steps:tl.steps.length,total:tl.total};
const want=${jsonScript(args.frames || '')}||tl.steps.map((s,i)=>'s'+(i+1)+':0.5,s'+(i+1)+':end').join(',');
const g=document.getElementById('g');
want.split(',').map(x=>x.trim()).filter(Boolean).forEach(f=>{
  let t,lab=f;
  if(f==='end'){t=tl.total;}
  else if(f.startsWith('t:')){t=+f.slice(2);}
  else{const m=/^s(\\d+):(end|[\\d.]+)$/.exec(f);if(!m){__errors.push('bad frame '+f);return;}const s=tl.steps[+m[1]-1];if(!s){__errors.push('no step '+m[1]);return;}
    t=m[2]==='end'?s.b-0.05:s.a+(s.b-s.a)*(+m[2]);lab=f+'  '+s.say;}
  const d=document.createElement('div');d.className='f';d.innerHTML='<b>'+lab.replace(/</g,'&lt;')+'  (t='+t.toFixed(2)+')</b>';
  const h=document.createElement('div');d.appendChild(h);g.appendChild(d);
  const c=BLUEPRINT.mount(h,spec,{play:'still',controls:false,font:false,lang:lang,paper:${jsonScript(args.paper || '')}||undefined});
  c.seek(t);
});
</script>`;

// Start the browser before making the temp folder, so a failed start leaves nothing behind.
const browser = await launchChromium(playwright).catch(e => { console.error(e.message); process.exit(1); });
const dir = mkdtempSync(join(tmpdir(), 'bp-frames-'));
let report = {}, pageErrors = [], consoleErrors = [];
try {
  const file = join(dir, 'sheet.html');
  writeFileSync(file, page);
  const pg = await browser.newPage({ viewport: { width: cols * (width + 14) + 32, height: 800 }, deviceScaleFactor: 1 });
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text()); });
  pg.on('pageerror', e => pageErrors.push(String(e)));
  await pg.goto(pathToFileURL(file).href);
  await pg.waitForTimeout(300);
  report = await pg.evaluate(() => ({ ...window.__report, runtime: window.__errors }));
  await pg.screenshot({ path: out, fullPage: true });
} finally {
  await browser.close().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
console.log(`sheet: ${out}`);
if (report.ids && report.ids.length > 1 && !args.scene) console.log(`note  the file has ${report.ids.length} scenes (${report.ids.join(', ')}); rendered "${report.id}". Pick one with --scene <id>.`);
if (report.steps != null) console.log(`steps: ${report.steps}, length: ${report.total.toFixed(1)} s`);
// The page's own error listener and Playwright's pageerror can both see one throw.
const runtimeErrors = [...new Set([...(report.runtime || []), ...pageErrors].map(e => e.replace(/^Uncaught /, '')))];
for (const e of [...(report.errors || []), ...runtimeErrors, ...consoleErrors]) console.log('ERROR ' + e);
for (const w of report.warnings || []) console.log('warn  ' + w);
process.exit((report.errors || []).length || runtimeErrors.length ? 1 : 0);
