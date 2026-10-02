({
  tag: 'DEVLOG · THE DILIGENT SHADOW', title: 'Her hair is cloth',
  music: { level: 0.9, mix: 0.18, root: 47, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [59, 66, 71, 74] }, { at: 18, notes: [55, 62, 67, 71] }, { at: 30, notes: [57, 64, 69, 73] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'hair_wire', from: 0, rect: [0, 200, 1080, 1400] }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'hair_wire', rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ['const hair = new Cloth({', 3], y: 1240, size: 20, h: 260 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 2, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'hair_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'hair_after', from: 0, label: 'AFTER' } }] },
    { say: 3, layers: [{ type: 'clip', clip: 'hair_before', rect: [0, 200, 1080, 760], label: 'BEFORE · RECREATION' },
      { type: 'graph', y: 1000, h: 560, title: 'Hair jitter (frame-to-frame acceleration)', unit: 'mm', dur: 6, revealDur: 4,
        series: [{ label: 'one step per frame', color: '#ff5a6e', clip: 'hair_before', f: m => m.hairJerk * 1000 }, { label: 'fixed 240 Hz steps', color: '#54e08a', clip: 'hair_after', f: m => m.hairJerk * 1000 }] }] },
    { say: 4, layers: [{ type: 'clip', clip: 'hair_after', from: 0, rect: [0, 200, 1080, 700], label: 'AFTER' }, { type: 'code', snip: ['const H = 1 / 240;', 10], y: 930, size: 19, h: 470 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, tail: 1.2, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'hair_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'hair_after', from: 0, label: 'AFTER' } }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'hair_wire', from: 3, rect: [0, 0, 1080, 1920] }, { type: 'end' }] },
  ],
})
