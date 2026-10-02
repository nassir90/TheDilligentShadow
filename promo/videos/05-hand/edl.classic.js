({
  tag: 'HOW IT WORKS · THE DILIGENT SHADOW', title: 'The visitor’s hand',
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 72] }, { at: 15, notes: [53, 60, 65, 69] }, { at: 28, notes: [55, 62, 67, 71] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'hand_wire', from: 0, rect: [0, 200, 1080, 1400] }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'hand_wire', rect: [0, 200, 1080, 1400] }] },
    { say: 2, layers: [{ type: 'clip', clip: 'hand_springs', from: 0, rect: [0, 200, 1080, 900] }, { type: 'code', snip: ['// fingertip glides to its target', 7], y: 1130, size: 20 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'hand_springs', rect: [0, 200, 1080, 900] }, { type: 'code', snip: ['s.yaw.step(', 4], y: 1130, size: 18, h: 300 }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'hand_dent', from: 0.3, rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ["bend('index-finger-phalanx-distal'", 2], y: 1240, size: 20, h: 200 }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'hand_fade', from: 0, rect: [0, 200, 1080, 1000] }, { type: 'code', snip: ['float fadeA = (1.0 - smoothstep(fadeInner, fadeOuter + 0.015', 1], y: 1240, size: 17, h: 160, title: 'hand shadow shader' }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'hand_dent', from: 3, rect: [0, 0, 1080, 1920] }, { type: 'end' }] },
  ],
})
