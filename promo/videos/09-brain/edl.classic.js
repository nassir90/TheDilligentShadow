({
  tag: 'DEVLOG · THE DILIGENT SHADOW', title: 'Her brain is a state machine',
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 72] }, { at: 14, notes: [53, 60, 65, 69] }, { at: 26, notes: [55, 62, 67, 71] }, { at: 38, notes: [57, 64, 69, 76] }] },
  segments: (() => {
    const nodes = [
      { id: 'rest', x: 180, y: 40, also: ['sitting'] }, { id: 'notice', x: 540, y: 40 }, { id: 'approach', x: 880, y: 40 },
      { id: 'home', x: 180, y: 220 }, { id: 'stomp', x: 540, y: 220 }, { id: 'kick', x: 880, y: 220 },
      { id: 'sulk', x: 180, y: 400 }, { id: 'giveupWalk', x: 540, y: 400 }, { id: 'push', x: 880, y: 400 },
      { id: 'fakeRun', x: 180, y: 580 }, { id: 'stare', x: 540, y: 580 },
    ];
    const edges = [['rest', 'notice'], ['notice', 'approach'], ['approach', 'kick'], ['kick', 'home', 0.4], ['kick', 'push', 0.5], ['push', 'kick', 0.5], ['kick', 'giveupWalk'],
      ['giveupWalk', 'sulk'], ['sulk', 'fakeRun'], ['fakeRun', 'stare'], ['stare', 'giveupWalk', 0.5], ['stare', 'approach', -0.3], ['home', 'rest'], ['home', 'approach', 0.25],
      ['approach', 'home', 0.25], ['home', 'stomp'], ['stomp', 'approach'], ['sulk', 'notice', -0.4]];
    const D = (from, speed = 1) => ({ type: 'diagram', y: 250, nodes, edges, modeClip: 'brain_run', modeFrom: from, speed });
    const C = (from, speed = 1) => ({ type: 'clip', clip: 'brain_run', from, speed, rect: [0, 920, 1080, 720] });
    return [
      { say: 0, layers: [D(0), C(0)], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
      { say: 1, layers: [D(1.0), C(1.0)] },
      { say: 2, layers: [D(7.8), C(7.8)] },
      { say: 3, layers: [D(16.0, 2.0), C(16.0, 2.0)] },
      { say: 4, layers: [D(27.8), C(27.8)] },
      { say: 5, layers: [D(31.0, 1.25), C(31.0, 1.25)] },
      { say: 6, tail: 1, layers: [D(39.5), C(39.5), { type: 'code', snip: ['function afterKick()', 6], y: 1080, x: 40, w: 1000, size: 18, h: 300 }], sfx: [{ at: 0.3, type: 'blip' }] },
      { dur: 4.5, layers: [C(44, 1), { type: 'clip', clip: 'brain_run', from: 44, rect: [0, 0, 1080, 1920] }, { type: 'end' }] },
    ];
  })(),
})
