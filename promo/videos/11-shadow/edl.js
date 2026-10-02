({
  music: { level: 1, mix: 0.75, root: 50, drone: 0.2, pad: 0.12, piano: 0.3, boom: 0.6, beat: 0.4, air: 0.15,
    chords: [{ at: 0, notes: [50, 57, 62, 65], level: 0.6 }, { at: 7, notes: [46, 53, 58, 62] }, { at: 15, notes: [43, 50, 55, 58] }, { at: 20.5, notes: [38, 50, 57], level: 0.5 }, { at: 25, notes: [41, 53, 57, 60] }, { at: 31.5, notes: [50, 57, 62, 69] }],
    notes: [{ at: 1.6, m: 69, v: 0.35 }, { at: 3.0, m: 65, v: 0.3 }, { at: 4.4, m: 62, v: 0.35, decay: 4 },
      { at: 8.2, m: 74, v: 0.5, decay: 4 }, { at: 10.2, m: 72, v: 0.35 }, { at: 12.4, m: 69, v: 0.35 },
      { at: 18.4, m: 62, v: 0.3, decay: 5 }, { at: 21.8, m: 57, v: 0.3, decay: 5 },
      { at: 25.6, m: 74, v: 0.4 }, { at: 27.6, m: 77, v: 0.45, decay: 4 }, { at: 29.2, m: 81, v: 0.35 },
      { at: 32, m: 62, v: 0.35, decay: 4 }, { at: 32.6, m: 64, v: 0.35, decay: 4 }, { at: 33.2, m: 65, v: 0.35, decay: 4 }, { at: 33.8, m: 69, v: 0.4, decay: 5 }, { at: 36, m: 74, v: 0.35, decay: 5 }],
    booms: [{ at: 16.95, v: 0.9 }, { at: 30.4, v: 0.7 }], swells: [{ at: 6.8, len: 2.2, v: 0.5 }, { at: 24.4, len: 2, v: 0.5 }],
    pulse: [{ from: 8.6, to: 16.8, every: 0.9, v: 0.45 }] },
  segments: [
    { dur: 7, say: 0, lead: 1.6, tail: 0.3, layers: [{ type: 'clip', clip: 'sha_sit', from: 0 }] },
    { dur: 8, say: 1, lead: 2.2, tail: 0.3, layers: [{ type: 'clip', clip: 'sha_rise', from: 0 }], sfx: [{ at: 1.0, type: 'click', vol: 0.7 }] },
    { dur: 5.5, say: 2, lead: 0.9, tail: 0.3, layers: [{ type: 'clip', clip: 'sha_kick', from: 0 }], sfx: [{ at: 1.95, type: 'click', vol: 0.9 }] },
    { dur: 4.5, say: 3, lead: 1.6, tail: 0.3, layers: [{ type: 'clip', clip: 'sha_wide', from: 0 }] },
    { dur: 6.5, say: 4, lead: 2.6, tail: 0.3, layers: [{ type: 'clip', clip: 'sha_wide', from: 0.5 }], sfx: [{ at: 0.5, type: 'click', vol: 0.7 }, { at: 5.4, type: 'click', vol: 0.9 }] },
    { dur: 8, layers: [{ type: 'clip', clip: 'sha_wide' }, { type: 'end' }] },
  ],
})
