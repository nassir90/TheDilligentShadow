({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'The cloak that wouldn\u2019t sit still', hold: 3.2 },
  music: { level: 0.9, mix: 0.18, root: 43, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [55, 62, 67, 70] }, { at: 17, notes: [51, 58, 63, 67] }, { at: 34, notes: [53, 60, 65, 69] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ic_boot_before', from: 0, speed: 0.5, label: 'before', labelY: 1020 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ic_boot_before_half', from: 0, speed: 0.5, label: 'before' }, b: { clip: 'ic_boot_after_half', from: 0, speed: 0.5, label: 'after' } }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ic_boot_before', from: 0, speed: 0.4, label: 'before' },
      { type: 'graph', title: 'cloak speed after the page loads', unit: 'mm/s', dur: 3, ymax: 700, revealDur: 3,
        series: [{ label: 'before', clip: 'ic_boot_before', f: m => m.cloak * 30000 }, { label: 'after', clip: 'ic_boot_after_half', f: m => m.cloak * 30000 }] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ic_preroll', from: 0, speed: 0.75 }, { type: 'code', snip: ['function settleCloth() {', 11] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'ic_pops_before', from: 1.5, label: 'before' }] },
    { say: 5, layers: [{ type: 'clip', clip: 'ic_pops_after', from: 1.5, label: 'after' }, { type: 'code', snip: ['// static friction: cloth resting', 6] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 6, tail: 1, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ic_pops_before_half', from: 1.5, label: 'before' }, b: { clip: 'ic_pops_after_half', from: 1.5, label: 'after' } }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'ic_pops_after', from: 7, ann: false }, { type: 'end' }] },
  ],
})
