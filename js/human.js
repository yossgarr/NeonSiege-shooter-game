'use strict';
/* =========================================================
   HUMANS — procedural people: rig, looks, living idle animation,
   per-limb hit boxes, cannon.js ragdoll death
   ========================================================= */
const humans = [];
const MAX_HUMANS = 10;
const DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _ea = new THREE.Euler(0, 0, 0, 'YXZ');
const _m4 = new THREE.Matrix4();
const angDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const smooth = x => x * x * (3 - 2 * x);

/* ---------------- shared geometry ---------------- */
const _geo = {};
function GEO(key, fn) { return _geo[key] || (_geo[key] = fn()); }
function lathe(points, seg = 18) {
  const g = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg); g.computeBoundingBox(); return g;
}
// tapered limb with rounded ends, centred on the origin, long axis = Y
function limbGeo(len, r0, r1, bulge, seg = 14) {
  const pts = [], cap = 5, half = len / 2, n = 8, y0 = -half + r0, y1 = half - r1;
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * Math.PI / 2; pts.push([r0 * Math.sin(a), -half + r0 * (1 - Math.cos(a))]); }
  for (let i = 1; i < n; i++) { const t = i / n; pts.push([lerp(r0, r1, t) * (1 + bulge * Math.sin(Math.PI * t)), lerp(y0, y1, t)]); }
  for (let i = 0; i <= cap; i++) { const a = Math.PI / 2 - (i / cap) * Math.PI / 2; pts.push([r1 * Math.sin(a), half - r1 * (1 - Math.cos(a))]); }
  return lathe(pts, seg);
}
// merge several geometries (with transforms) into one so a hand / foot is a single draw call
function mergeGeos(parts) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0; const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { g, m } of parts) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    if (g.index) for (const i of g.index.array) idx.push(i + off); else for (let i = 0; i < P.count; i++) idx.push(i + off);
    off += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx); out.computeBoundingBox(); return out;
}
function handGeo() {                 // hangs along -Y, wrist at y=+0.085, fingertips near y=-0.095; thumb points +Z
  const M = new THREE.Matrix4(), parts = [];
  const add = (g, x, y, z, sx, sy, sz, rx, rz) => { M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, 0, rz || 0)), new THREE.Vector3(sx, sy, sz)); parts.push({ g, m: M.clone() }); };
  add(limbGeo(0.11, 0.03, 0.027, 0.03, 10), 0, 0.03, 0, 1.35, 1, 0.62);                         // palm
  [[-0.026, 0.07, 0.0105], [-0.0085, 0.082, 0.0105], [0.0085, 0.076, 0.0100], [0.026, 0.062, 0.0092]].forEach(([x, len, r]) => add(limbGeo(len, r, r * 0.78, 0.0, 8), x, -0.02 - len / 2 + 0.01, 0.004, 1, 1, 1, -0.16));   // fingers (slightly curled)
  add(limbGeo(0.06, 0.012, 0.009, 0, 8), 0, 0.02, 0.026, 1, 1, 1, -0.9);                       // thumb
  return mergeGeos(parts);
}
const HG = {
  torso: () => GEO('torso', () => lathe([[0, -.25], [.095, -.245], [.13, -.2], [.135, -.12], [.125, -.04], [.13, .04], [.152, .12], [.16, .18], [.14, .225], [.07, .248], [0, .25]], 22)),
  pelvis: () => GEO('pelvis', () => lathe([[0, -.11], [.09, -.105], [.135, -.07], [.148, 0], [.145, .05], [.125, .095], [.09, .11], [0, .115]], 20)),
  uArm: () => GEO('uArm', () => limbGeo(0.34, 0.052, 0.042, 0.06)),
  fArm: () => GEO('fArm', () => limbGeo(0.3, 0.043, 0.031, 0.1)),
  thigh: () => GEO('thigh', () => limbGeo(0.46, 0.086, 0.06, 0.08, 16)),
  shin: () => GEO('shin', () => limbGeo(0.46, 0.058, 0.04, 0.14, 14)),
  neck: () => GEO('neck', () => limbGeo(0.16, 0.052, 0.048, 0, 12)),
  sphere: () => GEO('sphere', () => { const g = new THREE.SphereGeometry(1, 24, 18); g.computeBoundingBox(); return g; }),
  sphereLo: () => GEO('sphereLo', () => { const g = new THREE.SphereGeometry(1, 12, 8); g.computeBoundingBox(); return g; }),
  hairCap: () => GEO('hairCap', () => new THREE.SphereGeometry(1, 26, 16, 0, TAU, 0, Math.PI * 0.44)),
  beard: () => GEO('beard', () => new THREE.SphereGeometry(1, 20, 10, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.5, Math.PI * 0.42)),
  box: () => GEO('box', () => new THREE.BoxGeometry(1, 1, 1)),
  hand: () => GEO('hand', handGeo),
};

/* ---------------- looks ---------------- */
const SKINS = ['#f3d2b3', '#eec19a', '#e2a97c', '#c98c5e', '#a8693f', '#7b4a2d', '#5a3822'];
const HAIRS = ['#16110d', '#2a1d14', '#4a3220', '#6e4b2a', '#a67c42', '#cdb06a', '#7a3220', '#8b9096'];
const SHIRTS = ['#c9ccd2', '#2d4f7c', '#7c2f2f', '#2f6b4f', '#d6b84a', '#3b3b44', '#8f8f2f', '#d7d1c5', '#4c3a63', '#b0562c'];
const PANTS = ['#2b3b56', '#3a3f48', '#6b5a43', '#1d1d22', '#4b5b6b', '#6a6f52'];
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sc = hex => new THREE.Color(hex).convertSRGBToLinear();   // flat colours need the same sRGB->linear step the textures get

function makeFaceTex(skin, hair, cry) {
  return canvasTex([512, 256], (g, W) => {
    const Ht = 256;
    g.fillStyle = skin; g.fillRect(0, 0, W, Ht);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * Ht, 2, 2); }
    const cx = 128;
    g.fillStyle = 'rgba(205,90,80,.20)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * 44, 142, 22, 14, 0, 0, TAU); g.fill(); });      // cheeks
    g.fillStyle = 'rgba(60,30,20,.09)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * 32, 112, 17, 9, 0, 0, TAU); g.fill(); });         // eye sockets
    g.strokeStyle = hair; g.lineWidth = 6; g.lineCap = 'round';
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx + s * 16, 100); g.quadraticCurveTo(cx + s * 32, 92, cx + s * 50, 99); g.stroke(); });           // brows
    g.fillStyle = 'rgba(120,55,50,.95)'; g.beginPath(); g.ellipse(cx, 168, 17, 5.5, 0, 0, TAU); g.fill();                                           // lips
    g.fillStyle = 'rgba(170,85,80,.9)'; g.beginPath(); g.ellipse(cx, 165, 13, 3.5, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,20,20,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 16, 168); g.quadraticCurveTo(cx, 170, cx + 16, 168); g.stroke();
    g.fillStyle = 'rgba(80,50,40,.10)'; g.beginPath(); g.ellipse(cx, 135, 9, 15, 0, 0, TAU); g.fill();                                              // nose shade
    if (cry) {
      g.strokeStyle = 'rgba(190,225,255,.55)'; g.lineWidth = 3;
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx + s * 34, 124); g.quadraticCurveTo(cx + s * 38, 150, cx + s * 33, 178); g.stroke(); });
      g.fillStyle = 'rgba(220,90,90,.22)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * 33, 122, 15, 8, 0, 0, TAU); g.fill(); });
    }
  });
}

/* ---------------- rig definition ---------------- */
// jInP: joint position in the parent segment's frame; jInS: joint position in the segment's own frame (segment centre = origin)
const DEF = {
  pelvis: { parent: null,     jInP: [0, 0.96, 0],        jInS: [0, 0, 0],         half: [0.15, 0.09, 0.10],  mass: 12,  zone: 'torso', mul: 1.0 },
  torso:  { parent: 'pelvis', jInP: [0, 0.07, 0],        jInS: [0, -0.23, 0],     half: [0.17, 0.23, 0.10],  mass: 22,  zone: 'torso', mul: 1.0 },
  head:   { parent: 'torso',  jInP: [0, 0.24, 0],        jInS: [0, -0.2, 0],      half: [0.11, 0.11, 0.11],  mass: 5,   zone: 'head',  mul: 5.0, sphere: 0.113 },
  uArmL:  { parent: 'torso',  jInP: [-0.2, 0.17, 0],     jInS: [0, 0.15, 0],      half: [0.05, 0.15, 0.05],  mass: 2.2, zone: 'arm',   mul: 0.55 },
  uArmR:  { parent: 'torso',  jInP: [0.2, 0.17, 0],      jInS: [0, 0.15, 0],      half: [0.05, 0.15, 0.05],  mass: 2.2, zone: 'arm',   mul: 0.55 },
  fArmL:  { parent: 'uArmL',  jInP: [0, -0.15, 0],       jInS: [0, 0.13, 0],      half: [0.04, 0.17, 0.04],  mass: 1.6, zone: 'arm',   mul: 0.45, off: [0, -0.03, 0] },
  fArmR:  { parent: 'uArmR',  jInP: [0, -0.15, 0],       jInS: [0, 0.13, 0],      half: [0.04, 0.17, 0.04],  mass: 1.6, zone: 'arm',   mul: 0.45, off: [0, -0.03, 0] },
  thighL: { parent: 'pelvis', jInP: [-0.09, -0.04, 0],   jInS: [0, 0.21, 0],      half: [0.075, 0.21, 0.08], mass: 7.5, zone: 'leg',   mul: 0.7 },
  thighR: { parent: 'pelvis', jInP: [0.09, -0.04, 0],    jInS: [0, 0.21, 0],      half: [0.075, 0.21, 0.08], mass: 7.5, zone: 'leg',   mul: 0.7 },
  shinL:  { parent: 'thighL', jInP: [0, -0.21, 0],       jInS: [0, 0.21, 0],      half: [0.055, 0.21, 0.055], mass: 4,  zone: 'leg',   mul: 0.55 },
  shinR:  { parent: 'thighR', jInP: [0, -0.21, 0],       jInS: [0, 0.21, 0],      half: [0.055, 0.21, 0.055], mass: 4,  zone: 'leg',   mul: 0.55 },
  footL:  { parent: 'shinL',  jInP: [0, -0.21, 0],       jInS: [0, 0.04, -0.05],  half: [0.05, 0.04, 0.12],  mass: 1.2, zone: 'leg',   mul: 0.4 },
  footR:  { parent: 'shinR',  jInP: [0, -0.21, 0],       jInS: [0, 0.04, -0.05],  half: [0.05, 0.04, 0.12],  mass: 1.2, zone: 'leg',   mul: 0.4 },
};
const SEG_ORDER = Object.keys(DEF);
// ragdoll joint limits: [type, cone angle, twist]
const JOINT = {
  torso: ['cone', 0.8, 0.45], head: ['cone', 1.0, 0.8], uArmL: ['cone', 2.5, 1.2], uArmR: ['cone', 2.5, 1.2],
  fArmL: ['cone', 1.9, 0.4], fArmR: ['cone', 1.9, 0.4], thighL: ['cone', 1.9, 0.6], thighR: ['cone', 1.9, 0.6],
  shinL: ['hinge'], shinR: ['hinge'], footL: ['cone', 0.9, 0.4], footR: ['cone', 0.9, 0.4],
};

/* ---------------- building a person ---------------- */
function randomLook() {
  const female = Math.random() < 0.4;
  return {
    female, s: female ? rand(0.93, 1.02) : rand(0.98, 1.08), w: rand(0.92, 1.12),
    skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS),
    hairStyle: female ? pick(['long', 'long', 'ponytail', 'bob']) : pick(['short', 'short', 'buzz', 'bald', 'mop']),
    beard: !female && Math.random() < 0.35, longSleeve: Math.random() < 0.45, shoes: pick(['#1c1c1f', '#3a2a1e', '#d8d8d8', '#2c3a52']),
  };
}

function buildHuman(kind) {
  const L = randomLook();
  const h = { id: humans.length + Math.random(), kind, state: 'alive', hp: 100, look: L, root: new THREE.Group(), seg: {}, piv: {}, mats: [], tex: [], wounds: [], t: Math.random() * 10, removed: false, ragdoll: null, bleed: 0, collapse: 0 };
  h.root.scale.setScalar(L.s);
  const skinC = sc(L.skin);
  const mSkin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.55, metalness: 0, emissive: skinC.clone().multiplyScalar(0.07) });
  const faceTex = makeFaceTex(L.skin, L.hair, kind === 'hostage');
  const mHead = new THREE.MeshStandardMaterial({ color: 0xffffff, map: faceTex, roughness: 0.55, emissive: skinC.clone().multiplyScalar(0.07) });
  const mShirt = new THREE.MeshStandardMaterial({ color: sc(L.shirt), roughness: 0.92 });
  const mPants = new THREE.MeshStandardMaterial({ color: sc(L.pants), roughness: 0.9 });
  const mShoe = new THREE.MeshStandardMaterial({ color: sc(L.shoes), roughness: 0.55, metalness: 0.05 });
  const mSole = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
  const mHair = new THREE.MeshStandardMaterial({ color: sc(L.hair), roughness: 0.45, metalness: 0.1 });
  const mEye = new THREE.MeshStandardMaterial({ color: sc(kind === 'hostage' ? '#f0d4d0' : '#f2f2ee'), roughness: 0.25 });
  const mIris = new THREE.MeshStandardMaterial({ color: sc(pick(['#2a1a10', '#3b5a7a', '#4b6a3a', '#5a3a20'])), roughness: 0.2 });
  const mPupil = new THREE.MeshBasicMaterial({ color: 0x050505 });
  h.mats.push(mSkin, mHead, mShirt, mPants, mShoe, mSole, mHair, mEye, mIris, mPupil); h.tex.push(faceTex);
  h.skinMat = mSkin;

  // joints / segments
  for (const name of SEG_ORDER) {
    const d = DEF[name], parent = d.parent ? h.seg[d.parent].group : h.root;
    const pivot = new THREE.Group(); pivot.position.set(d.jInP[0], d.jInP[1], d.jInP[2]); parent.add(pivot);
    const group = new THREE.Group(); group.position.set(-d.jInS[0], -d.jInS[1], -d.jInS[2]); pivot.add(group);
    h.seg[name] = { name, def: d, pivot, group, mesh: null };
  }
  const S = h.seg, W = L.w, fem = L.female;
  const addMesh = (seg, geo, mat, x, y, z, sx, sy, sz, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = cast; m.receiveShadow = true; seg.group.add(m); return m;
  };
  // torso (+ neck, collar), pelvis
  S.torso.mesh = addMesh(S.torso, HG.torso(), mShirt, 0, 0, 0, (fem ? 1.0 : 1.18) * W, 1, fem ? 0.72 : 0.78);
  addMesh(S.torso, HG.neck(), mSkin, 0, 0.27, 0.0, 1, 1, 1, false);
  const collar = addMesh(S.torso, GEO('collar', () => new THREE.TorusGeometry(0.056, 0.014, 8, 18)), mShirt, 0, 0.215, 0.0, 1, 1, 1, false); collar.rotation.x = Math.PI / 2;
  S.pelvis.mesh = addMesh(S.pelvis, HG.pelvis(), mPants, 0, 0, 0, (fem ? 1.22 : 1.12) * W, 1, 0.84);
  // arms
  for (const side of ['L', 'R']) {
    const u = S['uArm' + side], f = S['fArm' + side];
    u.mesh = addMesh(u, HG.uArm(), mShirt, 0, 0, 0, W * (fem ? 0.88 : 1), 1, W * (fem ? 0.88 : 1));
    addMesh(u, HG.sphereLo(), mShirt, 0, 0.15, 0, 0.056 * W, 0.056, 0.056 * W, false);                       // shoulder cap
    f.mesh = addMesh(f, HG.fArm(), L.longSleeve ? mShirt : mSkin, 0, 0, 0, W * (fem ? 0.88 : 1), 1, W * (fem ? 0.88 : 1));
    addMesh(f, HG.sphereLo(), L.longSleeve ? mShirt : mSkin, 0, 0.13, 0, 0.044, 0.044, 0.044, false);          // elbow
    addMesh(f, HG.hand(), mSkin, 0, -0.205, 0.0, 1, 1, 1, false);                                           // hand
  }
  // legs
  for (const side of ['L', 'R']) {
    const t = S['thigh' + side], s = S['shin' + side], ft = S['foot' + side];
    t.mesh = addMesh(t, HG.thigh(), mPants, 0, 0, 0, W * (fem ? 0.95 : 1), 1, W * (fem ? 0.95 : 1));
    s.mesh = addMesh(s, HG.shin(), mPants, 0, 0, 0, W * (fem ? 0.9 : 1), 1, W * (fem ? 0.9 : 1));
    addMesh(s, HG.sphereLo(), mPants, 0, 0.21, 0.0, 0.058, 0.058, 0.058, false);                               // knee
    ft.mesh = addMesh(ft, HG.sphereLo(), mShoe, 0, 0.0, 0.05, 0.052, 0.04, 0.125);
    addMesh(ft, HG.box(), mSole, 0, -0.034, 0.05, 0.1, 0.014, 0.25, false);
  }
  // head
  const hd = S.head;
  hd.mesh = addMesh(hd, HG.sphere(), mHead, 0, 0, 0, 0.098, 0.118, 0.108);
  addMesh(hd, HG.sphere(), mSkin, 0, -0.073, 0.022, 0.074, 0.07, 0.082, false);                                   // jaw
  addMesh(hd, HG.sphereLo(), mSkin, 0, -0.012, 0.108, 0.014, 0.024, 0.02, false);                                 // nose
  [-1, 1].forEach(s => {
    addMesh(hd, HG.sphereLo(), mSkin, s * 0.099, -0.008, -0.004, 0.011, 0.026, 0.021, false);                      // ears
    const eye = new THREE.Group(); eye.position.set(s * 0.038, 0.018, 0.092); hd.group.add(eye);
    const ball = new THREE.Mesh(HG.sphereLo(), mEye); ball.scale.set(0.0165, 0.013, 0.012); eye.add(ball);
    const iris = new THREE.Mesh(HG.sphereLo(), mIris); iris.scale.set(0.0085, 0.0085, 0.004); iris.position.z = 0.0085; eye.add(iris);
    const pupil = new THREE.Mesh(HG.sphereLo(), mPupil); pupil.scale.set(0.0042, 0.0042, 0.002); pupil.position.z = 0.0112; eye.add(pupil);
    (h.eyes || (h.eyes = [])).push(eye);
  });
  const hs = L.hairStyle;
  if (hs !== 'bald') {
    const cap = addMesh(hd, HG.hairCap(), mHair, 0, 0.006, -0.01, 0.103, 0.123, 0.114);
    cap.rotation.x = hs === 'mop' ? -0.36 : -0.3;
    if (hs === 'buzz') cap.scale.set(0.1, 0.12, 0.11);
    if (hs === 'long' || hs === 'bob') {
      const back = addMesh(hd, HG.thigh(), mHair, 0, hs === 'long' ? -0.2 : -0.12, -0.065, 0.09, hs === 'long' ? 0.5 : 0.3, 0.065);
      back.rotation.x = 0.08;
      [-1, 1].forEach(s => addMesh(hd, HG.uArm(), mHair, s * 0.09, hs === 'long' ? -0.1 : -0.05, -0.02, 0.5, hs === 'long' ? 0.8 : 0.45, 0.45, false));
    }
    if (hs === 'ponytail') { const pt = addMesh(hd, HG.uArm(), mHair, 0, -0.1, -0.13, 0.7, 0.7, 0.7); pt.rotation.x = -0.35; }
  }
  if (L.beard) addMesh(hd, HG.beard(), mHair, 0, -0.07, 0.02, 0.082, 0.082, 0.092, false);

  // box/sphere hit volumes use each segment's main mesh
  for (const n of SEG_ORDER) if (!S[n].mesh) S[n].mesh = S[n].group.children[0];
  // blink bookkeeping + animation state
  h.anim = {
    ph: Math.random() * 6.28, startle: 0, startleDir: 0, nextG: rand(1.5, 4), g: { type: 'none', t: 0, dur: 1 }, look: { yaw: 0, pitch: 0, ty: 0, tp: 0, timer: rand(0.5, 2) },
    blinkT: rand(1, 4), blinkD: 0, sobT: rand(2, 6), sobD: 0, turning: false, hitLook: 0, cryT: rand(2, 6), kick: {},
  };
  ['spine', 'neck', 'shL', 'shR', 'hipL', 'hipR', 'kneeL', 'kneeR'].forEach(j => h.anim.kick[j] = [0, 0, 0, 0, 0, 0]);
  h.piv = { hips: S.pelvis.pivot, spine: S.torso.pivot, neck: S.head.pivot, shL: S.uArmL.pivot, shR: S.uArmR.pivot, elL: S.fArmL.pivot, elR: S.fArmR.pivot, hipL: S.thighL.pivot, hipR: S.thighR.pivot, knL: S.shinL.pivot, knR: S.shinR.pivot, anL: S.footL.pivot, anR: S.footR.pivot };
  return h;
}

/* ---------------- procedural pose helpers ---------------- */
function dirQ(q, x, y, z) { _a.set(x, y, z).normalize(); return q.setFromUnitVectors(DOWN, _a); }
// pose an arm from two direction vectors given in torso space
function poseArm(sh, el, ux, uy, uz, fx, fy, fz) {
  dirQ(sh.quaternion, ux, uy, uz);
  _b.set(fx, fy, fz).normalize().applyQuaternion(_qa.copy(sh.quaternion).invert());
  el.quaternion.setFromUnitVectors(DOWN, _b);
}
const _U = new THREE.Vector3(), _F = new THREE.Vector3();
// 2-bone IK in torso space: S shoulder, T target, pole = elbow direction hint
function ik2(S, T, pole, L1, L2, outU, outF) {
  _d.subVectors(T, S); let dist = _d.length(); _d.normalize();
  dist = clamp(dist, Math.abs(L1 - L2) + 0.03, L1 + L2 - 0.01);
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), A = Math.acos(cosA);
  _b.copy(pole); _b.addScaledVector(_d, -_b.dot(_d)); if (_b.lengthSq() < 1e-6) _b.set(0, 0, -1); _b.normalize();
  _c.copy(S).addScaledVector(_d, L1 * cosA).addScaledVector(_b, L1 * Math.sin(A));
  outU.subVectors(_c, S).normalize();
  _a.copy(S).addScaledVector(_d, dist); outF.subVectors(_a, _c).normalize();
}
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3();
const _u0 = new THREE.Vector3(), _f0 = new THREE.Vector3(), _u1 = new THREE.Vector3(), _f1 = new THREE.Vector3();
const L1 = 0.30, L2 = 0.335;
// blend target arm configuration into (u,f) with weight w
function armBlend(h, side, tx, ty, tz, px, py, pz, w) {
  if (w <= 0.001) return;
  _S.copy(side < 0 ? h.piv.shL.position : h.piv.shR.position);
  ik2(_S, _T.set(tx, ty, tz), _P.set(px, py, pz), L1, L2, _u1, _f1);
  _U.lerp(_u1, w).normalize(); _F.lerp(_f1, w).normalize();
}
function headToTorso(h, lx, ly, lz, out) {             // head-local point (relative to head centre) -> torso space
  out.set(lx, ly, lz).add(_a.set(0, 0.2, 0)).applyQuaternion(h.piv.neck.quaternion).add(h.piv.neck.position);
  return out;
}

function eulerQ(q, x, y, z) { return q.setFromEuler(_ea.set(x, y, z)); }

function applyKicks(h, dt) {
  const K = h.anim.kick;
  const apply = (name, piv) => {
    const k = K[name]; if (!k) return;
    for (let i = 0; i < 3; i++) { k[3 + i] += (-130 * k[i] - 8 * k[3 + i]) * dt; k[i] += k[3 + i] * dt; }
    if (Math.abs(k[0]) + Math.abs(k[1]) + Math.abs(k[2]) < 1e-4) return;
    piv.quaternion.multiply(_qb.setFromEuler(_ea.set(k[0], k[1], k[2])));
  };
  apply('spine', h.piv.spine); apply('neck', h.piv.neck); apply('shL', h.piv.shL); apply('shR', h.piv.shR);
  apply('hipL', h.piv.hipL); apply('hipR', h.piv.hipR); apply('kneeL', h.piv.knL); apply('kneeR', h.piv.knR);
}
function kickJoint(h, name, x, y, z) { const k = h.anim.kick[name]; if (k) { k[3] += x; k[4] += y; k[5] += z; } }

function updateBlink(h, dt) {
  const a = h.anim; a.blinkT -= dt;
  if (a.blinkT <= 0) { a.blinkD = 0.14; a.blinkT = rand(1.8, 5.5); }
  let closed = 0;
  if (a.blinkD > 0) { a.blinkD -= dt; closed = Math.sin(clamp(a.blinkD / 0.14, 0, 1) * Math.PI); }
  const sy = 1 - closed * 0.92;
  for (const e of h.eyes) e.scale.y = sy;
}

/* ---------------- idle animations ---------------- */
function startGesture(h) {
  const t = pick(['scratch', 'wring', 'cross', 'hips', 'none-look', 'wring']);
  h.anim.g = { type: t, t: 0, dur: rand(2.5, 5), side: Math.random() < 0.5 ? -1 : 1 };
}
function gestureWeight(g) { if (g.type === 'none' || g.type === 'none-look') return 0; return smooth(clamp(Math.min(g.t / 0.5, (g.dur - g.t) / 0.5), 0, 1)); }

function lookAtPlayer(h) {
  const dx = player.x - h.root.position.x, dz = player.z - h.root.position.z;
  return { ang: Math.atan2(dx, dz), dist: Math.hypot(dx, dz) };
}

function poseStanding(h, dt) {
  const a = h.anim, t = h.t, P = h.piv, st = smooth(clamp(a.startle, 0, 1));
  const breath = Math.sin(t * 1.7 + a.ph), w = Math.sin(t * 0.33 + a.ph * 2) * 0.6 + Math.sin(t * 0.11 + a.ph) * 0.4;
  const col = h.collapse;
  // gestures
  a.nextG -= dt;
  if (a.g.type === 'none' && a.nextG <= 0 && col === 0) startGesture(h);
  if (a.g.type !== 'none') { a.g.t += dt; if (a.g.t >= a.g.dur) { a.g.type = 'none'; a.nextG = rand(2, 6); } }
  const gw = gestureWeight(a.g), gt = a.g.type;
  // look / facing
  const pl = lookAtPlayer(h), faceDiff = angDiff(h.root.rotation.y, pl.ang);
  const lk = a.look; lk.timer -= dt;
  if (lk.timer <= 0) {
    lk.timer = rand(1.5, 4.5);
    if (Math.random() < 0.55) { lk.ty = clamp(faceDiff, -1.1, 1.1); lk.tp = rand(-0.1, 0.15); } else { lk.ty = rand(-0.8, 0.8); lk.tp = rand(-0.15, 0.2); }
    if (Math.abs(faceDiff) > 0.7 && Math.random() < 0.5) a.turning = true;
  }
  if (a.turning) { const step = clamp(angDiff(h.root.rotation.y, pl.ang), -1, 1) * Math.min(1, dt * 1.6); h.root.rotation.y += step; if (Math.abs(faceDiff) < 0.12) a.turning = false; }
  lk.yaw += (lk.ty - lk.yaw) * Math.min(1, dt * 4); lk.pitch += (lk.tp - lk.pitch) * Math.min(1, dt * 4);
  const hit = a.hitLook;                                       // head jerk toward a shock
  // spine / head
  const lean = 0.03 + breath * 0.008 - st * 0.14 + col * 0.35;
  eulerQ(P.spine.quaternion, lean, lk.yaw * 0.18, -w * 0.035);
  eulerQ(P.neck.quaternion, 0.05 + lk.pitch - st * 0.18 - col * 0.2, lk.yaw * 0.82, Math.sin(t * 0.7 + a.ph) * 0.02);
  P.spine.scale.set(1, 1 + breath * 0.006, 1 + breath * 0.012);
  // legs: the loaded leg is straight, the other relaxes; both bend when startled or collapsing
  const cbend = 0.18 * st + col * 1.0;
  for (const [sd, , hipP, knP, sign] of [['L', 0, P.hipL, P.knL, -1], ['R', 0, P.hipR, P.knR, 1]]) {
    const loaded = (sd === 'L') === (w > 0), k = Math.abs(w);
    const tf = loaded ? 0.0 : 0.10 * k + 0.02, sf = loaded ? 0.0 : -0.14 * k;
    dirQ(hipP.quaternion, sign * (0.04 + (loaded ? 0.0 : 0.05 * k)), -1, tf + cbend * 0.6);
    _b.set(0, -1, sf - cbend * 1.4).normalize().applyQuaternion(_qa.copy(hipP.quaternion).invert());
    knP.quaternion.setFromUnitVectors(DOWN, _b);
    // foot stays flat on the floor, toes slightly out
    _qc.copy(P.hips.quaternion).multiply(hipP.quaternion).multiply(knP.quaternion).invert();
    (sd === 'L' ? P.anL : P.anR).quaternion.copy(_qc).multiply(_qb.setFromEuler(_ea.set(0, sign * 0.18, 0)));
  }
  // hip height from the more extended leg
  const vL = legVertical(P.hipL, P.knL), vR = legVertical(P.hipR, P.knR);
  P.hips.position.set(w * 0.025, 0.08 + Math.max(vL, vR), 0);       // 0.08 = ankle-to-sole
  eulerQ(P.hips.quaternion, 0, -w * 0.05, w * 0.04);
  // arms
  for (const side of [-1, 1]) {
    _U.set(side * 0.10, -1, -0.03 + breath * 0.012).normalize(); _F.set(side * 0.05, -1, 0.30).normalize();
    const own = (gt === 'scratch' && a.g.side === side) || gt === 'wring' || gt === 'cross' || gt === 'hips';
    if (own && gw > 0) {
      if (gt === 'scratch') { const sc = Math.sin(t * 15) * 0.015; headToTorso(h, side * 0.1, -0.02 + sc, 0.01, _T); armBlend(h, side, _T.x, _T.y, _T.z, side, 0, -0.6, gw); }
      else if (gt === 'wring') armBlend(h, side, side * 0.045 + Math.sin(t * 6) * 0.01, -0.02 + Math.sin(t * 5 + side) * 0.012, 0.24, side * 0.5, -0.4, -0.5, gw);
      else if (gt === 'cross') armBlend(h, side, -side * 0.12, 0.08, 0.2 + (side > 0 ? 0.03 : 0), side * 0.3, -0.6, -0.1, gw);
      else if (gt === 'hips') armBlend(h, side, side * 0.2, -0.17, 0.0, side, -0.1, -0.7, gw);
    }
    // startle: hands come up in front of the face
    armBlend(h, side, side * 0.14, 0.5 + 0.02 * Math.sin(t * 9), 0.22, side, 0.15, -0.3, st * 0.9);
    poseArm(side < 0 ? P.shL : P.shR, side < 0 ? P.elL : P.elR, _U.x, _U.y, _U.z, _F.x, _F.y, _F.z);
  }
}
// vertical distance from the hip pivot's parent (pelvis centre) to the sole, using the current thigh+shin directions
function legVertical(hip, kn) {
  _a.set(0, -0.42, 0).applyQuaternion(hip.quaternion);
  _b.set(0, -0.42, 0).applyQuaternion(_qa.copy(hip.quaternion).multiply(kn.quaternion));
  return 0.04 - _a.y - _b.y;
}

function poseHostage(h, dt) {
  const a = h.anim, t = h.t, P = h.piv, st = smooth(clamp(a.startle, 0, 1));
  const breath = Math.sin(t * 2.6 + a.ph), col = h.collapse;
  // sobbing bursts
  a.sobT -= dt; if (a.sobT <= 0 && a.sobD <= 0) { a.sobD = rand(1.2, 2.2); a.sobT = rand(4, 9); }
  let sob = 0; if (a.sobD > 0) { a.sobD -= dt; sob = Math.sin(clamp(a.sobD / 2, 0, 1) * Math.PI) * Math.sin(t * 22); }
  const trem = 0.011 * (1 + st * 2.5 + Math.abs(sob));
  const nx = Math.sin(t * 31 + a.ph) * trem, ny = Math.sin(t * 27 + a.ph * 2) * trem, nz = Math.sin(t * 23 + a.ph * 3) * trem;
  // look up at the player now and then
  const lk = a.look; lk.timer -= dt;
  const pl = lookAtPlayer(h), faceDiff = angDiff(h.root.rotation.y, pl.ang);
  if (lk.timer <= 0) { lk.timer = rand(2, 5); if (Math.random() < 0.45) { lk.ty = clamp(faceDiff, -0.5, 0.5); lk.tp = -0.55; } else { lk.ty = rand(-0.4, 0.4); lk.tp = rand(0.15, 0.45); } }
  lk.yaw += (lk.ty - lk.yaw) * Math.min(1, dt * 3); lk.pitch += (lk.tp - lk.pitch) * Math.min(1, dt * 3);
  const lean = 0.14 + breath * 0.012 + st * 0.3 + sob * 0.035 + col * 0.9;
  eulerQ(P.spine.quaternion, lean + nx, nz * 2, ny + Math.sin(t * 0.8 + a.ph) * 0.02);
  eulerQ(P.neck.quaternion, lk.pitch * (1 - st * 0.5) + 0.12 + st * 0.35 + sob * 0.07 + nx, lk.yaw + ny * 2, nz);
  P.spine.scale.set(1, 1 + breath * 0.008, 1 + breath * 0.016);
  // kneeling legs: thighs vertical, shins flat on the floor behind
  for (const [sd, hipP, knP, anP, sign] of [['L', P.hipL, P.knL, P.anL, -1], ['R', P.hipR, P.knR, P.anR, 1]]) {
    dirQ(hipP.quaternion, sign * 0.13, -1, 0.07);
    _b.set(sign * 0.14, 0.0, -1).normalize().applyQuaternion(_qa.copy(hipP.quaternion).invert());
    knP.quaternion.setFromUnitVectors(DOWN, _b);
    _qc.copy(P.hips.quaternion).multiply(hipP.quaternion).multiply(knP.quaternion).invert();
    anP.quaternion.copy(_qc).multiply(_qb.setFromEuler(_ea.set(Math.PI, 0, sign * 0.1)));
  }
  _a.set(0, -0.42, 0).applyQuaternion(P.hipL.quaternion);
  P.hips.position.set(Math.sin(t * 0.5 + a.ph) * 0.012, 0.062 + 0.04 - _a.y, -0.02);
  eulerQ(P.hips.quaternion, 0, 0, 0);
  // hands clasped behind the head
  for (const side of [-1, 1]) {
    headToTorso(h, side * 0.055 + nx * 0.5, 0.0 + ny * 0.5, -0.085, _T);
    _S.copy(side < 0 ? P.shL.position : P.shR.position);
    const slack = col > 0 ? col : 0;
    ik2(_S, _T, _P.set(side * 1, -0.35 - slack, -0.25), L1, L2, _U, _F);
    if (slack > 0) { _u0.set(side * 0.1, -1, 0.1).normalize(); _f0.set(side * 0.05, -1, 0.4).normalize(); _U.lerp(_u0, slack).normalize(); _F.lerp(_f0, slack).normalize(); }
    poseArm(side < 0 ? P.shL : P.shR, side < 0 ? P.elL : P.elR, _U.x, _U.y, _U.z, _F.x, _F.y, _F.z);
  }
}

/* ---------------- spawn / remove ---------------- */
function spawnHuman(kind, padIndex) {
  const pad = SPAWN_PADS[padIndex];
  if (pad.human && !pad.human.removed) removeHuman(pad.human);
  if (humans.length >= MAX_HUMANS) { const dead = humans.find(x => x.state === 'ragdoll') || humans[0]; removeHuman(dead); }
  const h = buildHuman(kind);
  h.root.position.set(pad.x, 0, pad.z);
  h.root.rotation.y = Math.atan2(player.x - pad.x, player.z - pad.z) + rand(-0.15, 0.15);
  h.pad = pad; pad.human = h;
  scene.add(h.root); humans.push(h);
  poseHuman(h, 0.016); h.root.updateMatrixWorld(true);
  addFlash(pad.x, 0.9, pad.z, 0x19f0ff, 1.6, 0.5, 0.8);
  emit(pad.x, 0.1, pad.z, 18, { color: 0x6ff6ff, speed: 2.5, life: 0.7, size: 0.04, grav: -2, dir: { x: 0, y: 1, z: 0 }, cone: 0.6, hdr: 1.8 });
  sfx('spawn', pad, 0.5);
  return h;
}
function disposeHuman(h) {
  h.mats.forEach(m => m.dispose()); h.tex.forEach(t => t.dispose());
}
function removeHuman(h) {
  if (h.removed) return;
  h.removed = true;
  if (h.ragdoll) { h.ragdoll.constraints.forEach(c => physWorld.removeConstraint(c)); Object.values(h.ragdoll.bodies).forEach(b => physWorld.removeBody(b)); freeRagSlot(h.ragdoll.slot); }
  for (const n of SEG_ORDER) { const g = h.seg[n].group; if (g.parent) g.parent.remove(g); }
  if (h.root.parent) h.root.parent.remove(h.root);
  if (h.pad && h.pad.human === h) h.pad.human = null;
  removeBloodFor(h);
  const i = humans.indexOf(h); if (i >= 0) humans.splice(i, 1);
  disposeHuman(h);
}
function clearHumans() { while (humans.length) removeHuman(humans[humans.length - 1]); }
function aliveHumans() { return humans.filter(h => h.state !== 'ragdoll' && !h.removed); }

/* ---------------- ragdoll ---------------- */
function makeRagdoll(h, hit, dir, impulse) {
  let slot = allocRagSlot();
  if (slot < 0) { const old = humans.find(x => x.state === 'ragdoll' && x !== h); if (old) removeHuman(old); slot = allocRagSlot(); }
  if (slot < 0) { removeHuman(h); return; }
  h.piv.spine.scale.set(1, 1, 1); h.root.updateMatrixWorld(true);
  const s = h.look.s, bodies = {}, tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  for (const name of SEG_ORDER) {
    const seg = h.seg[name], d = seg.def;
    seg.group.getWorldPosition(tmpP); seg.group.getWorldQuaternion(tmpQ);
    const body = new CANNON.Body({ mass: d.mass, material: matBody, linearDamping: 0.06, angularDamping: 0.45 });
    if (d.sphere) body.addShape(new CANNON.Sphere(d.sphere * s));
    else body.addShape(new CANNON.Box(new CANNON.Vec3(d.half[0] * s, d.half[1] * s, d.half[2] * s)), d.off ? new CANNON.Vec3(d.off[0] * s, d.off[1] * s, d.off[2] * s) : undefined);
    body.position.set(tmpP.x, tmpP.y, tmpP.z); body.quaternion.set(tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w);
    body.collisionFilterGroup = ragGroup(slot); body.collisionFilterMask = ragMask(slot);
    body.allowSleep = true; body.sleepSpeedLimit = 0.25; body.sleepTimeLimit = 0.8;
    physWorld.addBody(body); bodies[name] = body; seg.body = body;
  }
  const constraints = [];
  for (const name of SEG_ORDER) {
    const d = DEF[name]; if (!d.parent) continue;
    const A = bodies[d.parent], B = bodies[name], J = JOINT[name];
    const pA = new CANNON.Vec3(d.jInP[0] * s, d.jInP[1] * s, d.jInP[2] * s), pB = new CANNON.Vec3(d.jInS[0] * s, d.jInS[1] * s, d.jInS[2] * s);
    // child limb direction (child local) and the same axis expressed in the parent frame -> zero initial violation
    _a.set(-d.jInS[0], -d.jInS[1], -d.jInS[2]).normalize();
    const axB = new CANNON.Vec3(_a.x, _a.y, _a.z), tmp = new CANNON.Vec3();
    B.quaternion.vmult(axB, tmp); const axA = new CANNON.Vec3(); A.quaternion.inverse().vmult(tmp, axA);
    let c;
    if (J[0] === 'hinge') {
      const hb = new CANNON.Vec3(1, 0, 0), hw = new CANNON.Vec3(); B.quaternion.vmult(hb, hw); const ha = new CANNON.Vec3(); A.quaternion.inverse().vmult(hw, ha);
      c = new CANNON.HingeConstraint(A, B, { pivotA: pA, pivotB: pB, axisA: ha, axisB: hb, maxForce: 3e4 });
    } else c = new CANNON.ConeTwistConstraint(A, B, { pivotA: pA, pivotB: pB, axisA: axA, axisB: axB, angle: J[1], twistAngle: J[2], maxForce: 3e4 });
    c.collideConnected = false;
    physWorld.addConstraint(c); constraints.push(c);
  }
  // detach segment groups from the (now meaningless) rig so physics owns them
  for (const name of SEG_ORDER) scene.attach(h.seg[name].group);
  if (h.root.parent) h.root.parent.remove(h.root);
  h.ragdoll = { slot, bodies, constraints, sleepT: 0, twitch: 1.0 };
  h.state = 'ragdoll';
  if (hit && dir && impulse) {
    const b = bodies[hit.seg.name];
    b.applyImpulse(new CANNON.Vec3(dir.x * impulse, dir.y * impulse, dir.z * impulse), new CANNON.Vec3(hit.point.x - b.position.x, hit.point.y - b.position.y, hit.point.z - b.position.z));
    ['pelvis', 'torso'].forEach(n => { if (n !== hit.seg.name) bodies[n].applyImpulse(new CANNON.Vec3(dir.x * impulse * 0.22, dir.y * impulse * 0.22, dir.z * impulse * 0.22), new CANNON.Vec3(0, 0, 0)); });
  }
}
function syncRagdoll(h, dt) {
  const R = h.ragdoll;
  for (const name of SEG_ORDER) { const b = R.bodies[name], g = h.seg[name].group; g.position.set(b.position.x, b.position.y, b.position.z); g.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); }
  if (R.twitch > 0) {                              // brief nervous twitching right after death
    R.twitch -= dt;
    if (Math.random() < 0.18) { const n = pick(['uArmL', 'uArmR', 'thighL', 'thighR', 'head']); R.bodies[n].applyImpulse(new CANNON.Vec3(rand(-1, 1) * 0.8, rand(0.1, 0.8), rand(-1, 1) * 0.8), new CANNON.Vec3(0, 0, 0)); }
  }
  let asleep = true; for (const n in R.bodies) if (R.bodies[n].sleepState !== CANNON.Body.SLEEPING) { asleep = false; break; }
  h.asleep = asleep;
}

/* ---------------- hit detection ---------------- */
const _inv = new THREE.Matrix4(), _lo = new THREE.Vector3(), _ld = new THREE.Vector3();
function hitscanHumans(ox, oy, oz, dx, dy, dz, maxT) {
  let best = null;
  for (const h of humans) {
    if (h.removed) continue;
    if (h.state !== 'ragdoll') h.root.updateMatrixWorld(true);
    // quick reject: distance from the ray to the body's centre
    const c = h.state === 'ragdoll' ? h.seg.pelvis.group.position : h.root.position, ry = h.state === 'ragdoll' ? 0 : 0.9;
    const lx = c.x - ox, ly = c.y + ry - oy, lz = c.z - oz, tca = lx * dx + ly * dy + lz * dz;
    if (lx * lx + ly * ly + lz * lz - tca * tca > 4.84) continue;
    for (const name of SEG_ORDER) {
      const seg = h.seg[name], mesh = seg.mesh;
      mesh.updateWorldMatrix(true, false);
      _inv.copy(mesh.matrixWorld).invert();
      _lo.set(ox, oy, oz).applyMatrix4(_inv);
      const e = _inv.elements;                       // direction keeps its length so t stays in world units
      _ld.set(e[0] * dx + e[4] * dy + e[8] * dz, e[1] * dx + e[5] * dy + e[9] * dz, e[2] * dx + e[6] * dy + e[10] * dz);
      let t;
      if (name === 'head') t = raySphereAny(_lo.x, _lo.y, _lo.z, _ld.x, _ld.y, _ld.z, 1);
      else { const bb = mesh.geometry.boundingBox; t = rayAABB(_lo.x, _lo.y, _lo.z, _ld.x, _ld.y, _ld.z, bb.min.x, bb.max.x, bb.min.y, bb.max.y, bb.min.z, bb.max.z); }
      if (t >= 0 && t < maxT && (!best || t < best.t)) best = { h, seg, t, zone: seg.def.zone, mul: seg.def.mul };
    }
  }
  if (best) { best.point = { x: ox + dx * best.t, y: oy + dy * best.t, z: oz + dz * best.t }; }
  return best;
}
// sphere at the origin, direction does NOT have to be unit length (t stays in the caller's units)
function raySphereAny(ox, oy, oz, dx, dy, dz, r) {
  const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const sq = Math.sqrt(disc); let t = (-b - sq) / (2 * a); if (t < 0) t = (-b + sq) / (2 * a);
  return t < 0 ? -1 : t;
}
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca, r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}
function rayAABB(ox, oy, oz, dx, dy, dz, x0, x1, y0, y1, z0, z1) {
  let tmin = -1e9, tmax = 1e9;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
    let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return tmin < 0 ? 0 : tmin;
}

/* ---------------- damage ---------------- */
function startleAll(amount, from) {
  for (const h of humans) {
    if (h.state === 'ragdoll' || h.removed) continue;
    const d = from ? Math.hypot(h.root.position.x - from.x, h.root.position.z - from.z) : 3;
    const a = amount * clamp(1.3 - d / 14, 0.35, 1);
    if (a > h.anim.startle) { const first = h.anim.startle < 0.2; h.anim.startle = a; if (first && Math.random() < 0.6) sfx(h.look.female ? 'gaspF' : 'gasp', h.root.position, 0.8); }
  }
}
// hit: result of hitscanHumans. dmg: base damage. wp: weapon id. dir: world ray direction
function damageHuman(hit, dmg, dir, wp) {
  const h = hit.h, zone = hit.zone, head = zone === 'head';
  const impulse = wp === 'ak47' ? 85 : 60;
  bloodHit(h, hit, dir, wp);
  sfx(head ? 'headshot' : 'flesh', hit.point, 1);
  if (h.state === 'ragdoll') {                                        // shooting a body
    const b = h.ragdoll.bodies[hit.seg.name];
    b.applyImpulse(new CANNON.Vec3(dir.x * impulse * 0.5, dir.y * impulse * 0.5, dir.z * impulse * 0.5), new CANNON.Vec3(hit.point.x - b.position.x, hit.point.y - b.position.y, hit.point.z - b.position.z));
    b.wakeUp(); return { killed: false, head };
  }
  if (h.state === 'dying') { h.hp = 0; finishDying(h, hit, dir, impulse); return { killed: true, head, already: true }; }
  h.hp -= dmg * hit.mul;
  const lethal = head || h.hp <= 0;
  if (lethal) { h.hp = 0; killHuman(h, hit, dir, impulse); return { killed: true, head }; }
  // not lethal: flinch, scream, start bleeding out
  h.bleed += zone === 'torso' ? 1.6 : zone === 'leg' ? 1.0 : 0.8;
  const lx = _a.set(dir.x, dir.y, dir.z).applyAxisAngle(_b.set(0, 1, 0), -h.root.rotation.y);
  const jn = zone === 'torso' ? 'spine' : hit.seg.name.includes('uArm') || hit.seg.name.includes('fArm') ? (hit.seg.name.endsWith('L') ? 'shL' : 'shR') : hit.seg.name.endsWith('L') ? 'hipL' : 'hipR';
  kickJoint(h, jn, lx.z * 7, 0, -lx.x * 7);
  if (zone === 'torso') kickJoint(h, 'neck', lx.z * 5, 0, -lx.x * 5);
  if (zone === 'leg') { kickJoint(h, hit.seg.name.endsWith('L') ? 'kneeL' : 'kneeR', 4, 0, 0); h.hp -= 12; }
  h.anim.startle = 1;
  sfx(h.look.female ? 'screamF' : 'scream', h.root.position, 0.9);
  if (h.hp < 28 || zone === 'leg' && h.hp < 60) { h.state = 'dying'; h.dyingT = 0; h.dyingDir = { x: dir.x, y: dir.y, z: dir.z }; h.dyingHit = hit; }
  startleAll(0.8, h.root.position);
  return { killed: false, head };
}
function killHuman(h, hit, dir, impulse) {
  h.state = 'dead'; h.hp = 0;
  if (h.pad && h.pad.human === h) h.pad.human = null;
  makeRagdoll(h, hit, dir, impulse);
  startDeathBleeding(h, hit);
  onHumanKilled(h, hit.zone === 'head');
  startleAll(1, h.seg.pelvis.group.position);
}
function finishDying(h, hit, dir, impulse) {
  if (h.pad && h.pad.human === h) h.pad.human = null;
  makeRagdoll(h, hit || h.dyingHit, dir || h.dyingDir, impulse || 20);
  startDeathBleeding(h, hit || h.dyingHit);
  onHumanKilled(h, false);
}

/* ---------------- per-frame update ---------------- */
function poseHuman(h, dt) {
  h.t += dt;
  const a = h.anim; a.startle = Math.max(0, a.startle - dt * 0.55);
  if (h.kind === 'hostage') poseHostage(h, dt); else poseStanding(h, dt);
  applyKicks(h, dt); updateBlink(h, dt);
}
function updateHumans(dt) {
  for (let i = humans.length - 1; i >= 0; i--) {
    const h = humans[i];
    if (h.removed) continue;
    if (h.state === 'alive' || h.state === 'dying') {
      if (h.state === 'dying') {
        h.dyingT += dt; h.collapse = smooth(clamp(h.dyingT / 0.9, 0, 1));
        if (h.dyingT >= 0.9) { finishDying(h); continue; }
      } else {
        // bleeding out and crying
        if (h.bleed > 0) { h.hp -= h.bleed * dt * 1.6; if (h.hp <= 0) { h.state = 'dying'; h.dyingT = 0; h.dyingDir = { x: 0, y: 0, z: 0 }; h.dyingHit = null; } }
        h.anim.cryT -= dt;
        if (h.anim.cryT <= 0) { h.anim.cryT = h.kind === 'hostage' ? rand(5, 11) : rand(14, 30); if (h.kind === 'hostage' || h.bleed > 0) sfx(h.bleed > 0 ? (h.look.female ? 'screamF' : 'groan') : (h.look.female ? 'cryF' : 'cry'), h.root.position, 0.8); }
      }
      poseHuman(h, dt);
    } else if (h.state === 'ragdoll') syncRagdoll(h, dt);
  }
  stepPhysics(dt);
  updateStandingPads();
}
function updateStandingPads() {
  for (const p of SPAWN_PADS) if (p.human && p.human.removed) p.human = null;
}
