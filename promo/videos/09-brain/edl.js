({
  style: 'ink',
  titleCard: { kicker: 'Devlog · The Diligent Shadow', title: 'Her brain is a state machine', hold: 2.6 },
  music: { level: 0.9, mix: 0.18, root: 45, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [57, 64, 69, 72] }, { at: 14, notes: [53, 60, 65, 69] }, { at: 26, notes: [55, 62, 67, 71] }, { at: 38, notes: [57, 64, 69, 76] }] },
  segments: (() => {
    // the states, laid out on the wall above her; the one she is in is a block with its name cut out
    const nodes = [
      { id: 'rest', x: 180, y: 0, also: ['sitting'] }, { id: 'notice', x: 540, y: 0 }, { id: 'approach', x: 880, y: 0 },
      { id: 'home', x: 180, y: 150 }, { id: 'stomp', x: 540, y: 150 }, { id: 'kick', x: 880, y: 150 },
      { id: 'sulk', x: 180, y: 300 }, { id: 'giveupWalk', label: 'give up', x: 540, y: 300 }, { id: 'push', x: 880, y: 300 },
      { id: 'fakeRun', label: 'fake run', x: 180, y: 450 }, { id: 'stare', x: 540, y: 450 },
    ];
    const edges = [['rest', 'notice'], ['notice', 'approach'], ['approach', 'kick'], ['kick', 'home', 0.4], ['kick', 'push', 0.5], ['push', 'kick', 0.5], ['kick', 'giveupWalk'],
      ['giveupWalk', 'sulk'], ['sulk', 'fakeRun'], ['fakeRun', 'stare'], ['stare', 'giveupWalk', 0.5], ['stare', 'approach', -0.3], ['home', 'rest'], ['home', 'approach', 0.25],
      ['approach', 'home', 0.25], ['home', 'stomp'], ['stomp', 'approach'], ['sulk', 'notice', -0.4]];
    const D = (from, speed = 1) => ({ type: 'diagram', y: 190, nodes, edges, modeClip: 'ibrain_run', modeFrom: from, speed });
    const C = (from, speed = 1) => ({ type: 'clip', clip: 'ibrain_run', from, speed });
    return [
      { say: 0, layers: [C(0)], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
      { say: 1, layers: [C(0.8), D(0.8)] },
      { say: 2, layers: [C(8.0), D(8.0)] },
      { say: 3, layers: [C(18.6, 2.0), D(18.6, 2.0)] },
      { say: 4, layers: [C(29.3, 0.6), D(29.3, 0.6)] },
      { say: 5, layers: [C(32.3), D(32.3)] },
      { say: 6, tail: 1, layers: [C(42.3), D(42.3), { type: 'code', snip: ['function afterKick()', 6] }], sfx: [{ at: 0.3, type: 'blip' }] },
      { dur: 4.5, layers: [C(49), { type: 'end' }] },
    ];
  })(),
})
