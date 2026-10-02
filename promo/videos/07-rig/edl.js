({
  style: 'ink',
  titleCard: { kicker: 'How it works · The Diligent Shadow', title: 'Rigging her', hold: 3.0 },
  music: { level: 0.9, mix: 0.18, root: 48, drone: 0.1, pad: 0.07, piano: 0, boom: 0, beat: 0,
    chords: [{ at: 0, notes: [60, 67, 72, 74] }, { at: 19, notes: [57, 64, 69, 72] }, { at: 30, notes: [53, 60, 65, 72] }] },
  segments: [
    { say: 0, layers: [{ type: 'clip', clip: 'irig_skel', from: 0 }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
    { say: 1, layers: [{ type: 'clip', clip: 'irig_skel' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'irig_skel' }, { type: 'readout', clip: 'irig_skel', w: 440,
      rows: [['hip height', 'hipY'], ['thigh', 'thighA'], ['knee', 'kneeA'], ['lean', 'lean'], ['nod', 'nod'], ['upper arm', 'uA'], ['forearm', 'fA']] }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ik_ik', from: 0 }, { type: 'code', snip: ["const H = stageG.worldToLocal(bn('UpperLeg.' + side)", 5] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'irig_fingers', from: 0, ann: false }, { type: 'code', snip: ['// rotating about d × n', 2] }], sfx: [{ at: 0.3, type: 'blip' }] },
    { say: 5, tail: 1, layers: [{ type: 'clip', clip: 'irig_fingers' }] },
    { dur: 4.5, layers: [{ type: 'clip', clip: 'irig_skel', ann: false }, { type: 'end' }] },
  ],
})
