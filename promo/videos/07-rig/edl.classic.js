({
  tag: 'HOW IT WORKS · THE DILIGENT SHADOW', title: 'Rigging her',
  music: { level: 0.9, mix: 0.18, root: 48, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [60, 67, 72, 74] }, { at: 19, notes: [57, 64, 69, 72] }, { at: 30, notes: [53, 60, 65, 72] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'rig_skel', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'rig_skel' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'rig_skel' }, { type: 'code', snip: ['const stand = withHip(', 1], y: 1430, size: 16, h: 150 }] },
    { say: 3, layers: [{ type: 'clip', clip: 'rig_ik', from: 0, rect: [0, 200, 1080, 900] }, { type: 'code', snip: ['function solveLeg(side, A, fwd', 8], y: 1130, size: 18 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'rig_fingers', from: 0, rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ['// rotating about d × n', 2], y: 1240, size: 19, h: 200 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'rig_fingers', rect: [0, 200, 1080, 1400] }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'rig_skel', from: 6 }, { type: 'end' }] },
  ],
})
