({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'Smoothing her out', hold: 3.0 },
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 76] }, { at: 19, notes: [53, 60, 65, 72] }, { at: 32, notes: [55, 62, 67, 74] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ism_kick_tall', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ism_before', from: 0, label: 'before' }, b: { clip: 'ism_after', from: 0, label: 'after' } }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ism_kick_tall' }, { type: 'graph', title: 'Her lean through a kick', unit: 'lean', dur: 3, revealDur: 3,
        series: [{ label: 'the pose', clip: 'ism_kick_tall', from: 0.5, f: m => m.raw + 0.3 }, { label: 'what she does', clip: 'ism_kick_tall', from: 0.5, f: m => m.smooth + 0.3 }] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ik_ik', from: 0 }, { type: 'code', snip: ['// the upper body follows the pose through a short', 3] }] },
    { say: 4, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ism_spine_before', from: 0, label: 'before' }, b: { clip: 'ism_spine_after', from: 0, label: 'after' } }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'ism_sit', from: 0.5 }, { type: 'code', snip: ['const WOB = {', 3] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'ism_sit' }, { type: 'end' }] },
  ],
})
