// Clip definitions for the dev and cinematic videos, eval'd after rec.js. CLIPS.<video> is a list of clips for
// REC.all(); `version` says which build of the exhibit page each must be recorded in ('current' or a commit).
(() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const wave = (t, p = 5) => 0.5 - 0.5 * Math.cos(t / p * Math.PI * 2);   // wireframe in and out
  const FOOTS = { R: 'LowerLeg.R_end', L: 'LowerLeg.L_end' };
  const stageY = v => stageG.worldToLocal(v.clone()).y;

  // footprints: where each foot's shadow touches the ledge while it's planted; a sliding foot leaves a smear
  function footprints() {
    // slip: while a foot stays planted, how far its ankle wanders from where it landed (stage units, ~metres)
    const st = { pts: [], start: {}, slip: 0 };
    return {
      st,
      meta(t, H) {
        for (const side of ['R', 'L']) {
          const a = H.bonePos(FOOTS[side]), l = stageG.worldToLocal(a.clone());
          if (l.y < ANKLE_H + 0.004) {
            st.pts.push({ p: H.onWall(a), t, side });
            // slip is measured only while the foot is flat (its ankle at standing height): heel and toe roll lift it
            if (l.y < ANKLE_H + 0.0008) { if (!st.start[side]) st.start[side] = l.clone(); st.slip = Math.max(st.slip, Math.hypot(l.x - st.start[side].x, l.z - st.start[side].z)); }
          } else st.start[side] = null;
        }
        st.pts = st.pts.filter(q => t - q.t < 3.2);
        return { slip: st.slip };
      },
      overlay(g, t, P, H, m, slipLabel = true) {
        if (slipLabel) label(g, `max foot slip: ${(st.slip * 1000).toFixed(1)} mm`, 540, 900, st.slip > 0.003 ? '#ff5a6e' : '#54e08a', 34);
        for (const q of st.pts) {
          const [x, y] = P(q.p), a = 1 - (t - q.t) / 3.2;
          g.fillStyle = q.side === 'R' ? `rgba(255,90,110,${a})` : `rgba(90,184,255,${a})`;
          g.beginPath(); g.arc(x, y + 6, 8, 0, 7); g.fill();
        }
      },
    };
  }
  const label = (g, text, x, y, color = '#ffb02e', size = 30) => {
    g.save(); g.font = `600 ${size}px Menlo, monospace`; const w = g.measureText(text).width + 20;
    g.fillStyle = 'rgba(10,11,14,0.75)'; g.fillRect(x - w / 2, y - size, w, size * 1.35); g.fillStyle = color; g.textAlign = 'center'; g.fillText(text, x, y); g.restore();
  };
  const sideCam = (H, dx = 0.55, dy = 0.08, dz = 0.95, fov = 34, lookY = 0) => { const c = H.bonePos('Hips'); c.y += lookY; return { pos: c.clone().add(V(dx, dy, dz)), at: c, fov }; };
  // a camera that holds still on a point picked at the start of the clip
  const fixedSide = (o) => { let at = null; return (t, H) => { if (!at) { at = H.bonePos('Hips'); at.y += o.lookY || 0; at.x += o.dxAt || 0; } return { pos: at.clone().add(V(o.dx, o.dy, o.dz)), at, fov: o.fov || 34 }; }; };

  const feetWalk = (name, mods) => {
    const fp = footprints();
    return { name, w: 1080, h: 960, dur: 5, mods, setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'home'; S.t = 0; },
      cam: (t, H) => H.wallCam(-0.43, 0.12, 0.66, 36), meta: fp.meta, overlay: fp.overlay };
  };
  const feetTurn = (name, mods) => {
    const fp = footprints();
    return { name, w: 1080, h: 960, dur: 3.2, mods, setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x - 0.1, 1); S.mode = 'home'; S.t = 0; },
      cam: (t, H) => H.wallCam(STRIKE.x - 0.1, 0.12, 0.45, 36), meta: fp.meta, overlay: (g, t, P, H, m) => fp.overlay(g, t, P, H, m, false) };
  };
  // a red dot on every cloak point that moved more than 1 mm in a frame (a "pop")
  function pops() {
    let last = null;
    return {
      meta() { const P = cloak.pts, out = []; if (last) for (let i = 0; i < P.length; i += 3) { const d = Math.hypot(P[i] - last[i], P[i + 1] - last[i + 1], P[i + 2] - last[i + 2]); if (d > 0.002) out.push(i); } last = Float32Array.from(P); return { pops: out }; },
      overlay(g, t, P, H, m) {
        for (const i of m.pops) { const w = stageG.localToWorld(V(cloak.pts[i], cloak.pts[i + 1], cloak.pts[i + 2])); const [x, y] = P(w); g.fillStyle = '#ff3b55'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
        label(g, `pops this frame: ${m.pops.length}`, 540, 900, m.pops.length ? '#ff5a6e' : '#54e08a');
      },
    };
  }
  const seatedCam = fixedSide({ dx: 0.38, dy: 0.05, dz: 0.5, fov: 36, lookY: -0.05, dxAt: -0.02 });
  const bootBefore = H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; cloak.lastA = null; hair.lastA = null; };
  const bootAfter = H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; settleCloth(); };

  const hairCam = (t, H) => { const h = H.bonePos('Head'); return { pos: h.clone().add(V(0.2, 0.02, 0.26)), at: h.clone().add(V(-0.025, -0.03, 0)), fov: 32 }; };
  const noisy = () => { let s = 3; return t => { s = (s * 16807) % 2147483647; return 1 / 30 * (0.55 + 0.9 * (s / 2147483647)); }; };

  // the lever, the hand hovering about over the plinth
  const plinthCam = (u = 0) => ({ pos: V(SW.x + 0.05, PLINTH.h + 0.26, SW.z + 0.5 - 0.05 * u), at: V(SW.x + 0.03, PLINTH.h + 0.06, SW.z - 0.02), fov: 40 });
  const lissajous = (t, sp = 1) => V(SW.x + 0.11 * Math.sin(t * 1.1 * sp), PLINTH.h + 0.07 + 0.03 * Math.sin(t * 1.7 * sp + 1), SW.z + 0.06 * Math.sin(t * 0.8 * sp + 2));

  // skeleton lines over the figure
  const BONES = [['Hips', 'Abdomen'], ['Abdomen', 'Torso'], ['Torso', 'Chest'], ['Chest', 'Neck'], ['Neck', 'Head'], ['Head', 'Head_end'],
    ...['L', 'R'].flatMap(s => [['Chest', `Shoulder.${s}`], [`Shoulder.${s}`, `UpperArm.${s}`], [`UpperArm.${s}`, `LowerArm.${s}`], [`LowerArm.${s}`, `Wrist.${s}`],
      ['Hips', `UpperLeg.${s}`], [`UpperLeg.${s}`, `LowerLeg.${s}`], [`LowerLeg.${s}`, `LowerLeg.${s}_end`], [`LowerLeg.${s}_end`, `Foot.${s}`]])];
  function skeleton(g, P, H, color = '#ffb02e') {
    g.save(); g.strokeStyle = color; g.lineWidth = 5; g.fillStyle = '#fff';
    for (const [a, b] of BONES) { if (!bn(a) || !bn(b)) continue; const [x1, y1] = P(H.bonePos(a)), [x2, y2] = P(H.bonePos(b)); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.beginPath(); g.arc(x2, y2, 6, 0, 7); g.fill(); }
    g.restore();
  }
  function poseReadout(g, m) {
    const p = m.pose, rows = [['hipY', p.hipY], ['thighA', p.thighA], ['kneeA', p.kneeA], ['thighB', p.thighB], ['kneeB', p.kneeB], ['lean', p.lean], ['nod', p.nod], ['uA', p.uA], ['fA', p.fA]];
    g.save(); g.fillStyle = 'rgba(10,11,14,0.78)'; g.fillRect(40, 1060, 420, rows.length * 44 + 30);
    g.font = '500 30px Menlo, monospace';
    rows.forEach(([k, v], i) => { g.fillStyle = '#8b93a1'; g.fillText(k.padEnd(7), 64, 1105 + i * 44); g.fillStyle = '#ffb02e'; g.fillText((v >= 0 ? ' ' : '') + v.toFixed(3), 250, 1105 + i * 44); });
    g.restore();
  }
  // spine as a polyline on its wall shadow
  function spineLine(g, P, H) {
    const pts = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'Head_end'].map(n => P(H.onWall(H.bonePos(n))));
    g.save(); g.strokeStyle = '#ffb02e'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.fillStyle = '#fff'; for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } g.restore();
  }
  function headTrail() {
    const tr = [];
    return (g, t, P, H) => { tr.push(H.onWall(H.bonePos('Head'))); if (tr.length > 24) tr.shift(); g.save(); g.strokeStyle = '#ff6fa8'; g.lineWidth = 5; g.beginPath(); tr.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.restore(); };
  }
  const heldKicks = H => { H.lights(true); H.stand(STRIKE.x, 1); H.hold(true); S.mode = 'kick'; S.t = -0.2; S.hit = false; S.fails = 1; S.patience = 99; };

  window.CLIPS = {
    '02-feet': [
      feetWalk('feet_walk_before', ['naiveWalk']), feetWalk('feet_walk_after', []),
      (() => { const fp = footprints(); return { name: 'feet_gait', w: 1080, h: 1080, dur: 11, wire: t => 0.25 + 0.75 * wave(t, 4), wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'giveupWalk'; S.t = 0; },
        cam: (t, H) => H.wallCam(clamp(fig.x, -0.62, -0.25), 0.1, 0.62, 34), meta: fp.meta,
        overlay(g, t, P, H) {
          fp.overlay(g, t, P, H, null, false);
          if (!walker) return;
          for (const [L, side] of [['A', 'R'], ['B', 'L']]) {
            const s = walker.d / walker.S + OFFSETS[L], phi = s - Math.floor(s);
            const name = phi < GAIT.heelEnd ? 'heel strike' : phi < GAIT.heelOff ? 'foot flat' : phi < GAIT.toeOff ? 'toe off' : 'swing';
            const [x, y] = P(H.onWall(H.bonePos(FOOTS[side])));
            label(g, name, x, y + (side === 'R' ? 70 : 120), side === 'R' ? '#ff5a6e' : '#5ab8ff', 28);
          }
        } }; })(),
      feetTurn('feet_turn_before', ['spinTurn']), feetTurn('feet_turn_after', []),
      (() => { const fp = footprints(); return { name: 'feet_montage', w: 1080, h: 1920, dur: 13,
        setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 2; },
        cam: (t, H) => H.wallCam(-0.45, 0.2, 1.05, 36), meta: fp.meta, overlay(g, t, P, H) { fp.overlay(g, t, P, H, null, false); label(g, `max foot slip: ${(fp.st.slip * 1000).toFixed(1)} mm`, 540, 1450, fp.st.slip > 0.003 ? '#ff5a6e' : '#54e08a', 40); label(g, S.mode, 540, 1530, '#ffb02e', 32); } }; })(),
    ],
    '03-cloak-old': [
      { name: 'cloak_boot_before', w: 1080, h: 960, dur: 4, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedCam },
      (() => { const p = pops(); return { name: 'cloak_pops_before', w: 1080, h: 960, dur: 7, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootBefore, cam: seatedCam, meta: p.meta, overlay: p.overlay }; })(),
    ],
    '03-cloak': [
      { name: 'cloak_boot_after', w: 1080, h: 960, dur: 4, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedCam },
      (() => { const p = pops(); return { name: 'cloak_pops_after', w: 1080, h: 960, dur: 7, wire: 1, solid: true, wireTags: ['cloak', 'chair'], setup: bootAfter, cam: seatedCam, meta: p.meta, overlay: p.overlay }; })(),
      // the boot pre-roll itself, played out: she stands while the cloth hangs, then sits down with it
      { name: 'cloak_preroll', w: 1080, h: 1080, dur: 4.6, wire: 1, wireTags: ['cloak', 'chair', 'figure'],
        setup: H => { H.lights(true); H.hold(false); S.minSit = 999; S.wait = 999; S.mode = 'rest'; rig.upper = null; const { x, pose } = sitPose(0, POSES.sitRest); fig.x = x; fig.pose = pose; fig.face = 1; rig.yaw = Math.PI / 2; applyFigure(1 / 60); hair.lastA = cloak.lastA = null; },
        manual(t, dt) { const u = clamp((t - 1.0) / 2.4, 0, 1); for (let i = 0; i < 2; i++) { const { x, pose } = sitPose(u, POSES.sitRest); fig.x = x; fig.pose = pose; applyFigure(1 / 60); hair.step(1 / 60); cloak.step(1 / 60); } },
        cam: fixedSide({ dx: 0.75, dy: 0.1, dz: 0.95, fov: 38, lookY: 0.02, dxAt: 0.08 }),
        overlay(g, t) { label(g, t < 1 ? 'pre-roll: stand, let it hang' : t < 3.4 ? 'pre-roll: sit down' : 'pre-roll: settle', 540, 1020, '#ffb02e', 32); } },
    ],
    '04-hair': [
      { name: 'hair_wire', w: 1080, h: 1080, dur: 8, solid: t => wave(t, 4) < 0.5, wire: t => 0.35 + 0.65 * wave(t, 4), wireTags: ['hair', 'figure'], setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: hairCam },
      { name: 'hair_before', w: 1080, h: 960, dur: 6, solid: true, mods: ['rawCloth'], dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: H => { H.lights(true); H.hold(true); H.stand(-0.45, 1); S.mode = 'stare'; S.t = 0; S.dur = 99; }, cam: hairCam },
      { name: 'hair_after', w: 1080, h: 960, dur: 6, solid: true, dtAt: noisy(), wire: 1, wireTags: ['hair'], setup: H => { H.lights(true); H.hold(true); H.stand(-0.45, 1); S.mode = 'stare'; S.t = 0; S.dur = 99; }, cam: hairCam },
    ],
    '05-hand': [
      { name: 'hand_wire', w: 1080, h: 1080, dur: 7, wire: t => wave(t, 3.5), wireTags: ['hand'], setup: H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; }, handPath: t => lissajous(t, 0.6), cam: () => plinthCam() },
      { name: 'hand_springs', w: 1080, h: 1080, dur: 7, setup: H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; }, handPath: t => lissajous(t, 1.9),
        cam: () => plinthCam(0.5),
        overlay(g, t, P) { const [x, y] = P(hand.target); g.strokeStyle = '#ffb02e'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 16, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - 26, y); g.lineTo(x + 26, y); g.moveTo(x, y - 26); g.lineTo(x, y + 26); g.stroke(); label(g, 'target', x, y - 34, '#ffb02e', 26); } },
      { name: 'hand_dent', w: 1080, h: 1080, dur: 7, setup: heldKicks,
        cam: t => { const tip = leverTipWorld(V()); return { pos: tip.clone().add(V(-0.12 + 0.012 * t / 7, 0.045, 0.15)), at: tip.clone().add(V(0.01, 0, 0)), fov: 30 }; } },
      { name: 'hand_fade', w: 1080, h: 1080, dur: 6, setup: H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; }, handPath: t => lissajous(t, 0.5),
        cam: () => ({ pos: V(SW.x - 0.32, PLINTH.h + 0.16, SW.z + 0.3), at: V(SW.x + 0.04, PLINTH.h + 0.08, SW.z), fov: 40 }) },
    ],
    '06-shadows': [
      { name: 'sh_room', w: 1080, h: 1920, dur: 7, setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; },
        cam: t => ({ pos: V(0.1, 1.85, 6.2 - 0.6 * ease(t / 7)), at: V(0, 1.75, -1), fov: 46 }) },
      { name: 'sh_reveal', w: 1080, h: 1920, dur: 12, wire: t => wave(t, 4), wireTags: ['figure', 'cloak', 'hair', 'chair'],
        setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; },
        cam: t => ({ pos: V(-0.1 + 0.25 * Math.sin(t * 0.25), 1.8, -3.86 + 1.55), at: V(-0.45, 1.74, -3.92), fov: 38 }) },
      { name: 'sh_orbit', w: 1080, h: 1920, dur: 9, solid: t => Math.sin(t * 0.7) > 0, wire: t => 1 - 0.5 * wave(t, 4.5), wireTags: ['figure', 'cloak', 'hair', 'chair'],
        setup: H => { H.lights(true); H.hold(true); H.seat('headInHands', 'sulk'); S.minSit = 999; S.wait = 999; S.fakeIn = 999; },
        cam: t => { const c = V(-0.76, 1.72, -3.88), a = -1.15 + 0.9 * t / 9; return { pos: c.clone().add(V(Math.sin(a) * 0.9, 0.12, Math.cos(a) * 0.9)), at: c, fov: 40 }; },
        overlay(g, t, P, H) { const L = H.lampPos(), head = H.bonePos('Head'), sh = H.onWall(head); const [x1, y1] = P(head), [x2, y2] = P(sh); g.save(); g.setLineDash([14, 10]); g.strokeStyle = '#fff4b0'; g.lineWidth = 3; const dir = head.clone().sub(L).normalize(); const [x0, y0] = P(head.clone().addScaledVector(dir, -0.6)); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x2, y2); g.stroke(); g.restore(); label(g, 'light from the lamp', x0, y0 - 20, '#fff4b0', 26); label(g, 'shadow', x2, y2 + 50, '#fff', 26); } },
      { name: 'sh_credit', w: 1080, h: 1920, dur: 6, credit: true, setup: H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; },
        cam: t => ({ pos: V(SW.x, 1.2, 1.22), at: V(SW.x, 1.16 - 0.3 * ease(t / 6), -4), fov: 62 }) },
    ],
    '07-rig': [
      { name: 'rig_skel', w: 1080, h: 1920, dur: 12, wire: t => 0.15 + 0.6 * wave(t, 4), wireTags: ['figure'], solid: t => wave(t, 4) < 0.5,
        setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; },
        cam: (t, H) => { const c = H.wallPt(clamp(fig.x, -0.6, -0.25), 0.29); return { pos: c.clone().add(V(0.35, 0.02, 1.25)), at: c.clone().add(V(0, 0, 0.14)), fov: 34 }; },
        overlay(g, t, P, H, m) { skeleton(g, P, H); poseReadout(g, m); } },
      { name: 'rig_ik', w: 1080, h: 1080, dur: 8, wire: 0.35, wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(true); H.stand(STRIKE.x, -1); S.mode = 'giveupWalk'; S.t = 0; },
        cam: (t, H) => { const c = H.wallPt(clamp(fig.x, -0.62, -0.25), 0.1); return { pos: c.clone().add(V(0.0, 0.0, 0.62)), at: c.clone().add(V(0, 0, 0.14)), fov: 34 }; },
        overlay(g, t, P, H) { for (const s of ['L', 'R']) { const hip = P(H.bonePos(`UpperLeg.${s}`)), kn = P(H.bonePos(`LowerLeg.${s}`)), an = P(H.bonePos(`LowerLeg.${s}_end`)); g.strokeStyle = s === 'R' ? '#ff5a6e' : '#5ab8ff'; g.lineWidth = 7; g.beginPath(); g.moveTo(...hip); g.lineTo(...kn); g.lineTo(...an); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(an[0], an[1], 20, 0, 7); g.moveTo(an[0] - 32, an[1]); g.lineTo(an[0] + 32, an[1]); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hip[0], hip[1], 9, 0, 7); g.fill(); } label(g, 'hip joint → IK → planted ankle', 540, 1030, '#ffb02e', 30); } },
      { name: 'rig_fingers', w: 1080, h: 1080, dur: 7, solid: true, clayColor: 0x5a4438, wire: t => 0.6 * wave(t, 3.5), wireTags: ['figure'],
        setup: H => { H.lights(true); H.hold(false); H.stand(-0.45, 1); S.mode = 'stare'; S.t = 0; S.dur = 99; REC._grip = gripFor; gripFor = () => [0.5 - 0.5 * Math.cos(REC.t * 1.4), 0.3]; },
        cam: (t, H) => { const w = H.bonePos('Wrist.R'), m = H.bonePos('Middle2.R'), c = w.clone().lerp(m, 0.5); return { pos: c.clone().add(V(0.02, 0.03, 0.17)), at: c, fov: 30 }; },
        overlay(g, t) { label(g, `grip ${(0.5 - 0.5 * Math.cos(t * 1.4)).toFixed(2)}`, 540, 1020, '#ffb02e', 34); } },
    ],
    '08-smoothing': [
      { name: 'sm_before', w: 1080, h: 960, dur: 6, mods: ['noSmooth', 'noWobble'], setup: heldKicks, cam: (t, H) => H.wallCam(STRIKE.x + 0.03, 0.24, 0.85, 36), overlay: (() => { const h = headTrail(); return (g, t, P, H) => h(g, t, P, H); })() },
      { name: 'sm_after', w: 1080, h: 960, dur: 6, setup: heldKicks, cam: (t, H) => H.wallCam(STRIKE.x + 0.03, 0.24, 0.85, 36), overlay: (() => { const h = headTrail(); return (g, t, P, H) => h(g, t, P, H); })(),
        meta: () => ({ raw: fig.pose.lean, smooth: rig.upper ? rig.upper.lean.x : fig.pose.lean }) },
      { name: 'sm_spine_before', w: 1080, h: 960, dur: 7, mods: ['noWobble'], setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: (t, H) => H.wallCam(-0.42, 0.22, 1.05, 36), overlay: (g, t, P, H) => spineLine(g, P, H),
        meta: () => ({ head: rig.wob ? rig.wob.out.f[4] : 0 }) },
      { name: 'sm_spine_after', w: 1080, h: 960, dur: 7, setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: (t, H) => H.wallCam(-0.42, 0.22, 1.05, 36), overlay: (g, t, P, H) => spineLine(g, P, H),
        meta: () => ({ head: rig.wob ? rig.wob.out.f[4] : 0 }) },
      { name: 'sm_sit', w: 1080, h: 1920, dur: 7, setup: H => { H.lights(true); H.hold(true); H.stand(FRONT_X + 0.25, -1); S.mode = 'home'; S.t = 0; S.minSit = 999; S.wait = 999; },
        cam: (t, H) => H.wallCam(SIT_X + 0.12, 0.2, 1.0, 38), overlay: (g, t, P, H) => spineLine(g, P, H) },
    ],
    '09-brain': [
      { name: 'brain_run', w: 1080, h: 1000, dur: 72,
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
        cam: (t, H) => { const c = H.closeCam(0.4); return c; } },
    ],
    '10-visitor': [
      { name: 'vis_wide_dark', w: 1080, h: 1920, dur: 8, setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; }, cam: t => ({ pos: V(0, 1.7, 7.8 - 0.9 * ease(t / 8)), at: V(0, 1.55, -1), fov: 44 }) },
      { name: 'vis_switch_orbit', w: 1080, h: 1920, dur: 7, setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; },
        cam: t => { const a = 0.9 - 0.7 * t / 7, c = V(SW.x, PLINTH.h + 0.03, SW.z); return { pos: c.clone().add(V(Math.sin(a) * 0.42, 0.13, Math.cos(a) * 0.42)), at: c, fov: 34 }; } },
      { name: 'vis_turn_on', w: 1080, h: 1920, dur: 9, setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 0; S.t = 99; },
        handPath: t => t < 4.0 ? V(SW.x + 0.22, PLINTH.h + 0.3, SW.z + 0.4).lerp(leverTipWorld(V()).add(V(0, 0.009, 0)), ease((t - 1.0) / 1.2)) : null,
        update(t, H) { if (t >= 2.4 && t < 2.42) H.hold(true); if (t >= 2.4 && t < 3.6) H.setTilt(lerp(SW.maxTilt, -SW.maxTilt, ease((t - 2.4) / 0.3))); if (t >= 3.6 && dragging) { H.hold(false); S.wait = 1.2; } },
        cam: t => ({ pos: V(SW.x - 0.1, 1.26, 2.9 - 0.25 * ease(t / 9)), at: V(-0.35, 1.38, -4), fov: 27 }) },
      { name: 'vis_held', w: 1080, h: 1920, dur: 10, setup: heldKicks, cam: t => ({ pos: V(SW.x - 0.1, 1.26, 2.75 - 0.15 * t / 10), at: V(-0.35, 1.38, -4), fov: 27 }) },
      { name: 'vis_dent', w: 1080, h: 1920, dur: 6, setup: heldKicks, cam: t => { const tip = leverTipWorld(V()); return { pos: tip.clone().add(V(-0.12 + 0.02 * t / 6, 0.05, 0.16)), at: tip.clone().add(V(0.01, 0, 0)), fov: 32 }; } },
      { name: 'vis_wide_lit', w: 1080, h: 1920, dur: 12, setup: heldKicks, cam: t => ({ pos: V(0, 1.75, 5.6 + 2.2 * ease(t / 12)), at: V(0, 1.6, -1), fov: 44 }) },
    ],
    '11-shadow': [
      { name: 'sha_sit', w: 1080, h: 1920, dur: 8, setup: H => { H.lights(true); H.hold(false); H.seat(); S.minSit = 999; S.wait = 999; }, cam: (t, H) => H.wallCam(SIT_X + 0.08, 0.2, 0.8 + 0.25 * ease(t / 8), 38) },
      { name: 'sha_rise', w: 1080, h: 1920, dur: 9, setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 0; S.t = 99; },
        update(t) { if (t >= 1.0 && t < 1.04) { setOn(true, 'key'); tilt = -SW.maxTilt; S.wait = 0.7; } }, cam: (t, H) => H.wallCam(-0.58, 0.22, 1.3 - 0.1 * t / 9, 38) },
      { name: 'sha_kick', w: 1080, h: 1920, dur: 6, setup: H => { H.lights(true); H.hold(false); H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99; }, cam: (t, H) => H.wallCam(STRIKE.x - 0.04, 0.22, 0.85, 36) },
      { name: 'sha_wide', w: 1080, h: 1920, dur: 16, setup: H => { H.lights(false); H.hold(false); H.seat(); S.minSit = 0; S.t = 99; },
        update(t) { if (t >= 1.0 && t < 1.04) { setOn(true, 'key'); tilt = -SW.maxTilt; S.wait = 0.5; } }, cam: t => ({ pos: V(0, 1.72, 7.6 - 1.2 * ease(t / 16)), at: V(0, 1.58, -1), fov: 44 }) },
    ],
  };
})();
