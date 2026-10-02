({
  // cinematic: no header; the score carries it
  music: { level: 1, mix: 0.75, root: 45, drone: 0.2, pad: 0.12, piano: 0.3, boom: 0.6, beat: 0.4, air: 0.15,
    chords: [{ at: 0, notes: [57, 60, 64], level: 0.6 }, { at: 13.5, notes: [53, 57, 60, 65] }, { at: 21.5, notes: [50, 57, 62, 65] }, { at: 29, notes: [52, 56, 59, 64] }, { at: 33.5, notes: [57, 60, 64, 69] }, { at: 38.5, notes: [53, 57, 60, 64] }],
    notes: [{ at: 2.4, m: 76, v: 0.35 }, { at: 4.6, m: 72, v: 0.3 }, { at: 7.4, m: 69, v: 0.4 }, { at: 9.6, m: 71, v: 0.3 }, { at: 11.6, m: 64, v: 0.3 },
      { at: 15.6, m: 81, v: 0.5, decay: 4 }, { at: 17.6, m: 72, v: 0.35 }, { at: 19.6, m: 76, v: 0.35 },
      { at: 22, m: 69, v: 0.4 }, { at: 25, m: 67, v: 0.35 }, { at: 28, m: 64, v: 0.35 }, { at: 29.6, m: 83, v: 0.25 }, { at: 31.2, m: 80, v: 0.25 },
      { at: 33.5, m: 57, v: 0.4 }, { at: 33.8, m: 64, v: 0.4 }, { at: 34.1, m: 69, v: 0.4 }, { at: 34.4, m: 72, v: 0.45, decay: 4 },
      { at: 38.7, m: 65, v: 0.35, decay: 4 }, { at: 39.4, m: 69, v: 0.35, decay: 4 }, { at: 40.1, m: 72, v: 0.35, decay: 4 }, { at: 40.8, m: 76, v: 0.4, decay: 5 }],
    booms: [{ at: 15.4, v: 0.8 }, { at: 39.0, v: 0.4 }], swells: [{ at: 13.6, len: 2.6, v: 0.6 }, { at: 32, len: 2, v: 0.4 }],
    pulse: [{ from: 21.5, to: 33, every: 1.05, v: 0.5 }] },
  segments: [
    { dur: 7, say: 0, lead: 2.4, tail: 0.3, layers: [{ type: 'clip', clip: 'vis_wide_dark', from: 0 }] },
    { dur: 6.5, say: 1, lead: 1.3, tail: 0.3, layers: [{ type: 'clip', clip: 'vis_switch_orbit', from: 0 }] },
    { dur: 8, say: 2, lead: 3.2, tail: 0.3, layers: [{ type: 'clip', clip: 'vis_turn_on', from: 0.8 }], sfx: [{ at: 1.75, type: 'click', vol: 0.8 }] },
    { dur: 7.5, say: 3, lead: 2.0, tail: 0.3, layers: [{ type: 'clip', clip: 'vis_held', from: 0 }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'vis_dent', from: 0.4 }] },
    { dur: 5, layers: [{ type: 'clip', clip: 'vis_wide_lit', from: 0 }] },
    { dur: 7, layers: [{ type: 'clip', clip: 'vis_wide_lit' }, { type: 'end' }] },
  ],
})
