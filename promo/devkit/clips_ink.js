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
})();
