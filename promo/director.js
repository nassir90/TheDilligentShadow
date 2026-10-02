// Promo director: injected into the exhibit page. Steps the exhibit at 30 fps, scripts the visitor's hand and her
// behaviour shot by shot, moves the camera, draws subtitles and the end card, and POSTs each frame to framesink.py.
// Usage (in the page): await import('/promo/director.js') is not possible (promo/ isn't served), so the file is
// fetched and eval'd by the capture step; then `PROMO.run({ sink: 'http://127.0.0.1:8781' })`.
(() => {
  const FPS = 30, W = 1080, H = 1920;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const seg = (t, a, b) => ease((t - a) / (b - a));

  // ---- voice lines: where each sits in the take (seconds) and where it goes in the edit ----
  const LINES = [
    { a: 0.30, b: 3.26, at: 0.5, sub: 'On a white plinth, there is a switch.' },
    { a: 4.36, b: 4.96, at: 4.6, sub: 'Turn it on.' },
    { a: 5.81, b: 9.31, at: 7.6, sub: "And someone on the wall would rather you didn't." },
    { a: 10.62, b: 16.19, at: 13.3, sub: "Hold it down, and her kicks do nothing.\nYou'll feel every one.", split: 4.18 },
    { a: 17.44, b: 21.56, at: 20.9, sub: 'She leans on it. She waits. She tries again.' },
    { a: 22.59, b: 25.19, at: 26.6, sub: 'Sometimes, she simply gives up.' },
    { a: 26.22, b: 27.25, at: 31.4, sub: 'Or so it seems.' },
    { a: 28.38, b: 30.92, at: 35.9, sub: "Keep teasing her, and she'll let you know." },
    { a: 32.23, b: 37.38, at: 41.4, sub: "Let go, and she'll put the light out herself, and walk home in the dark." },
    { a: 38.43, b: 44.48, at: 48.4, sub: 'The Diligent Shadow. After Koya Endo, at Tokyo Prototype 2026.' },
    { a: 45.02, b: 51.31, at: 55.0, sub: 'Play it at mpts.ie/games/thedilligentshadow' },
  ];
  const END = 47.6, TOTAL = 63.0;

  // ---- sim helpers ----
  const origAfterKick = afterKick, origAim = aimHand;
  const kickAgain = () => { if (!on) return origAfterKick(); S.mode = 'kick'; S.t = -0.25; S.hit = false; };
  const script = { target: null, events: [] };
  aimHand = function () {
    if (dragging) return origAim();
    if (script.target) { hand.target.copy(script.target); hand.want = 1; } else hand.want = 0;
  };
  const tipHover = () => leverTipWorld(V()).add(V(0, 0.009, 0));
  function grab() { dragging = { x: 0, tilt, k: 1 }; }
  function setTilt(v) {
    tilt = clamp(v, -SW.maxTilt, SW.maxTilt); tiltVel = 0;
    if (tilt < -0.05 && !on) setOn(true, 'drag');
    if (tilt > 0.05 && on) setOn(false, 'drag');
  }
  function standAt(x, face) {
    walker = null; turn = null; rig.turnLegs = null; rig.upper = null; fig.trans = null;
    fig.x = x; fig.face = face; rig.yaw = face > 0 ? Math.PI / 2 : -Math.PI / 2; fig.pose = { ...POSES.stand };
  }
  function seat(poseName = 'sitRest', mode = 'rest') {
    walker = null; turn = null; rig.turnLegs = null; fig.trans = null;
    fig.x = SIT_X; fig.face = 1; rig.yaw = Math.PI / 2; fig.pose = { ...POSES[poseName] }; seatedPose = poseName;
    S.mode = mode; S.t = 0;
  }
  function lights(v) { on = v; lampLevel = v ? 1 : 0; tilt = v ? -SW.maxTilt : SW.maxTilt; tiltVel = 0; }
  function handOn() { grab(); hand.alpha = 1; leverTipWorld(hand.pos); hand.vel.set(0, 0, 0); }
  function settle(s) { for (let i = 0; i < Math.round(s * 60); i++) frame(1 / 60, clockT += 1 / 60); }

  // ---- cameras ----
  const wallPt = (x, y) => stageG.localToWorld(V(x, y, 0));
  // portrait: a longer lens from further back, so the wall is bigger behind the switch and the hand isn't huge
  const closeCam = (u = 0) => window.PROMO_CLOSE ? PROMO_CLOSE(u) : ({ pos: V(SW.x - 0.1, 1.26, 2.9 - 0.18 * u), at: V(wallPt((SIT_X + STRIKE.x) / 2 + 0.06, 0).x, 1.4, -4), fov: 27 });
  function wallCam(x, y, d, fov = 40) { const c = wallPt(x, y); return { pos: V(c.x, c.y + 0.03, c.z + d), at: c, fov }; }
  function mix(A, B, k) { return { pos: A.pos.clone().lerp(B.pos, k), at: A.at.clone().lerp(B.at, k), fov: lerp(A.fov, B.fov, k) }; }

  // ---- shots ----
  const SHOTS = [
    { name: 'dark plinth', from: 0, enter() { lights(false); seat(); S.minSit = 999; script.target = null; hand.alpha = 0; dragging = null; },
      cam: t => mix({ pos: V(SW.x + 0.5, 1.62, 2.55), at: V(SW.x, PLINTH.h + 0.02, SW.z), fov: 50 }, closeCam(), ease(t / 4.4)) },
    { name: 'turn it on', from: 4.4, enter() { S.minSit = 0; S.t = 99; },
      update(t) {
        const out = V(SW.x + 0.2, PLINTH.h + 0.3, SW.z + 0.4);
        if (t < 0.6) script.target = out.clone().lerp(tipHover(), ease(t / 0.6));
        else if (t < 1.5) { if (!dragging) grab(); setTilt(lerp(SW.maxTilt, -SW.maxTilt, seg(t, 0.6, 0.85))); }
        else { if (dragging) { dragging = null; S.wait = 7.6 - 4.4 - 1.5; } script.target = t < 2.3 ? tipHover().lerp(out, ease((t - 1.5) / 0.8)) : null; }
      },
      cam: t => closeCam(Math.min(1, t / 8.6)) },
    { name: 'held: kicks do nothing', from: 13.0, enter() { lights(true); standAt(STRIKE.x, 1); handOn(); afterKick = kickAgain; S.mode = 'kick'; S.t = -0.15; S.hit = false; S.fails = 1; S.patience = 99; },
      cam: t => closeCam(0.6 + 0.4 * t / 4.3) },
    { name: 'finger dent', from: 17.3,
      cam: t => { const tip = leverTipWorld(V()); return { pos: tip.clone().add(V(-0.12 + 0.012 * t / 3.3, 0.045, 0.15)), at: tip.clone().add(V(0.01, 0.0, 0)), fov: 30 }; } },
    { name: 'push', from: 20.6, enter() { S.mode = 'push'; S.t = -0.2; S.dur = 2.4; S.hit = false; },
      cam: t => wallCam(STRIKE.x + 0.09, 0.22, 1.65 - 0.1 * t / 5.4) },
    { name: 'gives up', from: 26.0, enter() { afterKick = origAfterKick; standAt(FRONT_X + 0.16, -1); S.mode = 'giveupWalk'; S.t = 0; },
      cam: t => wallCam(SIT_X + 0.14, 0.22, 1.6 - 0.1 * t / 4.6) },
    { name: 'or so it seems', from: 30.6, enter() { if (S.mode !== 'sulk') seat('headInHands', 'sulk'); },
      update(t) { if (t >= 0.5 && S.mode === 'sulk') startRise('fakeRun', 0.45); },
      cam: t => wallCam((SIT_X + STRIKE.x) / 2, 0.24, 2.1 - 0.08 * t / 3.6, 42) },
    { name: 'teasing', from: 34.2, enter() { dragging = null; lights(true); standAt(FRONT_X, 1); S.mode = 'approach'; S.t = 0; S.flips = []; S.stomps = 0; newAttempt(); S.patience = 99; script.target = tipHover(); hand.alpha = 1; hand.pos.copy(script.target); },
      update(t) {
        const flips = [0.7, 1.55, 2.4, 3.25];
        if (t >= 0.45 && t < 3.6) { if (!dragging) grab(); let v = SW.maxTilt * -1; flips.forEach((f, i) => { const k = seg(t, f, f + 0.16); v = lerp(v, i % 2 ? -SW.maxTilt : SW.maxTilt, k); }); setTilt(v); }
        else if (t >= 3.6) { if (dragging) dragging = null; script.target = t < 4.4 ? tipHover().lerp(V(SW.x + 0.2, PLINTH.h + 0.3, SW.z + 0.4), ease((t - 3.6) / 0.8)) : null; }
      },
      cam: t => closeCam(0.3 + 0.3 * t / 3.4) },
    { name: 'stomp', from: 37.6,
      cam: t => wallCam(STRIKE.x - 0.02, 0.22, 1.6 - 0.08 * t / 3.4) },
    { name: 'let go', from: 41.0, enter() { lights(true); standAt(STRIKE.x, 1); handOn(); afterKick = kickAgain; S.mode = 'kick'; S.t = 0.1; S.hit = false; S.fails = 1; },
      update(t) {
        if (dragging && t > 0.7 && S.mode === 'kick' && S.t > 0 && S.t < KICK.contact * KICK.dur - 0.12) { afterKick = origAfterKick; dragging = null; script.target = null; }
        if (!dragging && t > 0.7) script.target = null;
      },
      cam: t => closeCam(0.2 + 0.8 * t / 6.6) },
    { name: 'end card', from: END, enter() { dragging = null; script.target = null; hand.alpha = 0; lights(true); seat(); S.minSit = 999; S.wait = 999; },
      cam: t => wallCam(SIT_X + 0.1, 0.17, 2.3 + 0.35 * ease(t / 15), 40) },
  ];

  // ---- overlay: subtitles and end card, Times New Roman ----
  const SERIF = '"Times New Roman", Times, serif';
  function wrap(g, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const w of para.split(' ')) { const tryL = line ? line + ' ' + w : w; if (g.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; }
      out.push(line);
    }
    return out;
  }
  function subtitle(g, t) {
    for (const L of LINES) {
      const len = L.b - L.a, a = L.at, b = L.at + len + 0.35;
      if (t < a - 0.1 || t > b + 0.15) continue;
      let text = L.sub;
      if (L.split) text = (t < L.at + L.split - 0.1) ? text.split('\n')[0] : text.split('\n')[1];
      const alpha = Math.min(1, (t - (a - 0.1)) / 0.15, ((b + 0.15) - t) / 0.15);
      g.save(); g.globalAlpha = alpha;
      g.font = `400 52px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const lines = wrap(g, text.replace('\n', ' '), 900), lh = 64, y0 = H - 250 - (lines.length - 1) * lh;
      const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 48, bh = lines.length * lh + 26;
      g.fillStyle = 'rgba(8,9,11,0.62)'; g.beginPath(); g.roundRect((W - bw) / 2, y0 - 50, bw, bh, 10); g.fill();
      g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
      g.restore();
    }
  }
  const knock = document.createElement('canvas'); knock.width = W; knock.height = 200; const kg = knock.getContext('2d');
  function endCard(g, t) {
    const u = t - END; if (u < 0) return;
    const k = ease(u / 1.2);
    g.fillStyle = `rgba(6,7,9,${0.5 * k})`; g.fillRect(0, 0, W, H);
    const fade = (d) => ease((u - d) / 0.9);
    g.save(); g.textAlign = 'center'; g.fillStyle = '#fff';
    g.globalAlpha = fade(0.6); g.font = `400 108px ${SERIF}`; g.fillText('The Diligent Shadow', W / 2, 470);
    g.globalAlpha = fade(1.4); g.font = `italic 400 50px ${SERIF}`; g.fillText('After Koya Endo', W / 2, 570);
    g.font = `400 50px ${SERIF}`; g.fillText('Tokyo Prototype 2026', W / 2, 638);
    g.restore();
    // the link: a block in the font colour with the text cut out of it, so the room shows through the letters
    const a = fade(7.2); if (a <= 0) return;
    const txt = 'mpts.ie/games/thedilligentshadow';
    kg.clearRect(0, 0, W, 200); kg.font = `400 50px ${SERIF}`;
    const tw = kg.measureText(txt).width, bw = tw + 56, bh = 84, bx = (W - bw) / 2, by = 58;
    kg.globalCompositeOperation = 'source-over'; kg.fillStyle = '#fff'; kg.fillRect(bx, by, bw, bh);
    kg.globalCompositeOperation = 'destination-out'; kg.textAlign = 'center'; kg.textBaseline = 'middle'; kg.fillText(txt, W / 2, by + bh / 2 + 3);
    kg.globalCompositeOperation = 'source-over';
    g.save(); g.globalAlpha = a; g.drawImage(knock, 0, 1400 - by); g.restore();
  }

  // ---- capture loop ----
  let clockT = 1000;
  async function run({ sink, from = 0, to = TOTAL, every = 1, preview = false }) {
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H;
    controls.update = () => {}; creditFX.draw = () => {}; touched = true;
    if (typeof flyTo !== 'undefined') flyTo = null;
    let seed = 11; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gl = renderer.getContext(), px = new Uint8Array(W * H * 4);
    const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
    const img = g.createImageData(W, H);
    const st = PROMO.status = { frame: 0, of: Math.round((to - from) * FPS), done: false, events: script.events, shot: '' };
    // run the sim from the start so state carries between shots, but only capture [from, to)
    let shot = -1; const n = Math.round(to * FPS);
    // events for the sound: switch flips, kicks landing on a held lever, stomps
    const so = setOn; let lastKickAge = 9, lastStompT = 0;
    setOn = (v, src) => { const was = on; so(v, src); if (on !== was) script.events.push({ t: curT, type: src === 'kick' ? 'kickoff' : (v ? 'on' : 'off') }); };
    let curT = 0;
    let batch = [];
    for (let f = 0; f < n; f++) {
      const t = curT = f / FPS;
      while (shot + 1 < SHOTS.length && t >= SHOTS[shot + 1].from - 1e-6) { shot++; st.shot = SHOTS[shot].name; SHOTS[shot].enter?.(); }
      const sh = SHOTS[shot], tl = t - sh.from;
      sh.update?.(tl);
      frame(1 / FPS, clockT += 1 / FPS);
      if (kickAge < lastKickAge) script.events.push({ t, type: 'thud' });
      lastKickAge = kickAge;
      if (S.mode === 'stomp' && S.from) {
        const nn = S.stomps > 1 ? 4 : 3;
        for (let i = 0; i < nn; i++) { const ti = STOMP.pre + (i + 0.72) * STOMP.stamp; if (lastStompT < ti && S.t >= ti) script.events.push({ t, type: 'stomp' }); }
        lastStompT = S.t;
      } else lastStompT = 0;
      if (f < from * FPS || (f % every)) continue;
      const c = sh.cam(tl); camera.position.copy(c.pos); camera.lookAt(c.at); camera.fov = c.fov; camera.updateProjectionMatrix();
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0);
      if (t < 0.8) { g.fillStyle = `rgba(0,0,0,${1 - ease(t / 0.8)})`; g.fillRect(0, 0, W, H); }
      endCard(g, t); subtitle(g, t);
      if (t > TOTAL - 1.2) { g.fillStyle = `rgba(0,0,0,${ease((t - (TOTAL - 1.2)) / 1.2)})`; g.fillRect(0, 0, W, H); }
      if (preview) { st.preview = (st.preview || []).concat(out.toDataURL('image/jpeg', 0.6)); }
      else {   // encode synchronously and send in batches: async encoding crawls when the page is in the background
        batch.push(`frames/f${String(f).padStart(5, "0")}.jpg ${out.toDataURL('image/jpeg', 0.92).split(',')[1]}`);
        if (batch.length >= 30) { await fetch(`${sink}/batch`, { method: 'POST', body: batch.join('\n') }); batch = []; }
      }
      st.frame++;
    }
    if (!preview && batch.length) await fetch(`${sink}/batch`, { method: 'POST', body: batch.join('\n') });
    if (!preview) await fetch(`${sink}/events.json`, { method: 'POST', body: JSON.stringify(script.events) });
    st.done = true;
  }
  window.PROMO = { run, LINES, SHOTS, TOTAL, END };
})();
