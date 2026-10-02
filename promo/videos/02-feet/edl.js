({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'Planted feet', hold: 3.0 },
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 71] }, { at: 14, notes: [53, 60, 65, 69] }, { at: 30, notes: [55, 62, 67, 71] }, { at: 42, notes: [57, 64, 69, 72] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'ik_walk_before_tall', from: 0, label: 'BEFORE · RECREATION', labelY: 470 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ik_walk_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'ik_walk_after', from: 0, label: 'AFTER' } }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ik_gait', from: 0, speed: 0.6 }, { type: 'code', snip: ['function footAt(phi, Af, G) {', 7] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ik_gait', from: 0, speed: 0.7 }, { type: 'code', snip: ['const GAIT = {', 1], typing: false }] },
    { say: 4, layers: [{ type: 'clip', clip: 'ik_ik', from: 0 }, { type: 'code', snip: ['function ik(hx, hy, ax, ay)', 6], size: 26 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'ik_turn_before', from: 0, label: 'BEFORE · RECREATION' }, b: { clip: 'ik_turn_after', from: 0, label: 'AFTER' } }] },
    { say: 6, layers: [{ type: 'clip', clip: 'ik_turn_after_tall', from: 0, speed: 0.6, ann: false }, { type: 'code', snip: ['const steps = Math.abs(d) > 0.9', 3], size: 26 },
      { type: 'stat', label: 'foot slip while turning', from: 96, to: 0.7, dp: 1, unit: ' mm', y: 330, note: '96 mm on the old code · 0.7 mm now' }] },
    { say: 7, tail: 1.2, layers: [{ type: 'clip', clip: 'ik_montage', from: 0, speed: 1.6 }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'ik_montage', speed: 1.0, ann: false }, { type: 'end' }] },
  ],
})
