// "ink" restyle clips for Planted feet: no drawing baked into the frames; annotations (footprints, callouts, leg
// lines) are saved per frame in clip pixels and drawn by compose.js at output scale with the inversion rule.
(() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const FOOTS = { R: 'LowerLeg.R_end', L: 'LowerLeg.L_end' };
  // per-foot contact tracking: footprints, whether each foot is planted / sliding / lifted, slip of the current contact
  function feet() {
    const st = { prints: [], c: { R: null, L: null }, last: {}, maxSlip: 0 };
    return {
      st,
      step(t, H, P) {
        const out = {};
        for (const side of ['R', 'L']) {
          const a = H.bonePos(FOOTS[side]), l = stageG.worldToLocal(a.clone()), wall = H.onWall(a), down = l.y < ANKLE_H + 0.004, flat = l.y < ANKLE_H + 0.0008;
          if (down) st.prints.push({ p: wall, t, side });
          if (flat) { if (!st.c[side]) st.c[side] = l.clone(); } else if (!down) st.c[side] = null;
          const slip = st.c[side] ? Math.hypot(l.x - st.c[side].x, l.z - st.c[side].z) : 0;
          if (flat) st.maxSlip = Math.max(st.maxSlip, slip);
          const moved = st.last[side] ? Math.hypot(l.x - st.last[side].x, l.z - st.last[side].z) : 0; st.last[side] = l.clone();
          const [x, y] = P(wall);
          out[side] = { x, y, down, flat, slip, state: !down ? 'lifted' : moved > 0.0006 ? 'sliding' : 'planted' };
        }
        st.prints = st.prints.filter(q => t - q.t < 3);
        return out;
      },
      prints(t, P) { return st.prints.map(q => { const [x, y] = P(q.p); return { k: 'dot', x, y: y + 6, r: 8, fill: q.side === 'R', o: 1 - (t - q.t) / 3 }; }); },
    };
  }
  const mm = v => (v * 1000).toFixed(1);
  // full height: a level camera on her shins, so her legs fill the top half and the ledge below takes the code
const lowCam = (x, d = 1.0, fov = 36) => (t, H) => { const at = H.wallPt(x, 0.035); return { pos: V(at.x, at.y, at.z + d), at, fov }; };

  const walk = (name, h, mods) => { const f = feet(); return { name, w: 1080, h, dur: 10, mods,
    setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'home'; S.t = 0; },
    cam: h > 1000 ? lowCam(-0.43, 1.05) : (t, H) => H.wallCam(-0.43, 0.12, 0.66, 36),
    overlay(g, t, P, H, m) {
      const ft = f.step(t, H, P), ann = f.prints(t, P);
      for (const side of ['R', 'L']) { const s = ft[side]; if (!s.down) continue;
        ann.push({ k: 'call', id: side, x: s.x, y: s.y, r: 30, dx: side === 'R' ? 150 : -150, dy: side === 'R' ? -170 : -260, text: s.state === 'sliding' ? `sliding ${mm(s.slip)} mm` : `planted ${mm(s.slip)} mm` }); }
      m.ann = ann; m.slip = f.st.maxSlip;
    } }; };
  const turnClip = (name, h, mods) => { const f = feet(); return { name, w: 1080, h, dur: 8, mods,
    setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x - 0.1, 1); S.mode = 'home'; S.t = 0; },
    // follows her once she has turned and walks off, so the shot never empties
    cam: (() => { let cx = null; return (t, H) => { cx = cx == null ? STRIKE.x - 0.1 : cx + (clamp(fig.x, -0.62, STRIKE.x - 0.1) - cx) * 0.08; return h > 1000 ? lowCam(cx, 0.9)(t, H) : H.wallCam(cx, 0.12, 0.45, 36); }; })(),
    overlay(g, t, P, H, m) {
      const ft = f.step(t, H, P), ann = f.prints(t, P);
      ann.push({ k: 'call', id: 'R', x: ft.R.x, y: ft.R.y, r: 30, dx: 160, dy: -200, text: ft.R.state });
      ann.push({ k: 'call', id: 'L', x: ft.L.x, y: ft.L.y, r: 30, dx: -160, dy: -300, text: ft.L.state });
      m.ann = ann; m.slip = f.st.maxSlip;
    } }; };

  window.CLIPS_INK = {
    '02-feet': [
      walk('ik_walk_before', 960, ['naiveWalk']), walk('ik_walk_after', 960, []), walk('ik_walk_before_tall', 1920, ['naiveWalk']),
      turnClip('ik_turn_before', 960, ['spinTurn']), turnClip('ik_turn_after', 960, []), turnClip('ik_turn_after_tall', 1920, []),
      (() => { const f = feet(); return { name: 'ik_gait', w: 1080, h: 1920, dur: 11, wireOnWall: true, wire: t => 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(t / 4 * Math.PI * 2)), wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'giveupWalk'; S.t = 0; },
        cam: (t, H) => { const x = clamp(fig.x, -0.62, -0.25), at = H.wallPt(x, 0.04); return { pos: V(at.x, at.y, at.z + 0.85), at, fov: 36 }; },
        overlay(g, t, P, H, m) {
          const ft = f.step(t, H, P), ann = f.prints(t, P);
          if (walker) for (const [L, side] of [['A', 'R'], ['B', 'L']]) {
            const s = walker.d / walker.S + OFFSETS[L], phi = s - Math.floor(s);
            const name = phi < GAIT.heelEnd ? 'heel strike' : phi < GAIT.heelOff ? 'foot flat' : phi < GAIT.toeOff ? 'toe off' : 'swing';
            ann.push({ k: 'call', id: side, x: ft[side].x, y: ft[side].y, r: 32, dx: side === 'R' ? 170 : -170, dy: side === 'R' ? -180 : -300, text: name });
          }
          m.ann = ann;
        } }; })(),
      { name: 'ik_ik', w: 1080, h: 1920, dur: 13, wireOnWall: true, wire: 0.35, wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'giveupWalk'; S.t = 0; },
        cam: (t, H) => { const x = clamp(fig.x, -0.62, -0.25), at = H.wallPt(x, 0.0), c = H.wallPt(x, 0.08); return { pos: V(c.x, c.y, c.z + 0.85), at: V(at.x, at.y, at.z + 0.14), fov: 36 }; },
        overlay(g, t, P, H, m) {
          const ann = [], pt = n => P(H.onWall(H.bonePos(n))).slice(0, 2);   // on the shadow, like the wireframe
          for (const s of ['R', 'L']) ann.push({ k: 'line', w: 5, pts: [pt(`UpperLeg.${s}`), pt(`LowerLeg.${s}`), pt(`LowerLeg.${s}_end`)] });
          const [hx, hy] = pt('UpperLeg.R'), [ax, ay] = pt('LowerLeg.R_end');
          ann.push({ k: 'call', id: 'hip', x: hx, y: hy, r: 26, dx: -190, dy: -150, text: 'hip joint' });
          ann.push({ k: 'call', id: 'ankle', x: ax, y: ay, r: 30, dx: 230, dy: 45, text: 'planted ankle' });   // out to the side: clear of the leg lines and the code box
          m.ann = ann;
        } },
      (() => { const f = feet(); return { name: 'ik_montage', w: 1080, h: 1920, dur: 20,
        setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 2; },
        cam: (() => { let cx = null; return (t, H) => { const want = clamp(fig.x, -0.6, -0.27); cx = cx == null ? want : cx + (want - cx) * 0.06; const at = H.wallPt(cx, 0.12), c = H.wallPt(cx, 0.2); return { pos: V(c.x, c.y + 0.03, c.z + 1.05), at, fov: 36 }; }; })(),
        overlay(g, t, P, H, m) {
          const ft = f.step(t, H, P), ann = f.prints(t, P), [hx, hy] = P(H.bonePos('Hips'));
          ann.push({ k: 'call', id: 'mode', x: hx, y: hy, r: 40, dx: 200, dy: -330, text: S.mode });
          const pl = ft.R.flat ? ft.R : ft.L.flat ? ft.L : null;
          if (pl) ann.push({ k: 'call', id: 'slip', x: pl.x, y: pl.y, r: 30, dx: -200, dy: 160, text: `max slip ${mm(f.st.maxSlip)} mm` });
          m.ann = ann; m.slip = f.st.maxSlip;
        } }; })(),
    ],
  };

  // ---- shared bits for the cloak, hair and hand videos ----
  const wave = (t, p = 5) => 0.5 - 0.5 * Math.cos(t / p * Math.PI * 2);
  const fixedAt = o => { let at = null; return (t, H) => { if (!at) { at = H.bonePos(o.bone || 'Hips'); at.x += o.dxAt || 0; at.y += o.lookY || 0; } return { pos: at.clone().add(V(o.dx, o.dy, o.dz)), at, fov: o.fov || 40 }; }; };
  const seatedTall = () => fixedAt({ dx: 0.46, dy: 0.04, dz: 0.66, fov: 46, lookY: -0.05, dxAt: -0.01 });
  const seatedHalf = () => fixedAt({ dx: 0.38, dy: 0.05, dz: 0.5, fov: 36, lookY: -0.05, dxAt: -0.02 });
  const bootBefore = H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; cloak.lastA = null; hair.lastA = null; };
  const bootAfter = H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; settleCloth(); };
  // cloak points that moved more than 2 mm in a frame (a "pop"): dots on each, and a callout counting them
  function pops() {
    let last = null;
    return (g, t, P, H, m) => {
      const Pt = cloak.pts, out = [];
      if (last) for (let i = 0; i < Pt.length; i += 3) if (Math.hypot(Pt[i] - last[i], Pt[i + 1] - last[i + 1], Pt[i + 2] - last[i + 2]) > 0.002) out.push(i);
      last = Float32Array.from(Pt);
      const ann = out.map(i => { const [x, y] = P(stageG.localToWorld(V(Pt[i], Pt[i + 1], Pt[i + 2]))); return { k: 'dot', x, y, r: 7 }; });
      const seat = P(stageG.localToWorld(V((rig.seat.front + rig.seat.back) / 2 + 0.02, SEAT_Y, 0)));
      ann.push({ k: 'call', id: 'pops', x: seat[0], y: seat[1], r: 40, dx: 200, dy: -330, text: out.length ? `${out.length} popping` : 'still' });
      m.ann = ann; m.pops = out.length;
    };
  }
  const hairTall = (t, H) => { const h = H.bonePos('Head'); return { pos: h.clone().add(V(0.26, 0.0, 0.36)), at: h.clone().add(V(-0.025, -0.06, 0)), fov: 44 }; };
  const hairHalf = (t, H) => { const h = H.bonePos('Head'); return { pos: h.clone().add(V(0.2, 0.02, 0.26)), at: h.clone().add(V(-0.025, -0.03, 0)), fov: 32 }; };
  const noisy = () => { let s = 3; return () => { s = (s * 16807) % 2147483647; return 1 / 30 * (0.55 + 0.9 * (s / 2147483647)); }; };
  const standStill = H => { H.lights(true); H.hold(true); H.stand(-0.45, 1); S.mode = 'stare'; S.t = 0; S.dur = 99; };
  const plinthTall = (u = 0) => ({ pos: V(SW.x + 0.05, PLINTH.h + 0.3, SW.z + 0.58 - 0.05 * u), at: V(SW.x + 0.03, PLINTH.h + 0.0, SW.z - 0.02), fov: 50 });
  const lissajous = (t, sp = 1) => V(SW.x + 0.11 * Math.sin(t * 1.1 * sp), PLINTH.h + 0.07 + 0.03 * Math.sin(t * 1.7 * sp + 1), SW.z + 0.06 * Math.sin(t * 0.8 * sp + 2));
  const seatedQuiet = H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; };
  const heldKicks = H => { H.lights(true); H.stand(STRIKE.x, 1); H.hold(true); S.mode = 'kick'; S.t = -0.2; S.hit = false; S.fails = 1; S.patience = 99; };

  Object.assign(window.CLIPS_INK, {
    '03-cloak-old': [
      { name: 'ic_boot_before', w: 1080, h: 1920, dur: 5, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedTall() },
      { name: 'ic_boot_before_half', w: 1080, h: 960, dur: 5, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedHalf() },
      { name: 'ic_pops_before', w: 1080, h: 1920, dur: 13, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedTall(), overlay: pops() },
      { name: 'ic_pops_before_half', w: 1080, h: 960, dur: 10, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedHalf(), overlay: pops() },
    ],
    '03-cloak': [
      { name: 'ic_boot_after_half', w: 1080, h: 960, dur: 5, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedHalf() },
      { name: 'ic_pops_after', w: 1080, h: 1920, dur: 12, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedTall(), overlay: pops() },
      { name: 'ic_pops_after_half', w: 1080, h: 960, dur: 10, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedHalf(), overlay: pops() },
      { name: 'ic_preroll', w: 1080, h: 1920, dur: 10, wire: 1, wireTags: ['cloak', 'chair', 'figure'],
        setup: H => { H.lights(true); H.hold(false); S.minSit = 999; S.wait = 999; S.mode = 'rest'; rig.upper = null; const { x, pose } = sitPose(0, POSES.sitRest); fig.x = x; fig.pose = pose; fig.face = 1; rig.yaw = Math.PI / 2; applyFigure(1 / 60); hair.lastA = cloak.lastA = null; },
        manual(t) { const u = clamp((t - 1.0) / 2.4, 0, 1); for (let i = 0; i < 2; i++) { const { x, pose } = sitPose(u, POSES.sitRest); fig.x = x; fig.pose = pose; applyFigure(1 / 60); hair.step(1 / 60); cloak.step(1 / 60); } },
        cam: fixedAt({ dx: 0.75, dy: 0.0, dz: 0.95, fov: 46, lookY: -0.1, dxAt: 0.08 }),
        overlay(g, t, P, H, m) { const [x, y] = P(H.bonePos('Hips')); m.ann = [{ k: 'call', id: 'phase', x, y, r: 40, dx: 230, dy: -300, text: t < 1 ? 'stand, let it hang' : t < 3.4 ? 'sit down' : 'settle' }]; } },
    ],
    '04-hair': [
      { name: 'ih_wire', w: 1080, h: 1920, dur: 16, prerun: 3, hide: ['cloak'], solid: t => wave(t, 4) < 0.5, wire: t => 0.35 + 0.65 * wave(t, 4), wireTags: ['hair', 'figure'], setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: hairTall },
      ...[['before', ['rawCloth']], ['after', []]].flatMap(([k, mods]) => [
        { name: `ih_${k}`, w: 1080, h: 960, dur: 9, prerun: 3, hide: ['cloak'], solid: true, mods, dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: standStill, cam: hairHalf },
        { name: `ih_${k}_tall`, w: 1080, h: 1920, dur: 23, prerun: 3, hide: ['cloak'], solid: true, mods, dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: standStill, cam: hairTall },
      ]),
    ],
    '05-hand': [
      { name: 'iha_wire', w: 1080, h: 1920, dur: 15, wire: t => wave(t, 3.5), wireTags: ['hand'], setup: seatedQuiet, handPath: t => lissajous(t, 0.6), cam: () => plinthTall() },
      { name: 'iha_springs', w: 1080, h: 1920, dur: 18, setup: seatedQuiet, handPath: t => lissajous(t, 1.9), cam: () => plinthTall(0.5),
        overlay(g, t, P, H, m) { const [x, y] = P(hand.target); m.ann = [{ k: 'call', id: 'target', x, y, r: 30, dx: -230, dy: -200, text: 'where it’s sent' }]; } },
      { name: 'iha_dent', w: 1080, h: 1920, dur: 9, setup: heldKicks,
        cam: t => { const tip = leverTipWorld(V()); return { pos: tip.clone().add(V(-0.14 + 0.012 * t / 8, 0.05, 0.19)), at: tip.clone().add(V(0.01, -0.025, 0)), fov: 42 }; } },
      { name: 'iha_fade', w: 1080, h: 1920, dur: 8, setup: seatedQuiet, handPath: t => lissajous(t, 0.5),
        cam: () => ({ pos: V(SW.x - 0.34, PLINTH.h + 0.17, SW.z + 0.32), at: V(SW.x + 0.04, PLINTH.h + 0.0, SW.z), fov: 50 }),
        overlay(g, t, P, H, m) { if (hand.alpha < 0.5) { m.ann = []; return; } const [x, y] = P(hand.bones.wrist.getWorldPosition(V())); m.ann = [{ k: 'call', id: 'wrist', x, y, r: 36, dx: 200, dy: -230, text: 'fades out' }]; } },
    ],
  });

  // ---- shared bits for the invisible cast, rigging, smoothing and state machine videos ----
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const xy = p => p.slice(0, 2);
  const inFrame = (p, w, h, m = 40) => p[2] < 1 && p[0] > m && p[0] < w - m && p[1] > m && p[1] < h - m;
  const approach = H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; };
  const BONES = [['Hips', 'Abdomen'], ['Abdomen', 'Torso'], ['Torso', 'Chest'], ['Chest', 'Neck'], ['Neck', 'Head'], ['Head', 'Head_end'],
    ...['L', 'R'].flatMap(s => [['Chest', `Shoulder.${s}`], [`Shoulder.${s}`, `UpperArm.${s}`], [`UpperArm.${s}`, `LowerArm.${s}`], [`LowerArm.${s}`, `Wrist.${s}`],
      ['Hips', `UpperLeg.${s}`], [`UpperLeg.${s}`, `LowerLeg.${s}`], [`LowerLeg.${s}`, `LowerLeg.${s}_end`], [`LowerLeg.${s}_end`, `Foot.${s}`]])];
  const skeleton = (P, H) => { const ann = [], seen = new Set();
    for (const [a, b] of BONES) { if (!bn(a) || !bn(b)) continue; ann.push({ k: 'line', w: 4, pts: [xy(P(H.bonePos(a))), xy(P(H.bonePos(b)))] });
      for (const n of [a, b]) if (!seen.has(n)) { seen.add(n); const [x, y] = P(H.bonePos(n)); ann.push({ k: 'dot', x, y, r: 7 }); } }
    return ann; };
  const SPINE = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'Head_end'];
  const spine = (P, H) => { const pts = SPINE.map(n => xy(P(H.onWall(H.bonePos(n))))); return [{ k: 'line', w: 5, pts }, ...pts.map(([x, y]) => ({ k: 'dot', x, y, r: 8 }))]; };
  const trail = () => { const tr = []; return (P, H) => { tr.push(H.onWall(H.bonePos('Head'))); if (tr.length > 24) tr.shift(); const pts = tr.map(p => xy(P(p))), [x, y] = pts[pts.length - 1]; return [{ k: 'line', w: 5, pts }, { k: 'dot', x, y, r: 9 }]; }; };
  const kickCam = (fov = 36) => (t, H) => H.wallCam(STRIKE.x + 0.03, 0.24, 0.85, fov);
  const leanMeta = m => { m.raw = fig.pose.lean; m.smooth = rig.upper ? rig.upper.lean.x : fig.pose.lean; };
  const castCall = (P, H, w, h) => {   // her body, hair, cloak and the chair, in 3D
    const ann = [], add = (id, v, dx, dy, text) => { const p = P(v); if (inFrame(p, w, h)) ann.push({ k: 'call', id, x: p[0], y: p[1], r: 34, dx, dy, text }); };
    const c = cloak.pts, i = 3 * Math.floor(c.length / 6);
    add('hair', H.bonePos('Head_end'), -210, -170, 'her hair');
    add('body', H.bonePos('Chest'), 230, -120, 'her body');
    add('cloak', stageG.localToWorld(V(c[i], c[i + 1], c[i + 2])), -230, 120, 'her cloak');
    if (typeof chair !== 'undefined' && chair) add('chair', chair.getWorldPosition(V()), 220, 160, 'the chair');
    return ann;
  };

  Object.assign(window.CLIPS_INK, {
    '06-shadows': [
      { name: 'ish_room', w: 1080, h: 1920, dur: 16, setup: approach,
        cam: t => ({ pos: V(0.1, 1.85, 6.2 - 0.6 * ease(t / 16)), at: V(0, 1.75, -1), fov: 46 }),
        overlay(g, t, P, H, m) { const ann = [], L = P(H.lampPos()), s = P(H.onWall(H.bonePos('Chest')));
          if (inFrame(L, 1080, 1920)) ann.push({ k: 'call', id: 'lamp', x: L[0], y: L[1], r: 34, dx: -200, dy: -200, text: 'the lamp' });
          if (inFrame(s, 1080, 1920)) ann.push({ k: 'call', id: 'shadow', x: s[0], y: s[1], r: 40, dx: 200, dy: 240, text: 'her shadow' });
          m.ann = ann; } },
      { name: 'ish_reveal', w: 1080, h: 1920, dur: 22, wire: t => wave(t, 4), wireTags: ['figure', 'cloak', 'hair', 'chair'], setup: approach,
        cam: t => ({ pos: V(-0.1 + 0.25 * Math.sin(t * 0.25), 1.8, -3.86 + 1.55), at: V(-0.45, 1.74, -3.92), fov: 38 }),
        overlay(g, t, P, H, m) { m.ann = castCall(P, H, 1080, 1920); } },
      { name: 'ish_orbit', w: 1080, h: 1920, dur: 12, solid: t => Math.sin(t * 0.7) > 0, wire: t => 1 - 0.5 * wave(t, 4.5), wireTags: ['figure', 'cloak', 'hair', 'chair'],
        setup: H => { H.lights(true); H.hold(true); H.seat('headInHands', 'sulk'); S.minSit = 999; S.wait = 999; S.fakeIn = 999; },
        cam: t => { const c = V(-0.76, 1.72, -3.88), a = -1.15 + 0.9 * t / 12; return { pos: c.clone().add(V(Math.sin(a) * 0.9, 0.12, Math.cos(a) * 0.9)), at: c, fov: 40 }; },
        // the ray from the lamp, through her head, to its shadow on the wall
        overlay(g, t, P, H, m) { const L = H.lampPos(), head = H.bonePos('Head'), sh = H.onWall(head), dir = head.clone().sub(L).normalize();
          const a = P(head.clone().addScaledVector(dir, -0.6)), b = P(sh);
          m.ann = [{ k: 'line', w: 3, dash: [14, 10], pts: [xy(a), xy(b)] }, { k: 'call', id: 'light', x: a[0], y: a[1], r: 26, dx: 160, dy: -170, text: 'light from the lamp' },
            { k: 'call', id: 'shadow', x: b[0], y: b[1], r: 30, dx: -170, dy: 190, text: 'shadow' }]; } },
      { name: 'ish_credit', w: 1080, h: 1920, dur: 14, credit: true, setup: seatedQuiet,
        cam: t => ({ pos: V(SW.x, 1.2, 1.22), at: V(SW.x, 1.16 - 0.3 * ease(t / 14), -4), fov: 62 }) },
    ],
    '07-rig': [
      { name: 'irig_skel', w: 1080, h: 1920, dur: 50, wire: t => 0.15 + 0.6 * wave(t, 4), wireTags: ['figure'], solid: t => wave(t, 4) < 0.5, setup: approach,
        cam: (t, H) => { const c = H.wallPt(clamp(fig.x, -0.6, -0.25), 0.25); return { pos: c.clone().add(V(0.35, 0.02, 1.25)), at: c.clone().add(V(0, -0.1, 0.14)), fov: 48 }; },
        overlay(g, t, P, H, m) { m.ann = skeleton(P, H); } },
      { name: 'irig_fingers', w: 1080, h: 1920, dur: 22, solid: true, clayColor: 0x5a4438, wire: t => 0.6 * wave(t, 3.5), wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(false); H.stand(-0.45, 1); S.mode = 'stare'; S.t = 0; S.dur = 99; REC._grip = gripFor; gripFor = () => [0.5 - 0.5 * Math.cos(REC.t * 1.4), 0.3]; },
        after: () => { gripFor = REC._grip; },
        cam: (t, H) => { const w = H.bonePos('Wrist.R'), mid = H.bonePos('Middle2.R'), c = w.clone().lerp(mid, 0.5); return { pos: c.clone().add(V(0.02, 0.03, 0.17)), at: c.clone().add(V(0, -0.02, 0)), fov: 40 }; },
        overlay(g, t, P, H, m) { const [x, y] = P(H.bonePos('Middle2.R')); m.grip = 0.5 - 0.5 * Math.cos(t * 1.4); m.ann = [{ k: 'call', id: 'grip', x, y, r: 40, dx: 230, dy: -260, text: `grip ${m.grip.toFixed(2)}` }]; } },
    ],
    '08-smoothing': [
      ...[['before', ['noSmooth', 'noWobble']], ['after', []]].map(([k, mods]) => { const tr = trail(); return { name: `ism_${k}`, w: 1080, h: 960, dur: 9, mods, setup: heldKicks, cam: kickCam(),
        overlay(g, t, P, H, m) { m.ann = tr(P, H); leanMeta(m); } }; }),
      (() => { const tr = trail(); return { name: 'ism_kick_tall', w: 1080, h: 1920, dur: 22, setup: heldKicks, cam: kickCam(58),
        overlay(g, t, P, H, m) { m.ann = tr(P, H); leanMeta(m); } }; })(),
      ...[['before', ['noWobble']], ['after', []]].map(([k, mods]) => ({ name: `ism_spine_${k}`, w: 1080, h: 960, dur: 11, mods, setup: approach, cam: (t, H) => H.wallCam(-0.42, 0.22, 1.05, 36),
        overlay(g, t, P, H, m) { m.ann = spine(P, H); } })),
      { name: 'ism_sit', w: 1080, h: 1920, dur: 16, setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X + 0.25, -1); S.mode = 'home'; S.t = 0; S.minSit = 999; S.wait = 999; },
        cam: (t, H) => H.wallCam(SIT_X + 0.12, 0.2, 1.0, 38), overlay(g, t, P, H, m) { m.ann = spine(P, H); } },
    ],
    '09-brain': [
      { name: 'ibrain_run', w: 1080, h: 1920, dur: 80,
        setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 0; S.t = 99; S.wait = null; REC._b = { pushed: false, faked: false, stage: 0 }; },
        update(t, H) {
          const b = REC._b;
          if (b.stage === 0 && t > 0.6) { setOn(true, 'key'); S.wait = 0.8; b.stage = 1; }
          if (b.stage === 1 && S.mode === 'home' && t > 8) { setOn(true, 'key'); H.hold(true); S.patience = 4; b.stage = 2; }
          if (b.stage === 2 && S.mode === 'kick' && S.fails === 1 && !b.pushed && S.t > KICK.dur * 0.97) { S.mode = 'push'; S.t = -0.2; S.dur = 2.4; S.hit = false; b.pushed = true; }
          if (b.stage === 2 && S.mode === 'sulk' && S.t > 3.0 && !b.faked) { startRise('fakeRun', 0.45); b.faked = true; b.stage = 3; }
          if (b.stage === 3 && S.mode !== 'fakeRun' && S.mode !== 'stare' && S.mode !== 'sitting') { H.hold(false); setOn(false, 'key'); tilt = SW.maxTilt; b.stage = 4; b.t4 = t; }
          // flip it back and forth while she walks (each flip turns her round): three flips, and she loses her temper
          if (b.stage === 4 && S.mode === 'home' && walker && fig.x < STRIKE.x - 0.12) { b.stage = 5; b.flips = 0; b.last = t; }
          if (b.stage === 5 && b.flips < 3 && t - b.last > 0.8 && (S.mode === 'home' || S.mode === 'approach')) { setOn(!on, 'key'); tilt = on ? -SW.maxTilt : SW.maxTilt; b.flips++; b.last = t; }
        },
        // her and the switch in the lower half; the wall above takes the diagram
        cam: (t, H) => { const c = H.closeCam(0.4); return { pos: c.pos, at: c.at.clone().add(V(0, 0.33, 0)), fov: 46 }; } },
    ],
  });
})();
