// Page capture: records the whole web page (HTML text, the credit line, the 3D canvas) frame by frame, for clips
// where the page itself is the subject. rec.js only sees the canvas; this takes real screenshots of the composited
// page in headless Chrome (cdp.mjs launch), stepping the exhibit and setting the scroll position every frame.
//   node pagecap.mjs <clip name> [url]       clips are defined in pagecap_clips.js; frames + meta.json go to clips/<name>/
// The page is 540 x 960 CSS pixels at device scale 2 (a phone's proportions; the frames are 1080 x 1920), so
// callout positions from the page are doubled into clip pixels. Callouts are saved as per-frame data
// (meta.ann, in clip pixels) for compose.js to ink at output scale, as with rec.js clips.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), PROMO = dirname(HERE);
const [name, urlArg] = process.argv.slice(2);
const CLIPS = (0, eval)(readFileSync(join(HERE, 'pagecap_clips.js'), 'utf8'));
const clip = CLIPS[name]; if (!clip) { console.error('no clip', name, Object.keys(CLIPS)); process.exit(1); }
const url = urlArg || clip.url || 'http://localhost:8780/games/thedilligentshadow/';

const BASE = 'http://127.0.0.1:9333';
const list = await (await fetch(`${BASE}/json/list`)).json();
const page = list.find(t => t.type === 'page' && !t.url.includes('#tab='));
const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const wait = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => {
  const r = (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result;
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await send('Page.bringToFront');   // a background tab neither renders nor composites
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'pc=' + Date.now() });
await new Promise(r => setTimeout(r, 5000));

// shared helpers in the page: frames are stepped by hand, recordings get the sharper shadow maps
await ev(`(async () => {
  window.requestAnimationFrame = () => 0;
  (0, eval)(await (await fetch('http://127.0.0.1:8781/devkit/rec.js?' + Date.now())).text());   // REC.H helpers
  scene.traverse(o => { if (o.isLight && o.castShadow) { const n = o.shadow.mapSize.x >= 4096 ? 16384 : 8192; if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } o.shadow.mapSize.set(n, n); } });
  window.PCT = 1000;
  let seed = 11; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);   // the same run every time
  window.pcOff = 0;
  window.pcStep = (dt = 1 / 30) => {
    if (window.pcRelight !== false && !on && view === 'close' && (window.pcOff += dt) > 1.5) { REC.H.lights(true); window.pcOff = 0; }   // the light comes back on
    for (let i = 0; i < 2; i++) frame(dt / 2, PCT += dt / 2);
  };
  // fade the page's own text (and the credit line) out above the video's subtitle band, so the two never overlap;
  // a mask on the text only, so the 3D plinth behind it is untouched. z0..z1: CSS y where it fades out
  window.pcFade = (z0, z1) => { for (const el of [document.querySelector('#about .sheet'), document.getElementById('credit')]) {
    const top = el.getBoundingClientRect().top, m = 'linear-gradient(to bottom, #000 ' + (z0 - top) + 'px, transparent ' + (z1 - top) + 'px)';
    el.style.webkitMaskImage = m; el.style.maskImage = m; } };
  window.pcEase = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  window.pcMax = () => document.documentElement.scrollHeight - innerHeight;
  window.pcProj = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight, p.z]; };
  window.pcOn = p => p[2] < 1 && p[0] > 40 && p[0] < innerWidth - 40 && p[1] > 40 && p[1] < innerHeight - 40;
  return 1;
})()`);
await ev(`(async () => { ${clip.setup}; return 1; })()`);

const dir = join(PROMO, 'clips', name); mkdirSync(dir, { recursive: true });
const n = Math.round(clip.dur * 30), frames = [];
for (let f = 0; f < n; f++) {
  const t = f / 30;
  const m = await ev(`(() => { const t = ${t}; const m = { t }; ${clip.step}; return m; })()`);
  for (const a of m.ann || []) { if (a.x != null) { a.x *= 2; a.y *= 2; } if (a.pts) a.pts = a.pts.map(([x, y]) => [x * 2, y * 2]); }
  frames.push(m);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
  writeFileSync(join(dir, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
}
writeFileSync(join(dir, 'meta.json'), JSON.stringify({ fps: 30, w: 1080, h: 1920, frames }));
await send('Emulation.clearDeviceMetricsOverride');
console.log(name, n, 'frames');
ws.close(); process.exit(0);
