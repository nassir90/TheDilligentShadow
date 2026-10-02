// record only the clips named in window.NAMES (from the groups in window.GROUPS)
window.requestAnimationFrame = () => 0;
for (let i = 0; i < 40; i++) frame(1 / 60, 100 + i / 60);
for (const f of ['rec.js', 'clips.js']) (0, eval)(await (await fetch('http://127.0.0.1:8781/devkit/' + f + '?' + Date.now())).text());
const names = window.NAMES.split(','), list = window.GROUPS.split(',').flatMap(g => CLIPS[g]).filter(c => names.includes(c.name));
await REC.all(list); return `${REC.queue.done}/${REC.queue.of} ${REC.queue.err || ''}`;
