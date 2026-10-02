({
  tag: 'HOW IT WORKS · THE DILIGENT SHADOW', title: 'The invisible cast',
  music: { level: 0.9, mix: 0.2, root: 45, drone: 0.12, pad: 0.07, piano: 0.12, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 71] }, { at: 12, notes: [53, 60, 65, 72] }, { at: 26, notes: [55, 62, 67, 74] }],
    notes: [{ at: 1, m: 69, v: 0.4 }, { at: 12.5, m: 72, v: 0.35 }, { at: 26.5, m: 74, v: 0.35 }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'sh_room', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'sh_room' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'sh_reveal', from: 0 }] },
    { say: 3, layers: [{ type: 'clip', clip: 'sh_reveal' }, { type: 'code', snip: ['const caster = (extra = {})', 1], y: 1380, size: 17, h: 160 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'sh_orbit', from: 0 }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'sh_room', from: 0 }, { type: 'dim', a: 0.15 },
      { type: 'draw', fn(g, tl, k) {
        // the credit line's rule, applied to these pixels: each letter is inked black or white by what is behind it
        const W = 1080, y = 380 + tl * 150, h = 120, text = 'The Diligent Shadow · Tokyo Prototype 2026';
        const m = this._m || (this._m = document.createElement('canvas')); m.width = W; m.height = h; const mg = m.getContext('2d');
        mg.clearRect(0, 0, W, h); mg.font = `400 46px ${k.SERIF}`; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillStyle = '#fff'; mg.fillText(text, W / 2, h / 2);
        const md = mg.getImageData(0, 0, W, h).data, bg = g.getImageData(0, y, W, h), d = bg.data;
        for (let i = 0; i < d.length; i += 4) { const a = md[i + 3] / 255; if (!a) continue; const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], ink = lum > 128 ? 0 : 255; for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - a) + ink * a; }
        g.putImageData(bg, 0, y);
      } }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'sh_room', from: 4 }, { type: 'end' }] },
  ],
})
