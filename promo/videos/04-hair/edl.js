({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'Her hair is cloth', hold: 2.6 },
  music: { level: 0.9, mix: 0.18, root: 47, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [59, 66, 71, 74] }, { at: 18, notes: [55, 62, 67, 71] }, { at: 30, notes: [57, 64, 69, 73] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ih_wire', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'ih_wire' }, { type: 'code', snip: ['const hair = new Cloth({', 3] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 2, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ih_before', from: 0, label: 'before' }, b: { clip: 'ih_after', from: 0, label: 'after' } }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ih_before_tall', from: 0, label: 'before' },
      { type: 'graph', title: 'hair jitter, standing still', unit: 'mm', dur: 6, revealDur: 4,
        series: [{ label: 'one step per frame', clip: 'ih_before', f: m => m.hairJerk * 1000 }, { label: 'fixed 240 Hz steps', clip: 'ih_after', f: m => m.hairJerk * 1000 }] }] },
    { say: 4, layers: [{ type: 'clip', clip: 'ih_after_tall', from: 0, label: 'after' }, { type: 'code', snip: ['const H = 1 / 240;', 10] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, tail: 1.2, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ih_before', from: 2, label: 'before' }, b: { clip: 'ih_after', from: 2, label: 'after' } }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'ih_wire', from: 4 }, { type: 'end' }] },
  ],
})
