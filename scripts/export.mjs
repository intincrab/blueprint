#!/usr/bin/env node
// Export a scene for places where JavaScript doesn't run: READMEs, Slack, X, Notion, slides.
//
//   node scripts/export.mjs scene.js --format gif                 -> scene.gif
//   node scripts/export.mjs scene.js --format mp4 --audio music.mp3
//   node scripts/export.mjs scene.js --format png                 -> the finished sheet, 2x
//   node scripts/export.mjs scene.js --format png --steps         -> one PNG per step (for slides)
//   node scripts/export.mjs scene.js --format all
//
// Options: --out <file or folder> --width 1280 --fps (gif 15, mp4 30) --speed (gif 1.8, mp4 1.25; motion only,
//          the rests that leave time to read each caption play in real seconds)
//          --paper blue|linen --hold 1.5 --scale (png 2, else 1) --scene <id> --audio track.mp3 (mp4)
// --out: a name ending in .png, .gif or .mp4 sets the file name, and every format gets its own
// extension (--out talk/cache.mp4 --format all -> talk/cache.png, .gif, .mp4; with --steps,
// talk/cache-01.png, -02.png …). Anything else is a folder. Without --out, files go next to the
// scene (--steps: into <scene>-steps/).
// A scene's `sources` are not drawn into images or video; put them in the post or slide notes.
// Needs Playwright (as frames.mjs does). GIF and PNG need nothing else. MP4 uses ffmpeg when it
// is on PATH; otherwise it encodes in Playwright's full Chromium with WebCodecs (lib/webcodecs.mjs),
// which works on macOS (no Xcode needed); Linux needs ffmpeg. --encoder ffmpeg|browser picks one.
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { GifWriter } from './lib/gif.mjs';
import { decodePNG } from './lib/png.mjs';
import { openEncoder } from './lib/webcodecs.mjs';
import { launchChromium } from './lib/chromium.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const require = createRequire(import.meta.url);
const USAGE = 'usage: export.mjs scene.js --format gif|mp4|png|all (or a list: png,gif) [--out path] [--steps] [--scene id] [--paper blue|linen] [--audio track.mp3] [--width 1280] [--fps n] [--speed n] [--hold s] [--scale n] [--encoder ffmpeg|browser] [--no-font]';
const VALUED = ['format', 'out', 'width', 'fps', 'speed', 'paper', 'hold', 'scale', 'audio', 'scene', 'encoder'], FLAGS = ['steps', 'no-font'];
const argv = process.argv.slice(2), opt = {}, files = [];
const die = (msg, code = 2) => { console.error(`${msg}\n${USAGE}`); process.exit(code); };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { files.push(a); continue; }
  const eq = a.indexOf('='), key = a.slice(2, eq < 0 ? undefined : eq);
  if (FLAGS.includes(key) && eq < 0) opt[key] = true;
  else if (!VALUED.includes(key)) die(`unknown option --${key}`);
  else if (eq >= 0) opt[key] = a.slice(eq + 1);
  else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opt[key] = argv[++i];
  else die(`--${key} needs a value`);
}
if (!files.length) die('no scene file given');
if (files.length > 1) console.warn(`warn: export.mjs exports one scene file; using ${files[0]} and ignoring ${files.slice(1).join(', ')}`);

// Validate everything before starting a browser.
const KNOWN = ['png', 'gif', 'mp4'];
const formats = [...new Set((opt.format || 'gif') === 'all' ? KNOWN : (opt.format || 'gif').split(',').map(f => f.trim().toLowerCase()).filter(Boolean))];
const bad = formats.filter(f => !KNOWN.includes(f));
if (bad.length || !formats.length) die(`unknown --format ${bad.join(', ') || '(empty)'}: use gif, mp4, png, all, or a list like png,gif`);
if (opt.steps && !formats.includes('png')) die('--steps writes one PNG per step, so it needs --format png (or all)');
if (opt.paper && !['blue', 'linen'].includes(opt.paper)) die(`--paper must be blue or linen (got "${opt.paper}")`);
for (const k of ['width', 'fps', 'speed', 'scale']) if (opt[k] != null && !(+opt[k] > 0)) die(`--${k} must be a positive number (got "${opt[k]}")`);
if (opt.hold != null && !(+opt.hold >= 0)) die(`--hold must be 0 or more seconds (got "${opt.hold}")`);
if (opt.audio && !formats.includes('mp4')) console.warn('warn: --audio is only used for MP4; ignoring it');
if (opt.audio && formats.includes('mp4') && !existsSync(resolve(opt.audio))) die(`--audio: no such file ${opt.audio}`, 1);
const src = resolve(files[0]);
if (!existsSync(src)) die(`no such file ${files[0]}`, 1);
if (opt.encoder && !['ffmpeg', 'browser'].includes(opt.encoder)) die(`--encoder must be ffmpeg or browser (got "${opt.encoder}")`);
if (opt.encoder && !formats.includes('mp4')) console.warn('warn: --encoder is only used for MP4; ignoring it');
// MP4: ffmpeg when it is on PATH, otherwise WebCodecs in Chromium.
const useFfmpeg = formats.includes('mp4') && opt.encoder !== 'browser' && (r => !r.error && r.status === 0)(spawnSync('ffmpeg', ['-version']));
if (opt.encoder === 'ffmpeg' && formats.includes('mp4') && !useFfmpeg) die('--encoder ffmpeg: ffmpeg is not on PATH (brew install ffmpeg, apt install ffmpeg, winget install ffmpeg)', 1);

let pw; try { pw = require('playwright'); } catch { try { pw = require('playwright-core'); } catch { console.error('Playwright not found. Run npm i && npx playwright install chromium in the skill folder, or in a scratch dir: npm i playwright@1.56.1 && npx playwright install chromium, then NODE_PATH=<scratch>/node_modules node export.mjs ...'); process.exit(2); } }

const stemOf = basename(src).replace(/\.js$/, '');
const width = +(opt.width || 1280), hold = +(opt.hold ?? 1.5);
// --out ending in a known extension names the files; anything else is a folder.
const outIsFile = opt.out && ['.png', '.gif', '.mp4'].includes(extname(opt.out).toLowerCase());
const outDir = opt.out ? (outIsFile ? dirname(resolve(opt.out)) : resolve(opt.out)) : dirname(src);
const stem = outIsFile ? basename(opt.out, extname(opt.out)) : stemOf;
const outFor = ext => join(outDir, `${stem}.${ext}`);
const stepsDir = opt.out ? outDir : resolve(dirname(src), `${stemOf}-steps`);

const page = `<!doctype html><meta charset="utf-8">
${opt['no-font'] ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap">'}
<style>html,body{margin:0;background:transparent}#h{width:${width}px}.bp-svg{border-radius:0!important}</style>
<div id="h"></div>
<script src="${pathToFileURL(join(root, 'runtime/blueprint.js'))}"></script>
<script src="${pathToFileURL(src)}"></script>`;
const work = mkdtempSync(join(tmpdir(), 'bp-export-'));
writeFileSync(join(work, 'page.html'), page);

// BLUEPRINT_CHROMIUM: a system Chromium, for offline boxes or distro builds without Playwright's download.
const browser = await launchChromium(pw).catch(e => {
  console.error(e.message);
  rmSync(work, { recursive: true, force: true }); process.exit(1);
});
// Close the browser and remove the temp frames before exiting on an error.
let encoder = null;
async function fail(msg) { console.error(msg); await encoder?.close(); await browser.close().catch(() => {}); rmSync(work, { recursive: true, force: true }); process.exit(1); }
async function open(scale, speed = 1) {
  const p = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
  p.on('pageerror', e => console.log('PAGE ERROR', String(e)));
  await p.goto(pathToFileURL(join(work, 'page.html')).href);
  await p.evaluate(() => document.fonts.ready.then(() => document.fonts.load('500 12px "IBM Plex Mono"')).catch(() => {}));
  const info = await p.evaluate(([paper, want, speed]) => {
    const ids = Object.keys(BLUEPRINT.scenes);
    if (!ids.length) return { error: 'the file defines no scene' };
    if (want && !BLUEPRINT.scenes[want]) return { error: `no scene "${want}" in the file (it has: ${ids.join(', ')})` };
    const id = want || ids[0];
    window.C = BLUEPRINT.mount(document.getElementById('h'), BLUEPRINT.scenes[id], { play: 'still', controls: false, font: false, paper: paper || undefined, speed });
    return { id, ids, total: window.C.timeline.total, steps: window.C.timeline.steps.map(s => ({ a: s.a, b: s.b, say: s.say })) };
  }, [opt.paper, opt.scene, speed]);
  if (info.error) await fail(info.error);
  if (info.ids.length > 1 && !opt.scene && !noted++) console.warn(`warn: ${files[0]} has ${info.ids.length} scenes (${info.ids.join(', ')}); exporting "${info.id}". Pick one with --scene <id>.`);
  const clip = await p.locator('#h .bp-svg').boundingBox();
  const shot = async t => { await p.evaluate(t => window.C.seek(t), t); return p.screenshot({ clip, type: 'png', omitBackground: false }); };
  return { p, info, clip, shot };
}
let noted = 0;
const written = [];
// Progress only in a terminal: piped output (an agent reading it) gets just the results.
const progress = process.stdout.isTTY ? s => process.stdout.write(`\r\x1b[K  ${s}`) : () => {};
const doneProgress = () => { if (process.stdout.isTTY) process.stdout.write('\r\x1b[K'); };
const GIF_MAX = 5e6;

if (formats.includes('png')) {
  const { info, shot } = await open(+(opt.scale || 2));
  if (opt.steps) {
    mkdirSync(stepsDir, { recursive: true });
    for (let i = 0; i < info.steps.length; i++) {
      const f = join(stepsDir, `${stem}-${String(i + 1).padStart(2, '0')}.png`);
      writeFileSync(f, await shot(info.steps[i].b - 0.05)); written.push(f);
    }
  } else {
    const f = outFor('png'); mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, await shot(info.total)); written.push(f);
  }
}

// Frame times come from the runtime's pacing: motion at --speed, rests in real seconds.
async function frames(fps, speed, scale) {
  const { info, shot, clip, p } = await open(scale, speed);
  const list = await p.evaluate(fps => {
    const P = window.C.pace, end = window.C.timeline.total, n = Math.ceil(P.total * fps), out = [];
    for (let i = 0; i <= n; i++) out.push(Math.min(end, P.scene(i / fps)));
    return out;
  }, fps);
  return { info, shot, clip, list };
}

if (formats.includes('gif')) {
  const fps = +(opt.fps || 15), speed = +(opt.speed || 1.8);
  const { shot, list } = await frames(fps, speed, +(opt.scale || 1));
  const pick = [list[Math.floor(list.length * 0.3)], list[Math.floor(list.length * 0.7)], list[list.length - 1]];
  const samples = [];
  for (const t of pick) samples.push(decodePNG(await shot(t)).data);
  const first = decodePNG(await shot(0));
  const gif = new GifWriter(first.width, first.height, samples);
  for (let i = 0; i < list.length; i++) {
    const img = i === 0 ? first : decodePNG(await shot(list[i]));
    gif.add(img.data, 1 / fps + (i === list.length - 1 ? hold : 0));
    if (i && i % 60 === 0) progress(`gif ${i}/${list.length}`);
  }
  doneProgress();
  const f = outFor('gif'), bytes = gif.end(); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, bytes); written.push(f);
  // READMEs, Slack and X handle GIFs under ~5 MB much better; long complex scenes go over at 1280.
  if (bytes.length > GIF_MAX) console.warn(`warn: ${basename(f)} is ${(bytes.length / 1e6).toFixed(1)} MB; GIFs over ~5 MB load slowly or get rejected. Try --width 960 (about a third smaller) or a lower --fps.`);
}

if (formats.includes('mp4')) {
  const fps = +(opt.fps || 30), speed = +(opt.speed || 1.25);
  // Start the browser encoder first, so a Chromium without H.264 (or AAC, with --audio) fails before any frames are drawn.
  if (!useFfmpeg) encoder = await openEncoder(pw, work, fps, { audio: !!opt.audio }).catch(e => fail(e.message));
  const { shot, list } = await frames(fps, speed, +(opt.scale || 1));
  const dir = join(work, 'frames'); if (useFfmpeg) mkdirSync(dir);
  const all = [...list, ...Array(Math.round(hold * fps)).fill(list[list.length - 1])];
  for (let i = 0; i < all.length; i++) {
    const png = await shot(all[i]);
    if (useFfmpeg) writeFileSync(join(dir, `f${String(i).padStart(5, '0')}.png`), png);
    else await encoder.add(png).catch(e => fail(`MP4 encoding failed: ${e.message}`));
    if (i && i % 90 === 0) progress(`mp4 ${i}/${all.length}`);
  }
  doneProgress();
  const f = outFor('mp4'); mkdirSync(dirname(f), { recursive: true });
  const audio = opt.audio ? resolve(opt.audio) : null;
  if (useFfmpeg) {
    const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.png')];
    // The video sets the length: a short track is padded with silence, a long one is cut.
    if (audio) args.push('-i', audio, '-af', 'apad', '-t', (all.length / fps).toFixed(3), '-c:a', 'aac', '-b:a', '192k');
    // Fedora's ffmpeg has no libx264, only libopenh264 (Baseline profile, about twice the size).
    const x264 = /\blibx264\b/.test(String(spawnSync('ffmpeg', ['-hide_banner', '-encoders']).stdout));
    args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', x264 ? 'libx264' : 'libopenh264', '-pix_fmt', 'yuv420p', ...(x264 ? ['-crf', '17', '-preset', 'slow'] : []), '-movflags', '+faststart', f);
    const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (r.status !== 0) await fail('ffmpeg failed');
  } else {
    writeFileSync(f, await encoder.finish(audio, all.length / fps).catch(e => fail(`MP4 encoding failed: ${e.message}`)));
    await encoder.close(); encoder = null;
  }
  written.push(f);
}

await browser.close();
rmSync(work, { recursive: true, force: true });
for (const f of written) console.log('wrote ' + f);
