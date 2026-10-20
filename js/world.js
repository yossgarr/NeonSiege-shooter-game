'use strict';
/* =========================================================
   WORLD — scene, procedural textures, map, collision, nav
   ========================================================= */
const ARENA = 30;                       // half-size of the arena (60 x 60)
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b16);
scene.fog = new THREE.FogExp2(0x0b1226, 0.016);

/* ---------------- procedural textures ---------------- */
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = Array.isArray(size) ? size[0] : size; c.height = Array.isArray(size) ? size[1] : size;
  const g = c.getContext('2d');
  draw(g, c.width);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}
function speckle(g, s, count, lo, hi, alpha) {
  for (let i = 0; i < count; i++) {
    const v = (lo + Math.random() * (hi - lo)) | 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    const w = 1 + Math.random() * 2.5;
    g.fillRect(Math.random() * s, Math.random() * s, w, w);
  }
}
function scratches(g, s, count, alpha) {
  g.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    g.strokeStyle = `rgba(255,255,255,${Math.random() * alpha})`;
    const x = Math.random() * s, y = Math.random() * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-40, 40), y + rand(-6, 6)); g.stroke();
  }
}

const floorTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#20252e'; g.fillRect(0, 0, s, s);
  const n = 4, t = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 28 + Math.random() * 14 | 0;
    g.fillStyle = `rgb(${v},${v + 4},${v + 12})`; g.fillRect(i * t, j * t, t, t);
  }
  speckle(g, s, 5000, 10, 90, 0.35);
  scratches(g, s, 60, 0.12);
  g.strokeStyle = '#080a10'; g.lineWidth = 4;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, s); g.moveTo(0, i * t); g.lineTo(s, i * t); g.stroke(); }
  g.strokeStyle = 'rgba(120,150,200,.18)'; g.lineWidth = 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.strokeRect(i * t + 6, j * t + 6, t - 12, t - 12);
  g.fillStyle = 'rgba(150,170,210,.35)';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) [[12, 12], [t - 14, 12], [12, t - 14], [t - 14, t - 14]].forEach(([x, y]) => { g.beginPath(); g.arc(i * t + x, j * t + y, 2.5, 0, TAU); g.fill(); });
});

const wallTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#2f3746'; g.fillRect(0, 0, s, s);
  speckle(g, s, 6000, 20, 110, 0.3);
  const n = 2, t = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * t, y = j * t;
    const gr = g.createLinearGradient(x, y, x, y + t);
    gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr; g.fillRect(x, y, t, t);
    g.strokeStyle = '#0c0f16'; g.lineWidth = 5; g.strokeRect(x + 2, y + 2, t - 4, t - 4);
    g.strokeStyle = 'rgba(140,170,220,.25)'; g.lineWidth = 2; g.strokeRect(x + 12, y + 12, t - 24, t - 24);
    g.fillStyle = 'rgba(190,205,235,.45)';
    [[22, 22], [t - 22, 22], [22, t - 22], [t - 22, t - 22]].forEach(([a, b]) => { g.beginPath(); g.arc(x + a, y + b, 3.5, 0, TAU); g.fill(); });
    // vent slits
    g.fillStyle = 'rgba(0,0,0,.45)';
    if ((i + j) % 2 === 0) for (let k = 0; k < 6; k++) g.fillRect(x + 70, y + 80 + k * 18, t - 140, 7);
  }
  scratches(g, s, 50, 0.1);
});

const crateTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#44503b'; g.fillRect(0, 0, s, s);
  speckle(g, s, 3000, 20, 120, 0.3);
  g.fillStyle = '#2b3524'; g.fillRect(0, 0, s, 16); g.fillRect(0, s - 16, s, 16); g.fillRect(0, 0, 16, s); g.fillRect(s - 16, 0, 16, s);
  g.strokeStyle = '#6d7e5b'; g.lineWidth = 12;
  g.beginPath(); g.moveTo(22, 22); g.lineTo(s - 22, s - 22); g.moveTo(s - 22, 22); g.lineTo(22, s - 22); g.stroke();
  g.strokeStyle = '#1f271a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(22, 22); g.lineTo(s - 22, s - 22); g.moveTo(s - 22, 22); g.lineTo(22, s - 22); g.stroke();
  g.fillStyle = '#e8b930'; g.fillRect(s / 2 - 30, s / 2 - 12, 60, 24);
  g.fillStyle = '#2a2208'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText('AMMO', s / 2, s / 2 + 6);
  g.fillStyle = '#c9d6b8';
  [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); });
  scratches(g, s, 25, 0.15);
});

const pillarTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#4b505b'; g.fillRect(0, 0, s, s);
  speckle(g, s, 5000, 30, 140, 0.35);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < s; y += 64) g.fillRect(0, y, s, 3);
  // hazard stripes at bottom
  const h = s * 0.22; g.save(); g.beginPath(); g.rect(0, s - h, s, h); g.clip();
  g.fillStyle = '#e8b930'; g.fillRect(0, s - h, s, h);
  g.fillStyle = '#15171c';
  for (let x = -s; x < s * 2; x += 44) { g.beginPath(); g.moveTo(x, s); g.lineTo(x + 22, s); g.lineTo(x + 22 + h, s - h); g.lineTo(x + h, s - h); g.fill(); }
  g.restore();
  scratches(g, s, 30, 0.1);
});

const decalTex = canvasTex(1024, (g, s) => {
  g.clearRect(0, 0, s, s);
  const c = s / 2;
  g.lineCap = 'round';
  // central rings
  g.strokeStyle = 'rgba(25,240,255,.85)'; g.lineWidth = 6;
  g.beginPath(); g.arc(c, c, s * 0.19, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, s * 0.215, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,45,149,.8)'; g.lineWidth = 4; g.setLineDash([24, 18]);
  g.beginPath(); g.arc(c, c, s * 0.3, 0, TAU); g.stroke(); g.setLineDash([]);
  // cross lanes
  g.strokeStyle = 'rgba(255,197,49,.55)'; g.lineWidth = 5; g.setLineDash([40, 30]);
  g.beginPath(); g.moveTo(c, s * 0.04); g.lineTo(c, s * 0.96); g.moveTo(s * 0.04, c); g.lineTo(s * 0.96, c); g.stroke(); g.setLineDash([]);
  // corner brackets
  g.strokeStyle = 'rgba(25,240,255,.7)'; g.lineWidth = 8;
  const m = s * 0.035, l = s * 0.1;
  [[m, m, 1, 1], [s - m, m, -1, 1], [m, s - m, 1, -1], [s - m, s - m, -1, -1]].forEach(([x, y, a, b]) => {
    g.beginPath(); g.moveTo(x + a * l, y); g.lineTo(x, y); g.lineTo(x, y + b * l); g.stroke();
  });
  // spawn chevrons
  g.fillStyle = 'rgba(255,45,149,.75)';
  for (let k = 0; k < 3; k++) {
    const y = s * 0.9 - k * 26;
    g.beginPath(); g.moveTo(c - 24, y); g.lineTo(c, y - 16); g.lineTo(c + 24, y); g.lineTo(c + 24, y + 8); g.lineTo(c, y - 8); g.lineTo(c - 24, y + 8); g.fill();
  }
  g.fillStyle = 'rgba(25,240,255,.8)'; g.font = '800 40px Orbitron, monospace'; g.textAlign = 'center';
  g.fillText('NEON SIEGE', c, c + s * 0.27); g.font = '700 22px monospace'; g.fillText('// ARENA 01 //', c, c + s * 0.27 + 34);
}, true);

const skyTex = canvasTex([2048, 1024], (g, W) => {
  const Ht = g.canvas.height;
  const gr = g.createLinearGradient(0, 0, 0, Ht);
  gr.addColorStop(0, '#01020a'); gr.addColorStop(0.45, '#0b1030'); gr.addColorStop(0.62, '#2a1450'); gr.addColorStop(0.72, '#7a2a7a'); gr.addColorStop(0.75, '#ff6aa0');
  gr.addColorStop(0.76, '#1a0f2e'); gr.addColorStop(1, '#05060e');
  g.fillStyle = gr; g.fillRect(0, 0, W, Ht);
  for (let i = 0; i < 1400; i++) {            // stars (kept away from the poles where the mapping stretches them)
    const y = Ht * (0.2 + Math.random() * 0.42);
    g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.8})`;
    g.fillRect(Math.random() * W, y, Math.random() < 0.04 ? 2 : 1, 1);
  }
  const mx = W * 0.72, my = Ht * 0.3, mg = g.createRadialGradient(mx, my, 2, mx, my, 150);
  mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.1, 'rgba(210,230,255,.95)'); mg.addColorStop(0.13, 'rgba(120,150,255,.35)'); mg.addColorStop(1, 'rgba(60,80,200,0)');
  g.fillStyle = mg; g.fillRect(0, 0, W, Ht);
}, true);
skyTex.wrapS = THREE.RepeatWrapping;

const cityTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#0a0d1a'; g.fillRect(0, 0, s, s);
  const cols = ['#ffd27a', '#7ad8ff', '#ff7ac4', '#fff3c4'];
  for (let y = 4; y < s; y += 12) for (let x = 4; x < s; x += 10) {
    if (Math.random() < 0.22) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = 0.45 + Math.random() * 0.55; g.fillRect(x, y, 5, 7); }
  }
  g.globalAlpha = 1;
});

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0x8aa0e8, 0x20243a, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xb4c4ff, 0.95);
sun.position.set(-26, 46, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 130 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun);

const accentLights = [];
[[-14, 9, -14, 0x19f0ff], [14, 9, -14, 0xff2d95], [-14, 9, 14, 0xff2d95], [14, 9, 14, 0x19f0ff], [0, 8, 0, 0x8a5bff]].forEach(([x, y, z, c]) => {
  const l = new THREE.PointLight(c, 1.15, 34, 1.6); l.position.set(x, y, z); scene.add(l); accentLights.push(l);
});

/* ---------------- sky + skyline ---------------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.rotation.y = 0.8;
scene.add(sky);

(function skyline() {
  const mat = new THREE.MeshBasicMaterial({ map: cityTex, color: 0xa8b4d8 });
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU + rand(-0.03, 0.03), r = rand(78, 130);
    const w = rand(8, 20), d = rand(8, 20), h = rand(18, 80);
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v; uv.setXY(k, uv.getX(k) * dims[f][0] / 10, uv.getY(k) * dims[f][1] / 10); }
    const m = new THREE.Mesh(g, mat);
    m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    scene.add(m);
    if (Math.random() < 0.35) { // antenna beacon
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2040, fog: false }));
      b.position.set(m.position.x, h - 2 + 0.5, m.position.z); scene.add(b);
    }
  }
})();

/* ---------------- floor ---------------- */
function scaleUV(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
const floorGeo = new THREE.PlaneGeometry(ARENA * 2, ARENA * 2); scaleUV(floorGeo, 15, 15);
const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: 0.45, roughness: 0.72, metalness: 0.35 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);
const decal = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
  new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
decal.rotation.x = -Math.PI / 2; decal.position.y = 0.012;
scene.add(decal);

/* ---------------- boxes (walls, crates, pillars) ---------------- */
const boxes = [];                        // AABBs used for collision / raycast
const bandMats = { cyan: new THREE.MeshBasicMaterial({ color: 0x19f0ff }), mag: new THREE.MeshBasicMaterial({ color: 0xff2d95 }), amber: new THREE.MeshBasicMaterial({ color: 0xffc531 }) };
const solidMats = {
  wall: new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.8, roughness: 0.6, metalness: 0.55 }),
  crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.75, metalness: 0.3 }),
  pillar: new THREE.MeshStandardMaterial({ map: pillarTex, roughness: 0.9, metalness: 0.1 }),
};

function addBox(x, z, w, d, h, kind, bandKey) {
  const tile = kind === 'crate' ? Math.min(w, d) : 4;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  const mesh = new THREE.Mesh(geo, solidMats[kind]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  if (bandKey) {
    const by = kind === 'pillar' ? h * 0.72 : Math.max(h - 0.45, h * 0.6);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.09, d + 0.03), bandMats[bandKey]);
    band.position.set(x, by, z); scene.add(band);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w >= d ? Math.max(w - 0.3, 0.2) : 0.12, 0.05, w >= d ? 0.12 : Math.max(d - 0.3, 0.2)), bandMats[bandKey]);
    top.position.set(x, h + 0.025, z); scene.add(top);
  }
  const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h, kind, mesh };
  boxes.push(b);
  return b;
}

(function buildMap() {
  const T = ARENA + 1;
  // outer walls
  const outer = [[0, -T, ARENA * 2 + 4, 2], [0, T, ARENA * 2 + 4, 2], [-T, 0, 2, ARENA * 2], [T, 0, 2, ARENA * 2]];
  outer.forEach(([x, z, w, d]) => {
    const b = addBox(x, z, w, d, 7, 'wall');
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.16, d + 0.04), bandMats.cyan);
    band.position.set(x, 4.2, z); scene.add(band);
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04), bandMats.mag);
    band2.position.set(x, 1.0, z); scene.add(band2);
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = (sx * sz > 0) ? 'cyan' : 'mag', c2 = (sx * sz > 0) ? 'mag' : 'cyan';
    addBox(sx * 10, sz * 13, 8, 1, 3.4, 'wall', c);            // L-shaped cover
    addBox(sx * 14, sz * 9, 1, 8, 3.4, 'wall', c);
    addBox(sx * 22, sz * 22, 2.6, 2.6, 7, 'pillar', c2);        // corner towers
    addBox(sx * 24, sz * 6, 2.2, 2.2, 1.2, 'crate');            // crate stairs
    addBox(sx * 24, sz * 8.4, 2.2, 2.2, 2.4, 'crate');
    addBox(sx * 6, sz * 24, 2.2, 2.2, 1.2, 'crate');
    addBox(sx * 8.4, sz * 24, 2.2, 2.2, 2.4, 'crate');
    addBox(sx * 17, sz * 17, 2.2, 2.2, 1.2, 'crate');           // diagonal cover
    addBox(0, sz * 17.5, 7, 1, 1.4, 'wall', 'amber');           // low walls
    addBox(sx * 17.5, 0, 1, 7, 1.4, 'wall', 'amber');
  }
  addBox(0, 0, 3.6, 3.6, 5.6, 'pillar', 'mag');                 // centre tower
  [[5.2, 0], [-5.2, 0], [0, 5.2], [0, -5.2]].forEach(([x, z]) => addBox(x, z, 2, 2, 1.1, 'crate'));
})();

/* ---------------- collision helpers ---------------- */
// push a circle (x,z,r) out of every box that is taller than the feet + step height
function resolveCircle(p, r, feetY, stepH) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.maxY <= feetY + stepH) continue;
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    let dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), k = (r - d) / d;
      p.x += dx * k; p.z += dz * k;
    } else {                              // centre inside the box
      const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
      else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
    }
  }
  const lim = ARENA - r;
  p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
}
// highest surface under a circle that the feet can step onto
function groundAt(x, z, r, feetY, stepH) {
  let g = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.maxY > g && b.maxY <= feetY + stepH) {
      const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r * 0.8) g = b.maxY;
    }
  }
  return g;
}
function boxAt(x, y, z) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y < b.maxY) return b;
  }
  return null;
}

// nearest ray hit against all boxes + floor. Returns distance (maxT if nothing). Fills rayN with hit normal.
const rayN = { x: 0, y: 1, z: 0 };
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT, nx = 0, ny = 0, nz = 0;
  if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; } }
  const ix = 1 / (Math.abs(dx) < 1e-9 ? 1e-9 : dx), iy = 1 / (Math.abs(dy) < 1e-9 ? 1e-9 : dy), iz = 1 / (Math.abs(dz) < 1e-9 ? 1e-9 : dz);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    let t1 = (b.minX - ox) * ix, t2 = (b.maxX - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = t1 < t2 ? -1 : 1, axis = 0;
    t1 = (b.minY - oy) * iy; t2 = (b.maxY - oy) * iy;
    let a = Math.min(t1, t2), c = Math.max(t1, t2);
    if (a > tmin) { tmin = a; axis = 1; ax = t1 < t2 ? -1 : 1; } if (c < tmax) tmax = c;
    t1 = (b.minZ - oz) * iz; t2 = (b.maxZ - oz) * iz;
    a = Math.min(t1, t2); c = Math.max(t1, t2);
    if (a > tmin) { tmin = a; axis = 2; ax = t1 < t2 ? -1 : 1; } if (c < tmax) tmax = c;
    if (tmax < 0 || tmin > tmax || tmin >= best) continue;
    if (tmin < 0) continue;               // origin inside box
    best = tmin; nx = axis === 0 ? ax : 0; ny = axis === 1 ? ax : 0; nz = axis === 2 ? ax : 0;
  }
  rayN.x = nx; rayN.y = ny; rayN.z = nz;
  return best;
}
// 2D segment test against boxes (inflated by margin) — used for "can I walk straight there?"
function segBlocked2D(ax, az, bx, bz, margin) {
  const dx = bx - ax, dz = bz - az;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.maxY < 0.8) continue;
    let t0 = 0, t1 = 1;
    const mnx = b.minX - margin, mxx = b.maxX + margin, mnz = b.minZ - margin, mxz = b.maxZ + margin;
    if (Math.abs(dx) < 1e-9) { if (ax < mnx || ax > mxx) continue; }
    else { let a = (mnx - ax) / dx, c = (mxx - ax) / dx; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (t0 > t1) continue;
    if (Math.abs(dz) < 1e-9) { if (az < mnz || az > mxz) continue; }
    else { let a = (mnz - az) / dz, c = (mxz - az) / dz; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (t0 <= t1) return true;
  }
  return false;
}

/* ---------------- navigation grid + flow field ---------------- */
const NAV_N = ARENA * 2;
const navBlocked = new Uint8Array(NAV_N * NAV_N);
const flowDist = new Float32Array(NAV_N * NAV_N);
const navCell = v => clamp(Math.floor(v + ARENA), 0, NAV_N - 1);
(function buildNav() {
  const m = 0.62;
  for (let j = 0; j < NAV_N; j++) for (let i = 0; i < NAV_N; i++) {
    const x = i - ARENA + 0.5, z = j - ARENA + 0.5;
    let blocked = 0;
    for (const b of boxes) if (x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m) { blocked = 1; break; }
    navBlocked[j * NAV_N + i] = blocked;
  }
})();
const _q = new Int32Array(NAV_N * NAV_N * 2), _inq = new Uint8Array(NAV_N * NAV_N);
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function computeFlow(tx, tz) {
  flowDist.fill(1e9);
  let ci = navCell(tx), cj = navCell(tz);
  if (navBlocked[cj * NAV_N + ci]) {      // target stands inside a blocked cell: use nearest free one
    let found = false;
    for (let r = 1; r < 6 && !found; r++) for (let dj = -r; dj <= r && !found; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= NAV_N || j >= NAV_N || navBlocked[j * NAV_N + i]) continue;
      ci = i; cj = j; found = true; break;
    }
  }
  const SZ = _q.length;
  let head = 0, tail = 0;
  flowDist[cj * NAV_N + ci] = 0; _q[tail++] = cj * NAV_N + ci; _inq.fill(0); _inq[cj * NAV_N + ci] = 1;
  while (head !== tail) {
    const cur = _q[head]; head = (head + 1) % SZ; _inq[cur] = 0;
    const cx = cur % NAV_N, cz = (cur / NAV_N) | 0, cd = flowDist[cur];
    for (let k = 0; k < 8; k++) {
      const n = NB[k], nx = cx + n[0], nz = cz + n[1];
      if (nx < 0 || nz < 0 || nx >= NAV_N || nz >= NAV_N) continue;
      const ni = nz * NAV_N + nx;
      if (navBlocked[ni]) continue;
      if (k >= 4 && (navBlocked[cz * NAV_N + nx] || navBlocked[nz * NAV_N + cx])) continue;
      const nd = cd + n[2];
      if (nd < flowDist[ni]) { flowDist[ni] = nd; if (!_inq[ni]) { _inq[ni] = 1; _q[tail] = ni; tail = (tail + 1) % SZ; } }
    }
  }
}
// writes the direction toward the lower-cost neighbour into out (x,z). returns false if no path
function flowDir(x, z, out) {
  const cx = navCell(x), cz = navCell(z);
  let best = flowDist[cz * NAV_N + cx], bx = -1, bz = -1;
  for (let k = 0; k < 8; k++) {
    const n = NB[k], nx = cx + n[0], nz = cz + n[1];
    if (nx < 0 || nz < 0 || nx >= NAV_N || nz >= NAV_N) continue;
    if (k >= 4 && (navBlocked[cz * NAV_N + nx] || navBlocked[nz * NAV_N + cx])) continue;
    const d = flowDist[nz * NAV_N + nx];
    if (d < best) { best = d; bx = nx; bz = nz; }
  }
  if (bx < 0) { out.x = 0; out.z = 0; return false; }
  const tx = bx - ARENA + 0.5 - x, tz = bz - ARENA + 0.5 - z, l = Math.hypot(tx, tz) || 1;
  out.x = tx / l; out.z = tz / l;
  return true;
}
function randomFreeSpot(minDistFrom, minDist, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const x = rand(-ARENA + 2, ARENA - 2), z = rand(-ARENA + 2, ARENA - 2);
    if (navBlocked[navCell(z) * NAV_N + navCell(x)]) continue;
    if (minDistFrom && Math.hypot(x - minDistFrom.x, z - minDistFrom.z) < minDist) continue;
    return { x, z };
  }
  return { x: 0, z: 20 };
}
