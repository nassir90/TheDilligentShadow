/* The Diligent Shadow — WebGL re-creation. three.js r128 globals. */
const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---------- geometry (metres) ----------
const WALL_Z = -4;
const PLINTH = { x: 0, z: 0.6, size: 0.65, h: 1.1 };
// panel toggle switch: lever pivots 17.5 mm above the plinth, bat handle 36.8 mm long
const SW = { x: 0.02, z: 0.8, pivot: 0.0175, lever: 0.0368, tipC: 0.0335, maxTilt: 0.42 };
const LAMP = new THREE.Vector3(0, 0.95, 2.6);
const ratio = z => (LAMP.z - WALL_Z) / (LAMP.z - z);
const FRONT_Z = PLINTH.z + PLINTH.size / 2;
const LEDGE_Y = LAMP.y + (PLINTH.h - LAMP.y) * ratio(FRONT_Z);   // top edge of the plinth's shadow on the wall
function shadowOf(v) {
  const k = (LAMP.z - WALL_Z) / (LAMP.z - v.z);
  return { x: LAMP.x + (v.x - LAMP.x) * k, y: LAMP.y + (v.y - LAMP.y) * k - LEDGE_Y };
}
const POOL_CENTER_Y = LEDGE_Y + 1.75;

// ---------- renderer / scene ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // filtered with a radius: soft edges, and dithered fades blur into gradients
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = false;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c0e);
scene.fog = new THREE.Fog(0x0b0c0e, 11, 26);

const camera = new THREE.PerspectiveCamera(46, 1, 0.02, 100);
const VIEWS = {
  close: { pos: new THREE.Vector3(SW.x, 1.2, 1.22), target: new THREE.Vector3(SW.x, 1.0, -4), min: 0.4 },
  room:  { pos: new THREE.Vector3(0, 2.0, 7.6),     target: new THREE.Vector3(0, 2.3, -1), min: 3 },
};
let view = 'close';
camera.position.copy(VIEWS.close.pos);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.copy(VIEWS.close.target);
controls.enableDamping = true;
controls.enablePan = false;
controls.minPolarAngle = Math.PI * 0.3; controls.maxPolarAngle = Math.PI * 0.53;
controls.minAzimuthAngle = -0.7; controls.maxAzimuthAngle = 0.7;
controls.maxDistance = 14;
const applyLimits = () => { controls.minDistance = VIEWS[view].min; };
applyLimits();

// ---------- image-based fill light ----------
// Two small "rooms" rendered into prefiltered environment maps: one with the lit wall pool and the
// ceiling downlight, one with only the downlight. They give every surface soft fill and the steel its reflections.
const pmrem = new THREE.PMREMGenerator(renderer);
function makeEnv(lit) {
  // fromScene renders from the origin, so the whole room is shifted to put the switch there
  const s = new THREE.Scene(), root = new THREE.Group();
  root.position.set(-SW.x, -(PLINTH.h + 0.02), -SW.z);
  s.add(root);
  const box = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 14), new THREE.MeshBasicMaterial({ color: lit ? 0x2a2c30 : 0x0d0e10, side: THREE.BackSide }));
  box.position.set(0, 3.5, -1); root.add(box);
  const floorE = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), new THREE.MeshBasicMaterial({ color: lit ? 0x3a3b3e : 0x141416 }));
  floorE.rotation.x = -Math.PI / 2; floorE.position.set(0, 0.01, -1); root.add(floorE);
  if (lit) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.9, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.45) }));
    pool.position.set(0, POOL_CENTER_Y, WALL_Z + 0.01); root.add(pool);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(2.6, LEDGE_Y + 0.05), new THREE.MeshBasicMaterial({ color: 0x1c1d20 }));
    shade.position.set(0, (LEDGE_Y + 0.05) / 2, WALL_Z + 0.02); root.add(shade);
    const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.2, 6.5) }));
    lampGlow.position.copy(LAMP); root.add(lampGlow);
  }
  const panel = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(lit ? 4 : 2.2, lit ? 3.7 : 2.0, lit ? 3.3 : 1.8) }));
  panel.rotation.x = Math.PI / 2; panel.position.set(0.6, 3.1, 1.95); root.add(panel);
  // the downlight's bright patch on the floor: it bounces up onto the plinth's sides, so they don't go black at the base
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(lit ? 1.1 : 0.8, lit ? 1.05 : 0.76, lit ? 1.0 : 0.72) }));
  patch.rotation.x = -Math.PI / 2; patch.position.set(0, 0.02, 0.75); root.add(patch);
  // the white plinth top right under the switch: the steel's lower faces reflect it
  const top = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.size, PLINTH.h, PLINTH.size), new THREE.MeshBasicMaterial({ color: new THREE.Color(lit ? 0.85 : 0.55, lit ? 0.84 : 0.53, lit ? 0.82 : 0.5) }));
  top.position.set(PLINTH.x, PLINTH.h / 2, PLINTH.z); root.add(top);
  // a soft grey band around the horizon, so steel faces looking sideways reflect grey instead of black
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.6, 48, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(lit ? 0.2 : 0.12, lit ? 0.21 : 0.12, lit ? 0.23 : 0.13), side: THREE.BackSide }));
  band.position.set(0, 1.3, 0.8); root.add(band);
  // a soft side strip so the steel has a gradient to catch
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(lit ? 0.9 : 0.3, lit ? 0.92 : 0.3, lit ? 0.95 : 0.32) }));
  strip.position.set(5.9, 2.5, 1); strip.rotation.y = -Math.PI / 2; root.add(strip);
  return pmrem.fromScene(s, 0.02).texture;
}
const ENV = { lit: makeEnv(true), dark: makeEnv(false) };
const envMats = [];   // [material, intensity when lit, intensity when dark]
function useEnv(mat, litI, darkI) { mat.envMap = ENV.lit; mat.envMapIntensity = litI; envMats.push([mat, litI, darkI]); return mat; }

// ---------- soft corner shading ----------
// Analytic ambient occlusion: surfaces darken smoothly toward the corners and contact lines they meet,
// so the wall fades into the floor and the plinth sits on the ground.
function withAO(mat, key, glsl) {
  mat.customProgramCacheKey = () => 'ao-' + key;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAoW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAoW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAoW;\nfloat aoFactor() {\n' + glsl + '\n}')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= aoFactor();\n#include <tonemapping_fragment>');
  };
  return mat;
}
const f3 = v => v.toFixed(4);
const PLINTH_SD = `vec2 q = abs(vAoW.xz - vec2(${f3(PLINTH.x)}, ${f3(PLINTH.z)})) - vec2(${f3(PLINTH.size / 2)});
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);`;

// ---------- room ----------
const floorMat = withAO(useEnv(new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 0.78 }), 0.22, 0.2), 'floor', `
  ${PLINTH_SD}
  float aoP = mix(0.3, 1.0, smoothstep(0.0, 0.38, sd));
  float aoWall = mix(0.35, 1.0, smoothstep(0.0, 0.9, vAoW.z - (${f3(WALL_Z)})));
  return aoP * aoWall;`);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// the wall is dark until light reaches it: almost no ambient, so outside the pool it falls away to black
const wallMat = withAO(useEnv(new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.93 }), 0.05, 0.03), 'wall', `
  return mix(0.3, 1.0, smoothstep(0.0, 0.9, vAoW.y));`);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat);
wall.position.set(0, 7, WALL_Z); wall.receiveShadow = true; scene.add(wall);

const bounceHemi = new THREE.HemisphereLight(0xc4ccd8, 0x26272a, 0.03);
scene.add(bounceHemi);
// light reflected off the bright pool: brightest on the wall around it and the floor just below, falling off with distance
const poolBounce = new THREE.PointLight(0xdfe6f0, 1.0, 7.5, 2);
poolBounce.position.set(0, POOL_CENTER_Y - 0.5, WALL_Z + 1.5);
scene.add(poolBounce);
// light reflected off the plinth's brightly lit front face onto the floor in front of it
const faceBounce = new THREE.PointLight(0xf1f3f6, 0.5, 1.8, 2);
faceBounce.position.set(PLINTH.x, 0.35, FRONT_Z + 0.3);
scene.add(faceBounce);

// the lamp: no visible body, only its light; cool white like the gallery fixture
const lamp = new THREE.SpotLight(0xf2f6ff, 2.2, 0, 0.42, 0.22, 1);
lamp.position.copy(LAMP);
lamp.target.position.set(0, POOL_CENTER_Y, WALL_Z);
lamp.castShadow = true;
lamp.shadow.mapSize.set(4096, 4096);
lamp.shadow.bias = -0.0002;
lamp.shadow.radius = 1.5;
lamp.shadow.camera.near = 0.4; lamp.shadow.camera.far = 12;
scene.add(lamp, lamp.target);

// the overhead downlight: a wide soft cone that covers the plinth and the floor all round it, falling off with distance
const down = new THREE.SpotLight(0xfff1df, 1.8, 9, 0.52, 0.95, 2);
down.position.set(0.6, 3.1, 1.95);
down.target.position.set(PLINTH.x + 0.04, 0.55, PLINTH.z + 0.12);
down.castShadow = true;
down.shadow.mapSize.set(2048, 2048);
down.shadow.bias = -0.00008;
down.shadow.radius = 2;
down.shadow.camera.near = 1.2; down.shadow.camera.far = 5;
scene.add(down, down.target);

// ---------- plinth ----------
const plinthMat = withAO(useEnv(new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.6 }), 0.28, 0.55), 'plinth', `
  float base = mix(0.5, 1.0, smoothstep(0.0, 0.32, vAoW.y));
  float r = length(vAoW.xz - vec2(${f3(SW.x)}, ${f3(SW.z)}));
  float sw = vAoW.y > ${f3(PLINTH.h - 0.001)} ? mix(0.45, 1.0, smoothstep(0.0158, 0.034, r)) : 1.0;
  return base * sw;`);
const plinth = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.size, PLINTH.h, PLINTH.size), plinthMat);
plinth.position.set(PLINTH.x, PLINTH.h / 2, PLINTH.z);
plinth.castShadow = plinth.receiveShadow = true;
scene.add(plinth);

// ---------- the toggle switch ----------
const steel = useEnv(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, metalness: 1, roughness: 0.12 }), 1.1, 1.0);
const brushed = useEnv(new THREE.MeshStandardMaterial({ color: 0xd9dce1, metalness: 1, roughness: 0.34 }), 1.15, 0.9);
const sw = new THREE.Group();
sw.position.set(SW.x, PLINTH.h, SW.z);
scene.add(sw);
const lathe = (pts, segs = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const smooth = (pts, n) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(n).map(v => [Math.max(0, v.x), v.y]);
function add(parent, geo, mat, y = 0) { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; parent.add(m); return m; }

// washer with rounded edges
add(sw, lathe([[0, 0], [0.0155, 0], [0.0162, 0.0004], [0.0162, 0.0011], [0.0155, 0.0015], [0, 0.0015]]), brushed);
// hex nut with chamfered edges
(function nut() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, r = 0.0108; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.0062, 0, Math.PI * 2, true); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0034, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.0022, 0);
  add(sw, g, steel);
})();
// threaded bushing
(function bushing() {
  const pts = [[0, 0.0015]];
  for (let i = 0; i <= 90; i++) { const y = 0.0015 + i / 90 * 0.0135; pts.push([0.0059 + 0.00028 * Math.sin(y / 0.0011 * Math.PI * 2), y]); }
  pts.push([0.0054, 0.0158], [0, 0.0158]);
  add(sw, lathe(pts, 48), brushed);
})();
// domed pivot cap the lever emerges from
add(sw, lathe(smooth([[0.0056, 0.0154], [0.005, 0.0172], [0.0035, 0.0184], [0.0016, 0.019], [0, 0.0191]], 16)), steel);

const leverPivot = new THREE.Group();
leverPivot.position.y = SW.pivot;
sw.add(leverPivot);
// one smooth bat-handle lever: slim neck, swelling to a rounded teardrop tip
add(leverPivot, lathe(smooth([
  [0, -0.0016], [0.0021, -0.0012], [0.0021, 0.004], [0.0018, 0.012], [0.0017, 0.019],
  [0.0019, 0.025], [0.0026, 0.0298], [0.0032, 0.0328], [0.0031, 0.0352], [0.0019, 0.0365], [0, 0.0368],
], 70)), steel);

// generous invisible grab volume around the switch
const grab = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
grab.position.y = 0.035;
sw.add(grab);

const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.0265, 48), new THREE.MeshBasicMaterial({ color: 0xf1d9a6, transparent: true, opacity: 0.6, toneMapped: false }));
ring.rotation.x = -Math.PI / 2;
ring.position.set(SW.x, PLINTH.h + 0.0008, SW.z);
scene.add(ring);

// ---------- the shadow stage ----------
// The figure, her hair and cloak, and the chair are real 3D objects standing 14 cm in front of the wall. They are invisible
// to the camera and only cast shadows, so the lamp draws them on the wall exactly like the plinth and the switch.
// The stage is scaled toward the lamp so a point at local (x, y, 0) casts onto the wall at (x, LEDGE_Y + y).
const STAGE_Z = WALL_Z + 0.14;
const stageK = (LAMP.z - WALL_Z) / (LAMP.z - STAGE_Z);
const stageG = new THREE.Group();
stageG.scale.setScalar(1 / stageK);
stageG.position.set(LAMP.x * (1 - 1 / stageK), LAMP.y + (LEDGE_Y - LAMP.y) / stageK, STAGE_Z);
scene.add(stageG);
const caster = (extra = {}) => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, ...extra });

// skeleton measurements, filled in from the model once it loads (metres on the wall; ledge = 0)
let L1 = 0.13, L2 = 0.13, UA = 0.09, FA = 0.1, ANKLE_H = 0.007;
const FIG_H = 0.56, PERSON_H = 1.6;    // a 1.6 m woman cast as a 56 cm shadow
let FOOT = { heel: [-0.012, -0.007], toe: [0.034, -0.007], tip: [0.041, -0.003] };
const FOOTS = { L: FOOT, R: FOOT };   // per foot (leg A is the right, B the left), measured in setupFigure
const rotF = ([x, y], p) => [x * Math.cos(p) + y * Math.sin(p), -x * Math.sin(p) + y * Math.cos(p)];   // foot pitch: + = toes down
const reach = (a, b) => Math.cos(a) * L1 + Math.cos(a - b) * L2;
function withHip(p) { return { pitchA: 0, pitchB: 0, ...p, hipY: Math.max(reach(p.thighA, p.kneeA), reach(p.thighB, p.kneeB)) + ANKLE_H }; }
function legPts(hx, hy, a, b, f) {
  const kx = hx + Math.sin(a) * L1 * f, ky = hy - Math.cos(a) * L1;
  return [[kx, ky], [kx + Math.sin(a - b) * L2 * f, ky - Math.cos(a - b) * L2]];
}

// ---------- the chair: "Painted Wooden Chair 02", Kirill Sannikov / Poly Haven, CC0 ----------
const CHAIR_X = -0.78;
let SEAT_Y = 0.2;
const chair = (() => {
  if (!window.CHAIR_MESH) return null;
  const dec = (b64, T) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return new T(u.buffer); };
  const pos = dec(window.CHAIR_MESH.positions, Float32Array), idx = dec(window.CHAIR_MESH.indices, Uint16Array);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // seat height: the most common vertex height between 0.5 and 0.7 m on the real chair
  const hist = {};
  for (let i = 1; i < pos.length; i += 3) if (pos[i] > 0.5 && pos[i] < 0.7) { const k = Math.round(pos[i] * 100); hist[k] = (hist[k] || 0) + 1; }
  const seat = +Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0] / 100;
  const m = new THREE.Mesh(geo, caster());
  m.castShadow = true;
  m.rotation.y = Math.PI / 2;            // backrest toward -x, seat facing the switch
  m.userData.seat = seat;
  stageG.add(m);
  return m;
})();

// ---------- the figure: "Animated Woman", Quaternius, CC0 ----------
// The model's own animations are not used. Each frame the planted-foot gait below produces a 2D pose
// (hip height, thigh/knee/foot angles, lean, arms) and the bones are aimed to match it.
const rig = { ready: false, root: new THREE.Group(), bones: {}, rest: {}, footRest: {}, yaw: Math.PI / 2, lat: {} };
stageG.add(rig.root);
const bn = n => rig.bones[n.replace(/[^A-Za-z0-9_]/g, '')];
let HAND = 'Wrist';   // the hand bone: Wrist on this rig, Palm on the Quaternius men
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function aimBone(bone, child, target) {      // rotate bone (from its rest pose) so its child lies toward target (world)
  const from = bone.getWorldPosition(_a);
  const d = _b.subVectors(target, from).normalize().applyQuaternion(bone.parent.getWorldQuaternion(_q).invert());
  const rest = rig.rest[bone.name];
  const r0 = _c.copy(child.position).normalize().applyQuaternion(rest);
  bone.quaternion.setFromUnitVectors(r0, d).multiply(rest);
  bone.updateMatrixWorld(true);
}
const L = (x, y, z) => rig.root.localToWorld(new THREE.Vector3(x, y, z));   // figure-local metres → world
function setupFigure(gltf) {
  const model = gltf.scene;
  const meshes = [];
  model.traverse(o => {
    if (o.isBone || /_end$/.test(o.name)) rig.bones[o.name.replace(/[^A-Za-z0-9_]/g, '')] = o;
    if (o.isSkinnedMesh) { meshes.push(o); o.material = caster({ skinning: true }); o.castShadow = true; o.frustumCulled = false; }
  });
  rig.root.add(model);
  HAND = bn('Wrist.L') ? 'Wrist' : 'Palm';
  rig.root.updateMatrixWorld(true);
  // scale to a 60 cm shadow person, hips over the origin
  const wy = n => bn(n).getWorldPosition(new THREE.Vector3());
  const toRoot = v => rig.root.worldToLocal(v.clone());
  const h0 = toRoot(wy('Head_end')).y - toRoot(wy('Foot.L')).y;
  model.scale.multiplyScalar(FIG_H / h0);
  rig.root.updateMatrixWorld(true);
  const hipL0 = toRoot(wy('UpperLeg.L')), hipR0 = toRoot(wy('UpperLeg.R'));
  model.position.z -= (hipL0.z + hipR0.z) / 2;
  model.position.y -= toRoot(wy('Foot.L')).y - 0.007;
  rig.root.updateMatrixWorld(true);
  for (const b of Object.values(rig.bones)) rig.rest[b.name] = b.quaternion.clone();
  rig.bodyRest = bn('Body').position.clone();
  const P = n => toRoot(wy(n));
  const len = (a, b) => P(a).distanceTo(P(b));
  L1 = (len('UpperLeg.L', 'LowerLeg.L') + len('UpperLeg.R', 'LowerLeg.R')) / 2;
  L2 = (len('LowerLeg.L', 'LowerLeg.L_end') + len('LowerLeg.R', 'LowerLeg.R_end')) / 2;
  UA = len('UpperArm.L', 'LowerArm.L'); FA = len('LowerArm.L', HAND + '.L');
  for (const side of ['L', 'R']) rig.lat[side] = { hip: P('UpperLeg.' + side).x, sh: P('UpperArm.' + side).x };
  rig.hipRestY = (P('UpperLeg.L').y + P('UpperLeg.R').y) / 2;
  const hd = P('Head'), he = P('Head_end');
  rig.head = { y: lerp(hd.y, he.y, 0.45), z: lerp(hd.z, he.z, 0.45), r: he.distanceTo(hd) * 0.5 };
  rig.shoulderY = (P('UpperArm.L').y + P('UpperArm.R').y) / 2 + 0.006;
  // foot rest orientation relative to the figure root, so pitch can be applied on top
  const rootQ = rig.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const side of ['L', 'R']) rig.footRest[side] = rootQ.clone().multiply(bn('Foot.' + side).getWorldQuaternion(new THREE.Quaternion()));
  // measure each shoe from the skinned meshes themselves (foot and toe bones): heel, toe and sole relative to the
  // ankle. The two feet differ (the right reaches ~17 mm further forward), so each leg pivots on its own heel and toe.
  const v = new THREE.Vector3(), shoe = {};
  for (const side of ['L', 'R']) {
    const ankle = P('Foot.' + side);
    let heel = 0, toe = 0, sole = 0, tipY = 0;
    for (const mesh of meshes) {
      const sk = mesh.skeleton, joints = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
      const ids = [sk.bones.indexOf(bn('Foot.' + side)), sk.bones.indexOf(bn('PT.' + side))].filter(k => k >= 0);
      mesh.updateMatrixWorld(true);
      for (let i = 0; i < joints.count; i++) {
        let best = 0, bw = -1;
        const W = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)], J = [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)];
        for (let k = 0; k < 4; k++) if (W[k] > bw) { bw = W[k]; best = J[k]; }
        if (!ids.includes(best)) continue;
        mesh.boneTransform(i, v); mesh.localToWorld(v); const r = toRoot(v).sub(ankle);
        heel = Math.min(heel, r.z); sole = Math.min(sole, r.y);
        if (r.z > toe) { toe = r.z; tipY = r.y; }
      }
    }
    shoe[side] = { heel, toe, sole, tipY };
  }
  // the body surface around the spine, for fitting the cloak: rest-pose vertices skinned to the torso bones
  const TORSO = ['Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Shoulder.L', 'Shoulder.R', 'UpperLeg.L', 'UpperLeg.R'].map(n => bn(n)).filter(Boolean);
  rig.torsoVerts = [];
  for (const mesh of meshes) {
    const joints = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight, ids = TORSO.map(b => mesh.skeleton.bones.indexOf(b));
    for (let i = 0; i < joints.count; i++) {
      let best = 0, bw = -1;
      const W = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)], J = [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)];
      for (let k = 0; k < 4; k++) if (W[k] > bw) { bw = W[k]; best = J[k]; }
      if (!ids.includes(best)) continue;
      mesh.boneTransform(i, v); mesh.localToWorld(v); const r = toRoot(v); r.mesh = mesh; r.i = i; rig.torsoVerts.push(r);
    }
  }
  rig.spine = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck'].filter(n => bn(n)).map(n => ({ n, p: P(n) }));
  // how far the back of her upper thigh sits behind the thigh bone: when she sits, that is what rests on the seat
  {
    const hip = P('UpperLeg.L'), knee = P('LowerLeg.L');
    let back = 0;
    for (const v of rig.torsoVerts) {
      const k = (hip.y - v.y) / (hip.y - knee.y);
      if (k < 0.15 || k > 0.6 || Math.sign(v.x) !== Math.sign(hip.x)) continue;
      back = Math.max(back, lerp(hip.z, knee.z, k) - v.z);
    }
    rig.thighBack = back;
  }
  rig.waistY = rig.hipRestY + 0.045;
  ANKLE_H = -Math.min(shoe.L.sole, shoe.R.sole);
  for (const side of ['L', 'R']) { const f = shoe[side]; FOOTS[side] = { heel: [f.heel + 0.002, -ANKLE_H], toe: [f.toe - 0.006, -ANKLE_H], tip: [f.toe, Math.max(f.tipY, -ANKLE_H + 0.002)] }; }
  FOOT = FOOTS.L;
  rig.ready = true;
  initFigureConstants();
  rig.yaw = Math.PI / 2; S.mode = 'rest'; S.t = 0; S.minSit = 1.5;   // she starts seated on her chair
  // put the seat exactly under her: pose her seated, find where her hips and thighs actually bottom out
  buildPonytail(meshes, toRoot);
  hair.init(); cloak.init();       // cloth anchors are measured on the rest pose, so set up before posing her
  if (chair) { applyFigure(0); fitChairSeat(seatContact() - 0.0005); rig.upper = null; }
  settleCloth();
}
// At boot the cloth would start as straight sheets hanging from her seated shoulders, through her lap and the chair,
// and spend its first seconds fighting its way out into a drape she never makes. Instead, before the first frame,
// she stands in front of the chair while the cloth hangs still, then sits down, with the cloth simulated all the way.
function settleCloth() {
  const end = POSES.sitRest, F = 1 / 60;
  const pose = u => { const { x, pose } = sitPose(u, end); fig.x = x; fig.face = 1; fig.pose = pose; applyFigure(F); };
  rig.upper = null; rig.wob = null; rig.fingers = null;
  pose(0); hair.lastA = cloak.lastA = null;
  const step = () => { hair.step(F); cloak.step(F); };
  for (let i = 0; i < 30; i++) { pose(0); step(); }                 // standing: let it hang
  for (let i = 0; i <= 60; i++) { pose(i / 60); step(); }           // sit down
  for (let i = 0; i < 40; i++) { pose(1); step(); }                 // and settle
  fig.x = SIT_X; fig.pose = { ...end };
}

// The model's hair is one rigid mesh made of separate pieces (cap, fringe, side locks, ponytail). The ponytail is the
// pieces lying wholly behind her head. Its triangles are removed from the rigid mesh, and its shape is traced into rings
// (horizontal slices, each an ellipse fitted to the slice) that become the cloth tube's starting shape.
function buildPonytail(meshes, toRoot) {
  const hm = meshes.find(m => m.name === 'Formad_Head_2'); if (!hm) return;
  const geo = hm.geometry, idx = geo.index.array, pos = geo.attributes.position, n = pos.count;
  const key = i => [pos.getX(i), pos.getY(i), pos.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
  const weld = new Map(), rep = new Int32Array(n), par = Int32Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) { const k = key(i); if (!weld.has(k)) weld.set(k, i); rep[i] = weld.get(k); }
  const find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(rep[idx[t]]); par[find(rep[idx[t + 1]])] = a; par[find(rep[idx[t + 2]])] = a; }
  const head = toRoot(bn('Head').getWorldPosition(new THREE.Vector3())), v = new THREE.Vector3(), P = [], front = new Map();
  for (let i = 0; i < n; i++) { hm.boneTransform(i, v); hm.localToWorld(v); P[i] = toRoot(v); const c = find(rep[i]); front.set(c, Math.max(front.get(c) ?? -1, P[i].z - head.z)); }
  const pony = new Set([...front].filter(([, z]) => z < -0.01).map(([c]) => c)), inPony = i => pony.has(find(rep[i]));
  const pts = []; for (let i = 0; i < n; i++) if (inPony(i)) pts.push(P[i]);
  if (pts.length < 50) return;
  geo.setIndex(Array.from(idx).filter((_, t, a) => { const b = t - t % 3; return !(inPony(a[b]) || inPony(a[b + 1]) || inPony(a[b + 2])); }));
  // rings: M horizontal slices from just below the top of the ponytail to its tip, each an ellipse (lateral x, depth z)
  const N = hair.N, M = hair.M, ys = pts.map(p => p.y).sort((a, b) => a - b), top = ys[Math.floor(ys.length * 0.97)], tip = ys[0];
  const rings = [];
  for (let l = 0; l < M; l++) {
    const y = lerp(top, tip, l / (M - 1)), half = (top - tip) / (M - 1) * 0.75;
    let sl = pts.filter(p => Math.abs(p.y - y) < half); if (sl.length < 6) sl = [...pts].sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y)).slice(0, 12);
    const q = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
    const xs = sl.map(p => p.x), zs = sl.map(p => p.z), cx = (q(xs, 0.05) + q(xs, 0.95)) / 2, cz = (q(zs, 0.05) + q(zs, 0.95)) / 2;
    const ax = Math.max(0.002, (q(xs, 0.95) - q(xs, 0.05)) / 2), az = Math.max(0.002, (q(zs, 0.95) - q(zs, 0.05)) / 2);
    for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; rings.push(new THREE.Vector3(cx + Math.cos(t) * ax, y, cz + Math.sin(t) * az)); }
  }
  hair.shapeRoot = rings;
  rig.ponytail = { verts: pts.length, pieces: pony.size, top: top - head.y, tip: tip - head.y };
}

// pose → bones. Leg A/arm A is the figure's right side: the side toward the lamp when it walks toward the switch.
// ---------- turning on the spot ----------
// Feet stay planted. A half-turn or more is taken in two steps: the body turns half way while one foot lifts
// and is set down at its new place, then the other. Legs are solved in 3D to the planted feet while turning.
const TURN = { stepDur: 0.42, lift: 0.012, dip: 0.008 };
let turn = null;
const yawOf = face => face > 0 ? Math.PI / 2 : -Math.PI / 2;
// where a standing foot's ankle sits (stage coords) for a given body yaw, figure at fig.x
function standAnkle(side, yaw) {   // exactly where the standing pose puts the ankle (a hair behind the hip: knee 0.02 rad)
  const lat = rig.lat[side].hip, st = POSES.stand, f = Math.sin(st.thighA) * L1 + Math.sin(st.thighA - st.kneeA) * L2;
  return new THREE.Vector3(fig.x + lat * Math.cos(yaw) + f * Math.sin(yaw), ANKLE_H, -lat * Math.sin(yaw) + f * Math.cos(yaw));
}
function turnInPlace(face, dt) {
  const target = yawOf(face);
  if (!turn) {
    if (Math.abs(rig.yaw - target) < 0.01) { rig.yaw = target; fig.face = face; return true; }
    // A half-turn swaps which side each foot is on, so it takes three steps: one foot to the quarter-turn
    // position, the other foot to its final place, then the first foot's small adjusting step.
    const y0 = rig.yaw, d = target - y0, F = d > 0 ? 'R' : 'L', O = F === 'R' ? 'L' : 'R';
    const steps = Math.abs(d) > 0.9
      ? [{ swing: F, yaw: y0 + d / 2, foot: y0 + d / 2, dur: 0.4 }, { swing: O, yaw: target, foot: target, dur: 0.4 }, { swing: F, yaw: target, foot: target, dur: 0.3 }]
      : [{ swing: F, yaw: target, foot: target, dur: 0.35 }, { swing: O, yaw: target, foot: target, dur: 0.3 }];
    turn = { target, steps, k: 0, t: 0, yawFrom: y0,
      feet: { R: { p: standAnkle('R', y0), yaw: y0 }, L: { p: standAnkle('L', y0), yaw: y0 } } };
  }
  const T = turn, st = T.steps[T.k];
  T.t += dt;
  const u = clamp(T.t / st.dur, 0, 1), e = u * u * u * (u * (u * 6 - 15) + 10);
  rig.yaw = lerp(T.yawFrom, st.yaw, e);
  const legs = {};
  for (const side of ['R', 'L']) {
    const f = T.feet[side];
    if (side === st.swing) {
      const dest = standAnkle(side, st.foot);
      const pos = f.p.clone().lerp(dest, e); pos.y = ANKLE_H + TURN.lift * Math.sin(Math.PI * u);
      legs[side] = { pos, yaw: lerp(f.yaw, st.foot, e) };
      if (u >= 1) { f.p = dest; f.yaw = st.foot; }
    } else legs[side] = { pos: f.p.clone(), yaw: f.yaw };
  }
  rig.turnLegs = legs;
  fig.pose = { ...POSES.stand, hipY: POSES.stand.hipY - TURN.dip * Math.sin(Math.PI * u) };
  if (u >= 1) {
    T.k++; T.t = 0; T.yawFrom = st.yaw;
    if (T.k >= T.steps.length) {   // a turn always finishes; if she now wants the other way, the next call plans that turn
      turn = null; rig.turnLegs = null; rig.yaw = T.target; fig.face = T.target > 0 ? 1 : -1; fig.pose = { ...POSES.stand };
      return T.target === target;
    }
  }
  return false;
}
// 3D two-bone IK from the real hip joint to an ankle target (stage coords); the knee bends toward `fwd`
// The shadow floor. The stage is exact only in its own plane (z = 0): a foot a few centimetres nearer the lamp casts
// lower on the wall, one further away casts higher, so with both on a level floor one shadow sinks into the ledge
// and the other floats above it. The points whose shadows land exactly on the ledge's edge make a plane through the
// lamp, tilting down toward it; feet are planted on that plane (ankles shifted by their depth, soles tilted to match).
const SHADOW_FLOOR = (LEDGE_Y - LAMP.y) / (LAMP.z - WALL_Z);   // the drop per unit of depth toward the lamp (~0.09)
const FLOOR_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan(SHADOW_FLOOR));
const SOLE_SINK = 0.0012;   // a hair into the ledge, so the soft shadow edge meets it with no light showing (as the chair's legs do)
function solveLeg(side, A, fwd = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw))) {
  A = A.clone(); A.y -= SHADOW_FLOOR * A.z + SOLE_SINK;
  const H = stageG.worldToLocal(bn('UpperLeg.' + side).getWorldPosition(new THREE.Vector3()));
  const v = A.clone().sub(H), d = clamp(v.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4), dir = v.normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pole = fwd.clone().addScaledVector(dir, -fwd.dot(dir)).normalize();
  const knee = H.clone().addScaledVector(dir, a).addScaledVector(pole, h), ank = H.clone().addScaledVector(dir, d);
  aimBone(bn('UpperLeg.' + side), bn('LowerLeg.' + side), stageG.localToWorld(knee));
  aimBone(bn('LowerLeg.' + side), bn('LowerLeg.' + side + '_end'), stageG.localToWorld(ank));
}
// 3D two-bone IK to the planted ankles; knees point the way the body faces
// Her real hip joints aren't level (the right sits higher), so a nearly straight pose (standing, staring, a support
// leg, the planted legs of a turn) can ask one leg to reach further than it is long: the solver stops at full length
// and that foot hangs a few millimetres above the floor. Before the legs are solved, the body is lowered by exactly
// the shortfall, so both feet always reach the ground.
function reachLegs(targets) {
  const lmax = L1 + L2 - 0.0004; let drop = 0;
  for (const side of ['R', 'L']) {
    const A = targets[side].clone(); A.y -= SHADOW_FLOOR * A.z + SOLE_SINK;   // where solveLeg will aim
    const Hp = stageG.worldToLocal(bn('UpperLeg.' + side).getWorldPosition(new THREE.Vector3())), d = A.clone().sub(Hp);
    if (d.length() <= lmax) continue;
    const need = Math.sqrt(Math.max(0, lmax * lmax - d.x * d.x - d.z * d.z));
    drop = Math.max(drop, (Hp.y - A.y) - need);
  }
  rig.legDrop = drop;
  if (drop <= 0) return;
  const body = bn('Body'), w = body.getWorldPosition(new THREE.Vector3()), down = w.clone(); down.y -= drop * stageG.scale.y;
  body.position.add(body.parent.worldToLocal(down.clone()).sub(body.parent.worldToLocal(w.clone())));
  body.updateMatrixWorld(true);
}
function placeTurnLegs() {
  const fwd = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw));
  for (const side of ['R', 'L']) {
    const g = rig.turnLegs[side];
    solveLeg(side, g.pos, fwd);
    const foot = bn('Foot.' + side), at = bn('LowerLeg.' + side + '_end').getWorldPosition(new THREE.Vector3());
    foot.position.copy(foot.parent.worldToLocal(at));
    const want = FLOOR_TILT.clone().multiply(stageG.getWorldQuaternion(_q2)).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.yaw)).multiply(rig.footRest[side]);
    foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
    foot.updateMatrixWorld(true);
  }
}
const UPPER = ['lean', 'nod', 'uA', 'fA', 'uB', 'fB'];
// Secondary motion, after the visitor's hand: the hips' smoothed velocity and clamped acceleration (and how fast
// her lean and kicking thigh swing) drive a spring per spine segment, looser toward the head, a little underdamped
// so the back gives and settles instead of moving as one plank. Zero at rest, so held poses are left exactly as set.
const WOB = {
  k: [190, 150, 115, 90, 70], zeta: 0.34,          // stiffness per segment, hips → head
  fwd: [-0.01, -0.02, -0.03, -0.04, -0.05],    // hips speeding up forward: the upper body lags back
  vert: [0.005, 0.01, 0.015, 0.02, 0.026],       // landing on a step (upward acceleration): it settles forward
  lean: [-0.001, -0.0025, -0.004, -0.0055, -0.0075], // quick changes of lean: the top of the spine trails and overshoots
  kick: [0.003, 0.004, 0.0045, 0.005, 0.005],    // a thigh swinging forward pulls the torso back over the hips
  side: [0.0, 0.25, 0.5, 0.75, 1],                 // a slow, tiny side-to-side sway (breathing, balance)
  arm: { k: 80, zeta: 0.3, fwd: -0.05 },
};
function wobble(dt, p) {
  const w = rig.wob || (rig.wob = { last: null, sv: [0, 0], lsv: [0, 0], lv: 0, tv: 0, f: WOB.k.map(() => new Spring()),
    arm: [new Spring(), new Spring()], t: 0, out: { f: [0, 0, 0, 0, 0], s: [0, 0, 0, 0, 0], arm: [0, 0] } });
  if (!(dt > 0)) return w.out;
  w.t += dt;
  const pos = [fig.x, p.hipY], lean = rig.upper.lean, thigh = p.thighA;
  // a teleport (reset, cut) restarts the filters instead of kicking the springs
  if (!w.last || Math.abs(pos[0] - w.last[0]) > 0.05 || Math.abs(pos[1] - w.last[1]) > 0.05) {
    w.last = pos; w.sv = [0, 0]; w.lsv = [0, 0]; w.lv = lean.v; w.lastThigh = thigh; w.tv = 0; return w.out;
  }
  const k = 1 - Math.exp(-dt / 0.05);
  for (let i = 0; i < 2; i++) w.sv[i] += ((pos[i] - w.last[i]) / dt - w.sv[i]) * k;
  const cl = v => clamp(v, -6, 6);
  const af = cl((w.sv[0] - w.lsv[0]) / dt * Math.sin(rig.yaw)), av = cl((w.sv[1] - w.lsv[1]) / dt);
  const la = clamp((lean.v - w.lv) / dt, -60, 60);
  const tv = (thigh - w.lastThigh) / dt; w.tv += (tv - w.tv) * k; const ta = clamp(w.tv, -12, 12);
  w.last = pos; w.lsv = [...w.sv]; w.lv = lean.v; w.lastThigh = thigh;
  const n = 4, h = dt / n;
  for (let i = 0; i < WOB.k.length; i++) {
    const target = WOB.fwd[i] * af + WOB.vert[i] * av + WOB.lean[i] * la - WOB.kick[i] * ta, c = 2 * WOB.zeta * Math.sqrt(WOB.k[i]);
    for (let j = 0; j < n; j++) w.f[i].step(target, WOB.k[i], c, h);
    w.out.f[i] = w.f[i].x;
    w.out.s[i] = 0.006 * WOB.side[i] * (Math.sin(w.t * 0.9 + i * 0.4) + 0.5 * Math.sin(w.t * 1.7 + 1.3));
  }
  const ca = 2 * WOB.arm.zeta * Math.sqrt(WOB.arm.k);
  for (let s = 0; s < 2; s++) for (let j = 0; j < n; j++) w.arm[s].step(WOB.arm.fwd * af, WOB.arm.k, ca, h);
  w.out.arm[0] = w.arm[0].x; w.out.arm[1] = w.arm[1].x;
  return w.out;
}
function applyFigure(dt) {
  if (!rig.ready) return;
  // the upper body follows the pose through a short critically damped filter (~80 ms): the legs stay exact for
  // foot contact, while the torso and head never jerk, so the hair and cloak are driven by smooth motion
  if (!rig.upper) rig.upper = Object.fromEntries(UPPER.map(k => [k, { x: fig.pose[k], v: 0 }]));
  const p = { ...fig.pose };
  for (const k of UPPER) {
    const u = rig.upper[k];
    u.x = smoothDamp(u.x, fig.pose[k], u, 0.08, dt);
    p[k] = u.x;
  }
  // body yaw is only changed by the stepping turn (turnInPlace), so the feet never skate round
  rig.root.position.set(fig.x, 0, 0);
  rig.root.rotation.y = rig.yaw;
  rig.root.updateMatrixWorld(true);
  for (const b of Object.values(rig.bones)) b.quaternion.copy(rig.rest[b.name]);
  const body = bn('Body');
  body.position.copy(rig.bodyRest);
  rig.root.updateMatrixWorld(true);
  // lift the pelvis so the hip joints sit at the pose's hip height, centred over the origin
  const hipNow = bn('UpperLeg.L').getWorldPosition(new THREE.Vector3()).add(bn('UpperLeg.R').getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
  const hipWant = L(0, p.hipY, 0);
  body.position.add(body.parent.worldToLocal(hipWant.clone()).sub(body.parent.worldToLocal(hipNow.clone())));
  body.updateMatrixWorld(true);
  // spine and head lean forward about the hips, each segment wobbling a little on its own spring (see wobble())
  const wb = wobble(dt, p);
  const up = (ang, side = 0) => L(Math.sin(side), Math.cos(ang), Math.sin(ang)).sub(L(0, 0, 0));
  const aimDir = (b, c, dir) => aimBone(bn(b), bn(c), bn(b).getWorldPosition(new THREE.Vector3()).add(dir));
  aimDir('Hips', 'Abdomen', up(p.lean * 0.6 + wb.f[0], wb.s[0]));
  aimDir('Abdomen', 'Torso', up(p.lean + wb.f[1], wb.s[1]));
  if (bn('Chest')) { aimDir('Torso', 'Chest', up(p.lean + wb.f[2], wb.s[2])); aimDir('Chest', 'Neck', up(p.lean + wb.f[3], wb.s[3])); }
  else aimDir('Torso', 'Neck', up(p.lean + wb.f[3], wb.s[3]));
  aimDir('Neck', 'Head', up(p.lean + p.nod * 0.5 + wb.f[4], wb.s[4]));
  aimDir('Head', 'Head_end', up(p.lean + p.nod + wb.f[4] * 1.15, wb.s[4]));
  p.uA += wb.arm[0]; p.uB += wb.arm[1];
  // how far her hips are bent (0 standing, 1 seated): the cloak lets go of her lower back as she sits
  rig.hipFlex = ss(((p.thighA + p.thighB) / 2 - 0.45) / 0.8);
  // legs: thigh toward the knee, shin toward the ankle, then the foot bone placed on the ankle with its pitch
  // The pose's angles say where each ankle goes (relative to the ideal hip point); the leg is then solved in 3D
  // from her real hip joint to exactly that ankle, so feet land where the gait puts them.
  {
    const ankAt = (side, th, kn) => stageG.worldToLocal(L(rig.lat[side].hip, p.hipY - Math.cos(th) * L1 - Math.cos(th - kn) * L2, Math.sin(th) * L1 + Math.sin(th - kn) * L2));
    reachLegs(rig.turnLegs ? { R: rig.turnLegs.R.pos, L: rig.turnLegs.L.pos } : { R: ankAt('R', p.thighA, p.kneeA), L: ankAt('L', p.thighB, p.kneeB) });
  }
  if (rig.turnLegs) placeTurnLegs(); else
  for (const [side, th, kn, pi] of [['R', p.thighA, p.kneeA, p.pitchA], ['L', p.thighB, p.kneeB, p.pitchB]]) {
    const lat = rig.lat[side].hip;
    const ank = L(lat, p.hipY - Math.cos(th) * L1 - Math.cos(th - kn) * L2, Math.sin(th) * L1 + Math.sin(th - kn) * L2);
    solveLeg(side, stageG.worldToLocal(ank.clone()));
    const foot = bn('Foot.' + side), at = bn('LowerLeg.' + side + '_end').getWorldPosition(new THREE.Vector3());
    foot.position.copy(foot.parent.worldToLocal(at));
    const want = FLOOR_TILT.clone().multiply(rig.root.getWorldQuaternion(_q2)).multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pi)).multiply(rig.footRest[side]);
    foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
    foot.updateMatrixWorld(true);
  }
  // arms swing in the walking plane, opening slightly outward
  for (const [side, u, fa] of [['R', p.uA, p.fA], ['L', p.uB, p.fB]]) {
    const out = Math.sign(rig.lat[side].sh) * 0.12, ua = u + p.lean * 0.4;
    const sh = bn('UpperArm.' + side).getWorldPosition(new THREE.Vector3());
    const d1 = L(out, -Math.cos(ua), Math.sin(ua)).sub(L(0, 0, 0)).normalize();
    aimBone(bn('UpperArm.' + side), bn('LowerArm.' + side), sh.clone().addScaledVector(d1, UA));
    const el = bn('LowerArm.' + side).getWorldPosition(new THREE.Vector3());
    const d2 = L(out * 0.5, -Math.cos(ua + fa), Math.sin(ua + fa)).sub(L(0, 0, 0)).normalize();
    aimBone(bn('LowerArm.' + side), bn(HAND + '.' + side), el.clone().addScaledVector(d2, FA));
  }
  poseFingers(dt, rig.wob ? rig.wob.t : 0);
}

// ---------- fingers ----------
// The rig has full hands (a palm bone and three phalanges per finger, three thumb bones), all skinned. Each joint
// bends about its own curl axis, found once from the rest pose: across the finger, in the plane of the palm.
// One "grip" value per hand (0 open … 1 fist) sets the curl, cascading from index to little finger, and is eased
// toward a target set by what she is doing; each finger then lags on its own spring when the wrist moves, like
// the visitor's hand, with a slow fidget so the hands are never quite still.
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const FCURL = { palm: [0, 0, 0.12, 0.22], joints: [1.45, 1.7, 1.05], cascade: [0.88, 1, 1.06, 1.14], spread: [-0.16, -0.04, 0.06, 0.16] };
function fingerAxes(side) {
  const P = n => bn(n).getWorldPosition(new THREE.Vector3()), q = new THREE.Quaternion();
  const toLocal = (b, v) => v.clone().applyQuaternion(bn(b).getWorldQuaternion(q).invert()).normalize();
  // palm normal (toward the palm side): across the knuckles × along the hand, flipped so the thumb tip lies on it
  const along = P(`Middle2.${side}`).sub(P(`Wrist.${side}`)).normalize();
  const across = P(`Index2.${side}`).sub(P(`Pinky2.${side}`)).normalize();
  let n = new THREE.Vector3().crossVectors(across, along).normalize();
  if (P(`Thumb3.${side}`).sub(P(`Wrist.${side}`)).dot(n) < 0) n.negate();
  const ax = { n };
  for (const f of FINGERS) for (let j = 1; j <= 4; j++) {
    const b = `${f}${j}.${side}`, c = j < 4 ? `${f}${j + 1}.${side}` : `${f}4${side}_end`;
    const d = (bn(c) ? P(c) : P(b).add(P(b).sub(P(`${f}${j - 1}.${side}`)))).sub(P(b)).normalize();
    // rotating about d × n swings the finger's far end toward n, into the palm
    ax[b] = { curl: toLocal(b, new THREE.Vector3().crossVectors(d, n)), spread: toLocal(b, n) };
  }
  for (let j = 1; j <= 3; j++) {
    const b = `Thumb${j}.${side}`, c = j < 3 ? `Thumb${j + 1}.${side}` : null;
    const d = (c ? P(c) : P(b).add(P(b).sub(P(`Thumb${j - 1}.${side}`)))).sub(P(b)).normalize();
    // the thumb folds across the palm toward the little finger
    const toPinky = P(`Pinky2.${side}`).sub(P(b)).normalize();
    ax[b] = { curl: toLocal(b, new THREE.Vector3().crossVectors(d, toPinky).normalize()) };
  }
  return ax;
}
function gripFor() {   // [grip, spread] for what she is doing
  const m = S.mode;
  if (m === 'stomp') return [1.0, -0.2];
  if (m === 'kick') return [0.95, -0.15];
  if (m === 'push') return [0.22, 0.6];
  if (m === 'fakeRun') return [0.62, 0];
  if (m === 'home' || m === 'giveupWalk') return [0.5, 0];
  if (m === 'sulk' || (m === 'sitting' && seatedPose && seatedPose !== 'sitRest' && S.sit.dir > 0)) return seatedPose === 'chinInHands' ? [0.58, 0.1] : [0.2, 0.55];
  if (m === 'rest' || m === 'sitting') return [0.42, 0.1];
  if (m === 'stare') return [0.4, 0];
  return [0.34, 0.15];
}
function poseFingers(dt, t) {
  const F = rig.fingers || (rig.fingers = { R: null, L: null });
  const [g, sp] = gripFor();
  for (const side of ['R', 'L']) {
    if (!F[side]) F[side] = { ax: fingerAxes(side), grip: { x: g, v: 0 }, spread: { x: sp, v: 0 }, lag: FINGERS.map(() => new Spring()),
      last: null, sv: new THREE.Vector3(), lsv: new THREE.Vector3() };
    const h = F[side], ax = h.ax;
    if (dt > 0) {
      h.grip.x = smoothDamp(h.grip.x, g, h.grip, 0.22, dt);
      h.spread.x = smoothDamp(h.spread.x, sp, h.spread, 0.25, dt);
      // the wrist's smoothed acceleration toward the back of the hand flicks the fingers open a little, then they settle
      const w = bn(`Wrist.${side}`).getWorldPosition(new THREE.Vector3());
      if (h.last && w.distanceTo(h.last) < 0.05) {
        h.sv.lerp(w.clone().sub(h.last).divideScalar(dt), 1 - Math.exp(-dt / 0.06));
        const acc = h.sv.clone().sub(h.lsv).divideScalar(dt).clampLength(0, 8);
        const j = clamp(-acc.dot(ax.n) * 0.02, -0.25, 0.25);
        FINGERS.forEach((f, i) => { const k = 90 + 25 * i, c = 2 * 0.3 * Math.sqrt(k); for (let s = 0; s < 4; s++) h.lag[i].step(j, k, c, dt / 4); });
      }
      h.last = w; h.lsv.copy(h.sv);
    }
    const q = new THREE.Quaternion();
    FINGERS.forEach((f, i) => {
      const fid = 0.035 * Math.sin(t * (0.5 + 0.13 * i) + i * 1.7 + (side === 'L' ? 2 : 0));
      const gi = clamp(h.grip.x * FCURL.cascade[i] + h.lag[i].x + fid, -0.15, 1.15);
      for (let j = 1; j <= 4; j++) {
        const b = bn(`${f}${j}.${side}`), a = ax[`${f}${j}.${side}`];
        const ang = j === 1 ? FCURL.palm[i] * gi : FCURL.joints[j - 2] * gi * (j === 4 ? 0.85 : 1);
        b.quaternion.multiply(q.setFromAxisAngle(a.curl, ang));
        if (j === 2) b.quaternion.multiply(q.setFromAxisAngle(a.spread, FCURL.spread[i] * h.spread.x * (side === 'R' ? 1 : -1)));
      }
    });
    const tg = clamp(h.grip.x, 0, 1);
    [0.35, 0.45, 0.6].forEach((m, j) => bn(`Thumb${j + 1}.${side}`).quaternion.multiply(q.setFromAxisAngle(ax[`Thumb${j + 1}.${side}`].curl, m * tg)));
  }
}

// ---------- flowing hair and cloak: verlet cloth ----------
// Sheets of particles pinned along a curve on a bone (the back of the head, the shoulders), held by distance
// links, pulled by gravity and dragged by the body's motion, and pushed out of the head, torso and legs.
class Cloth {
  constructor(o) { Object.assign(this, { pts: null, prev: null, mesh: null, ok: false, drag: 1.6, passes: 4, bend: 0.5, spread: 0.03, soft: 1 }, o); }
  init() {
    const N = this.N, M = this.M;
    this.pts = new Float32Array(N * M * 3); this.prev = new Float32Array(N * M * 3);
    rig.root.updateMatrixWorld(true);
    const bone = bn(this.bone);
    this.anchors = this.anchorsLocal().map(v => bone.worldToLocal(L(v.x, v.y, v.z)));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * M * 3), 3));
    const idx = [], cols = this.closed ? N : N - 1;
    for (let l = 0; l < M - 1; l++) for (let i = 0; i < cols; i++) {
      const a = l * N + i, b = l * N + (i + 1) % N, c = (l + 1) * N + i, d = (l + 1) * N + (i + 1) % N;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, caster());
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    stageG.add(this.mesh);
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    this.anchorStage(0, v); this.anchorStage(1, w);
    this.across = v.distanceTo(w);
    if (this.shapeRoot) {
      // a starting shape (figure-local, rest pose): kept in the bone's frame, and every link's rest length is
      // measured from it, so the cloth starts exactly in that shape and from then on behaves as fabric
      this.shape = this.shapeRoot.map(p => bone.worldToLocal(L(p.x, p.y, p.z)));
      const d = (a, b) => this.shapeRoot[a].distanceTo(this.shapeRoot[b]);
      this.rv = new Float32Array(N * M); this.rb = new Float32Array(N * M); this.ra = new Float32Array(N * M); this.ro = new Float32Array(N * M);
      for (let l = 1; l < M; l++) for (let i = 0; i < N; i++) {
        const k = l * N + i;
        this.rv[k] = d(k - N, k);
        if (l >= 2) this.rb[k] = d(k - 2 * N, k);
        this.ra[k] = d(k, l * N + (i + 1) % N);
        this.ro[k] = d(k, l * N + (i + (N >> 1)) % N);   // straight across the ring
      }
    }
    if (this.setupHold) this.setupHold();
    this.reset();
  }
  anchorStage(i, out) { return stageG.worldToLocal(bn(this.bone).localToWorld(out.copy(this.anchors[i]))); }
  reset() {
    rig.root.updateMatrixWorld(true);
    const v = new THREE.Vector3(), seg = this.len / (this.M - 1);
    if (this.shape) {   // start in the given shape, carried by the bone
      const bone = bn(this.bone);
      this.shape.forEach((p, k) => { stageG.worldToLocal(bone.localToWorld(v.copy(p))); this.pts.set([v.x, v.y, v.z], k * 3); });
    } else for (let i = 0; i < this.N; i++) {
      this.anchorStage(i, v);
      for (let l = 0; l < this.M; l++) { const k = (l * this.N + i) * 3; this.pts[k] = v.x; this.pts[k + 1] = v.y - l * seg; this.pts[k + 2] = v.z; }
    }
    if (this.hold) for (const h of this.hold) {
      this.holdPoint(h, v);
      this.pts[h.q] = lerp(this.pts[h.q], v.x, h.w); this.pts[h.q + 1] = lerp(this.pts[h.q + 1], v.y, h.w); this.pts[h.q + 2] = lerp(this.pts[h.q + 2], v.z, h.w);
    }
    this.prev.set(this.pts); this.ok = true; this.acc = 0;
  }
  // Fixed 1/240 s sub-steps (independent of frame rate). The pinned row is interpolated from last frame's
  // anchor positions to this frame's across the sub-steps, so the sheet is led smoothly instead of yanked.
  step(dt) {
    if (!this.ok) return;
    const N = this.N, M = this.M, P = this.pts, Q = this.prev, seg = this.len / (M - 1), v = new THREE.Vector3();
    const sp = n => stageG.worldToLocal(bn(n).getWorldPosition(new THREE.Vector3()));
    const { caps, spheres } = this.colliders(sp);
    const cur = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.anchorStage(i, v); cur[i * 3] = v.x; cur[i * 3 + 1] = v.y; cur[i * 3 + 2] = v.z; }
    const holdCur = this.hold ? this.hold.map(h => this.holdPoint(h, v).toArray()) : null;
    if (!this.lastA || Math.hypot(cur[0] - this.lastA[0], cur[1] - this.lastA[1], cur[2] - this.lastA[2]) > 0.08) { this.reset(); this.lastA = cur; this.lastHold = holdCur; this.acc = 0; return; }
    const H = 1 / 240;
    this.acc = Math.min((this.acc || 0) + dt, 8 * H);
    const n = Math.floor(this.acc / H);
    this.acc -= n * H;
    const keep = Math.exp(-this.drag * H), g = -9.8 * H * H, vmax = 2.5 * H;
    for (let it = 0; it < n; it++) {
      const k = (it + 1) / n;
      for (let i = 0; i < N; i++) {           // pinned row, interpolated
        const a = i * 3;
        P[a] = lerp(this.lastA[a], cur[a], k); P[a + 1] = lerp(this.lastA[a + 1], cur[a + 1], k); P[a + 2] = lerp(this.lastA[a + 2], cur[a + 2], k);
        Q[a] = P[a]; Q[a + 1] = P[a + 1]; Q[a + 2] = P[a + 2];
      }
      for (let q = N * 3; q < P.length; q += 3) {   // verlet with per-second drag and a speed limit
        let vx = (P[q] - Q[q]) * keep, vy = (P[q + 1] - Q[q + 1]) * keep + g, vz = (P[q + 2] - Q[q + 2]) * keep;
        const sv = Math.hypot(vx, vy, vz); if (sv > vmax) { const f = vmax / sv; vx *= f; vy *= f; vz *= f; }
        Q[q] = P[q]; Q[q + 1] = P[q + 1]; Q[q + 2] = P[q + 2];
        P[q] += vx; P[q + 1] += vy; P[q + 2] += vz;
      }
      for (let pass = 0; pass < this.passes; pass++) {
        for (let l = 1; l < M; l++) for (let i = 0; i < N; i++) {
          const a = (l * N + i) * 3, up = ((l - 1) * N + i) * 3;
          const k = l * N + i, rv = this.rv;
          this.link(up, a, rv ? rv[k] : seg, l === 1 ? 0 : 0.5, 1, 'both');
          // a shaped cloth (the ponytail) also keeps its curve (bending links both ways) and its cross-section (rings
          // held at their own size, and across), so it swings as a lock instead of collapsing into a limp cord
          if (l >= 2) this.link(((l - 2) * N + i) * 3, a, rv ? this.rb[k] : seg * 2, l === 2 ? 0 : 0.5, this.bend, rv ? 'both' : 'min');
          if (this.closed || i < N - 1) this.link(a, (l * N + (i + 1) % N) * 3, rv ? this.ra[k] : this.across * Math.max(0.2, 1 + l * this.spread), 0.5, 1, rv ? 'both' : 'max');
          if (rv && i < (N >> 1)) this.link(a, (l * N + (i + (N >> 1)) % N) * 3, this.ro[k], 0.5, 0.6, 'both');
        }
        for (let q = N * 6; q < P.length; q += 3) {   // rows next to the pins never collide: the pins sit just outside the body
          for (const [A, B, r] of caps) this.pushCapsule(q, A, B, r);
          for (const [C, r] of spheres) this.pushSphere(q, C, r);
          if (P[q + 1] < -0.002) P[q + 1] = -0.002;
          if (this.seat) this.seatPush(q);
        }
      }
      if (holdCur) this.hold.forEach((h, j) => {      // upper rows held on her back, firmest at the shoulders
        const A = this.lastHold[j], B = holdCur[j];
        const w = h.low ? h.w * (1 - rig.hipFlex) : h.w;
        if (w > 0.001) for (let c = 0; c < 3; c++) P[h.q + c] = lerp(P[h.q + c], lerp(A[c], B[c], k), w);
      });
    }
    this.lastA = cur; this.lastHold = holdCur;
    // draw between the last two solver states, so a frame rate that is not a multiple of 240 Hz shows no stutter
    const out = this.mesh.geometry.attributes.position.array, f = this.acc / H;
    for (let q = 0; q < P.length; q++) out[q] = Q[q] + (P[q] - Q[q]) * f;
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  link(a, b, rest, wa, stiff = 1, mode = 'both') {
    const P = this.pts, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    if ((mode === 'max' && d <= rest) || (mode === 'min' && d >= rest * 0.98)) return;
    const e = (d - rest) / d * stiff, wb = 1 - wa;
    P[a] += dx * e * wa; P[a + 1] += dy * e * wa; P[a + 2] += dz * e * wa;
    P[b] -= dx * e * wb; P[b + 1] -= dy * e * wb; P[b + 2] -= dz * e * wb;
  }
  pushCapsule(k, A, B, r) {
    const P = this.pts, abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
    const t = clamp(((P[k] - A.x) * abx + (P[k + 1] - A.y) * aby + (P[k + 2] - A.z) * abz) / (abx * abx + aby * aby + abz * abz || 1), 0, 1);
    const cx = A.x + abx * t, cy = A.y + aby * t, cz = A.z + abz * t;
    const dx = P[k] - cx, dy = P[k + 1] - cy, dz = P[k + 2] - cz, d = Math.hypot(dx, dy, dz);
    if (d < r && d > 1e-6) this.pushTo(k, cx + dx * (d + (r - d) * this.soft) / d, cy + dy * (d + (r - d) * this.soft) / d, cz + dz * (d + (r - d) * this.soft) / d);
  }
  // Move a point out of a collider. Most of the push is also applied to its previous position, so a contact moves
  // the cloth without flinging it: otherwise cloth pressed between a leg and its neighbours is pushed out, springs
  // back in, and buzzes at the frame rate. (`absorb` 0 keeps the old, fully elastic push.)
  pushTo(k, x, y, z) {
    const P = this.pts, Q = this.prev, a = this.absorb || 0;
    Q[k] += (x - P[k]) * a; Q[k + 1] += (y - P[k + 1]) * a; Q[k + 2] += (z - P[k + 2]) * a;
    P[k] = x; P[k + 1] = y; P[k + 2] = z;
  }
  // the chair seat: cloth that comes down onto it stays on its top. The contact is dead (no bounce) and grippy
  // (it kills sliding), and only catches cloth arriving from above, so the hem hanging past the seat's edge is never
  // yanked up onto it.
  seatPush(q) {
    const P = this.pts, Q = this.prev, s = rig.seat, top = SEAT_Y + 0.003;
    const m = Math.abs(Q[q + 1] - top) < 0.001 ? 0.008 : 0;   // cloth already resting on the seat keeps hold of its edges
    if (!s || P[q] < s.back - m || P[q] > s.front + m || Math.abs(P[q + 2]) > s.half + m) return;
    if (P[q + 1] >= top || Q[q + 1] < top - 0.002) return;   // (cloth swinging in under the edge is left alone, or it would pop up onto it)
    P[q + 1] = top; Q[q + 1] = top;
    // static friction: cloth resting on the seat stays put unless it is pulled harder than the seat grips, so the
    // drape doesn't creep toward the edges and slip off a bit at a time; past that it slides, slowed by the grip
    const tx = P[q] - Q[q], tz = P[q + 2] - Q[q + 2], tl = Math.hypot(tx, tz), grip = 0.0004;
    const k = tl <= grip ? 0 : (tl - grip) / tl;
    P[q] = Q[q] + tx * k; P[q + 2] = Q[q + 2] + tz * k;
    Q[q] = lerp(Q[q], P[q], 0.6); Q[q + 2] = lerp(Q[q + 2], P[q + 2], 0.6);
  }
  pushSphere(k, C, r) {
    const P = this.pts, dx = P[k] - C.x, dy = P[k + 1] - C.y, dz = P[k + 2] - C.z, d = Math.hypot(dx, dy, dz);
    if (d < r && d > 1e-6) { const s = (d + (r - d) * this.soft) / d; this.pushTo(k, C.x + dx * s, C.y + dy * s, C.z + dz * s); }
  }
}
// Body surface around the spine at height y, in direction d (figure-local, horizontal): the spine centre there,
// and how far out the skin is. Used to put the cloak right on her back.
function spineAt(y) {
  const sp = rig.spine;
  if (y <= sp[0].p.y) return sp[0];
  for (let i = 1; i < sp.length; i++) if (y <= sp[i].p.y) {
    const k = (y - sp[i - 1].p.y) / (sp[i].p.y - sp[i - 1].p.y);
    return { n: sp[i - 1].n, p: sp[i - 1].p.clone().lerp(sp[i].p, k) };
  }
  return sp[sp.length - 1];
}
function surfaceAt(y, dx, dz, maxLat) {
  // try a tight search first; widen the height band and the cone until a skin vertex is found
  for (const [band, cone] of [[0.008, 0.32], [0.014, 0.55], [0.022, 0.9], [0.04, 1.4]]) {
    const r = surfaceAt1(y, dx, dz, maxLat, band, cone);
    if (r.vert) return r;
  }
  return surfaceAt1(y, dx, dz, 0, 0.08, 1.57);
}
function surfaceAt1(y, dx, dz, maxLat, band, cone) {
  const c = spineAt(y).p, cosCone = Math.cos(cone);
  let best = 0, vert = null;
  for (const v of rig.torsoVerts) {
    if (Math.abs(v.y - y) > band || (maxLat && Math.abs(v.x) > maxLat)) continue;
    const rx = v.x - c.x, rz = v.z - c.z, r = Math.hypot(rx, rz);
    if (r < 1e-4 || (rx * dx + rz * dz) / r < cosCone) continue;
    const d = rx * dx + rz * dz;
    if (d > best) { best = d; vert = v; }
  }
  return { c, s: best, bone: spineAt(y).n, vert };
}
// where a skin vertex is right now (skinned), pushed out by gap along a figure-local horizontal direction, in stage space
const _sv = new THREE.Vector3(), _so = new THREE.Vector3();
function skinPoint(vert, dx, dz, gap, out) {
  vert.mesh.boneTransform(vert.i, _sv); vert.mesh.localToWorld(_sv);
  _so.set(dx * gap, 0, dz * gap).applyQuaternion(rig.root.getWorldQuaternion(_q2)).divideScalar(stageG.scale.x);
  return stageG.worldToLocal(out.copy(_sv)).add(_so);
}
const legCaps = (sp, r1, r2) => ['L', 'R'].flatMap(s => [[sp('UpperLeg.' + s), sp('LowerLeg.' + s), r1], [sp('LowerLeg.' + s), sp('LowerLeg.' + s + '_end'), r2]]);
const CLOAK_GAP = 0.003;   // cloth thickness off the skin
// long hair: a sheet from ear to ear round the back of the head, falling to the middle of her back
// Her ponytail: the model's own ponytail mesh is rigid (all of it on the Head bone), so it is hidden and replaced by a
// fabric tube built in its exact shape (rings traced round its cross-section, top to tip; see buildPonytail), pinned
// at the scalp. From its first frame it is ordinary cloth: links keep the ponytail's own lengths, gravity, drag and the
// head, neck and back push it about.
const hair = new Cloth({
  bone: 'Head', N: 8, M: 12, len: 0.08, closed: true, drag: 2.2, bend: 0.45,
  anchorsLocal() { return this.shapeRoot.slice(0, this.N); },
  colliders(sp) {
    const head = sp('Head'), top = sp('Head_end'), neck = sp('Neck'), chest = sp(bn('Chest') ? 'Chest' : 'Torso'), hips = sp('Hips');
    const hc = head.clone().lerp(top, 0.45);
    return { caps: [[neck, hc, rig.head.r * 0.55], [hips, chest, 0.038]], spheres: [[hc, rig.head.r]] };
  },
});
// cloak: from one shoulder round the back of the neck to the other, down to her calves, open at the front.
// The top edge sits on her skin (measured from the mesh); down to the waist the cloth is held onto her back,
// below it hangs free and swings.
const cloak = new Cloth({
  bone: 'Chest', N: 15, M: 19, len: 0.34, closed: false, spread: 0.09, drag: 2.4, bend: 0.55, soft: 0.3, absorb: 0.8, seat: true,   // legs ease the cloth aside instead of shoving it
  dirs() { return Array.from({ length: this.N }, (_, i) => { const t = lerp(-1.75, 1.75, i / (this.N - 1)); return [Math.sin(t), -Math.cos(t)]; }); },
  anchorsLocal() {
    // the top edge: pinned to the skin vertices round the back of her neck and over her shoulders
    const y = rig.shoulderY + 0.01, maxLat = Math.abs(rig.lat.L.sh) * 0.9;
    this.pins = this.dirs().map(([dx, dz]) => ({ dx, dz, vert: surfaceAt(y, dx, dz, maxLat).vert }));
    return this.pins.map(({ dx, dz, vert }) => { const v = vert.clone(); v.x += dx * CLOAK_GAP; v.z += dz * CLOAK_GAP; return v; });
  },
  anchorStage(i, out) { const p = this.pins[i]; return skinPoint(p.vert, p.dx, p.dz, CLOAK_GAP, out); },
  // the rows above her hips are held on her back, each on the skin vertex furthest out in its direction
  setupHold() {
    const seg = this.len / (this.M - 1), y0 = rig.shoulderY + 0.01, maxLat = Math.abs(rig.lat.L.sh) * 0.9;
    this.hold = [];
    this.dirs().forEach(([dx, dz], i) => {
      for (let l = 1; l < this.M; l++) {
        const y = y0 - l * seg;
        const w = ss((y - (rig.hipRestY - 0.012)) / 0.05);
        if (w <= 0.01) break;
        const { vert } = surfaceAt(y, dx, dz, maxLat);
        // rows below the small of her back let go as her hips bend, so the cloak drapes over her bottom and the seat
        if (vert) this.hold.push({ q: (l * this.N + i) * 3, dx, dz, vert, w, low: y < rig.waistY + 0.03 });
      }
    });
    this.waistR = surfaceAt(rig.waistY, 0, -1).s + CLOAK_GAP;
    this.hipR = surfaceAt(rig.hipRestY - 0.01, 0, -1).s + CLOAK_GAP;
  },
  holdPoint(h, out) { return skinPoint(h.vert, h.dx, h.dz, CLOAK_GAP, out); },
  colliders(sp) {
    const chest = sp(bn('Chest') ? 'Chest' : 'Torso'), hips = sp('Hips');
    return { caps: [[hips, chest, this.waistR || 0.04], ...legCaps(sp, 0.028, 0.022)], spheres: [[hips, this.hipR || 0.045]] };
  },
});

// ---------- walking: planted feet + two-bone IK ----------
// Timing from clinical gait data: stance 0–60 % of the cycle (heel strike, foot flat, heel-off, toe-off), swing 60–100 %.
// A planted foot's ground contact is a fixed point (heel, then sole, then toe), so it cannot slip; the hip moves
// on and the legs are solved to reach their feet. The hip rides highest over each midstance, lowest in double support.
const GAIT = { c: 0.25, heelEnd: 0.08, heelOff: 0.45, toeOff: 0.6, strike: -0.22, push: 0.6 };
const GAITS = {
  walk:   { S: 0.30, v: 0.30, clear: 0.014, Hc: 0.256, bob: 0.006, lean: 0.07, nod: 0, arm: 0.7, elbow: 0.16 },
  trudge: { S: 0.20, v: 0.15, clear: 0.009, Hc: 0.25, bob: 0.004, lean: 0.2, nod: 0.4, arm: 0.3, elbow: 0.22 },
  run:    { S: 0.40, v: 0.62, clear: 0.022, Hc: 0.25, bob: 0.009, lean: 0.2, nod: -0.05, arm: 1.2, elbow: 1.1 },
};
// foot for one leg at gait phase phi; Af = where the ankle sits during foot-flat (distance along the walk)
function footAt(phi, Af, G) {   // G.F: which foot's heel and toe to pivot on
  const FOOT = G.F || FOOTS.L;
  if (phi < GAIT.heelEnd) {                       // heel strike → foot flat, pivoting on the heel
    const p = lerp(GAIT.strike, 0, ss(phi / GAIT.heelEnd));
    const hx = Af + FOOT.heel[0], [rx, ry] = rotF(FOOT.heel, p);
    return { x: hx - rx, y: -ry, p };
  }
  if (phi < GAIT.heelOff) return { x: Af, y: ANKLE_H, p: 0 };
  if (phi < GAIT.toeOff) {                        // heel-off → toe-off, pivoting on the toe
    const p = lerp(0, GAIT.push, ss((phi - GAIT.heelOff) / (GAIT.toeOff - GAIT.heelOff)));
    const tx = Af + FOOT.toe[0], [rx, ry] = rotF(FOOT.toe, p);
    return { x: tx - rx, y: -ry, p };
  }
  const u = (phi - GAIT.toeOff) / (1 - GAIT.toeOff);   // swing
  const a = footAt(GAIT.toeOff - 1e-9, Af, G), b = footAt(0, Af + G.S, G);
  return {
    x: lerp(a.x, b.x, ss(u)),
    y: lerp(a.y, b.y, u) + G.clear * Math.sin(Math.PI * u),
    p: lerp(GAIT.push, GAIT.strike, ss(u / 0.75)),
  };
}
function ik(hx, hy, ax, ay) {    // returns thigh angle and knee bend; knee points forward
  const dx = ax - hx, dy = ay - hy, d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-5, L1 + L2 - 1e-5);
  const beta = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const knee = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  return { a: Math.atan2(dx, -dy) + beta, b: Math.PI - knee };
}
const OFFSETS = { A: 0.25, B: 0.75 };   // at d = 0 leg A is at midstance under the hip and leg B mid-swing
// Walks start and end standing. The stride is stretched so the walk covers a whole number of half-strides:
// then the walk ends with one foot flat under the hip and the other swinging in beside it, the mirror of the start.
function gaitPose(d, w) {
  const G = w.G, S = w.S, win = 0.25 * S;
  const kIn = ss(d / win), kOut = ss((w.D - d) / win), k = Math.min(kIn, kOut);
  const feet = {};
  for (const L of ['A', 'B']) {
    const s = d / S + OFFSETS[L], phi = s - Math.floor(s);
    const Af = (Math.floor(s) - OFFSETS[L]) * S + GAIT.c * S;
    const GF = { ...G, S, F: L === 'A' ? FOOTS.R : FOOTS.L };
    let ft = footAt(phi, Af, GF);
    if (L === 'B' && d < win) {                     // first step: B swings out from where it stood
      const uu = clamp((phi - 0.75) / 0.25, 0, 1), b = footAt(0, Af + S, GF);
      ft = { x: lerp(0, b.x, ss(uu)), y: lerp(ANKLE_H, b.y, uu) + G.clear * Math.sin(Math.PI * uu), p: lerp(0, GAIT.strike, ss(uu)) };
    }
    if (L === w.lastSwing && d > w.D - win && phi >= GAIT.toeOff - 1e-9) {   // last step: swing in beside the planted foot
      const uu = clamp((phi - GAIT.toeOff) / (0.75 - GAIT.toeOff), 0, 1), a = footAt(GAIT.toeOff - 1e-9, Af, GF);
      ft = { x: lerp(a.x, w.D, ss(uu)), y: lerp(a.y, ANKLE_H, uu) + G.clear * Math.sin(Math.PI * uu), p: lerp(GAIT.push, 0, ss(uu)) };
    }
    feet[L] = { ...ft, phi };
  }
  const gaitHip = G.Hc + G.bob * Math.cos(4 * Math.PI * (feet.A.phi - GAIT.c));
  let hy = lerp(POSES.stand.hipY, gaitHip, k);
  for (const L of ['A', 'B']) {
    const dx = feet[L].x - d, max = L1 + L2 - 0.0015;
    hy = Math.min(hy, feet[L].y + Math.sqrt(Math.max(0, max * max - dx * dx)));
  }
  const A = ik(d, hy, feet.A.x, feet.A.y), B = ik(d, hy, feet.B.x, feet.B.y);
  const upper = { lean: G.lean, nod: G.nod, uA: -G.arm * A.a + 0.04, fA: G.elbow + 0.3 * Math.max(0, -G.arm * A.a), uB: -G.arm * B.a + 0.04, fB: G.elbow + 0.3 * Math.max(0, -G.arm * B.a) };
  const rest = d < w.D / 2 ? w.from : POSES.stand;
  const o = { hipY: hy, thighA: A.a, kneeA: A.b, pitchA: feet.A.p, thighB: B.a, kneeB: B.b, pitchB: feet.B.p };
  for (const key in upper) o[key] = lerp(rest[key], upper[key], k);
  return o;
}
// critically damped smoothing (exact for any frame time, so it never overshoots or oscillates)
function smoothDamp(cur, target, st, smoothTime, dt, maxSpeed = Infinity) {
  const omega = 2 / smoothTime, x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * smoothTime;
  const change = clamp(cur - target, -maxChange, maxChange), tgt = cur - change;
  const temp = (st.v + omega * change) * dt;
  st.v = (st.v - omega * temp) * e;
  let out = tgt + (change + temp) * e;
  if ((target - cur > 0) === (out > target)) { out = target; st.v = 0; }
  return out;
}
// timed, eased pose change (sitting down, standing up); returns true when finished
function transitionTo(to, dt, dur) {
  if (!fig.trans || fig.trans.to !== to) {
    let d = 0; for (const k of ['hipY', 'thighA', 'kneeA', 'thighB', 'kneeB', 'lean']) d = Math.max(d, Math.abs(fig.pose[k] - to[k]) / (k === 'hipY' ? 0.12 : 1.2));
    fig.trans = { from: { ...fig.pose }, to, t: 0, dur: dur || clamp(0.25 + d * 0.8, 0.25, 1.0) };
  }
  const tr = fig.trans;
  tr.t += dt;
  const k = tr.t / tr.dur, e = k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10);
  fig.pose = lerpPose(tr.from, tr.to, e);
  if (k >= 1) { fig.trans = null; fig.pose = { ...to }; return true; }
  return false;
}
function lerpPose(a, b, k) { const o = {}; for (const key in b) o[key] = lerp(a[key], b[key], k); return o; }
function blend(to, k) { for (const key in fig.pose) fig.pose[key] += (to[key] - fig.pose[key]) * k; }
function nearStand(p) {
  let m = 0; for (const key of ['thighA', 'kneeA', 'thighB', 'kneeB', 'pitchA', 'pitchB']) m = Math.max(m, Math.abs(p[key] - POSES.stand[key]));
  return m < 0.02 && Math.abs(p.hipY - POSES.stand.hipY) < 0.002;
}

let walker = null;
function walkTo(tx, dt, gaitName = 'walk') {
  if (!walker || walker.tx !== tx) {
    if (Math.abs(tx - fig.x) < 0.002) { fig.x = tx; walker = null; return true; }
    if (!turn && !nearStand(fig.pose)) { transitionTo(POSES.stand, dt); return false; }   // (a turn dips the hips: don't fight it)
    if (!turnInPlace(Math.sign(tx - fig.x), dt)) return false;   // step round to face the way she'll walk
    const G = GAITS[gaitName], D = Math.abs(tx - fig.x);
    const m = Math.max(1, Math.round(2 * D / G.S)), S = 2 * D / m;
    const lastSwing = Math.abs(((D / S + OFFSETS.A) % 1) - 0.75) < 0.01 ? 'A' : 'B';
    // legs are already at the standing pose; keep the upper body where it is so the head and arms don't snap
    const cur = fig.pose;
    fig.pose = { ...POSES.stand, lean: cur.lean, nod: cur.nod, uA: cur.uA, fA: cur.fA, uB: cur.uB, fB: cur.fB };
    walker = { x0: fig.x, tx, dir: Math.sign(tx - fig.x), D, S, d: 0, from: { ...fig.pose }, G, lastSwing };
  }
  const w = walker, G = w.G;
  // pick up speed from standstill over ~0.35 s, and slow over the last few centimetres
  w.tt = (w.tt || 0) + dt;
  const ramp = Math.min(0.04 + ss(w.tt / 0.35), 1, 0.1 + 0.9 * ss((w.D - w.d) / 0.07));
  w.d = Math.min(w.D, w.d + (w.vOverride || G.v) * ramp * dt);
  fig.pose = gaitPose(w.d, w);
  fig.face = w.dir;
  fig.x = w.x0 + w.dir * w.d;
  if (w.d >= w.D) { walker = null; fig.x = tx; return true; }
  return false;
}

// ---------- the kick ----------
const STRIKE_B = 0.06, KICK_PITCH = 0.1;
const SUPPORT = { thighB: 0, kneeB: 0.08, pitchB: 0 };   // standing knee a little soft; thigh set in init so the ankle stays under the hip
function leverShadowPoint(frac, a = SW.maxTilt) {   // a: the lever's angle (leverPivot.rotation.z), fully on by default
  return shadowOf(new THREE.Vector3(SW.x - Math.sin(a) * SW.lever * frac, PLINTH.h + SW.pivot + Math.cos(a) * SW.lever * frac, SW.z));
}
const CONTACT = leverShadowPoint(0.5);
const LEVER_HALF_W = 0.0019 * ratio(SW.z);
let KICK_HIP = 0.26, STRIKE = { a: 0.9, x: -0.2 }, SIT_X = CHAIR_X, FRONT_X = CHAIR_X + 0.15, SIT_HIP = 0.18;
function toeAt(a) {
  const [, [ax, ay]] = legPts(0, KICK_HIP, a, STRIKE_B, 1);
  const [tx, ty] = rotF(FOOTS.R.tip, KICK_PITCH);   // she kicks with her right (leg A)
  return [ax + tx, ay + ty];
}
// angles: radians from straight down, positive = forward; shins and forearms bend relative to the segment above
let POSES = {};
const fig = { x: CHAIR_X + 0.17, face: 1, pose: null };
// shorten (or lengthen) the chair's legs so the seat top sits at height `target`; seat, back and rungs keep their shape
function fitChairSeat(target) {
  const k = FIG_H / PERSON_H, seatLocal = chair.userData.seat, want = target / k;
  const pos = chair.geometry.attributes.position;
  if (!chair.userData.y0) chair.userData.y0 = Float32Array.from({ length: pos.count }, (_, i) => pos.getY(i));
  const y0 = chair.userData.y0, below = seatLocal - 0.04, f = (want - 0.04) / below;
  for (let i = 0; i < pos.count; i++) pos.setY(i, y0[i] < below ? y0[i] * f : y0[i] - below * (1 - f));
  pos.needsUpdate = true; chair.geometry.computeBoundingBox(); chair.geometry.computeBoundingSphere();
  chair.scale.setScalar(k); chair.scale.x *= 0.04;   // flattened in depth so all four legs land on the ledge
  chair.position.set(CHAIR_X, 0, 0);
  chair.updateMatrixWorld(true);
  SEAT_Y = want * k;
}
// the lowest point of her hips and thighs over the seat, posed seated (skinned vertices)
function seatContact() {
  const v = new THREE.Vector3(), want = ['Body', 'Hips', 'UpperLeg.L', 'UpperLeg.R', 'Abdomen'].map(bn);
  let minY = Infinity;
  rig.root.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight, ids = want.map(b => m.skeleton.bones.indexOf(b));
    for (let i = 0; i < J.count; i++) {
      const w = [W.getX(i), W.getY(i), W.getZ(i), W.getW(i)], j = [J.getX(i), J.getY(i), J.getZ(i), J.getW(i)];
      let b = 0, bw = -1; for (let q = 0; q < 4; q++) if (w[q] > bw) { bw = w[q]; b = j[q]; }
      if (!ids.includes(b)) continue;
      m.boneTransform(i, v); m.localToWorld(v); stageG.worldToLocal(v);
      if (v.x > rig.seat.back && v.x < rig.seat.front) minY = Math.min(minY, v.y);
    }
  });
  return minY;
}
// everything that depends on the model's measured proportions
function initFigureConstants() {
  const legMax = L1 + L2;
  GAITS.walk.Hc = legMax * 0.965 + ANKLE_H; GAITS.trudge.Hc = legMax * 0.94 + ANKLE_H; GAITS.run.Hc = legMax * 0.93 + ANKLE_H;
  const legK = legMax / 0.265;
  GAITS.walk.S = 0.30 * legK; GAITS.walk.v = 0.27 * legK; GAITS.walk.clear = 0.014 * legK;
  GAITS.trudge.S = 0.2 * legK; GAITS.trudge.v = 0.11 * legK; GAITS.trudge.clear = 0.009 * legK;
  GAITS.run.S = 0.4 * legK; GAITS.run.v = 0.62 * legK; GAITS.run.clear = 0.022 * legK;
  // Seated she rests the backs of her thighs on the seat with her shins upright, so the seat belongs at her knee
  // height less the thickness of her thigh. The chair's legs are shortened to put it there; its seat, back and
  // rungs keep their shape.
  SIT_HIP = ANKLE_H + L2 * 0.985;
  const seatTarget = SIT_HIP - rig.thighBack - 0.002;
  if (chair) {
    fitChairSeat(seatTarget);
    const pos = chair.geometry.attributes.position;
    // seat front and back edges, from the geometry itself
    chair.updateMatrixWorld(true);
    let front = -Infinity, back = Infinity; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); stageG.worldToLocal(chair.localToWorld(v));
      if (Math.abs(v.y - SEAT_Y) < 0.006) { front = Math.max(front, v.x); back = Math.min(back, v.x); }
    }
    rig.seat = { front, back, half: 0.32 * FIG_H / PERSON_H };   // the real chair is ~0.64 m wide
    SIT_X = lerp(back, front, 0.42);
  }
  FRONT_X = SIT_X + L1;               // standing in front of the seat: where her feet stay while she sits
  // standing: knees a hair soft (0.02 rad) with the ankles exactly under the hips, the same place walks start and end
  const th0 = 0.02 * L2 / (L1 + L2);
  const stand = withHip({ thighA: th0, kneeA: 0.02, thighB: th0, kneeB: 0.02, lean: 0.03, uA: 0.06, fA: 0.14, uB: -0.04, fB: 0.12, nod: 0 });
  const legs = ik(SIT_X, SIT_HIP, FRONT_X, ANKLE_H), seatLegs = { hipY: SIT_HIP, thighA: legs.a, kneeA: legs.b, thighB: legs.a, kneeB: legs.b, pitchA: 0, pitchB: 0 };
  POSES = {
    stand,
    sitRest:     { ...stand, ...seatLegs, lean: 0.06, nod: 0.08, uA: 0.42, fA: 0.85, uB: 0.36, fB: 0.9 },
    // arm angles found by search so the wrists reach the face / chin (miss in profile: 2.7 mm / 1.5 mm)
    headInHands: { ...stand, ...seatLegs, lean: 0.62, nod: 0.95, uA: 0.0, fA: 2.3, uB: -0.04, fB: 2.27 },
    chinInHands: { ...stand, ...seatLegs, lean: 0.5, nod: -0.3, uA: 0.65, fA: 2.45, uB: 0.61, fB: 2.42 },
  };
  SUPPORT.thighB = SUPPORT.kneeB * L2 / (L1 + L2);       // support ankle exactly under the hip: the foot never slides into a kick
  KICK_HIP = reach(SUPPORT.thighB, SUPPORT.kneeB) + ANKLE_H;
  let lo = 0.1, hi = 1.7;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (toeAt(m)[1] < CONTACT.y) lo = m; else hi = m; }
  const a = (lo + hi) / 2;
  STRIKE = { a, x: CONTACT.x - LEVER_HALF_W + 0.004 - toeAt(a)[0] };
  // the push: planted ankles from the strike pose; step the hips in until the kicking knee bends ~25 degrees
  PUSH.kickAnkle = legPts(STRIKE.x, KICK_HIP, STRIKE.a, STRIKE_B, 1)[1];
  PUSH.supAnkle = legPts(STRIKE.x, KICK_HIP, SUPPORT.thighB, SUPPORT.kneeB, 1)[1];
  for (PUSH.dx = 0; PUSH.dx < 0.12 && pushLegs(PUSH.dx).kneeA < 0.44; PUSH.dx += 0.001);
  fig.x = SIT_X; fig.face = 1; fig.pose = { ...POSES.sitRest };
}

// ---------- the kick ----------
// arms counterbalance the leg: they swing back with the elbows bending on the wind-up, fling out and straighten
// on the strike, and fold back in as she recovers
const KICK = { dur: 0.78, contact: 0.5, release: 0.64 };
function kickPose(u, held) {
  const p = { ...POSES.stand, ...SUPPORT, hipY: KICK_HIP };
  if (u < 0.4) {                 // wind up: the foot lifts straight up first (thigh forward by the knee's share), then draws back
    const k = ss(u / 0.4), lift = ss(Math.min(1, u / 0.4 * 2.2)), back = ss(Math.max(0, (u / 0.4 - 0.25) / 0.75));
    p.kneeA = lerp(POSES.stand.kneeA, 1.14, lift);
    p.thighA = lerp(p.kneeA * L2 / (L1 + L2), -0.55, back); p.pitchA = 0.5 * k; p.lean = 0.14 * k;
    p.uA = lerp(0.06, 0.55, k); p.fA = lerp(0.14, 1.05, k); p.uB = lerp(-0.04, -0.45, k); p.fB = lerp(0.12, 0.85, k);
  } else if (u < KICK.contact) { // strike
    const k = Math.min(1, (u - 0.4) / (KICK.contact - 0.4));
    p.thighA = -0.55 + (STRIKE.a + 0.55) * k; p.kneeA = 1.14 - (1.14 - STRIKE_B) * k;
    p.pitchA = lerp(0.5, KICK_PITCH, k); p.lean = 0.14 - 0.28 * k;
    p.uA = lerp(0.55, -0.4, k); p.fA = lerp(1.05, 0.3, k); p.uB = lerp(-0.45, 0.7, k); p.fB = lerp(0.85, 0.35, k);
  } else if (u < KICK.release) { // foot on the lever
    const k = (u - KICK.contact) / (KICK.release - KICK.contact);
    p.thighA = STRIKE.a; p.kneeA = STRIKE_B; p.pitchA = KICK_PITCH; p.lean = -0.14;
    p.uA = -0.4; p.fA = 0.3 + 0.25 * Math.sin(k * Math.PI); p.uB = 0.7; p.fB = 0.35 + 0.3 * Math.sin(k * Math.PI);
  } else {                       // bounce back off a held switch, or swing through a free one, then recover
    const k = Math.min(1, (u - KICK.release) / (1 - KICK.release));
    const over = held ? -0.12 * Math.sin(k * Math.PI) : 0.15 * Math.sin(k * Math.PI);
    // the thigh comes back under her first, then the knee straightens: the foot sets down vertically, under the hip
    // swing the leg back under her with the knee folding, then set the foot straight down: in the last part the
    // thigh keeps the knee's share forward, so the ankle drops vertically onto its standing spot
    const fold = Math.sin(Math.min(1, k / 0.6) * Math.PI / 2), knee = lerp(STRIKE_B, 0.75, fold) * (1 - ss(Math.max(0, (k - 0.55) / 0.45))) + POSES.stand.kneeA * ss(Math.max(0, (k - 0.55) / 0.45));
    const under = knee * L2 / (L1 + L2), toUnder = ss(Math.min(1, k / 0.55));
    p.kneeA = knee; p.thighA = lerp(STRIKE.a + over, under, toUnder);
    p.pitchA = KICK_PITCH * (1 - k); p.lean = -0.14 * (1 - k);
    p.uA = lerp(-0.4, 0.06, ss(k)); p.fA = lerp(0.3, 0.14, ss(k)) + 0.55 * Math.sin(k * Math.PI);
    p.uB = lerp(0.7, -0.04, ss(k)); p.fB = lerp(0.35, 0.12, ss(k)) + 0.45 * Math.sin(k * Math.PI);
  }
  // elbows drawn back and bent, fists tucked in, for the whole kick (eased in and out so it meets the standing pose)
  const e = ss(u / 0.22) * (1 - ss((u - 0.8) / 0.2));
  p.uA -= 0.55 * e; p.uB -= 0.55 * e; p.fA += 0.75 * e; p.fB += 0.75 * e;
  return p;
}
const PUSH = { dx: 0.03, kickAnkle: [0, 0], supAnkle: [0, 0], follow: [0, 0] };
// while she leans on it, her toe rides the lever wherever the visitor moves it (follow: how far its contact point has
// moved from where it sits fully on)
function followLever() {
  const c = leverShadowPoint(0.5, leverPivot.rotation.z);
  PUSH.follow = [c.x - CONTACT.x, c.y - CONTACT.y];
}
// the lingering push: the foot stays on the lever and leans into it in slow pulses, toes curling, arms bracing
let pushForce = 0;      // 0..1, read by the lever (strain) and the visitor's hand (finger flex)
let kickAge = 9;        // seconds since a kick landed on the held lever; a brief jolt the visitor's finger feels
const kickJolt = () => kickAge < 0.03 ? kickAge / 0.03 : Math.exp(-(kickAge - 0.03) / 0.07);
const strain = () => Math.max(pushForce, 0.8 * kickJolt());
// Both feet stay put (the support foot flat, the kicking toe on the lever); she shifts her hips in toward the
// switch so the kicking knee bends, and each pulse leans a little further in.
function pushLegs(dx) {
  const hx = STRIKE.x + dx, hy = KICK_HIP - Math.abs(dx) * 0.2;   // sinks a little as she leans in
  const k = ik(hx, hy, PUSH.kickAnkle[0] + PUSH.follow[0], PUSH.kickAnkle[1] + PUSH.follow[1]), sp = ik(hx, hy, PUSH.supAnkle[0], ANKLE_H);
  return { x: hx, hipY: hy, thighA: k.a, kneeA: k.b, thighB: sp.a, kneeB: sp.b };
}
function pushPose(t) {
  const pulse = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * 0.9), p = kickPose(KICK.contact + 0.001, true);
  const legs = pushLegs(PUSH.dx + 0.008 * pulse);
  Object.assign(p, legs); delete p.x;
  p.pitchA = KICK_PITCH + 0.12 * pulse; p.lean = -0.04 - 0.06 * pulse;
  p.uA = -0.25 - 0.2 * pulse; p.fA = 0.75 + 0.45 * pulse; p.uB = 0.55 + 0.15 * pulse; p.fB = 0.8 + 0.5 * pulse;
  p.nod = 0.2 + 0.1 * pulse;
  return { p, pulse, x: legs.x };
}

// ---------- sitting down and standing up ----------
// Feet stay planted in front of the seat; the hips travel back and down onto it (or up and forward off it)
// while she leans forward to balance; the legs are solved to the planted feet every frame.
function sitPose(u, end) {
  const e = u * u * u * (u * (u * 6 - 15) + 10);
  const hx = lerp(FRONT_X, SIT_X, ss(Math.min(1, u * 1.25)));
  const hy = lerp(POSES.stand.hipY, SIT_HIP, ss(Math.max(0, (u - 0.08) / 0.92)));
  const leg = ik(hx, hy, FRONT_X, ANKLE_H);
  const sb = Math.sin(Math.PI * u), bend = 0.5 * sb * sb;   // forward lean, zero rate at both ends: no jolt entering or leaving the seat
  const o = lerpPose(POSES.stand, end, e);
  Object.assign(o, { hipY: hy, thighA: leg.a, kneeA: leg.b, thighB: leg.a, kneeB: leg.b, pitchA: 0, pitchB: 0 });
  o.lean = lerp(POSES.stand.lean, end.lean, e) + bend;
  o.uA += bend * 0.6; o.uB += bend * 0.5;      // hands reach forward as she lowers
  return { x: hx, pose: o };
}

// ---------- the angry stomp ----------
// Fists down, head lowered, she stamps one foot then the other. Each foot lifts and slams straight down onto the
// spot it stood on (legs solved to the planted ankles), and the impact jolts her hips, shoulders and fists.
const STOMP = { pre: 0.3, stamp: 0.42, post: 0.55 };
const stompDur = n => STOMP.pre + n * STOMP.stamp + STOMP.post;
function stompPose(t, n, from) {
  const st = POSES.stand, total = stompDur(n);
  const fx = Math.sin(st.thighA) * L1 + Math.sin(st.thighA - st.kneeA) * L2;   // standing ankle, relative to the hip
  const anger = ss(t / STOMP.pre) * (1 - ss((t - (total - STOMP.post)) / STOMP.post));
  const H = 0.34 * L2;
  let lift = 0, imp = 0, side = 'A';
  for (let i = 0; i < n; i++) {
    const u = (t - STOMP.pre - i * STOMP.stamp) / STOMP.stamp;
    if (u >= 0 && u < 1) {
      side = i % 2 ? 'B' : 'A';
      lift = u < 0.5 ? H * Math.sin(u / 0.5 * Math.PI / 2)                   // knee comes up
           : u < 0.72 ? H * (1 - Math.pow((u - 0.5) / 0.22, 2)) : 0;          // and slams down, accelerating
    }
    const s = (t - STOMP.pre - (i + 0.72) * STOMP.stamp);
    if (s >= 0) imp = Math.max(imp, Math.exp(-s / 0.07));
  }
  const hy = st.hipY - 0.025 * L1 * anger - 0.03 * L1 * imp;
  const flat = ik(0, hy, fx, ANKLE_H), up = ik(0, hy, fx + 0.25 * lift, ANKLE_H + lift);
  const lifted = side === 'A' ? up : flat, other = side === 'A' ? flat : up;
  const toe = 0.3 * lift / H;
  const angry = { lean: 0.17 + 0.07 * imp, nod: 0.3 + 0.12 * imp, uA: -0.16 - 0.12 * imp, fA: 0.28 - 0.1 * imp, uB: -0.2 - 0.12 * imp, fB: 0.3 - 0.1 * imp };
  const o = { hipY: hy, thighA: lifted.a, kneeA: lifted.b, pitchA: side === 'A' ? toe : 0, thighB: other.a, kneeB: other.b, pitchB: side === 'B' ? toe : 0 };
  const base = t < STOMP.pre ? from : st;   // ease in from however the walk left her arms and head, ease out to standing
  for (const key in angry) o[key] = lerp(base[key], angry[key], anger);
  return o;
}

// ---------- behaviour ----------
const S = { mode: 'rest', t: 0, fails: 0, hit: false, patience: 3, clock: 0, flips: [], stomps: 0 };
// flipping the light back and forth while she walks between the switch and her chair makes her stamp her feet
const ANGER = { flips: 3, within: 8 };
const rand = (a, b) => a + Math.random() * (b - a);
let seatedPose = null;
function startSit(endName, next, dur = 1.25) { S.sit = { u: 0, dir: 1, dur, end: POSES[endName] }; S.mode = 'sitting'; S.next = next; seatedPose = endName; }
function startRise(next, dur = 1.0) { S.sit = { u: 1, dir: -1, dur, end: fig.pose }; S.mode = 'sitting'; S.next = next; }
function stepSit(dt) {
  const st = S.sit;
  st.u = clamp(st.u + st.dir * dt / st.dur, 0, 1);
  const { x, pose } = sitPose(st.u, st.end);
  fig.x = x; fig.face = 1; fig.pose = pose;
  return st.dir > 0 ? st.u >= 1 : st.u <= 0;
}
// walk somewhere; if already walking somewhere else, finish the current stride gracefully first
function goTo(tx, dt, gait) {
  if (walker && Math.abs(walker.tx - tx) > 1e-6) stopWalk();
  if (walker && walker.stopping) { if (walkTo(walker.tx, dt)) walker = null; return false; }
  return walkTo(tx, dt, gait);
}
function stopWalk() {   // end the walk at the next foot-together point
  const w = walker;
  if (!w || w.stopping) return;
  const half = 0.5 * w.S, D = Math.min(w.D, Math.ceil((w.d + 0.25 * w.S) / half - 1e-6) * half);
  if (D < w.D - 1e-6) { w.D = D; w.tx = w.x0 + w.dir * D; w.lastSwing = Math.abs(((D / w.S + OFFSETS.A) % 1) - 0.75) < 0.01 ? 'A' : 'B'; }
  w.stopping = true;
  w.vOverride = GAITS.walk.v * 1.15;   // finish the step briskly: she has noticed something
}
// come to a standstill wherever she is: finish the stride or the turn in progress; true once standing still
function halt(dt) {
  if (turn) { turnInPlace(turn.target > 0 ? 1 : -1, dt); return false; }
  if (walker) { stopWalk(); if (walkTo(walker.tx, dt)) walker = null; return false; }
  return true;
}
let turnDt = 0;
function turnTo(face) { return turnInPlace(face, turnDt); }
function newAttempt() { S.fails = 0; S.patience = Math.floor(rand(2, 6)); }
function afterKick() {   // decide what the next attempt is, or give up
  if (!on) { S.mode = 'home'; S.t = 0; return; }   // she kicked it off (or it went off mid-kick): home in the dark
  if (S.fails >= S.patience) { S.mode = 'giveupWalk'; return; }
  if (S.fails >= 1 && Math.random() < 0.4) { S.mode = 'push'; S.t = -0.2; S.dur = rand(1.5, 2.6); S.hit = false; return; }
  S.mode = 'kick'; S.t = -rand(0.2, 0.5); S.hit = false;
}
function stepFigure(dt, t) {
  if (!rig.ready) return;
  S.t += dt; S.clock += dt; turnDt = dt;
  pushForce = 0; PUSH.follow[0] = PUSH.follow[1] = 0;
  switch (S.mode) {
    case 'rest':                   // sitting quietly; when the lamp comes on she takes a moment before getting up
      if (on) {
        if (S.wait == null) S.wait = rand(1.0, 2.6);
        if ((S.wait -= dt) <= 0 && S.t > S.minSit) { S.wait = null; newAttempt(); startRise('notice'); }
      } else S.wait = null;
      break;
    case 'sitting':
      if (stepSit(dt)) {
        if (S.sit.dir > 0) { S.mode = S.next; S.t = 0; S.wait = null; S.minSit = S.next === 'sulk' ? rand(6, 11) : rand(4, 8); S.fakeIn = rand(12, 22); }
        else { fig.pose = { ...POSES.stand }; S.mode = S.next; S.t = 0; }
      }
      break;
    case 'notice':                 // a beat to look at the switch
      blend({ ...POSES.stand, nod: -0.15 + Math.min(S.t, 0.5) * 0.3 }, 1 - Math.pow(0.01, dt));
      if (S.t > 0.7) S.mode = 'approach';
      break;
    case 'approach':
      if (goTo(STRIKE.x, dt, 'walk')) { S.mode = 'kick'; S.t = 0; S.hit = false; }
      break;
    case 'kick': {
      if (!turnTo(1)) { S.t = Math.min(S.t, 0); break; }   // the kick starts once she faces the switch, not while she turns
      const u = S.t / KICK.dur;
      const kp = kickPose(Math.max(0, u), dragging && on);
      if (u < 0.3) blend(kp, 1 - Math.pow(1e-6, dt)); else fig.pose = kp;
      if (!S.hit && u >= KICK.contact) {
        S.hit = true;
        if (on && !dragging) setOn(false, 'kick'); else { S.fails++; if (dragging) kickAge = 0; }
      }
      if (u >= 1 && S.mode === 'kick') afterKick();
      break;
    }
    case 'push': {                 // kick in, then linger and lean on the lever
      followLever();
      if (S.t < 0) { blend(POSES.stand, 1 - Math.pow(1e-4, dt)); break; }
      const inT = KICK.contact * KICK.dur;
      if (S.t < inT) { fig.pose = kickPose(S.t / KICK.dur, true); break; }
      const lt = S.t - inT;
      if (lt < S.dur) {
        const { p, pulse, x } = pushPose(lt);
        const k = ss(lt / 0.35); fig.pose = lerpPose(kickPose(KICK.contact + 0.001, true), p, k);
        fig.x = lerp(STRIKE.x, x, k);
        if (k < 1) Object.assign(fig.pose, (({ x, ...r }) => r)(pushLegs((x - STRIKE.x) * k)));   // legs stay solved to the planted feet while she steps in
        pushForce = pulse * k;
        if (on && !dragging) { setOn(false, 'kick'); S.dur = lt; break; }   // let go mid-push: it goes, and she draws her leg back
        break;
      }
      const ru = KICK.release + (lt - S.dur) / (KICK.dur * (1 - KICK.release)) * (1 - KICK.release);
      fig.pose = kickPose(Math.min(1, ru), true);
      {   // shift the hips back over the support foot as the leg comes down, support leg solved to its planted ankle
        const back = 1 - ss(Math.min(1, (ru - KICK.release) / 0.15));
        fig.x = STRIKE.x + PUSH.dx * back;
        fig.pose.hipY = KICK_HIP - PUSH.dx * 0.2 * back;
        const sp = ik(fig.x, fig.pose.hipY, PUSH.supAnkle[0], ANKLE_H); fig.pose.thighB = sp.a; fig.pose.kneeB = sp.b;
        // the foot leaves the lever from wherever the visitor has it, easing back to its own path
        const fade = 1 - ss(Math.min(1, (ru - KICK.release) / 0.2));
        if (fade > 0 && (PUSH.follow[0] || PUSH.follow[1])) {
          const [, an] = legPts(fig.x, fig.pose.hipY, fig.pose.thighA, fig.pose.kneeA, 1);
          const k = ik(fig.x, fig.pose.hipY, an[0] + PUSH.follow[0] * fade, an[1] + PUSH.follow[1] * fade);
          fig.pose.thighA = k.a; fig.pose.kneeA = k.b;
        }
      }
      if (ru >= 1) { S.fails++; afterKick(); }
      break;
    }
    case 'giveupWalk':             // trudge back to the chair, turn round at its front, sit down despairing
      if (!goTo(FRONT_X, dt, 'trudge')) break;
      if (!turnTo(1)) break;
      startSit(Math.random() < 0.5 ? 'headInHands' : 'chinInHands', 'sulk', 1.5);
      break;
    case 'sulk':
      fig.pose.nod = POSES[seatedPose].nod + Math.sin(t * 0.8) * 0.04 * ss(S.t / 1.5);   // slow breathing nod, eased in
      if (on && !dragging) {        // let go: she notices after a moment, once she has sulked a while
        if (S.wait == null) S.wait = rand(0.8, 2.2);
        if ((S.wait -= dt) <= 0 && S.t > S.minSit) { S.wait = null; newAttempt(); startRise('notice', 1.0); }
        break;
      }
      S.wait = null;
      if (on && dragging && (S.fakeIn -= dt) <= 0) {
        if (Math.random() < 0.35) { startRise('fakeRun', 0.45); break; }   // jump up and dash at it
        S.fakeIn = rand(12, 22);
      }
      break;
    case 'fakeRun':
      if (goTo(STRIKE.x - 0.08, dt, 'run')) { S.mode = 'stare'; S.t = 0; S.dur = rand(0.8, 1.6); }
      break;
    case 'stare':                  // stop short and eye it up
      if (!turnTo(1)) break;
      blend({ ...POSES.stand, lean: 0.12, nod: 0.25 + 0.05 * Math.sin(S.t * 3) }, 1 - Math.pow(0.02, dt));
      if (S.t > S.dur) {
        if (on && !dragging) S.mode = 'approach';
        else if (Math.random() < 0.5) S.mode = 'giveupWalk';
        else { newAttempt(); S.mode = 'approach'; }
      }
      break;
    case 'stomp': {                // fed up: stop, stamp, then carry on with whatever the light now says
      if (!S.from) { if (!halt(dt)) { S.t = 0; break; } S.from = { ...fig.pose }; S.t = 0; }
      const n = S.stomps > 1 ? 4 : 3;
      fig.pose = stompPose(Math.min(S.t, stompDur(n)), n, S.from);
      if (S.t >= stompDur(n)) { fig.pose = { ...POSES.stand }; S.from = null; S.flips = []; S.mode = on ? 'approach' : 'home'; S.t = 0; }
      break;
    }
    case 'home':                   // lamp off: walk back slowly in the dark and sit down
      if (!goTo(FRONT_X, dt, 'trudge')) break;
      if (!turnTo(1)) break;
      startSit('sitRest', 'rest', 1.4);
      break;
  }
}

// ---------- switch state ----------
let on = true, tilt = -SW.maxTilt, tiltVel = 0, dragging = null, touched = false, lampLevel = 1;
function setOn(v, source) {
  if (v === on) return;
  on = v;
  if (source === 'kick') tiltVel += 9;
  else if (source !== 'drag') tiltVel += on ? -5 : 5;
  if (!rig.ready) return;
  // turning her round mid-walk (to the switch / back to the chair) counts towards losing her temper;
  // the giving-up walk and sulking don't: then she is past caring
  const reverses = on ? S.mode === 'home' : ['notice', 'approach'].includes(S.mode);
  if (!on) {
    // in the dark she heads back to her chair; if she is already sitting, she stays put
    // (a kick or push in progress finishes first: afterKick sends her home)
    if (['notice', 'approach', 'fakeRun', 'stare', 'giveupWalk'].includes(S.mode)) { S.mode = 'home'; S.t = 0; }
  } else {
    // lamp back on: get up, or stop walking home and come back
    if (S.mode === 'home' || S.mode === 'giveupWalk') { newAttempt(); S.mode = 'approach'; }
  }
  if (reverses) {
    S.flips = S.flips.filter(c => S.clock - c < ANGER.within).concat(S.clock);
    // she loses her temper on a flip that brings the light back: a tantrum in the dark would go unseen
    if (on && S.flips.length >= ANGER.flips) { S.stomps++; S.mode = 'stomp'; S.t = 0; S.from = null; }
  }
}
addEventListener('keydown', e => {
  if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); touched = true; setOn(!on, 'key'); }
});
const leverTipWorld = (v = new THREE.Vector3()) => leverPivot.localToWorld(v.set(0, SW.tipC, 0));

// ---------- the visitor's hand ----------
// WebXR Input Profiles "generic hand" (right.glb, MIT, (c) 2019 Amazon). The fingertip goes exactly where it is
// sent; the rest of the hand sways around it on springs, the loose fingers ring at their own rates, and the
// skin fades out before the open edge at the wrist. Its shadow fades the same way, by dithering the shadow
// map; the soft shadow filter smooths the dither into a gradient.
class Spring {
  constructor() { this.x = 0; this.v = 0; }
  step(target, k, c, dt) { this.v += (k * (target - this.x) - c * this.v) * dt; this.x += this.v * dt; return this.x; }
}
const hand = {
  ready: false, root: new THREE.Group(), pivot: new THREE.Group(), model: null, mesh: null, bones: {}, rest: {},
  flex: -1, q: new THREE.Quaternion(), alpha: 0, want: 0,
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(),
  sv: new THREE.Vector3(), lastSv: new THREE.Vector3(), acc: new THREE.Vector3(),
  sp: { yaw: new Spring(), roll: new Spring(), pitch: new Spring(), mid: new Spring(), ring: new Spring(), pinky: new Spring(), thumb: new Spring(), press: new Spring() },
  uniforms: { fadeTip: { value: new THREE.Vector3() }, fadeDir: { value: new THREE.Vector3(0, 1, 0) }, fadeInner: { value: -0.05 }, fadeOuter: { value: 0.0 }, handAlpha: { value: 0 } },
};
hand.root.add(hand.pivot);
scene.add(hand.root);
const CHAINS = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
  middle: ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
  ring: ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
  pinky: ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'],
};
const X_AXIS = new THREE.Vector3(1, 0, 0);
const tmpQ = new THREE.Quaternion();
function bend(name, angle, side = 0) {
  const b = hand.bones[name]; if (!b) return;
  b.quaternion.copy(hand.rest[name]).multiply(tmpQ.setFromAxisAngle(X_AXIS, hand.flex * angle));
  if (side) b.quaternion.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), side));
}
const DEG = Math.PI / 180;
function poseHand(t) {
  const s = hand.sp, press = s.press.x;
  const breathe = Math.sin(t * 1.9) * 2 * DEG;
  // index: slack bends so it can straighten; last joint bends back when pressing on the lever
  bend('index-finger-phalanx-proximal', (22 + 8 * (1 - press)) * DEG);
  bend('index-finger-phalanx-intermediate', (20 - 6 * press) * DEG);
  bend('index-finger-phalanx-distal', (8 - 22 * press - 16 * strain()) * DEG);
  bend('index-finger-phalanx-intermediate', (20 - 6 * press + 9 * strain()) * DEG);
  const curl = (f, a, b, c, j) => {
    bend(`${f}-finger-phalanx-proximal`, a * DEG + j + breathe);
    bend(`${f}-finger-phalanx-intermediate`, b * DEG + j * 0.8 + breathe);
    bend(`${f}-finger-phalanx-distal`, c * DEG + j * 0.5);
  };
  curl('middle', 78, 95, 55, s.mid.x);
  curl('ring', 82, 95, 55, s.ring.x);
  curl('pinky', 86, 92, 50, s.pinky.x);
  bend('thumb-phalanx-proximal', 18 * DEG + s.thumb.x);
  bend('thumb-phalanx-distal', 20 * DEG + s.thumb.x * 0.6);
}
function setupHand(gltf) {
  const model = gltf.scene;
  model.traverse(o => { if (o.isSkinnedMesh) hand.mesh = o; if (o.isBone || o.type === 'Bone' || CHAINS.index.includes(o.name) || o.name === 'wrist') hand.bones[o.name] = o; });
  model.traverse(o => { if (o.name && /(wrist|metacarpal|phalanx|tip)$/.test(o.name)) hand.bones[o.name] = o; });
  model.updateMatrixWorld(true);
  // the joints import as siblings: link each finger into a chain, keeping world transforms
  const wrist = hand.bones.wrist;
  for (const chain of Object.values(CHAINS)) {
    let parent = wrist;
    for (const name of chain) { const b = hand.bones[name]; if (b) { parent.attach(b); parent = b; } }
  }
  for (const [n, b] of Object.entries(hand.bones)) hand.rest[n] = b.quaternion.clone();

  // skin material with the wrist fade and a little fresnel warmth
  const skin = useEnv(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.96, 0.78, 0.68).convertSRGBToLinear(), roughness: 0.55, metalness: 0, skinning: true, transparent: true }), 0.9, 0.7);
  skin.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, hand.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHandWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHandWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHandWorld;\nuniform vec3 fadeTip; uniform vec3 fadeDir; uniform float fadeInner; uniform float fadeOuter; uniform float handAlpha;')
      .replace('#include <tonemapping_fragment>', `
        float along = dot(vHandWorld - fadeTip, fadeDir);
        float fadeA = (1.0 - smoothstep(fadeInner, fadeOuter, along)) * handAlpha;
        float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.5);
        gl_FragColor.rgb += rim * vec3(0.20, 0.06, 0.035);
        gl_FragColor.a *= fadeA;
        #include <tonemapping_fragment>`);
  };
  hand.mesh.material = skin;
  hand.mesh.castShadow = true;
  hand.mesh.frustumCulled = false;
  hand.mesh.renderOrder = 11;
  // depth-only copy drawn first: the see-through hand then shows only its nearest surface, never its far side
  const prepass = new THREE.SkinnedMesh(hand.mesh.geometry, new THREE.MeshBasicMaterial({ colorWrite: false, skinning: true }));
  prepass.bind(hand.mesh.skeleton, hand.mesh.bindMatrix);
  prepass.frustumCulled = false;
  prepass.renderOrder = 10;
  hand.mesh.parent.add(prepass);
  prepass.position.copy(hand.mesh.position); prepass.quaternion.copy(hand.mesh.quaternion); prepass.scale.copy(hand.mesh.scale);
  hand.prepass = prepass;

  // find which way a positive local-X turn bends a finger: toward the palm or away
  const wp = n => hand.bones[n].getWorldPosition(new THREE.Vector3());
  model.updateMatrixWorld(true);
  const fM = wp('index-finger-tip').sub(wp('index-finger-phalanx-proximal')).normalize();
  const sM = wp('index-finger-metacarpal').sub(wp('pinky-finger-metacarpal')).normalize();
  const palm = new THREE.Vector3().crossVectors(sM, fM).normalize();   // right hand: thumb side × finger = palm side
  const tip0 = wp('index-finger-tip');
  hand.bones['index-finger-phalanx-proximal'].quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, 0.4));
  model.updateMatrixWorld(true);
  hand.flex = wp('index-finger-tip').sub(tip0).dot(palm) > 0 ? 1 : -1;
  hand.bones['index-finger-phalanx-proximal'].quaternion.copy(hand.rest['index-finger-phalanx-proximal']);

  // orient by measured directions: the arm comes in from the right as in the reel; index points left and down, palm down, thumb toward the viewer
  poseHand(0); model.updateMatrixWorld(true);
  const f = wp('index-finger-tip').sub(wp('index-finger-phalanx-proximal')).normalize();
  let s = wp('index-finger-metacarpal').sub(wp('pinky-finger-metacarpal'));
  s.sub(f.clone().multiplyScalar(s.dot(f))).normalize();
  const fW = new THREE.Vector3(-0.86, -0.45, -0.24).normalize();
  const sW = new THREE.Vector3(0.05, 0.1, 1); sW.sub(fW.clone().multiplyScalar(sW.dot(fW))).normalize();
  const bm = new THREE.Matrix4().makeBasis(f, s, new THREE.Vector3().crossVectors(f, s));
  const bw = new THREE.Matrix4().makeBasis(fW, sW, new THREE.Vector3().crossVectors(fW, sW));
  hand.q.setFromRotationMatrix(bw.multiply(bm.transpose()));
  model.quaternion.copy(hand.q);
  hand.model = model;
  hand.pivot.add(model);

  // the shadow fades out toward the wrist like the skin: fragments are dropped against a fine noise
  // threshold, and the soft shadow filter turns the dither into a smooth gradient
  const shadowFade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true });
  shadowFade.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, hand.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHandWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHandWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHandWorld;\nuniform vec3 fadeTip; uniform vec3 fadeDir; uniform float fadeInner; uniform float fadeOuter; uniform float handAlpha;')
      .replace('void main() {', `void main() {
        float fadeA = (1.0 - smoothstep(fadeInner, fadeOuter + 0.015, dot(vHandWorld - fadeTip, fadeDir))) * handAlpha;
        // ordered 4x4 Bayer threshold: the shadow filter's 3x3 taps average it into an even gradient
        vec2 bq = floor(gl_FragCoord.xy);
        float b2a = fract(dot(floor(bq * 0.5), vec2(0.5, floor(bq.y * 0.5) * 0.75)));
        float b2b = fract(dot(bq, vec2(0.5, bq.y * 0.75)));
        float n = b2a * 0.25 + b2b + 1.0 / 32.0;
        n = fract(n);
        if (fadeA <= n) discard;`);
  };
  hand.mesh.customDepthMaterial = shadowFade;
  hand.ready = true;
}
if (THREE.GLTFLoader && window.FIGURE_GLB_B64) {
  const bin = Uint8Array.from(atob(window.FIGURE_GLB_B64), c => c.charCodeAt(0));
  new THREE.GLTFLoader().parse(bin.buffer, '', setupFigure, e => console.error('figure', e));
}
if (THREE.GLTFLoader && window.HAND_GLB_B64) {
  const bin = Uint8Array.from(atob(window.HAND_GLB_B64), c => c.charCodeAt(0));
  new THREE.GLTFLoader().parse(bin.buffer, '', setupHand, () => {});
}

const tipLocal = new THREE.Vector3(), wristW = new THREE.Vector3(), knuckleW = new THREE.Vector3(), tmpV = new THREE.Vector3();
function updateHand(dt, t) {
  if (!hand.ready) return;
  const H = hand;
  H.alpha += ((H.want ? 1 : 0) - H.alpha) * (1 - Math.pow(H.want ? 0.002 : 0.0005, dt));
  if (H.alpha < 0.01 && H.want) H.pos.copy(H.target), H.vel.set(0, 0, 0);
  // fingertip glides to its target on a critically damped spring, in 4 sub-steps
  const n = 4, h = dt / n, k = 260, c = 2 * Math.sqrt(k);
  for (let i = 0; i < n; i++) {
    tmpV.subVectors(H.target, H.pos).multiplyScalar(k).addScaledVector(H.vel, -c);
    H.vel.addScaledVector(tmpV, h);
    H.pos.addScaledVector(H.vel, h);
  }
  if (dragging) H.pos.copy(H.target);     // on the lever, the finger is exactly on its tip
  // smoothed velocity (~60 ms) and clamped acceleration drive the sway springs
  H.sv.lerp(H.vel, 1 - Math.exp(-dt / 0.06));
  H.acc.subVectors(H.sv, H.lastSv).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 8);
  H.lastSv.copy(H.sv);
  const drift = (seed, a) => a * (Math.sin(t * 0.73 + seed) + 0.6 * Math.sin(t * 1.37 + seed * 2.1) + 0.35 * Math.sin(t * 2.91 + seed * 3.7));
  const s = H.sp, vx = H.sv.x, vz = H.sv.z, vy = H.sv.y;
  for (let i = 0; i < n; i++) {
    s.yaw.step(clamp(-vx * 1.2, -0.35, 0.35) + drift(1, 0.02), 44, 5, h);
    s.roll.step(clamp(vx * 1.6 - H.acc.x * 0.02, -0.4, 0.4) + drift(2, 0.025), 42, 5, h);
    s.pitch.step(clamp(vz * 1.4 + vy * 1.2 + H.acc.z * 0.015, -0.35, 0.35) + drift(3, 0.02), 50, 5, h);
    const j = clamp(H.acc.length() * 0.012 + vy * 0.8, -0.25, 0.25);
    s.mid.step(j, 85, 3.5, h); s.ring.step(j, 110, 3.5, h); s.pinky.step(j, 140, 3.5, h); s.thumb.step(j * 0.6, 70, 3.5, h);
    s.press.step(dragging ? 1 : 0, 260, 20, h);
  }
  poseHand(t);
  // rotation sways around the fingertip; re-centre so the tip stays exactly on the target
  H.root.position.copy(H.pos);
  H.pivot.rotation.set(s.pitch.x, s.yaw.x, s.roll.x, 'YXZ');
  H.model.position.set(0, 0, 0);
  H.model.updateMatrixWorld(true);
  H.bones['index-finger-tip'].getWorldPosition(tipLocal);
  H.pivot.worldToLocal(tipLocal);
  H.model.position.copy(tipLocal).negate();
  H.root.updateMatrixWorld(true);
  // fade follows the live wrist
  H.bones.wrist.getWorldPosition(wristW);
  H.bones['middle-finger-metacarpal'].getWorldPosition(knuckleW);
  const dir = tmpV.subVectors(wristW, knuckleW).normalize();
  H.uniforms.fadeTip.value.copy(wristW);
  H.uniforms.fadeDir.value.copy(dir);
  H.uniforms.handAlpha.value = H.alpha;
  H.model.visible = H.alpha > 0.01;
  H.prepass.visible = H.alpha > 0.6;
}

// ---------- pointer: hover, drag, hand target ----------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let pointerIn = false, hoverSwitch = false;
function setPtr(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
}
function hitsSwitch() { ray.setFromCamera(ptr, camera); return ray.intersectObject(sw, true).length > 0; }
function pxPerRadian() {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const r = renderer.domElement.getBoundingClientRect();
  const y = SW.pivot + Math.cos(0.3) * SW.lever, x = Math.sin(0.3) * SW.lever;
  sw.localToWorld(a.set(-x, y, 0)).project(camera);
  sw.localToWorld(b.set(x, y, 0)).project(camera);
  return Math.max(40, Math.abs(b.x - a.x) * r.width / 2 / 0.6);
}
// the pedestal: a click (no drag) on it zooms between the close-up and the whole room
function hitsPlinth() { ray.setFromCamera(ptr, camera); return ray.intersectObject(plinth, false).length > 0; }
let press = null;
stage.addEventListener('pointerdown', e => {
  setPtr(e); pointerIn = true;
  press = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (!hitsSwitch()) return;
  e.stopPropagation(); e.preventDefault();
  touched = true;
  controls.enabled = false;
  dragging = { x: e.clientX, tilt, k: pxPerRadian() };
  renderer.domElement.setPointerCapture?.(e.pointerId);
  renderer.domElement.style.cursor = 'grabbing';
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  setPtr(e); pointerIn = true;
  if (dragging) {
    tilt = clamp(dragging.tilt + (e.clientX - dragging.x) / dragging.k, -SW.maxTilt, SW.maxTilt);
    tiltVel = 0;
    if (tilt < -0.05 && !on) setOn(true, 'drag');
    if (tilt > 0.05 && on) setOn(false, 'drag');
    return;
  }
  hoverSwitch = hitsSwitch();
  renderer.domElement.style.cursor = hoverSwitch ? 'grabbing' : hitsPlinth() ? (view === 'close' ? 'zoom-out' : 'zoom-in') : '';
});
function endDrag(e) {
  const p = press; press = null;
  if (!dragging) {
    if (p && e && e.type === 'pointerup' && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6 && performance.now() - p.t < 500) {
      setPtr(e);
      if (hitsPlinth()) toggleView();
    }
    return;
  }
  dragging = null;
  controls.enabled = true;
  hoverSwitch = hitsSwitch();
  renderer.domElement.style.cursor = hoverSwitch ? 'grabbing' : '';
}
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
renderer.domElement.addEventListener('pointerleave', () => { pointerIn = false; hoverSwitch = false; if (!dragging) renderer.domElement.style.cursor = ''; });

const hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PLINTH.h + 0.055));
// the hand roams a little in front of and behind the switch; reach past that, into the room, and it rises into the air
const REACH = { front: SW.z + 0.22, back: SW.z - 0.14, x: 0.42, top: PLINTH.h + 0.9 };
const reachPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -REACH.back);
const hit = new THREE.Vector3();
function aimHand() {
  if (dragging || hoverSwitch) {
    leverTipWorld(hand.target);
    hand.target.y += dragging ? 0.0035 : 0.009;
    hand.want = 1;
    return;
  }
  ray.setFromCamera(ptr, camera);
  let ok = pointerIn && ray.ray.intersectPlane(hoverPlane, hit);
  // behind the switch (or above the horizon): follow the pointer up a vertical plane instead of across the plinth
  if (pointerIn && (!ok || hit.z < REACH.back)) ok = ray.ray.intersectPlane(reachPlane, hit) && hit.y >= PLINTH.h + 0.045;
  if (ok && Math.abs(hit.x - SW.x) < REACH.x && hit.y < REACH.top && hit.z < PLINTH.z + 0.75) {
    hand.target.copy(hit); hand.target.z = Math.min(hit.z, REACH.front); hand.want = 1;
  } else hand.want = 0;
}

// ---------- camera views ----------
let flyTo = null;
function toggleView() {
  view = view === 'close' ? 'room' : 'close';
  flyTo = { from: camera.position.clone(), fromT: controls.target.clone(), t: reduced ? 1 : 0 };
  applyLimits();
  $('credit').classList.toggle('room', view === 'room');
  renderer.domElement.style.cursor = hitsPlinth() ? (view === 'close' ? 'zoom-out' : 'zoom-in') : '';
}
addEventListener('keydown', e => { if (e.key === 'Enter' && !(e.target instanceof HTMLAnchorElement)) toggleView(); });
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep at least the horizontal view of a 1.25:1 window; tall screens get a taller view instead of a cropped one
  const hBase = 2 * Math.atan(Math.tan(23 * Math.PI / 180) * 1.25);
  camera.fov = clamp(2 * Math.atan(Math.tan(hBase / 2) / camera.aspect) * 180 / Math.PI, 46, 62);
  camera.updateProjectionMatrix();
  // tall screens: aim a little higher so the switch and the shadow figure share the middle of the frame
  const portrait = camera.aspect < 0.8;
  VIEWS.close.target.y = portrait ? 1.16 : 1.0;
  if (view === 'close' && !flyTo && !dragging) controls.target.copy(VIEWS.close.target);
}
addEventListener('resize', resize); resize();

// ---------- the credit line: a shader picks black or white for every pixel of it ----------
// The HTML line stays in place (transparent) so the link works and it can be read and selected. Its glyphs are
// drawn into a mask; after each frame the pixels behind the line are copied, and a pass paints each glyph pixel
// black where the scene behind it is light and white where it is dark.
const creditFX = (() => {
  const el = $('credit'), pad = 4;
  const mask = document.createElement('canvas'), mtx = mask.getContext('2d');
  const maskTex = new THREE.CanvasTexture(mask);
  maskTex.minFilter = maskTex.magFilter = THREE.LinearFilter; maskTex.generateMipmaps = false;
  const mat = new THREE.ShaderMaterial({
    uniforms: { mask: { value: maskTex }, bg: { value: null } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D mask, bg; varying vec2 vUv;
      void main() {
        float m = texture2D(mask, vUv).a;
        if (m < 0.004) discard;
        vec3 behind = texture2D(bg, vUv).rgb;
        float light = step(0.5, dot(behind, vec3(0.2126, 0.7152, 0.0722)));
        gl_FragColor = vec4(vec3(1.0 - light), m);     // light behind -> black, dark behind -> white
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const fxScene = new THREE.Scene(); fxScene.add(quad);
  const fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let bgTex = null, box = null, dirty = true;
  function build() {
    dirty = false;
    const dpr = renderer.getPixelRatio(), cv = renderer.domElement.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!r.width) { box = null; return; }
    const left = r.left - pad, top = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
    const W = Math.ceil(w * dpr), H = Math.ceil(h * dpr);
    mask.width = W; mask.height = H;
    mtx.setTransform(dpr, 0, 0, dpr, 0, 0); mtx.clearRect(0, 0, w, h);
    const cs = getComputedStyle(el);
    mtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    mtx.fillStyle = mtx.strokeStyle = '#fff'; mtx.textBaseline = 'alphabetic';
    // draw every character exactly where the browser laid it out
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node; (node = walker.nextNode());) {
      const alpha = node.parentElement.classList.contains('sep') ? 0.7 : 1;
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const cr = range.getClientRects()[0], ch = node.data[i];
        if (!cr || !ch.trim()) continue;
        const m = mtx.measureText(ch), asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.89;
        mtx.globalAlpha = alpha;
        mtx.fillText(ch, cr.left - left, cr.top - top + asc);
      }
    }
    mtx.globalAlpha = 1;
    for (const a of el.querySelectorAll('a')) for (const cr of a.getClientRects()) {   // link underline
      const asc = mtx.measureText('S').fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.89;
      mtx.fillRect(cr.left - left, cr.top - top + asc + 3, cr.width, 1);
    }
    maskTex.needsUpdate = true;
    // quad covering the line, in clip space
    const x0 = (left - cv.left) / cv.width * 2 - 1, x1 = (left + w - cv.left) / cv.width * 2 - 1;
    const y0 = 1 - (top + h - cv.top) / cv.height * 2, y1 = 1 - (top - cv.top) / cv.height * 2;
    const pos = quad.geometry.attributes.position;
    pos.setXY(0, x0, y1); pos.setXY(1, x1, y1); pos.setXY(2, x0, y0); pos.setXY(3, x1, y0); pos.needsUpdate = true;
    // where to copy the background from, in drawing-buffer pixels (origin bottom-left)
    box = { x: Math.round((left - cv.left) * dpr), y: Math.round((cv.bottom - (top + h)) * dpr), W, H };
    if (bgTex) bgTex.dispose();
    // RGB to match the canvas (no alpha channel): WebGL refuses to copy an RGB framebuffer into an RGBA texture
    bgTex = new THREE.DataTexture(new Uint8Array(W * H * 3), W, H, THREE.RGBFormat);
    bgTex.unpackAlignment = 1;
    bgTex.minFilter = bgTex.magFilter = THREE.LinearFilter;
    bgTex.needsUpdate = true;   // allocate it on the GPU once, so the framebuffer copy has somewhere to go
    mat.uniforms.bg.value = bgTex;
  }
  addEventListener('resize', () => { dirty = true; });
  if (document.fonts) document.fonts.ready.then(() => { dirty = true; });
  return {
    draw() {
      if (dirty) build();
      if (!box) return;
      const fb = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (box.x < 0 || box.y < 0 || box.x + box.W > fb.x || box.y + box.H > fb.y) return;
      renderer.copyFramebufferToTexture(new THREE.Vector2(box.x, box.y), bgTex);
      renderer.autoClear = false;
      renderer.render(fxScene, fxCam);
      renderer.autoClear = true;
    },
    rebuild() { dirty = true; },
  };
})();

// ---------- loop ----------
const clock = new THREE.Clock();
function frame(dt, t) {
  kickAge += dt;
  if (!dragging) {
    const rest = on ? -SW.maxTilt : SW.maxTilt;
    tiltVel += (rest - tilt) * 320 * dt - tiltVel * 20 * dt;
    tilt += tiltVel * dt;
    if (reduced) { tilt = rest; tiltVel = 0; }
  }
  // while she leans on a held lever it strains a little toward off
  leverPivot.rotation.z = -(tilt + (dragging ? 0.035 * strain() : 0));

  lampLevel += ((on ? 1 : 0) - lampLevel) * (1 - Math.pow(on ? 0.0005 : 1e-8, dt));
  lamp.intensity = 2.2 * lampLevel;
  down.intensity = 1.5 + 0.5 * lampLevel;
  bounceHemi.intensity = 0.02 + 0.03 * lampLevel;
  poolBounce.intensity = 0.38 * lampLevel;
  faceBounce.intensity = 0.5 * lampLevel;
  const env = lampLevel > 0.5 ? ENV.lit : ENV.dark;
  for (const [m, li, di] of envMats) { if (m.envMap !== env) m.envMap = env; m.envMapIntensity = lerp(di, li, lampLevel); }

  ring.visible = !touched && !dragging;
  if (ring.visible) {
    const s = reduced ? 1 : 1 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.4;
    ring.scale.set(s, s, s);
    ring.material.opacity = reduced ? 0.6 : 0.75 - (s - 1) * 1.5;
  }

  stepFigure(dt, t);
  applyFigure(dt);
  hair.step(dt); cloak.step(dt);   // keeps running in the dark, so nothing jumps when the lamp comes back

  aimHand();
  updateHand(dt, t);

  if (flyTo) {
    flyTo.t = Math.min(1, flyTo.t + dt / 1.1);
    const e = flyTo.t < .5 ? 2 * flyTo.t * flyTo.t : 1 - Math.pow(-2 * flyTo.t + 2, 2) / 2;
    camera.position.lerpVectors(flyTo.from, VIEWS[view].pos, e);
    controls.target.lerpVectors(flyTo.fromT, VIEWS[view].target, e);
    if (flyTo.t === 1) flyTo = null;
  }
  controls.update();
  renderer.render(scene, camera);
  creditFX.draw();
}
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  frame(dt, clock.elapsedTime);
  requestAnimationFrame(tick);
}
tick();
