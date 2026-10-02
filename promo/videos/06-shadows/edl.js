({
  style: 'ink',
  titleCard: { kicker: 'How it works · The Diligent Shadow', title: 'The invisible cast', hold: 3.0 },
  music: { level: 0.9, mix: 0.2, root: 45, drone: 0.12, pad: 0.07, piano: 0.12, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 71] }, { at: 12, notes: [53, 60, 65, 72] }, { at: 26, notes: [55, 62, 67, 74] }],
    notes: [{ at: 1, m: 69, v: 0.4 }, { at: 12.5, m: 72, v: 0.35 }, { at: 26.5, m: 74, v: 0.35 }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ish_room', from: 0, ann: false }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'ish_room' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ish_reveal', from: 0 }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ish_reveal', ann: false }, { type: 'code', snip: ['const caster = (extra = {})', 1] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'ish_orbit', from: 0 }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'ish_credit', from: 0 }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'ish_credit' }, { type: 'end' }] },
  ],
})
