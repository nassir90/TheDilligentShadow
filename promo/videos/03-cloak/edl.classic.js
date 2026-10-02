({
  tag: 'DEVLOG · THE DILIGENT SHADOW', title: 'The cloak that wouldn’t sit still',
  music: { level: 0.9, mix: 0.18, root: 43, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [55, 62, 67, 70] }, { at: 17, notes: [51, 58, 63, 67] }, { at: 34, notes: [53, 60, 65, 69] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'cloak_boot_before', from: 0, speed: 0.5, rect: [0, 200, 1080, 1400], label: 'BEFORE' }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'cloak_boot_before', from: 0, speed: 0.4, label: 'BEFORE · page load' }, b: { clip: 'cloak_boot_after', from: 0, speed: 0.4, label: 'AFTER · page load' } }] },
    { say: 2, layers: [{ type: 'clip', clip: 'cloak_boot_before', from: 0, speed: 0.4, rect: [0, 200, 1080, 760], label: 'BEFORE' },
      { type: 'graph', y: 1000, h: 560, title: 'Cloak speed after the page loads', unit: 'mm/s', dur: 3, ymax: 700, revealDur: 3,
        series: [{ label: 'before', color: '#ff5a6e', clip: 'cloak_boot_before', f: m => m.cloak * 30000 }, { label: 'after', color: '#54e08a', clip: 'cloak_boot_after', f: m => m.cloak * 30000 }] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'cloak_preroll', from: 0, speed: 0.6, rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ['function settleCloth() {', 11], y: 1230, size: 19, h: 400 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'cloak_pops_before', from: 1.5, rect: [0, 200, 1080, 1400], label: 'BEFORE' }] },
    { say: 5, layers: [{ type: 'clip', clip: 'cloak_pops_after', from: 1.5, rect: [0, 200, 1080, 760], label: 'AFTER' }, { type: 'code', snip: ['// static friction: cloth resting', 6], y: 990, size: 20 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 6, tail: 1, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'cloak_pops_before', from: 1.5, label: 'BEFORE' }, b: { clip: 'cloak_pops_after', from: 1.5, label: 'AFTER' } }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'cloak_pops_after', from: 3, rect: [0, 0, 1080, 1920] }, { type: 'end' }] },
  ],
})
