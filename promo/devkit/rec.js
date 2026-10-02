// Clip recorder, eval'd into the exhibit page (any version of it). Steps the exhibit at a fixed rate, renders it,
// optionally lays a wireframe of the invisible shadow-casters over it, draws a 2D overlay, and sends the frames and a
// per-frame data log (her state, pose, cloth speed…) to framesink.py under clips/<name>/.
(() => {
  const SINK = 'http://127.0.0.1:8781';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  let clockT = 5000;
  const draw = renderer.render.bind(renderer);   // the exhibit's frame() renders too: silenced while recording
  const sim = dt => frame(dt, clockT += dt);

  // ---- wireframe copies of the shadow-casters, on layer 1 so they can be drawn in a second pass ----
  const WIRE = [];
  function wires() {
    if (WIRE.length) return WIRE;
    const add = (src, color, tag) => {
      const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0, depthWrite: false, skinning: !!src.isSkinnedMesh });
      const m = src.isSkinnedMesh ? new THREE.SkinnedMesh(src.geometry, mat) : new THREE.Mesh(src.geometry, mat);
      if (src.isSkinnedMesh) { m.bind(src.skeleton, src.bindMatrix); m.bindMode = src.bindMode; }
      m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
      m.frustumCulled = false; m.layers.set(1); src.parent.add(m);
      WIRE.push({ m, tag });
    };
    rig.root.traverse(o => { if (o.isSkinnedMesh) add(o, 0x35d0ff, 'figure'); });
    add(cloak.mesh, 0xff3d7f, 'cloak'); add(hair.mesh, 0xffb02e, 'hair');
    if (typeof chair !== 'undefined' && chair) add(chair, 0xd8e04a, 'chair');
    if (hand.mesh) add(hand.mesh, 0x54e08a, 'hand');
    return WIRE;
  }
  function drawWire(amount, tags) {
    if (amount <= 0.001) return;
    for (const w of wires()) { w.m.material.opacity = tags.includes(w.tag) ? amount : 0; w.m.visible = tags.includes(w.tag); }
    const bg = scene.background; scene.background = null;   // a colour background would clear the frame
    renderer.autoClear = false; camera.layers.set(1); renderer.clearDepth();
    draw(scene, camera);
    camera.layers.set(0); renderer.autoClear = true; scene.background = bg;
  }

  // ---- "before" recreations of earlier behaviour ----
  const orig = { gaitPose, turnInPlace, smoothDamp, step: Cloth.prototype.step, WOB: typeof WOB !== 'undefined' ? JSON.parse(JSON.stringify(WOB)) : null, credit: creditFX.draw };
  const MODS = {
    // legs swinging on a timer while the body glides at constant speed: the feet slide
    naiveWalk(on) {
      gaitPose = !on ? orig.gaitPose : (d, w) => {
        const ph = d / w.S * Math.PI * 2, st = POSES.stand;
        const sw = s => 0.36 * Math.sin(ph + s);
        return { ...st, hipY: st.hipY, thighA: sw(0), kneeA: 0.05 + 0.5 * Math.max(0, Math.sin(ph + Math.PI / 2)), thighB: sw(Math.PI), kneeB: 0.05 + 0.5 * Math.max(0, Math.sin(ph - Math.PI / 2)),
          pitchA: 0, pitchB: 0, lean: 0.07, nod: 0, uA: -0.3 * Math.sin(ph), fA: 0.2, uB: 0.3 * Math.sin(ph), fB: 0.2 };
      };
    },
    // turning by spinning the whole body: the feet go round with it
    spinTurn(on) {
      if (!on) { turnInPlace = orig.turnInPlace; return; }
      turnInPlace = (face, dt) => {
        const target = face > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (!turn) { if (Math.abs(rig.yaw - target) < 0.01) { rig.yaw = target; fig.face = face; return true; } turn = { from: rig.yaw, t: 0, target, spin: true }; }
        turn.t += dt; const k = ease(turn.t / 0.6); rig.yaw = lerp(turn.from, turn.target, k); rig.turnLegs = null; fig.pose = { ...POSES.stand };
        if (turn.t >= 0.6) { turn = null; rig.yaw = target; fig.face = face; return true; }
        return false;
      };
    },
    // no smoothing: the upper body snaps to each pose
    noSmooth(on) { smoothDamp = on ? ((cur, target, st) => { st.v = 0; return target; }) : orig.smoothDamp; },
    // no springs in the spine
    noWobble(on) { if (!orig.WOB) return; for (const k of ['fwd', 'vert', 'lean', 'kick']) WOB[k] = orig.WOB[k].map(v => on ? 0 : v); WOB.arm.fwd = on ? 0 : orig.WOB.arm.fwd; },
    // one cloth step per frame, with whatever time the frame took, pins snapped, no blending between states
    rawCloth(on) {
      if (!on) { Cloth.prototype.step = orig.step; return; }
      if (!MODS._raw) {
        let src = String(orig.step).replace(/^step\(dt\)/, 'function (dt)');
        src = src.replace('const H = 1 / 240;', 'const H = dt;').replace('const k = (it + 1) / n;', 'const k = 1;')
          .replace('const out = this.mesh.geometry.attributes.position.array, f = this.acc / H;', 'const out = this.mesh.geometry.attributes.position.array, f = 1;');
        MODS._raw = (0, eval)('(' + src + ')');
      }
      Cloth.prototype.step = MODS._raw;
    },
  };
  function mods(list = []) { for (const k of ['naiveWalk', 'spinTurn', 'noSmooth', 'noWobble', 'rawCloth']) MODS[k](list.includes(k)); }

  // ---- helpers for setting her up ----
  const H_ = {
    stand(x, face = 1) { walker = null; turn = null; rig.turnLegs = null; fig.trans = null; fig.x = x; fig.face = face; rig.yaw = face > 0 ? Math.PI / 2 : -Math.PI / 2; fig.pose = { ...POSES.stand }; },
    seat(poseName = 'sitRest', mode = 'rest') { walker = null; turn = null; rig.turnLegs = null; fig.trans = null; fig.x = SIT_X; fig.face = 1; rig.yaw = Math.PI / 2; fig.pose = { ...POSES[poseName] }; seatedPose = poseName; S.mode = mode; S.t = 0; },
    lights(v) { on = v; lampLevel = v ? 1 : 0; tilt = v ? -SW.maxTilt : SW.maxTilt; tiltVel = 0; },
    hold(v) { dragging = v ? { x: 0, tilt, k: 1 } : null; if (v) { hand.alpha = 1; leverTipWorld(hand.pos); } },
    setTilt(v) { tilt = clamp(v, -SW.maxTilt, SW.maxTilt); tiltVel = 0; if (tilt < -0.05 && !on) setOn(true, 'drag'); if (tilt > 0.05 && on) setOn(false, 'drag'); },
    wallPt: (x, y) => stageG.localToWorld(V(x, y, 0)),
    wallCam(x, y, d, fov = 38) { const c = H_.wallPt(x, y); return { pos: V(c.x, c.y + 0.03, c.z + d), at: c, fov }; },
    closeCam: (u = 0) => ({ pos: V(SW.x - 0.1, 1.26, 2.9 - 0.18 * u), at: V(H_.wallPt((SIT_X + STRIKE.x) / 2 + 0.06, 0).x, 1.4, -4), fov: 27 }),
    lampPos() { return lamp.getWorldPosition(V()); },
    onWall(v) { const L = H_.lampPos(), t = (WALL_Z + 0.01 - L.z) / (v.z - L.z); return L.clone().add(v.clone().sub(L).multiplyScalar(t)); },
    bonePos: n => bn(n).getWorldPosition(V()),
    cloakSpeed() { const P = cloak.pts, Q = H_._lastCloak; let s = 0; if (Q) for (let i = 0; i < P.length; i += 3) s += Math.hypot(P[i] - Q[i], P[i + 1] - Q[i + 1], P[i + 2] - Q[i + 2]); H_._lastCloak = Float32Array.from(P); return Q ? s / (P.length / 3) : 0; },
    clothJerk(c) { const P = c.pts, a = c._j1, b = c._j2; let s = 0; if (a && b) for (let i = 0; i < P.length; i++) s += Math.abs(P[i] - 2 * a[i] + b[i]); c._j2 = a; c._j1 = Float32Array.from(P); return a && b ? s / P.length : 0; },
  };

  // ---- solid "clay" view of the invisible figure, cloak and hair ----
  const clay = { on: false, saved: [], lights: [] };
  function solid(v) {
    if (v === clay.on) return; clay.on = v;
    if (v) {
      const mat = sk => new THREE.MeshStandardMaterial({ color: clay.color || 0xd9c3b0, roughness: 0.75, skinning: sk, side: THREE.DoubleSide });
      rig.root.traverse(o => { if (o.isSkinnedMesh && !WIRE.some(w => w.m === o)) { clay.saved.push([o, o.material]); o.material = mat(true); } });
      for (const c of [cloak, hair]) { clay.saved.push([c.mesh, c.mesh.material]); c.mesh.material = new THREE.MeshStandardMaterial({ color: c === cloak ? 0x9c4a5c : 0x6b4a30, roughness: 0.8, side: THREE.DoubleSide }); }
      const dim = clay.color ? 0.35 : 1;   // a darker clay gets gentler fill, so it reads against the lit wall
      const k = new THREE.DirectionalLight(0xffffff, 1.1 * dim); k.position.set(1.5, 3, 1); const a = new THREE.AmbientLight(0xffffff, 0.45 * dim);
      const c = new THREE.PointLight(0xffffff, 1.2 * dim, 3); clay.cam = c;   // follows the camera, so the clay is never unlit
      scene.add(k, a, c); clay.lights = [k, a, c];
    } else { for (const [o, m] of clay.saved) o.material = m; clay.saved = []; clay.lights.forEach(l => scene.remove(l)); clay.lights = []; }
  }
  const origAim = aimHand;
  let handPath = null;
  aimHand = function () { if (handPath && !dragging) { const p = handPath(); if (p) { hand.target.copy(p); hand.want = 1; } else hand.want = 0; } else origAim(); };

  // ---- record one clip ----
  async function clip(o) {
    const W = o.w || 1080, Hh = o.h || 1920, fps = o.fps || 30, n = Math.round(o.dur * fps);
    renderer.setPixelRatio(1); renderer.setSize(W, Hh, false); camera.aspect = W / Hh; renderer.render = () => {};
    controls.update = () => {}; creditFX.draw = () => {}; touched = true; flyTo = null;
    let seed = o.seed || 11; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    mods(o.mods); H_._lastCloak = null; cloak._j1 = cloak._j2 = hair._j1 = hair._j2 = null;
    handPath = o.handPath ? () => o.handPath(REC.t, H_) : null; REC.t = 0;
    o.setup?.(H_);
    const hidden = (o.hide || []).map(k => ({ cloak: cloak.mesh, hair: hair.mesh })[k]).filter(Boolean); hidden.forEach(m => m.visible = false);
    if (o.prerun) for (let i = 0; i < Math.round(o.prerun * 60); i++) { o.preUpdate?.(i / 60, H_); sim(1 / 60); }
    const gl = renderer.getContext(), px = new Uint8Array(W * Hh * 4);
    const out = document.createElement('canvas'); out.width = W; out.height = Hh; const g = out.getContext('2d');
    const img = g.createImageData(W, Hh), meta = [];
    const P = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * Hh, p.z]; };
    let batch = [];
    REC.status = { name: o.name, frame: 0, of: n, done: false };
    for (let f = 0; f < n; f++) {
      const t = f / fps, dt = o.dtAt ? o.dtAt(t) : 1 / fps;
      REC.t = t; o.update?.(t, H_);
      if (o.manual) o.manual(t, 1 / fps, H_);
      else for (let s = 0; s < (o.dtAt ? 1 : Math.round(60 / fps)); s++) sim(o.dtAt ? dt : 1 / 60);
      const m = { t, mode: S.mode, on, lamp: lampLevel, x: fig.x, pose: { ...fig.pose }, tilt, cloak: H_.cloakSpeed(), hairJerk: H_.clothJerk(hair), cloakJerk: H_.clothJerk(cloak), ...(o.meta?.(t, H_) || {}) };
      meta.push(m);
      const c = o.cam(t, H_); camera.position.copy(c.pos); camera.lookAt(c.at); camera.fov = c.fov; camera.updateProjectionMatrix();
      clay.color = o.clayColor; solid(typeof o.solid === 'function' ? o.solid(t) : !!o.solid);
      if (clay.on && clay.cam) clay.cam.position.copy(camera.position);
      renderer.setRenderTarget(null); draw(scene, camera);
      if (o.wire) drawWire(typeof o.wire === 'function' ? o.wire(t) : o.wire, o.wireTags || ['figure', 'cloak', 'hair', 'chair']);
      if (o.credit) orig.credit.call(creditFX);
      gl.readPixels(0, 0, W, Hh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let y = 0; y < Hh; y++) img.data.set(px.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0);
      o.overlay?.(g, t, P, H_, m);
      batch.push(`clips/${o.name}/f${String(f).padStart(5, '0')}.jpg ${out.toDataURL('image/jpeg', 0.9).split(',')[1]}`);
      if (batch.length >= 24) { await fetch(`${SINK}/batch`, { method: 'POST', body: batch.join('\n') }); batch = []; }
      REC.status.frame = f + 1;
    }
    if (batch.length) await fetch(`${SINK}/batch`, { method: 'POST', body: batch.join('\n') });
    await fetch(`${SINK}/clips/${o.name}/meta.json`, { method: 'POST', body: JSON.stringify({ fps, w: W, h: Hh, frames: meta }) });
    mods([]); solid(false); handPath = null; renderer.render = draw; hidden.forEach(m => m.visible = true);
    REC.status.done = true;
  }
  // run a list of clip definitions one after another (in the background); poll REC.status / REC.queue
  async function all(list) {
    REC.queue = { done: 0, of: list.length, err: null };
    try { for (const o of list) { await clip(o); REC.queue.done++; } } catch (e) { REC.queue.err = String(e.stack); }
  }
  window.REC = { clip, all, H: H_, wires, MODS, mods, sim };
})();
