({
  tag: 'DEVLOG · THE DILIGENT SHADOW', title: 'Smoothing her out',
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 76] }, { at: 19, notes: [53, 60, 65, 72] }, { at: 32, notes: [55, 62, 67, 74] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'sm_after', from: 0, rect: [0, 200, 1080, 1400] }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'sm_before', from: 0, label: 'BEFORE · NO SMOOTHING' }, b: { clip: 'sm_after', from: 0, label: 'AFTER' } }] },
    { say: 2, layers: [{ type: 'graph', y: 220, h: 560, title: 'Her lean through a kick', unit: 'lean', dur: 3, revealDur: 3,
        series: [{ label: 'pose (raw)', color: '#ff5a6e', clip: 'sm_after', from: 0.5, f: m => m.raw + 0.3 }, { label: 'what she does (filtered)', color: '#54e08a', clip: 'sm_after', from: 0.5, f: m => m.smooth + 0.3 }] },
      { type: 'code', snip: ['function smoothDamp(cur, target, st, smoothTime', 10], y: 840, size: 18 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'rig_ik', from: 0, rect: [0, 200, 1080, 900] }, { type: 'code', snip: ['// the upper body follows the pose through a short', 3], y: 1130, size: 18, h: 260 }] },
    { say: 4, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'sm_spine_before', from: 0, label: 'BEFORE · ONE PLANK' }, b: { clip: 'sm_spine_after', from: 0, label: 'AFTER · SPRINGS' } }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'sm_sit', from: 0.5, rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ['const WOB = {', 7], y: 1230, size: 17, h: 380 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'sm_sit', from: 4.5, rect: [0, 0, 1080, 1920] }, { type: 'end' }] },
  ],
})
