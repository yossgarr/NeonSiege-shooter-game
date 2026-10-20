'use strict';
/* =========================================================
   FX — particles, tracers, bullet holes, glow sprites
   ========================================================= */
const glowTex = canvasTex(64, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}, false);
glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;

function makeGlow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1);
  return s;
}

/* ---------------- particles (one InstancedMesh) ---------------- */
const PMAX = 700;
const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), PMAX);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pMesh.frustumCulled = false;
const _pc = new THREE.Color();
for (let i = 0; i < PMAX; i++) pMesh.setColorAt(i, _pc.set(0xffffff));
scene.add(pMesh);
const parts = [];
for (let i = 0; i < PMAX; i++) parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, grav: 0, dead: true });
let pHead = 0;
const _dummy = new THREE.Object3D();
const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);

// opts: color, speed, life, size, grav, dir{x,y,z}, cone(0..1: how random the direction is), hdr (brightness multiplier)
function emit(x, y, z, n, o) {
  const speed = o.speed || 4, life = o.life || 0.5, size = o.size || 0.06, grav = o.grav === undefined ? 12 : o.grav;
  const cone = o.cone === undefined ? 1 : o.cone, hdr = o.hdr || 1;
  for (let k = 0; k < n; k++) {
    const idx = pHead, p = parts[idx]; pHead = (pHead + 1) % PMAX;
    let rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    let vx = rx, vy = ry, vz = rz;
    if (o.dir) { vx = o.dir.x + rx * cone; vy = o.dir.y + ry * cone; vz = o.dir.z + rz * cone; const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l; }
    const sp = speed * rand(0.3, 1);
    p.x = x; p.y = y; p.z = z; p.vx = vx * sp; p.vy = vy * sp; p.vz = vz * sp;
    p.life = p.max = life * rand(0.6, 1); p.size = size * rand(0.6, 1.4); p.grav = grav; p.dead = false;
    const c = Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color;
    _pc.set(c === undefined ? 0xffffff : c).multiplyScalar(hdr);
    pMesh.setColorAt(idx, _pc);
  }
  pMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.dead) continue;
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; pMesh.setMatrixAt(i, zeroM); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    const s = p.size * Math.min(1, (p.life / p.max) * 2.2);
    _dummy.position.set(p.x, p.y, p.z); _dummy.scale.set(s, s, s); _dummy.rotation.set(p.x * 3, p.y * 3, p.z * 3);
    _dummy.updateMatrix(); pMesh.setMatrixAt(i, _dummy.matrix);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}
for (let i = 0; i < PMAX; i++) pMesh.setMatrixAt(i, zeroM);

/* ---------------- tracers ---------------- */
const tracers = [];
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.visible = false; m.userData = { life: 0, max: 1, w: 0.02 }; scene.add(m); tracers.push(m);
}
let trHead = 0;
function addTracer(ax, ay, az, bx, by, bz, color, width, life) {
  const m = tracers[trHead]; trHead = (trHead + 1) % tracers.length;
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  if (len < 0.3) return;
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.lookAt(bx, by, bz);
  m.scale.set(width, width, len);
  m.material.color.set(color); m.material.opacity = 1;
  m.userData.life = m.userData.max = life; m.userData.w = width; m.visible = true;
}
function updateTracers(dt) {
  for (const m of tracers) {
    if (!m.visible) continue;
    const u = m.userData; u.life -= dt;
    if (u.life <= 0) { m.visible = false; continue; }
    const k = u.life / u.max; m.material.opacity = k; m.scale.x = m.scale.y = u.w * (0.4 + k * 0.6);
  }
}

/* ---------------- bullet holes ---------------- */
const holeTex = canvasTex(64, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.35, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(255,170,60,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}, false);
holeTex.wrapS = holeTex.wrapT = THREE.ClampToEdgeWrapping;
const holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const holeGeo = new THREE.PlaneGeometry(1, 1);
const holes = []; let holeHead = 0;
for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(holeGeo, holeMat); m.visible = false; scene.add(m); holes.push(m); }
function addHole(x, y, z, nx, ny, nz, size) {
  const m = holes[holeHead]; holeHead = (holeHead + 1) % holes.length;
  m.position.set(x + nx * 0.015, y + ny * 0.015, z + nz * 0.015);
  m.lookAt(x + nx, y + ny, z + nz); m.rotateZ(Math.random() * TAU);
  m.scale.set(size, size, 1); m.visible = true;
}
function clearHoles() { holes.forEach(h => h.visible = false); }

/* ---------------- glow flashes (expanding sprites) ---------------- */
const flashes = [];
for (let i = 0; i < 24; i++) { const s = makeGlow(0xffffff, 1); s.visible = false; s.userData = { life: 0, max: 1, size: 1, grow: 0 }; scene.add(s); flashes.push(s); }
let flHead = 0;
function addFlash(x, y, z, color, size, life, grow) {
  const s = flashes[flHead]; flHead = (flHead + 1) % flashes.length;
  s.position.set(x, y, z); s.material.color.set(color); s.material.opacity = 1;
  Object.assign(s.userData, { life, max: life, size, grow: grow || 0 }); s.scale.set(size, size, 1); s.visible = true;
}
function updateFlashes(dt) {
  for (const s of flashes) {
    if (!s.visible) continue;
    const u = s.userData; u.life -= dt;
    if (u.life <= 0) { s.visible = false; continue; }
    const k = u.life / u.max, sz = u.size * (1 + u.grow * (1 - k));
    s.scale.set(sz, sz, 1); s.material.opacity = k;
  }
}

/* ---------------- reusable effect recipes ---------------- */
const SPARK = [0xffd27a, 0xffa23a, 0xfff2c8];
function wallImpact(x, y, z, nx, ny, nz, big) {
  emit(x, y, z, big ? 10 : 6, { color: SPARK, speed: 5, life: 0.35, size: 0.045, grav: 14, dir: { x: nx, y: ny, z: nz }, cone: 0.9, hdr: 2 });
  emit(x, y, z, 3, { color: 0x6b7385, speed: 2, life: 0.5, size: 0.07, grav: 8, dir: { x: nx, y: ny, z: nz }, cone: 1.2 });
  addFlash(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, 0xffc060, 0.35, 0.08, 0.5);
  addHole(x, y, z, nx, ny, nz, big ? 0.3 : 0.2);
}
function robotHit(x, y, z, dirx, diry, dirz, head, color) {
  emit(x, y, z, head ? 16 : 10, { color: [0xffd27a, 0xffffff, color], speed: 6, life: 0.4, size: 0.05, grav: 10, dir: { x: -dirx, y: -diry, z: -dirz }, cone: 0.9, hdr: 2 });
  addFlash(x, y, z, head ? 0xff5060 : 0xffd27a, head ? 0.8 : 0.5, 0.1, 0.8);
}
function deathBlast(x, y, z, color, scale) {
  emit(x, y, z, 40, { color: [color, 0xffd27a, 0xffffff, 0x333a48], speed: 9 * scale, life: 0.9, size: 0.12 * scale, grav: 12, hdr: 1.6 });
  emit(x, y, z, 14, { color: 0xffe0a0, speed: 5, life: 0.5, size: 0.2 * scale, grav: -1, hdr: 2 });
  addFlash(x, y, z, color, 2.4 * scale, 0.35, 1.2);
  addFlash(x, y, z, 0xffffff, 1.0 * scale, 0.12, 0.6);
}
