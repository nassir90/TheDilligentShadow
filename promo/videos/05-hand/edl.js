({
  style: 'ink',
  titleCard: { kicker: 'How it works · The Diligent Shadow', title: 'The visitor’s hand', hold: 2.4 },
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 72] }, { at: 15, notes: [53, 60, 65, 69] }, { at: 28, notes: [55, 62, 67, 71] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'iha_wire', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'iha_wire' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'iha_springs', from: 0 }, { type: 'code', snip: ['// fingertip glides to its target', 7] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'iha_springs' }, { type: 'code', snip: ['s.yaw.step(', 4] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'iha_dent', from: 0.3 }, { type: 'code', snip: ["bend('index-finger-phalanx-distal'", 2] }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'iha_fade', from: 0 }, { type: 'code', snip: ['float fadeA = (1.0 - smoothstep(fadeInner, fadeOuter + 0.015', 1] }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'iha_springs', from: 1, ann: false }, { type: 'end' }] },   // over the hand moving, not a still
  ],
})
