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

  const walk = (name, h, mods) => { const f = feet(); return { name, w: 1080, h, dur: 7.5, mods,
    setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'home'; S.t = 0; },
    cam: h > 1000 ? lowCam(-0.43, 1.05) : (t, H) => H.wallCam(-0.43, 0.12, 0.66, 36),
    overlay(g, t, P, H, m) {
      const ft = f.step(t, H, P), ann = f.prints(t, P);
      for (const side of ['R', 'L']) { const s = ft[side]; if (!s.down) continue;
        ann.push({ k: 'call', id: side, x: s.x, y: s.y, r: 30, dx: side === 'R' ? 150 : -150, dy: side === 'R' ? -170 : -260, text: s.state === 'sliding' ? `sliding ${mm(s.slip)} mm` : `planted ${mm(s.slip)} mm` }); }
      m.ann = ann; m.slip = f.st.maxSlip;
    } }; };
  const turnClip = (name, h, mods) => { const f = feet(); return { name, w: 1080, h, dur: 6.5, mods,
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
      (() => { const f = feet(); return { name: 'ik_gait', w: 1080, h: 1920, dur: 11, wire: t => 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(t / 4 * Math.PI * 2)), wireTags: ['figure'],
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
      { name: 'ik_ik', w: 1080, h: 1920, dur: 8, wire: 0.35, wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'giveupWalk'; S.t = 0; },
        cam: (t, H) => { const x = clamp(fig.x, -0.62, -0.25), at = H.wallPt(x, 0.0), c = H.wallPt(x, 0.08); return { pos: V(c.x, c.y, c.z + 0.85), at: V(at.x, at.y, at.z + 0.14), fov: 36 }; },
        overlay(g, t, P, H, m) {
          const ann = [], pt = n => P(H.bonePos(n)).slice(0, 2);
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
      { name: 'ic_pops_before', w: 1080, h: 1920, dur: 11, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedTall(), overlay: pops() },
      { name: 'ic_pops_before_half', w: 1080, h: 960, dur: 9, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedHalf(), overlay: pops() },
    ],
    '03-cloak': [
      { name: 'ic_boot_after_half', w: 1080, h: 960, dur: 5, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedHalf() },
      { name: 'ic_pops_after', w: 1080, h: 1920, dur: 12, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedTall(), overlay: pops() },
      { name: 'ic_pops_after_half', w: 1080, h: 960, dur: 9, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedHalf(), overlay: pops() },
      { name: 'ic_preroll', w: 1080, h: 1920, dur: 7, wire: 1, wireTags: ['cloak', 'chair', 'figure'],
        setup: H => { H.lights(true); H.hold(false); S.minSit = 999; S.wait = 999; S.mode = 'rest'; rig.upper = null; const { x, pose } = sitPose(0, POSES.sitRest); fig.x = x; fig.pose = pose; fig.face = 1; rig.yaw = Math.PI / 2; applyFigure(1 / 60); hair.lastA = cloak.lastA = null; },
        manual(t) { const u = clamp((t - 1.0) / 2.4, 0, 1); for (let i = 0; i < 2; i++) { const { x, pose } = sitPose(u, POSES.sitRest); fig.x = x; fig.pose = pose; applyFigure(1 / 60); hair.step(1 / 60); cloak.step(1 / 60); } },
        cam: fixedAt({ dx: 0.75, dy: 0.0, dz: 0.95, fov: 46, lookY: -0.1, dxAt: 0.08 }),
        overlay(g, t, P, H, m) { const [x, y] = P(H.bonePos('Hips')); m.ann = [{ k: 'call', id: 'phase', x, y, r: 40, dx: 230, dy: -300, text: t < 1 ? 'stand, let it hang' : t < 3.4 ? 'sit down' : 'settle' }]; } },
    ],
    '04-hair': [
      { name: 'ih_wire', w: 1080, h: 1920, dur: 14, hide: ['cloak'], solid: t => wave(t, 4) < 0.5, wire: t => 0.35 + 0.65 * wave(t, 4), wireTags: ['hair', 'figure'], setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: hairTall },
      ...[['before', ['rawCloth']], ['after', []]].flatMap(([k, mods]) => [
        { name: `ih_${k}`, w: 1080, h: 960, dur: 9, hide: ['cloak'], solid: true, mods, dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: standStill, cam: hairHalf },
        { name: `ih_${k}_tall`, w: 1080, h: 1920, dur: 20, hide: ['cloak'], solid: true, mods, dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: standStill, cam: hairTall },
      ]),
    ],
    '05-hand': [
      { name: 'iha_wire', w: 1080, h: 1920, dur: 10, wire: t => wave(t, 3.5), wireTags: ['hand'], setup: seatedQuiet, handPath: t => lissajous(t, 0.6), cam: () => plinthTall() },
      { name: 'iha_springs', w: 1080, h: 1920, dur: 14, setup: seatedQuiet, handPath: t => lissajous(t, 1.9), cam: () => plinthTall(0.5),
        overlay(g, t, P, H, m) { const [x, y] = P(hand.target); m.ann = [{ k: 'call', id: 'target', x, y, r: 30, dx: -230, dy: -200, text: 'where it’s sent' }]; } },
      { name: 'iha_dent', w: 1080, h: 1920, dur: 9, setup: heldKicks,
        cam: t => { const tip = leverTipWorld(V()); return { pos: tip.clone().add(V(-0.14 + 0.012 * t / 8, 0.05, 0.19)), at: tip.clone().add(V(0.01, -0.025, 0)), fov: 42 }; } },
      { name: 'iha_fade', w: 1080, h: 1920, dur: 8, setup: seatedQuiet, handPath: t => lissajous(t, 0.5),
        cam: () => ({ pos: V(SW.x - 0.34, PLINTH.h + 0.17, SW.z + 0.32), at: V(SW.x + 0.04, PLINTH.h + 0.0, SW.z), fov: 50 }),
        overlay(g, t, P, H, m) { if (hand.alpha < 0.5) { m.ann = []; return; } const [x, y] = P(hand.bones.wrist.getWorldPosition(V())); m.ann = [{ k: 'call', id: 'wrist', x, y, r: 36, dx: 200, dy: -230, text: 'fades out' }]; } },
    ],
  });
})();
