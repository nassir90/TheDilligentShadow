// Compositor: builds a video's frames from its edit list (videos/<id>/edl.js), the clips recorded by rec.js, the
// narration timings (videos/<id>/vo.json) and code pulled live from exhibit.js. Runs in compose.html, served by
// framesink.py; posts frames to videos/<id>/frames/ and the audio cue list to videos/<id>/timeline.json.
const W = 1080, H = 1920, FPS = 30;
const SERIF = '"Times New Roman", Times, serif', MONO = 'Menlo, "SF Mono", Consolas, monospace', SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = { bg: '#0b0c0f', panel: 'rgba(14,16,21,0.94)', ink: '#e9ecf1', dim: '#8b93a1', red: '#ff5a6e', green: '#54e08a', blue: '#5ab8ff', amber: '#ffb02e', pink: '#ff6fa8', cyan: '#35d0ff' };

const get = async (p, as = 'json') => { const r = await fetch(p + (p.includes('?') ? '&' : '?') + 'nc=' + Date.now()); if (!r.ok) throw new Error(p + ' ' + r.status); return as === 'json' ? r.json() : r.text(); };
let SRC = '';
// lines of exhibit.js starting at the line containing `marker` (the n-th match), `count` long
function snippet(marker, count, nth = 0) {
  const L = SRC.split('\n'); let i = -1;
  for (let k = 0, seen = 0; k < L.length; k++) if (L[k].includes(marker)) { if (seen++ === nth) { i = k; break; } }
  if (i < 0) throw new Error('snippet not found: ' + marker);
  const lines = L.slice(i, i + count), pad = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return { text: lines.map(l => l.slice(pad)).join('\n'), line: i + 1 };
}

// ---- clips ----
const clips = {};
async function loadClip(name) { if (!clips[name]) clips[name] = { meta: await get(`/clips/${name}/meta.json`), imgs: new Map() }; return clips[name]; }
async function clipFrame(name, t) {
  const c = clips[name], n = c.meta.frames.length, i = clamp(Math.round(t * c.meta.fps), 0, n - 1);
  if (!c.imgs.has(i)) {
    const im = new Image(); im.src = `/clips/${name}/f${String(i).padStart(5, '0')}.jpg`; await im.decode(); c.imgs.set(i, im);
    for (const k of c.imgs.keys()) if (k < i - 4 || k > i + 4) c.imgs.delete(k);
  }
  return { img: c.imgs.get(i), meta: c.meta.frames[i] };
}
function cover(g, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s, sx = (img.width - sw) * fx, sy = (img.height - sh) * fy;
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  return (px, py) => [x + (px - sx) * s, y + (py - sy) * s];   // clip pixel → output pixel
}

// ---- "ink": the credit line's rule. Things drawn into the ink mask are painted, pixel by pixel, black where the
// frame behind is light and white where it is dark (the mask's alpha is how much). ----
const COUR = '"Courier New", Courier, monospace';
const ink = document.createElement('canvas'); ink.width = W; ink.height = H; const ig = ink.getContext('2d');
function applyInk(g) {
  const fr = g.getImageData(0, 0, W, H), d = fr.data, m = ig.getImageData(0, 0, W, H).data;
  for (let i = 0; i < d.length; i += 4) {
    const a = m[i + 3] / 255; if (!a) continue;
    const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 128 ? 0 : 255;
    d[i] += (v - d[i]) * a; d[i + 1] += (v - d[i + 1]) * a; d[i + 2] += (v - d[i + 2]) * a;
  }
  g.putImageData(fr, 0, 0);
}
// ---- crowding check: every piece of text records its glyph box; boxes of different elements must not overlap or
// sit closer than a fraction of the smaller font's height ----
const BOXES = [];
function tbox(group, ctx, text, x, y, size) {   // box of text drawn at (x, y) with ctx's current font and alignment
  const m = ctx.measureText(text), l = x - m.actualBoundingBoxLeft, r = x + m.actualBoundingBoxRight;
  BOXES.push({ group, name: group.startsWith('call#') ? `callout "${text}"` : group, x0: l, x1: r, y0: y - m.actualBoundingBoxAscent, y1: y + m.actualBoundingBoxDescent, size, text });
}
function crowding(t) {
  const st = STATUS.crowd ||= { frames: 0, overlaps: {}, tight: {}, worstGap: Infinity, worstPair: '' };
  let bad = false;
  for (let i = 0; i < BOXES.length; i++) for (let j = i + 1; j < BOXES.length; j++) {
    const a = BOXES[i], b = BOXES[j]; if (a.group === b.group) continue;
    const hx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0); if (hx <= 0) continue;   // not stacked
    const gap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1), key = `${a.name || a.group} × ${b.name || b.group}`;
    const need = 0.25 * Math.min(a.size, b.size);
    if (gap < 0) { st.overlaps[key] = (st.overlaps[key] || 0) + 1; bad = true; }
    else if (gap < need) { st.tight[key] = (st.tight[key] || 0) + 1; bad = true; }
    if (gap < st.worstGap) { st.worstGap = Math.round(gap); st.worstPair = `${key} at ${t.toFixed(2)}s`; }
  }
  if (bad) st.frames++;
  BOXES.length = 0;
}
// a square block with the word cut out of it, drawn into the ink mask: the block is inked pixel by pixel like all
// the other text, and the word shows the video through it
function inkCut(text, x, y, size = 34) {
  text = text.toLowerCase();
  ig.save(); ig.font = `400 ${size}px ${SERIF}`; const w = Math.ceil(ig.measureText(text).width + size * 0.8), h = Math.ceil(size * 1.4);
  ig.fillStyle = '#fff'; ig.fillRect(x, y, w, h);
  ig.globalCompositeOperation = 'destination-out'; ig.textBaseline = 'alphabetic'; ig.fillText(text, x + size * 0.4, y + h * 0.7);
  ig.restore();
  BOXES.push({ group: 'label:' + text + y, x0: x, x1: x + w, y0: y, y1: y + h, size, text });
}
// (classic) a square block with the word cut out of it (lowercase, regular weight): the whole block is black or white, by the
// average brightness behind it
function cutLabel(g, text, x, y, size = 34) {
  text = text.toLowerCase();
  g.save(); g.font = `400 ${size}px ${SERIF}`; const w = Math.ceil(g.measureText(text).width + size * 0.8), h = Math.ceil(size * 1.4);
  const px = g.getImageData(x, y, w, h).data; let lum = 0; for (let i = 0; i < px.length; i += 4) lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  lum /= px.length / 4;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext('2d');
  cg.fillStyle = lum > 128 ? '#000' : '#fff'; cg.fillRect(0, 0, w, h);
  cg.globalCompositeOperation = 'destination-out'; cg.font = g.font; cg.textBaseline = 'alphabetic'; cg.fillText(text, size * 0.4, h * 0.7);
  g.drawImage(c, x, y); g.restore();
  BOXES.push({ group: 'label:' + text, x0: x, x1: x + w, y0: y, y1: y + h, size, text });
}
// annotations recorded with a clip (in clip pixels), drawn into the ink mask at output scale
function drawAnn(list, map, key = '', t = 0) {
  const calls = [];
  ig.save(); ig.strokeStyle = '#fff'; ig.fillStyle = '#fff'; ig.lineWidth = 3; ig.lineCap = 'round'; ig.lineJoin = 'round';
  for (const a of list || []) {
    ig.globalAlpha = a.o ?? 1;
    if (a.k === 'dot') { const [x, y] = map(a.x, a.y); ig.beginPath(); ig.arc(x, y, (a.r || 7) * 0.8, 0, 7); a.fill === false ? ig.stroke() : ig.fill(); }
    else if (a.k === 'line') { ig.lineWidth = a.w || 3; ig.beginPath(); a.pts.forEach((p, i) => { const [x, y] = map(...p); i ? ig.lineTo(x, y) : ig.moveTo(x, y); }); ig.stroke(); ig.lineWidth = 3; }
    else if (a.k === 'call') calls.push(a);
  }
  ig.restore();
  drawCalls(calls, map, key, t);
}
// Callouts: the circle follows its feature every frame, but the label stays put until the feature has moved well
// away from it, then glides to its new place; callouts fade in and out instead of popping. State is kept per
// callout id (per clip), so a label keeps its place from frame to frame.
const CALL = new Map();
function drawCalls(calls, map, key, t) {
  const live = new Set();
  for (const a of calls) {
    const id = key + ':' + (a.id ?? a.text), [cx, cy] = map(a.x, a.y), size = a.size || 36;
    ig.save(); ig.font = `400 ${size}px ${SERIF}`; const tw = ig.measureText(a.text).width; ig.restore();
    let dx = a.dx; if (cx + dx - tw < 24 && dx < 0) dx = -dx; else if (cx + dx + tw > W - 24 && dx > 0) dx = -dx;   // keep it on screen
    const gx = cx + dx, gy = cy + a.dy;
    let st = CALL.get(id);
    if (!st || t - st.t > 0.5 || t < st.t) st = { ax: gx, ay: gy, gx, gy, alpha: 0, t };
    if (Math.hypot(st.gx - gx, st.gy - gy) > 180 || st.gx - tw < 0 || st.gx + tw > W) { st.gx = gx; st.gy = gy; }   // drifted too far: move on
    // glide toward the new place, gently, and never faster than 20 px a frame
    const dt = Math.max(0, t - st.t), k = 1 - Math.exp(-dt / 0.45);
    let mx = (st.gx - st.ax) * k, my = (st.gy - st.ay) * k; const ml = Math.hypot(mx, my), cap = 20 * dt * 30;
    if (ml > cap) { mx *= cap / ml; my *= cap / ml; }
    st.ax += mx; st.ay += my; st.alpha += (1 - st.alpha) * (1 - Math.exp(-dt / 0.12));
    if (st.px != null) { const m = (STATUS.callMotion ||= { circle: 0, label: 0, frames: 0, maxLabelStep: 0 }); const ls = Math.hypot(st.ax - st.pax, st.ay - st.pay); m.circle += Math.hypot(cx - st.px, cy - st.py); m.label += ls; m.frames++; m.maxLabelStep = Math.max(m.maxLabelStep, +ls.toFixed(1)); }
    st.px = cx; st.py = cy; st.pax = st.ax; st.pay = st.ay;
    Object.assign(st, { t, cx, cy, text: a.text, size, r: (a.r || 34) * 0.55, seen: t });
    CALL.set(id, st); live.add(id);
  }
  for (const [id, st] of CALL) {
    if (!id.startsWith(key + ':')) continue;
    if (!live.has(id)) { const dt = Math.max(0, t - st.t); st.t = t; st.alpha *= Math.exp(-dt / 0.15); if (st.alpha < 0.02 || t - st.seen > 1) { CALL.delete(id); continue; } }
    // draw: circle, leader to the label, leader runs on as its underline
    const { cx, cy, r, ax, ay, text, size } = st, left = ax < cx;
    ig.save(); ig.globalAlpha = st.alpha; ig.strokeStyle = '#fff'; ig.fillStyle = '#fff'; ig.lineWidth = 3; ig.lineCap = 'round';
    ig.font = `400 ${size}px ${SERIF}`; const tw = ig.measureText(text).width;
    const uy = ay + Math.round(size * 0.3) + 7, ux1 = left ? ax - tw - 14 : ax + tw + 14;
    const ang = Math.atan2(uy - cy, ax - cx), ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
    ig.beginPath(); ig.arc(cx, cy, r, 0, 7); ig.stroke();
    ig.beginPath(); ig.moveTo(ex, ey); ig.lineTo(ax, uy); ig.lineTo(ux1, uy); ig.stroke();
    ig.textAlign = left ? 'right' : 'left'; const tx = ax + (left ? -9 : 9); ig.fillText(text, tx, ay);
    tbox('call#' + id, ig, text, tx, ay, size); ig.restore();
  }
}
const SUB = { size: 50, lh: 60, y: 1730, maxW: 940 };
function subLines(text) { ig.save(); ig.font = `400 ${SUB.size}px ${SERIF}`; const l = wrap(ig, text, SUB.maxW); ig.restore(); return l; }
function subTop(text) { return SUB.y - (subLines(text).length - 1) * SUB.lh - SUB.size * 0.72; }   // top of the subtitle's first line
function inkSubtitle(text, alpha, words, t) {
  ig.save(); ig.globalAlpha = alpha; ig.font = `400 ${SUB.size}px ${SERIF}`; ig.textAlign = 'left'; ig.fillStyle = '#fff'; ig.textBaseline = 'alphabetic';
  const lines = subLines(text), y0 = SUB.y - (lines.length - 1) * SUB.lh;
  // the word being spoken: the last one to have started (it stays lit through a pause until the next begins)
  let cur = -1; if (words) for (let i = 0; i < words.length; i++) if (t >= words[i].t0) cur = i;
  let wi = 0;
  lines.forEach((l, li) => {
    const yy = y0 + li * SUB.lh, lw = ig.measureText(l).width, x0 = (W - lw) / 2, parts = l.split(' ');
    let x = x0;
    for (const p of parts) {
      const pw = ig.measureText(p).width;
      if (wi === cur) {
        const pad = 8, top = yy - SUB.size * 0.78, h = SUB.size * 1.02;
        ig.fillRect(x - pad, top, pw + pad * 2, h);
        ig.globalCompositeOperation = 'destination-out'; ig.fillText(p, x, yy); ig.globalCompositeOperation = 'source-over';
      } else ig.fillText(p, x, yy);
      x += pw + ig.measureText(' ').width; wi++;
    }
    tbox('subtitle', ig, l, x0, yy, SUB.size);
  });
  ig.restore();
}
// a stack of centred lines laid out from their real glyph boxes: each line's top sits `gap` × its font size below
// the line above
function inkStack(rows, top, alpha) {
  ig.save(); ig.globalAlpha = alpha; ig.fillStyle = '#fff'; ig.textAlign = 'center';
  let y = top;
  for (const r of rows) {
    ig.font = r.font; const m = ig.measureText(r.text), base = y + m.actualBoundingBoxAscent;
    ig.fillText(r.text, W / 2, base); tbox(r.group, ig, r.text, W / 2, base, r.size);
    y = base + m.actualBoundingBoxDescent + (r.gap ?? 0.35) * r.size;
  }
  ig.restore();
}
function inkTitle(E, t) {
  const T = E.titleCard; if (!T) return;
  const a = ease(t / 0.6) * (1 - ease((t - (T.hold || 3.2)) / 0.9)); if (a <= 0) return;
  // a title too wide for the frame wraps onto a second line
  ig.save(); ig.font = `400 112px ${SERIF}`; const tl = wrap(ig, T.title, W - 120); ig.restore();
  inkStack([{ text: T.kicker || '', font: `italic 400 40px ${SERIF}`, size: 40, group: 'title.kicker', gap: 0.5 },
    ...tl.map((l, i) => ({ text: l, font: `400 112px ${SERIF}`, size: 112, group: 'title', gap: 0.2 }))], T.top ?? 210, a);
}
function inkStat(L, tl) {
  const k = ease((tl - (L.delay || 0.4)) / (L.count || 1.2)), v = L.from + (L.to - L.from) * k;
  const rows = [{ text: L.label, font: `italic 400 42px ${SERIF}`, size: 42, group: 'stat.label', gap: 0.55 },
    { text: v.toFixed(L.dp ?? 0) + (L.unit || ''), font: `400 160px ${SERIF}`, size: 160, group: 'stat.value', gap: 0.3 }];
  if (L.note) rows.push({ text: L.note, font: `400 34px ${SERIF}`, size: 34, group: 'stat.note' });
  inkStack(rows, L.top ?? 230, ease(tl / 0.3));
}
// code: a plain black box, thin white Times New Roman, inset so the video shows round its sides and below it; it
// sits as low as it can while keeping clear of the segment's subtitles
function plainCode(g, L, tl, bottom) {
  const sn = L.snip ? snippet(...L.snip) : { text: L.text, line: 1 };
  const size = L.size || 27, lh = size * 1.45, x = L.x ?? 48, w = L.w ?? (W - 96), pad = 30;
  g.save(); g.font = `400 ${size}px ${MONO}`;
  const rows = [];   // long lines wrap inside the box, continuing with an extra indent
  for (const ln of sn.text.split('\n')) {
    const ind = ln.match(/^ */)[0]; let rest = ln;
    while (g.measureText(rest).width > w - pad * 2) {
      let k = rest.length; while (k > ind.length + 8 && g.measureText(rest.slice(0, k)).width > w - pad * 2) k--;
      const sp = rest.lastIndexOf(' ', k); if (sp > ind.length + 8) k = sp;
      rows.push(rest.slice(0, k)); rest = ind + '    ' + rest.slice(k).trimStart();
    }
    rows.push(rest);
  }
  const h = rows.length * lh + pad * 1.4, y = L.y ?? (bottom - h), a = ease(tl / 0.35);
  g.globalAlpha = a * 0.84; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.globalAlpha = a; g.fillStyle = '#fff';
  BOXES.push({ group: 'code', x0: x, x1: x + w, y0: y, y1: y + h, size, text: 'code box' });
  const total = rows.join('').length, reveal = L.typing === false ? 1 : clamp((tl - 0.2) / (L.typeDur || 1.4), 0, 1);
  let shown = Math.floor(total * reveal), cx = x + pad, cy = y + pad + size * 0.75;
  rows.forEach((r, i) => {
    const yy = y + pad + size * 0.75 + i * lh, piece = r.slice(0, Math.max(0, shown)); shown -= r.length;
    g.fillText(piece, x + pad, yy);
    if (piece.length || i === 0) { cx = x + pad + g.measureText(piece).width; cy = yy; }
  });
  if (reveal < 1 && Math.floor(tl * 3) % 2 === 0) g.fillRect(cx + 3, cy - size * 0.72, 2, size * 0.9);
  g.restore();
}
// a graph in the same plain style: a translucent black box, white lines (solid, then dashed), Times New Roman labels;
// it sits just above the subtitles, like the code
function plainGraph(g, L, tl, bottom) {
  const x = 48, w = W - 96, h = L.h || 470, y = L.y ?? (bottom - h), a = ease(tl / 0.3);
  const ser = L.series.map(sr => sr.data || clips[sr.clip].meta.frames.slice(Math.round((sr.from || 0) * 30), Math.round(((sr.from || 0) + L.dur) * 30)).map(m => sr.f(m)));
  const ym = L.ymax || Math.max(...ser.flat()) * 1.1 || 1;
  g.save(); g.globalAlpha = a * 0.84; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.globalAlpha = a;
  BOXES.push({ group: 'graph', x0: x, x1: x + w, y0: y, y1: y + h, size: 30, text: 'graph box' });
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.font = `400 34px ${SERIF}`; g.fillText(L.title, x + 30, y + 52);
  const px = x + 96, py = y + 90, pw = w - 130, ph = h - 170;
  g.font = `400 24px ${MONO}`; g.globalAlpha = a * 0.6; g.lineWidth = 1;
  for (let k = 0; k <= 2; k++) { const yy = py + ph - ph * k / 2; g.beginPath(); g.moveTo(px, yy); g.lineTo(px + pw, yy); g.stroke(); g.fillText(String(+(ym * k / 2).toPrecision(2)), x + 22, yy + 8); }
  g.fillText(L.unit || '', x + 22, py - 22); g.fillText(`${L.dur} s`, px + pw - 50, py + ph + 36);
  g.globalAlpha = a;
  const prog = clamp((tl - 0.3) / (L.revealDur || 2.5), 0, 1);
  ser.forEach((d, si) => {
    const n = Math.max(1, Math.floor(d.length * prog));
    g.lineWidth = 4; g.setLineDash(si ? [14, 10] : []); g.beginPath();
    for (let i = 0; i < n; i++) { const xx = px + pw * i / (d.length - 1), yy = py + ph - ph * clamp(d[i] / ym, 0, 1); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    g.stroke();
    const lx = px + si * pw / 2, ly = y + h - 30; g.beginPath(); g.moveTo(lx, ly - 10); g.lineTo(lx + 50, ly - 10); g.stroke(); g.setLineDash([]);
    g.font = `400 30px ${SERIF}`; g.fillText(L.series[si].label, lx + 64, ly);
  });
  g.restore();
}
function pill(g, text, x, y, color, size = 30) {
  g.save(); g.font = `700 ${size}px ${SANS}`; const w = g.measureText(text).width + size * 1.1, h = size * 1.6;
  g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  g.fillStyle = '#0b0c0f'; g.textBaseline = 'middle'; g.fillText(text, x + size * 0.55, y + h / 2 + 1); g.restore(); return w;
}

// ---- syntax-highlighted code panel ----
const KW = /\b(const|let|var|function|return|if|else|for|of|in|new|this|class|while|break|case|switch|true|false|null|undefined|typeof|async|await)\b/;
function tokens(line) {
  const out = []; let s = line;
  const rules = [[/^\/\/.*/, '#6f7a8a'], [/^(['"`])(?:\\.|(?!\1).)*\1/, '#a8e3a0'], [/^\d+(\.\d+)?(e-?\d+)?/, '#ffb86b'],
    [/^[A-Za-z_$][\w$]*(?=\s*\()/, '#7cc7ff'], [/^[A-Za-z_$][\w$]*/, null], [/^\s+/, null], [/^./, '#c9cfd8']];
  while (s.length) for (const [re, col] of rules) {
    const m = s.match(re); if (!m) continue;
    let c = col; if (col === null) c = KW.test(m[0]) && m[0].match(KW)[0] === m[0] ? '#ff7ab6' : '#e6e9ee';
    out.push([m[0], c]); s = s.slice(m[0].length); break;
  }
  return out;
}
function code(g, L, tl) {
  const { x = 40, y = 980, w = 1000, size = 25, title = 'exhibit.js' } = L;
  const sn = L.snip ? snippet(...L.snip) : { text: L.text, line: 1 };
  const lines = sn.text.split('\n'), lh = size * 1.45, h = L.h || (lines.length * lh + 110);
  const a = ease(tl / 0.35);
  g.save(); g.globalAlpha = a;
  g.fillStyle = C.panel; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.roundRect(x, y, w, 58, [18, 18, 0, 0]); g.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(x + 32 + i * 28, y + 29, 8, 0, 7); g.fill(); });
  g.fillStyle = C.dim; g.font = `500 24px ${MONO}`; g.fillText(`${title}${L.snip ? ' : ' + sn.line : ''}`, x + 120, y + 37);
  g.font = `400 ${size}px ${MONO}`; g.textBaseline = 'alphabetic';
  const reveal = L.type === 'code' && L.typing !== false ? clamp((tl - 0.2) / (L.typeDur || 1.4), 0, 1) : 1;
  const total = sn.text.length; let shown = Math.floor(total * reveal), cx, cy;
  const hl = L.hl || [];
  lines.forEach((ln, i) => {
    const yy = y + 100 + i * lh;
    if (hl.some(([a2, b2]) => i >= a2 && i <= b2)) { g.fillStyle = 'rgba(90,184,255,0.13)'; g.fillRect(x + 4, yy - size * 1.05, w - 8, lh); }
    g.fillStyle = '#4b5361'; g.fillText(String(sn.line + i).padStart(4), x + 14, yy);
    let xx = x + 100;
    for (const [tx, col] of tokens(ln)) {
      if (shown <= 0) break;
      const piece = tx.slice(0, shown); shown -= piece.length;
      g.fillStyle = col; g.fillText(piece, xx, yy); xx += g.measureText(piece).width;
      if (xx > x + w - 16) break;
    }
    shown -= 1; cx = xx; cy = yy;
  });
  if (reveal < 1 && Math.floor(tl * 3) % 2 === 0) { g.fillStyle = C.blue; g.fillRect(cx + 2, cy - size * 0.85, size * 0.55, size); }
  g.restore();
}

// ---- a line chart drawn from recorded data (or given arrays), revealed over time ----
function graph(g, L, tl) {
  const { x = 60, y = 1000, w = 960, h = 520, title = '', unit = '', ymax } = L;
  const a = ease(tl / 0.3);
  g.save(); g.globalAlpha = a;
  g.fillStyle = C.panel; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  g.fillStyle = C.ink; g.font = `600 30px ${SANS}`; g.fillText(title, x + 30, y + 52);
  const px = x + 90, py = y + 90, pw = w - 130, ph = h - 160;
  const ser = L.series.map(s => s.data || clips[s.clip].meta.frames.slice(Math.round((s.from || 0) * 30), Math.round(((s.from || 0) + L.dur) * 30)).map(m => s.f(m)));
  const ym = ymax || Math.max(...ser.flat()) * 1.1 || 1;
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.fillStyle = C.dim; g.font = `400 22px ${MONO}`;
  for (let k = 0; k <= 4; k++) { const yy = py + ph - ph * k / 4; g.beginPath(); g.moveTo(px, yy); g.lineTo(px + pw, yy); g.stroke(); g.fillText(String(+(ym * k / 4).toPrecision(2)), x + 16, yy + 7); }
  g.fillText(unit, px, py - 16); g.fillText(`${L.dur}s`, px + pw - 40, py + ph + 34); g.fillText('0', px, py + ph + 34);
  const prog = clamp((tl - 0.3) / (L.revealDur || 2.5), 0, 1);
  ser.forEach((d, si) => {
    const s = L.series[si], n = Math.max(1, Math.floor(d.length * prog));
    g.strokeStyle = s.color; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < n; i++) { const xx = px + pw * i / (d.length - 1), yy = py + ph - ph * clamp(d[i] / ym, 0, 1); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    g.stroke();
    g.fillStyle = s.color; g.font = `600 26px ${SANS}`; g.fillText('● ' + s.label, px + 10 + si * (pw / L.series.length), y + h - 22);
  });
  g.restore();
}

// ---- the state machine diagram, lit by what she is doing in a clip ----
function diagram(g, L, tl, mode) {
  const { x = 0, y = 120, nodes, edges } = L;
  const pos = Object.fromEntries(nodes.map(n => [n.id, n]));
  g.save(); g.translate(x, y);
  g.lineWidth = 3;
  for (const [a, b, bend = 0] of edges) {
    const A = pos[a], B = pos[b], mx = (A.x + B.x) / 2 + bend * (B.y - A.y) * 0.3, my = (A.y + B.y) / 2 - bend * (B.x - A.x) * 0.3;
    const live = a === L._prev && b === mode;
    g.strokeStyle = live ? C.amber : 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
    const t = 0.82, qx = (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * mx + t * t * B.x, qy = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * my + t * t * B.y;
    const ang = Math.atan2(B.y - qy, B.x - qx); g.fillStyle = g.strokeStyle;
    g.beginPath(); g.moveTo(qx + Math.cos(ang) * 14, qy + Math.sin(ang) * 14); g.lineTo(qx + Math.cos(ang + 2.5) * 14, qy + Math.sin(ang + 2.5) * 14); g.lineTo(qx + Math.cos(ang - 2.5) * 14, qy + Math.sin(ang - 2.5) * 14); g.fill();
  }
  for (const n of nodes) {
    const act = n.id === mode || (n.also || []).includes(mode);
    g.font = `600 30px ${MONO}`; const w = g.measureText(n.id).width + 44, h = 62;
    if (act) { g.shadowColor = C.amber; g.shadowBlur = 30; }
    g.fillStyle = act ? C.amber : 'rgba(22,25,31,0.95)'; g.strokeStyle = act ? C.amber : 'rgba(255,255,255,0.35)';
    g.beginPath(); g.roundRect(n.x - w / 2, n.y - h / 2, w, h, 14); g.fill(); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = act ? '#16130a' : C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n.id, n.x, n.y + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  g.restore();
}

// ---- text ----
function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) { let line = ''; for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); }
  return out;
}
function textLayer(g, L, tl) {
  const a = ease((tl - (L.delay || 0)) / 0.4); if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.fillStyle = L.color || C.ink; g.textAlign = L.align || 'center';
  g.font = L.font || `400 ${L.size || 64}px ${L.face === 'mono' ? MONO : L.face === 'sans' ? SANS : SERIF}`;
  const lines = wrap(g, L.text, L.maxW || 940), lh = (L.size || 64) * 1.25;
  lines.forEach((l, i) => g.fillText(l, L.x ?? W / 2, (L.y ?? 900) + i * lh));
  g.restore();
}
function bigStat(g, L, tl) {   // "96 mm → 0 mm" counting down
  const k = ease((tl - (L.delay || 0.4)) / (L.count || 1.2));
  const v = L.from + (L.to - L.from) * k;
  g.save(); g.textAlign = 'center'; g.globalAlpha = ease(tl / 0.3);
  g.fillStyle = C.dim; g.font = `500 34px ${SANS}`; g.fillText(L.label, L.x ?? W / 2, (L.y ?? 1000) - 110);
  g.fillStyle = k >= 1 ? C.green : C.ink; g.font = `700 150px ${SANS}`; g.fillText(v.toFixed(L.dp ?? 0) + (L.unit || ''), L.x ?? W / 2, L.y ?? 1000);
  if (L.note) { g.fillStyle = C.dim; g.font = `400 30px ${SANS}`; g.fillText(L.note, L.x ?? W / 2, (L.y ?? 1000) + 70); }
  g.restore();
}
const knock = document.createElement('canvas'); knock.width = W; knock.height = 200;
function endCard(g, L, tl) {
  const k = ease(tl / 1.0);
  g.fillStyle = `rgba(6,7,9,${0.72 * k})`; g.fillRect(0, 0, W, H);
  const f = d => ease((tl - d) / 0.8);
  g.save(); g.textAlign = 'center'; g.fillStyle = '#fff';
  g.globalAlpha = f(0.3); g.font = `400 104px ${SERIF}`; g.fillText('The Diligent Shadow', W / 2, 700);
  g.globalAlpha = f(0.8); g.font = `italic 400 48px ${SERIF}`; g.fillText('After Koya Endo', W / 2, 800);
  g.font = `400 48px ${SERIF}`; g.fillText('Tokyo Prototype 2026', W / 2, 866);
  g.restore();
  const a = f(1.4); if (a <= 0) return;
  const kg = knock.getContext('2d'), txt = 'mpts.ie/games/thedilligentshadow';
  kg.clearRect(0, 0, W, 200); kg.font = `400 50px ${SERIF}`;
  const tw = kg.measureText(txt).width, bw = tw + 56, bh = 84, bx = (W - bw) / 2, by = 58;
  kg.globalCompositeOperation = 'source-over'; kg.fillStyle = '#fff'; kg.fillRect(bx, by, bw, bh);
  kg.globalCompositeOperation = 'destination-out'; kg.textAlign = 'center'; kg.textBaseline = 'middle'; kg.fillText(txt, W / 2, by + bh / 2 + 3);
  kg.globalCompositeOperation = 'source-over';
  g.save(); g.globalAlpha = a; g.drawImage(knock, 0, 1180 - by); g.restore();
}
function subtitle(g, text, alpha, y = 1700) {
  g.save(); g.globalAlpha = alpha; g.font = `400 46px ${SERIF}`; g.textAlign = 'center';
  const lines = wrap(g, text, 900), lh = 58, y0 = y - (lines.length - 1) * lh;
  const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 44, bh = lines.length * lh + 24;
  g.fillStyle = 'rgba(8,9,11,0.66)'; g.beginPath(); g.roundRect((W - bw) / 2, y0 - 46, bw, bh, 10); g.fill();
  g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh)); g.restore();
}
function header(g, E) {
  if (!E.tag) return;
  const gr = g.createLinearGradient(0, 0, 0, 250); gr.addColorStop(0, 'rgba(8,9,12,0.85)'); gr.addColorStop(0.7, 'rgba(8,9,12,0.55)'); gr.addColorStop(1, 'rgba(8,9,12,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 250);
  g.save(); g.font = `600 26px ${MONO}`; g.fillStyle = C.amber; g.fillText(E.tag, 48, 92);
  g.fillStyle = C.ink; g.font = `400 54px ${SERIF}`; g.fillText(E.title, 48, 160); g.restore();
}

// ---- timeline ----
function timeline(E, vo) {
  let t = 0; const segs = [], cues = [], cursor = {};
  for (const s of E.segments) {
    const line = s.say != null ? vo.lines[s.say] : null;
    const lead = s.lead ?? 0.35, len = line ? line.end - line.start : 0;
    const dur = Math.max(s.dur || 0, line ? lead + len + (s.tail ?? 0.5) : 0);
    if (line) cues.push({ a: line.start, b: line.end, at: t + lead, say: s.say, text: E.lines[s.say].sub || E.lines[s.say].say });
    for (const L of s.layers || []) for (const k of ['clip', 'a', 'b']) {
      const ref = k === 'clip' ? L : L[k]; if (!ref || !ref.clip) continue;
      if (ref.from === 'cont' || ref.from == null) ref._from = cursor[ref.clip] || 0; else ref._from = ref.from;
      cursor[ref.clip] = ref._from + dur * (ref.speed || 1);
    }
    for (const e of s.sfx || []) cues.push({ sfx: e.type, at: t + e.at, vol: e.vol });
    segs.push({ ...s, t0: t, dur }); t += dur;
  }
  return { segs, cues, total: t };
}

let STYLE = 'classic', NOW = 0, WORDS = null;
async function drawClipLayer(g, L, tl, rect) {
  const ct = L._from + tl * (L.speed || 1), len = clips[L.clip].meta.frames.length / clips[L.clip].meta.fps;
  if (ct > len + 1 / 30) { const o = (STATUS.overrun ||= {}); o[L.clip] = Math.max(o[L.clip] || 0, +(ct - len).toFixed(2)); }   // the clip has run out: it would freeze
  const { img, meta } = await clipFrame(L.clip, ct);
  const [x, y, w, h] = rect || L.rect || [0, 0, W, H];
  g.save(); if (L.alpha != null) g.globalAlpha = L.alpha;
  const map = cover(g, img, x, y, w, h, L.fx ?? 0.5, L.fy ?? 0.5); g.restore();
  if (STYLE === 'ink') {
    if (meta.ann && L.ann !== false) { ig.save(); ig.beginPath(); ig.rect(x, y, w, h); ig.clip(); drawAnn(meta.ann, map, L.clip + '@' + y, NOW); ig.restore(); }
    if (L.label) inkCut(L.label, x + 36, y + (L.labelY ?? 36));
  } else if (L.label) pill(g, L.label, x + 30, y + 30, L.labelColor || (L.label.startsWith('BEFORE') ? C.red : C.green));
  return meta;
}

async function run(id, opts = {}) {
  const st = window.STATUS = { id, frame: 0, of: 0, done: false };
  SRC = await get('/src/exhibit.js', 'text');
  const E = (0, eval)(await get(`/videos/${id}/edl.js`, 'text'));
  if (!E.lines) E.lines = await get(`/videos/${id}/script.json`);
  const vo = E.lines.length ? await get(`/videos/${id}/vo.json`) : { lines: [] };
  const TL = timeline(E, vo); STYLE = E.style || 'classic'; CALL.clear();
  WORDS = STYLE === 'ink' ? await get(`/videos/${id}/words.json`).catch(() => null) : null;
  for (const s of TL.segs) for (const L of s.layers || []) {
    for (const k of ['clip', 'a', 'b']) { const r = k === 'clip' ? L : L[k]; if (r && r.clip) await loadClip(r.clip); }
    if (L.series) for (const s2 of L.series) if (s2.clip) await loadClip(s2.clip);
    if (L.modeClip) await loadClip(L.modeClip);
  }
  const n = Math.round(TL.total * FPS); st.of = n;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const only = opts.only;   // [from, to] seconds, for previews
  let batch = [], prevMode = null, lastMode = null;
  for (let f = 0; f < n; f++) {
    const t = f / FPS; NOW = t;
    if (only && (t < only[0] || t >= only[1] || (f % (opts.every || 1)))) continue;
    const s = TL.segs.find(s => t >= s.t0 && t < s.t0 + s.dur) || TL.segs[TL.segs.length - 1], tl = t - s.t0;
    g.fillStyle = s.bg || C.bg; g.fillRect(0, 0, W, H); ig.clearRect(0, 0, W, H);
    const cuts = [];
    for (const L of s.layers || []) {
      if (L.type === 'clip') await drawClipLayer(g, L, tl);
      else if (L.type === 'split') { await drawClipLayer(g, L.a, tl, [0, L.top ?? 0, W, (L.h ?? 960)]); await drawClipLayer(g, L.b, tl, [0, (L.top ?? 0) + (L.h ?? 960), W, (L.h ?? 960)]); if (STYLE !== 'ink') { g.fillStyle = '#0b0c0f'; g.fillRect(0, (L.top ?? 0) + (L.h ?? 960) - 3, W, 6); } }
      else if (L.type === 'code') { if (STYLE === 'ink') { L._code = true; } else code(g, L, tl); }
      else if (L.type === 'graph') { if (STYLE === 'ink') L._graph = true; else graph(g, L, tl); }
      else if (L.type === 'text') textLayer(g, L, tl);
      else if (L.type === 'stat') { if (STYLE === 'ink') inkStat(L, tl); else bigStat(g, L, tl); }
      else if (L.type === 'end') endCard(g, L, tl);
      else if (L.type === 'dim') { g.fillStyle = `rgba(0,0,0,${L.a ?? 0.5})`; g.fillRect(...(L.rect || [0, 0, W, H])); }
      else if (L.type === 'diagram') {
        const { meta } = await clipFrame(L.modeClip, (L.modeFrom ?? 0) + tl * (L.speed || 1));
        if (meta.mode !== lastMode) { prevMode = lastMode; lastMode = meta.mode; }
        L._prev = prevMode; diagram(g, L, tl, meta.mode);
      }
      else if (L.type === 'draw') L.fn(g, tl, { W, H, C, SANS, MONO, SERIF, ease, clips });
    }
    if (STYLE === 'ink') {
      inkTitle(E, t);
      for (const c of TL.cues) if (c.text) { const b = c.at + (c.b - c.a) + 0.3; if (t >= c.at - 0.1 && t <= b + 0.15) inkSubtitle(c.text, Math.min(1, (t - (c.at - 0.1)) / 0.15, (b + 0.15 - t) / 0.15), WORDS && WORDS[c.say], c.a + (t - c.at)); }
      applyInk(g);
      const subs = TL.cues.filter(c => c.text && c.at < s.t0 + s.dur && c.at + (c.b - c.a) + 0.45 > s.t0);
      const bottom = (subs.length ? Math.min(...subs.map(c => subTop(c.text))) : H - 60) - 48;   // just clear of the subtitles
      for (const L of s.layers || []) { for (const r of [L, L.a, L.b]) if (r && r._cut) { cutLabel(g, ...r._cut); r._cut = null; } if (L._code) plainCode(g, L, tl, bottom); if (L._graph) plainGraph(g, L, tl, bottom); }
      crowding(t);
    } else {
      header(g, E);
      for (const c of TL.cues) if (c.text) { const b = c.at + (c.b - c.a) + 0.3; if (t >= c.at - 0.1 && t <= b + 0.15) subtitle(g, c.text, Math.min(1, (t - (c.at - 0.1)) / 0.15, (b + 0.15 - t) / 0.15)); }
    }
    if (t < 0.5) { g.fillStyle = `rgba(0,0,0,${1 - ease(t / 0.5)})`; g.fillRect(0, 0, W, H); }
    if (t > TL.total - 0.8) { g.fillStyle = `rgba(0,0,0,${ease((t - (TL.total - 0.8)) / 0.8)})`; g.fillRect(0, 0, W, H); }
    if (opts.preview) { (st.preview ||= []).push(cv.toDataURL('image/jpeg', 0.6)); }
    else {
      batch.push(`videos/${id}/frames/f${String(f).padStart(5, '0')}.jpg ${cv.toDataURL('image/jpeg', 0.9).split(',')[1]}`);
      if (batch.length >= 24) { await fetch('/batch', { method: 'POST', body: batch.join('\n') }); batch = []; }
    }
    st.frame++;
  }
  if (batch.length) await fetch('/batch', { method: 'POST', body: batch.join('\n') });
  if (!opts.preview) await fetch(`/videos/${id}/timeline.json`, { method: 'POST', body: JSON.stringify({ total: TL.total, cues: TL.cues, music: E.music || null }) });
  st.done = true;
}
window.COMPOSE = { run, snippet, timeline };
