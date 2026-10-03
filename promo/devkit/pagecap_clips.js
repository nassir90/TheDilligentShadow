// Page-capture clips (pagecap.mjs) for "Building the site". Each has a setup and a per-frame step, run in the page;
// the step sets the scroll position, advances the exhibit (pcStep) and fills m.ann with callouts in clip pixels.
// In the close-up she walks over and kicks the light off; pcStep turns it back on 1.5 s later, so she keeps at it.
({
  // in the room, a callout on the plinth; then the click flies the camera into the close-up
  site_zoom: { dur: 9,
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.seat(); S.minSit = 0; S.t = 99; toggleView(); for (let i = 0; i < 80; i++) pcStep();`,
    step: `if (t >= 1.8 && !window.pcZoomed) { toggleView(); window.pcZoomed = true; }
      pcStep();
      const p = pcProj(new THREE.Vector3(PLINTH.x, PLINTH.h, PLINTH.z + PLINTH.size * 0.3));
      m.view = view; m.ann = t < 1.8 && pcOn(p) ? [{ k: 'call', id: 'plinth', x: p[0], y: p[1], r: 40, dx: 200, dy: -280, text: 'click the plinth' }] : [];` },

  // the close-up, then a slow scroll down: the plinth rises and the page comes up on its front face
  site_scroll: { dur: 22,
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99;
      for (let i = 0; i < 60; i++) pcStep(); window.pcS1 = Math.min(pcMax(), 575);`,
    step: `const s = pcS1 * pcEase((t - 1.5) / 11); scrollTo(0, s); pcStep(); pcFade(755, 790); m.s = s; m.ann = [];
      const cr = document.getElementById('credit').getBoundingClientRect();
      if (t > 2.5 && cr.top > 150 && cr.bottom < 740) m.ann.push({ k: 'call', id: 'credit', x: cr.left + 70, y: cr.top + cr.height / 2, r: 30, dx: 140, dy: -230, text: 'the credit line' });
      const f = pcProj(new THREE.Vector3(PLINTH.x + 0.2, PLINTH.h - 0.25, FRONT_Z));
      if (t > 2.5 && s < 350 && pcOn(f) && f[1] < innerHeight - 190) m.ann.push({ k: 'call', id: 'face', x: f[0], y: f[1], r: 40, dx: -220, dy: -300, text: "the plinth's front face" });` },

  // the credit line's lag: the canvas is drawn for the scroll position two frames back, as the browser shows it
  // while it scrolls the page ahead of the next canvas frame; the page's own text is at the current position
  site_lag_after: { dur: 14,
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99;
      for (let i = 0; i < 60; i++) pcStep(); window.pcS0 = Math.min(pcMax() - 130, 450);`,
    step: `const s = u => pcS0 + 120 * Math.sin(2 * Math.PI * u / 2.4);
      scrollTo(0, s(t - 2 / 30)); pcStep(); scrollTo(0, s(t)); pcFade(585, 612); m.s = s(t); m.ann = [];` },
  site_lag_before: { dur: 14, url: 'http://localhost:8780/games/thedilligentshadow/old.html',
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99;
      for (let i = 0; i < 60; i++) pcStep(); window.pcS0 = Math.min(pcMax() - 130, 450);`,
    step: `const s = u => pcS0 + 120 * Math.sin(2 * Math.PI * u / 2.4);
      scrollTo(0, s(t - 2 / 30)); pcStep(); scrollTo(0, s(t)); pcFade(585, 612); m.s = s(t); m.ann = [];` },

  // a touch point on the front face drags the page up
  site_swipe: { dur: 14,
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99;
      for (let i = 0; i < 60; i++) pcStep(); window.pcF0 = [innerWidth * 0.62, 760];`,   // on the front face, as it sits in the close-up
    step: `const s = 350 * pcEase((t - 2) / 6); scrollTo(0, s); pcStep(); pcFade(755, 790); const x = pcF0[0], y = pcF0[1] - s; m.s = s;
      m.ann = t > 1 && t < 9 && y > 60 ? [{ k: 'dot', x, y, r: 26, fill: false }, { k: 'dot', x, y, r: 12 },
        { k: 'call', id: 'touch', x, y, r: 46, dx: -240, dy: -300, text: 'a swipe on the front face' }] : [];` },

  // down to the foot of the page (the Roblox link), then back up to the switch
  site_end: { dur: 11,
    setup: `REC.H.lights(true); REC.H.hold(false); REC.H.stand(STRIKE.x - 0.25, 1); S.mode = 'approach'; S.t = 0; S.patience = 99;
      for (let i = 0; i < 60; i++) pcStep(); window.pcA = Math.min(pcMax(), 575); scrollTo(0, pcA); for (let i = 0; i < 4; i++) pcStep();`,
    step: `const M = pcMax(); let s;
      if (t < 2.2) s = pcA + (M - pcA) * pcEase(t / 2.2); else if (t < 3.4) s = M; else s = M * (1 - pcEase((t - 3.4) / 6));
      scrollTo(0, s); pcStep(); pcFade(755, 790); m.s = s;
      const a = [...document.querySelectorAll('#about a')].find(e => /Roblox/.test(e.textContent)), r = a.getBoundingClientRect();
      m.ann = t > 1.6 && t < 3.6 && r.top > 40 && r.bottom < innerHeight - 210 ? [{ k: 'call', id: 'roblox', x: r.left + r.width / 2, y: r.top + r.height / 2, r: 50, dx: 200, dy: -230, text: 'the Roblox version' }] : [];` },
})
