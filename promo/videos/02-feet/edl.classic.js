({
  tag: 'DEVLOG · THE DILIGENT SHADOW', title: 'Planted feet',
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 71] }, { at: 14, notes: [53, 60, 65, 69] }, { at: 30, notes: [55, 62, 67, 71] }, { at: 42, notes: [57, 64, 69, 72] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'feet_walk_before', from: 0, rect: [0, 200, 1080, 1400], label: 'BEFORE · RECREATION' }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'feet_walk_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'feet_walk_after', from: 0, label: 'AFTER' } }] },
    { say: 2, layers: [{ type: 'clip', clip: 'feet_gait', from: 0, speed: 0.6, rect: [0, 200, 1080, 760] }, { type: 'code', snip: ['function footAt(phi, Af, G) {', 11], y: 990, size: 22 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'feet_gait', from: 0, speed: 0.7, rect: [0, 200, 1080, 1080] }, { type: 'code', snip: ['const GAIT = {', 1], y: 1320, size: 21, typing: false, h: 150 }] },
    { say: 4, layers: [{ type: 'clip', clip: 'rig_ik', from: 0, rect: [0, 200, 1080, 760] }, { type: 'code', snip: ['function ik(hx, hy, ax, ay)', 6], y: 990, size: 22 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, layers: [{ type: 'split', top: 200, h: 700, a: { clip: 'feet_turn_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'feet_turn_after', from: 0, label: 'AFTER' } }] },
    { say: 6, layers: [{ type: 'clip', clip: 'feet_turn_after', from: 0, speed: 0.6, rect: [0, 200, 1080, 760] }, { type: 'code', snip: ['const steps = Math.abs(d) > 0.9', 3], y: 990, size: 21, h: 230 },
      { type: 'stat', label: 'foot slip while turning', from: 96, to: 0.7, dp: 1, unit: ' mm', y: 1470, note: '96 mm measured on the old code · 0.7 mm now' }] },
    { say: 7, tail: 1.2, layers: [{ type: 'clip', clip: 'feet_montage', from: 0, speed: 1.6 }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'feet_montage', speed: 1.0 }, { type: 'end' }] },
  ],
})
