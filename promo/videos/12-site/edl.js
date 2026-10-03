({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'Building the site', hold: 3.0 },
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 76] }, { at: 19, notes: [53, 60, 65, 72] }, { at: 32, notes: [55, 62, 67, 74] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ish_room', from: 0, ann: false }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'site_zoom', from: 0 }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ish_credit', from: 0 }] },
    { say: 3, layers: [{ type: 'clip', clip: 'site_scroll', from: 0 }] },
    { say: 4, layers: [{ type: 'clip', clip: 'site_scroll' }, { type: 'code', snip: ['function pageDrop() {', 4] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'site_lag_before', from: 0, fy: 0.625, label: 'before' }, b: { clip: 'site_lag_after', from: 0, fy: 0.625, label: 'after' } }] },
    { say: 6, layers: [{ type: 'clip', clip: 'site_swipe', from: 0 }, { type: 'code', snip: ['if (!hitsPlinthFront()) return;', 3] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 7, layers: [{ type: 'clip', clip: 'site_end', from: 0 }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'site_end' }, { type: 'end' }] },
  ],
})
