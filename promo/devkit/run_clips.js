// usage: node cdp.mjs eval run_clips.js   (set window.GROUP first via -e, or edit GROUPS below)
window.requestAnimationFrame = () => 0;
// warm up: let the page run some ordinary frames first (materials, shadow maps and env maps get built on first use)
for (let i = 0; i < 40; i++) frame(1 / 60, 100 + i / 60);
for (const f of ['rec.js', 'clips.js']) (0, eval)(await (await fetch('http://127.0.0.1:8781/devkit/' + f + '?' + Date.now())).text());
const groups = (window.GROUPS || '').split(',').filter(Boolean), out = [];
for (const g of groups) { const t0 = performance.now(); await REC.all(CLIPS[g]); out.push(`${g}: ${REC.queue.done}/${REC.queue.of} in ${((performance.now() - t0) / 1000).toFixed(0)}s ${REC.queue.err || ''}`); if (REC.queue.err) break; }
return out.join('\n');
