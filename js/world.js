'use strict';
/* =========================================================
   WORLD — a closed tiled cube room, lights, spawn pads, ray/collision helpers
   ========================================================= */
const ROOM = 16;                        // the room is a cube: ROOM x ROOM x ROOM metres
const ARENA = ROOM / 2;                 // half-size on x/z
const ROOM_H = ROOM;                    // ceiling height
const TILE = 2;                         // ceramic tile size in metres
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c10);

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
    const w = 1 + Math.random() * 2;
    g.fillRect(Math.random() * s, Math.random() * s, w, w);
  }
}
function scaleUV(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

// large glossy ceramic tiles: 2x2 tiles per texture repeat
function tileTexture(base, grout, vary) {
  return canvasTex(1024, (g, s) => {
    const n = 2, t = s / n, gap = 9;
    g.fillStyle = grout; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * t + gap / 2, y = j * t + gap / 2, w = t - gap, d = (Math.random() * 2 - 1) * vary;
      g.fillStyle = `rgb(${clamp(base[0] + d, 0, 255) | 0},${clamp(base[1] + d, 0, 255) | 0},${clamp(base[2] + d, 0, 255) | 0})`;
      g.fillRect(x, y, w, w);
      const gr = g.createLinearGradient(x, y, x + w, y + w);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)');
      g.fillStyle = gr; g.fillRect(x, y, w, w);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, w);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + w - 3, w, 3); g.fillRect(x + w - 3, y, 3, w);
      if (Math.random() < 0.5) {                       // faint hairline crack
        g.strokeStyle = 'rgba(70,75,80,.25)'; g.lineWidth = 1; g.beginPath();
        let cx = x + Math.random() * w, cy = y + Math.random() * w; g.moveTo(cx, cy);
        for (let k = 0; k < 6; k++) { cx += rand(-30, 30); cy += rand(-30, 30); g.lineTo(clamp(cx, x, x + w), clamp(cy, y, y + w)); }
        g.stroke();
      }
    }
    speckle(g, s, 3500, 90, 200, 0.07);
    g.fillStyle = 'rgba(0,0,0,.12)';                    // dirty grout
    for (let i = 0; i < 400; i++) { const k = Math.floor(Math.random() * (n + 1)) * t; g.fillRect(k - gap / 2, Math.random() * s, gap, 2 + Math.random() * 3); g.fillRect(Math.random() * s, k - gap / 2, 2 + Math.random() * 3, gap); }
  });
}
const wallTileTex = tileTexture([226, 230, 232], '#8f979d', 7);
const floorTileTex = tileTexture([186, 192, 196], '#767d83', 9);

const wallMat = new THREE.MeshStandardMaterial({ map: wallTileTex, bumpMap: wallTileTex, bumpScale: 0.22, roughness: 0.28, metalness: 0.04 });
const floorMat = new THREE.MeshStandardMaterial({ map: floorTileTex, bumpMap: floorTileTex, bumpScale: 0.18, roughness: 0.14, metalness: 0.06 });

function addPlane(w, h, mat, x, y, z, rx, ry) {
  const geo = new THREE.PlaneGeometry(w, h); scaleUV(geo, w / (TILE * 2), h / (TILE * 2));
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; scene.add(m); return m;
}
addPlane(ROOM, ROOM, floorMat, 0, 0, 0, -Math.PI / 2, 0);                         // floor
addPlane(ROOM, ROOM, wallMat, 0, ROOM_H, 0, Math.PI / 2, 0);                       // ceiling
addPlane(ROOM, ROOM_H, wallMat, 0, ROOM_H / 2, -ARENA, 0, 0);                     // walls (all face inward)
addPlane(ROOM, ROOM_H, wallMat, 0, ROOM_H / 2, ARENA, 0, Math.PI);
addPlane(ROOM, ROOM_H, wallMat, -ARENA, ROOM_H / 2, 0, 0, Math.PI / 2);
addPlane(ROOM, ROOM_H, wallMat, ARENA, ROOM_H / 2, 0, 0, -Math.PI / 2);

// skirting + ceiling light panels
(function trim() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x59616a, roughness: 0.5, metalness: 0.2 });
  const s = ROOM, b = 0.18;
  [[0, -ARENA + 0.02, s, 0], [0, ARENA - 0.02, s, 0], [-ARENA + 0.02, 0, s, 1], [ARENA - 0.02, 0, s, 1]].forEach(([x, z, len, rot]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.04 : len, b, rot ? len : 0.04), dark); m.position.set(x, b / 2, z); scene.add(m);
  });
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), frameMat = new THREE.MeshBasicMaterial({ color: 0x9aa2a8 });
  [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([x, z]) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.3), frameMat); f.rotation.x = Math.PI / 2; f.position.set(x, ROOM_H - 0.01, z); scene.add(f);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), panelMat); p.rotation.x = Math.PI / 2; p.position.set(x, ROOM_H - 0.02, z); scene.add(p);
  });
})();

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0xf2f5fa, 0x7a838e, 0.34);
scene.add(hemi);
const keyLight = new THREE.SpotLight(0xfff2e2, 1.45, 70, 1.0, 0.55, 1);
keyLight.position.set(0, ROOM_H - 0.6, 0); keyLight.target.position.set(0, 0, 0);
keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 3; keyLight.shadow.camera.far = ROOM_H + 4;
keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.04;
scene.add(keyLight); scene.add(keyLight.target);
const fillLights = [];
[[-5.5, 3.2, -5.5], [5.5, 3.2, -5.5], [-5.5, 3.2, 5.5], [5.5, 3.2, 5.5]].forEach(([x, y, z]) => {
  const l = new THREE.PointLight(0xfff0e0, 0.3, 18, 1.4); l.position.set(x, y, z); scene.add(l); fillLights.push(l);
});

/* ---------------- spawn pads ---------------- */
const SPAWN_PADS = [[-3.5, 1.5], [0, 1.5], [3.5, 1.5], [-5, -2.5], [-1.7, -2.5], [1.7, -2.5], [5, -2.5], [0, -5.8]].map(([x, z], i) => ({ i, x, z, human: null }));
(function buildPads() {
  SPAWN_PADS.forEach(p => {
    const g = new THREE.Group(); g.position.set(p.x, 0.014, p.z);
    p.ringMat = new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.85, depthWrite: false });
    p.discMat = new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.07, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.82, 48), p.ringMat); ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), p.discMat); disc.rotation.x = -Math.PI / 2;
    const numTex = canvasTex(128, (c, s) => { c.clearRect(0, 0, s, s); c.fillStyle = '#fff'; c.font = '800 78px Orbitron, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.i + 1), s / 2, s / 2 + 4); }, false);
    numTex.wrapS = numTex.wrapT = THREE.ClampToEdgeWrapping;
    p.numMat = new THREE.MeshBasicMaterial({ map: numTex, color: 0x19f0ff, transparent: true, opacity: 0.8, depthWrite: false });
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), p.numMat); num.rotation.x = -Math.PI / 2; num.position.set(0, 0.002, 0.0);
    g.add(ring, disc, num); scene.add(g); p.group = g;
  });
})();
function setPadState(p, st) {            // free | aim | busy
  const c = st === 'busy' ? 0xff3b4e : st === 'aim' ? 0xffc531 : 0x19f0ff;
  p.ringMat.color.setHex(c); p.discMat.color.setHex(c); p.numMat.color.setHex(c);
  p.ringMat.opacity = st === 'aim' ? 1 : 0.85; p.discMat.opacity = st === 'aim' ? 0.2 : 0.07;
}

/* ---------------- collision boxes (room shell only) ---------------- */
const boxes = [];
(function shell() {
  const t = 1, H = ROOM_H, A = ARENA;
  boxes.push({ minX: -A - t, maxX: -A, minZ: -A - t, maxZ: A + t, minY: -t, maxY: H + t });
  boxes.push({ minX: A, maxX: A + t, minZ: -A - t, maxZ: A + t, minY: -t, maxY: H + t });
  boxes.push({ minX: -A, maxX: A, minZ: -A - t, maxZ: -A, minY: -t, maxY: H + t });
  boxes.push({ minX: -A, maxX: A, minZ: A, maxZ: A + t, minY: -t, maxY: H + t });
  boxes.push({ minX: -A - t, maxX: A + t, minZ: -A - t, maxZ: A + t, minY: H, maxY: H + t });     // ceiling
})();

/* ---------------- collision helpers ---------------- */
// push a circle (x,z,r) out of every box that is in its way (ceiling is ignored via minY)
function resolveCircle(p, r, feetY, stepH) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.maxY <= feetY + stepH || b.minY > feetY + 2) continue;
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else {
      const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z, m = Math.min(l, rr, t, bt);
      if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
    }
  }
  const lim = ARENA - r;
  p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
}
function groundAt() { return 0; }
function boxAt(x, y, z) {
  if (y < 0 || y > ROOM_H || x < -ARENA || x > ARENA || z < -ARENA || z > ARENA) return boxes[0];
  return null;
}

// nearest ray hit against the room shell (floor included). Returns distance (maxT if nothing); fills rayN with the surface normal.
const rayN = { x: 0, y: 1, z: 0 };
function rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT, nx = 0, ny = 0, nz = 0;
  if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; } }
  if (dy > 1e-6) { const t = (ROOM_H - oy) / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = -1; nz = 0; } }
  if (dx > 1e-6) { const t = (ARENA - ox) / dx; if (t > 0 && t < best) { best = t; nx = -1; ny = 0; nz = 0; } }
  if (dx < -1e-6) { const t = (-ARENA - ox) / dx; if (t > 0 && t < best) { best = t; nx = 1; ny = 0; nz = 0; } }
  if (dz > 1e-6) { const t = (ARENA - oz) / dz; if (t > 0 && t < best) { best = t; nx = 0; ny = 0; nz = -1; } }
  if (dz < -1e-6) { const t = (-ARENA - oz) / dz; if (t > 0 && t < best) { best = t; nx = 0; ny = 0; nz = 1; } }
  rayN.x = nx; rayN.y = ny; rayN.z = nz;
  return best;
}
// floor point under a ray (or null)
function rayFloor(ox, oy, oz, dx, dy, dz) {
  if (dy > -1e-4) return null;
  const t = -oy / dy; if (t < 0 || t > 60) return null;
  const x = ox + dx * t, z = oz + dz * t;
  return Math.abs(x) < ARENA && Math.abs(z) < ARENA ? { x, z } : null;
}
