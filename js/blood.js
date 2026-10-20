'use strict';
/* =========================================================
   BLOOD — droplets, mist, wall/floor splatter decals, pools,
   bleeding wounds, blood on clothes, blood on the screen
   ========================================================= */
const BL = { drops: [], mist: [], emitters: [], pools: [], patches: [], growing: [] };
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion(), _bv = new THREE.Vector3(), _bv2 = new THREE.Vector3(), _bm = new THREE.Matrix4(), _bs = new THREE.Vector3(), _bc = new THREE.Color();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);

/* ---------------- textures ---------------- */
function drawSplat(kind) {
  return canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const c = s / 2, R = Math.random;
    g.shadowColor = 'rgba(50,0,0,.9)'; g.shadowBlur = 5;
    const col = a => `rgba(${78 + R() * 34 | 0},${3 + R() * 6 | 0},${5 + R() * 6 | 0},${a})`;
    const circle = (x, y, r, a = 0.96) => { g.fillStyle = col(a); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    const streak = (ang, len, w) => {
      const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx, bx = c + dx * 6, by = c + dy * 6;
      g.fillStyle = col(0.95); g.beginPath(); g.moveTo(bx + px * w, by + py * w);
      g.quadraticCurveTo(bx + dx * len * 0.55 + px * w * 0.7, by + dy * len * 0.55 + py * w * 0.7, bx + dx * len, by + dy * len);
      g.quadraticCurveTo(bx + dx * len * 0.55 - px * w * 0.7, by + dy * len * 0.55 - py * w * 0.7, bx - px * w, by - py * w); g.fill();
      circle(bx + dx * (len + 5), by + dy * (len + 5), Math.max(1.5, w * 0.55));
    };
    if (kind === 0) {                                  // spray: radial tapered streaks
      for (let i = 0; i < 60; i++) streak(R() * TAU, (0.15 + R() * 0.8) * c * (R() < 0.3 ? 1 : 0.55), 1.5 + R() * 5);
      for (let i = 0; i < 12; i++) circle(c + (R() - 0.5) * 40, c + (R() - 0.5) * 40, 6 + R() * 12);
      for (let i = 0; i < 18; i++) { const a = R() * TAU, d = (0.3 + R() * 0.65) * c; circle(c + Math.cos(a) * d, c + Math.sin(a) * d, 1 + R() * 3.5); }
    } else if (kind === 1) {                           // round blob + satellites
      for (let i = 0; i < 16; i++) { const a = R() * TAU, d = R() * c * 0.28; circle(c + Math.cos(a) * d, c + Math.sin(a) * d, c * (0.12 + R() * 0.2)); }
      for (let i = 0; i < 22; i++) { const a = R() * TAU, d = (0.4 + R() * 0.55) * c; circle(c + Math.cos(a) * d, c + Math.sin(a) * d, 1 + R() * 5); }
      for (let i = 0; i < 8; i++) streak(R() * TAU, (0.3 + R() * 0.4) * c, 1 + R() * 2.5);
    } else if (kind === 2) {                           // drips running down (texture +Y is up, so streaks go to the bottom)
      circle(c, c * 0.45, c * 0.22); circle(c - 20, c * 0.5, c * 0.14); circle(c + 24, c * 0.46, c * 0.15);
      for (let i = 0; i < 7; i++) {
        const x = c + (R() - 0.5) * 90, len = (0.25 + R() * 0.6) * s * 0.7, w = 2.5 + R() * 4;
        g.fillStyle = col(0.95); g.fillRect(x - w / 2, c * 0.5, w, len); circle(x, c * 0.5 + len, w * 0.95);
      }
      for (let i = 0; i < 16; i++) circle(c + (R() - 0.5) * 200, c * 0.3 + R() * 150, 1 + R() * 3);
    } else {                                           // small droplets
      for (let i = 0; i < 14; i++) circle(c + (R() - 0.5) * 170, c + (R() - 0.5) * 170, 2 + R() * 9);
      for (let i = 0; i < 4; i++) streak(R() * TAU, 20 + R() * 40, 1.5 + R() * 2);
    }
  }, true);
}
const poolTex = canvasTex(256, (g, s) => {
  const c = s / 2, N = 56, pts = []; let ph = Math.random() * 6;
  for (let i = 0; i < N; i++) { const a = i / N * TAU; pts.push([a, 0.74 + 0.1 * Math.sin(a * 3 + ph) + 0.06 * Math.sin(a * 5 + ph * 2) + 0.04 * Math.random()]); }
  g.shadowColor = 'rgba(40,0,0,.9)'; g.shadowBlur = 8;
  const gr = g.createRadialGradient(c, c, 4, c, c, c * 0.8); gr.addColorStop(0, 'rgba(45,0,2,.98)'); gr.addColorStop(0.7, 'rgba(80,3,5,.95)'); gr.addColorStop(1, 'rgba(105,6,8,.9)');
  g.fillStyle = gr; g.beginPath();
  pts.forEach(([a, r], i) => { const x = c + Math.cos(a) * r * c, y = c + Math.sin(a) * r * c; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, d = (0.78 + Math.random() * 0.18) * c; g.fillStyle = 'rgba(100,5,7,.9)'; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 2 + Math.random() * 4, 0, TAU); g.fill(); }
}, true);
[poolTex].forEach(t => t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping);

/* ---------------- decals (4 instanced meshes, one per splat texture) ---------------- */
const DECAL_CAP = 150, decalSets = [];
const decalGeo = new THREE.PlaneGeometry(1, 1);
for (let k = 0; k < 4; k++) {
  const tex = drawSplat(k); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, roughness: 0.1, metalness: 0.0 });
  const mesh = new THREE.InstancedMesh(decalGeo, mat, DECAL_CAP); mesh.frustumCulled = false; mesh.receiveShadow = true;
  for (let i = 0; i < DECAL_CAP; i++) { mesh.setMatrixAt(i, zeroMat); mesh.setColorAt(i, _bc.setRGB(1, 1, 1)); }
  scene.add(mesh); decalSets.push({ mesh, head: 0, data: new Array(DECAL_CAP).fill(null) });
}
function decalMatrix(d, k) {
  const sz = d.size * k;
  _bs.set(sz, sz * d.aspect, 1); return _bm.compose(d.pos, d.q, _bs);
}
function addSplat(x, y, z, nx, ny, nz, size, kind, aspect = 1, angle = null) {
  const ds = decalSets[kind], i = ds.head; ds.head = (ds.head + 1) % DECAL_CAP;
  _bv2.set(nx, ny, nz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, _bv2);
  q.multiply(_bq2.setFromAxisAngle(Z_AXIS, angle === null ? Math.random() * TAU : angle));
  const d = { pos: new THREE.Vector3(x + _bv2.x * 0.004, y + _bv2.y * 0.004, z + _bv2.z * 0.004), q, size, aspect, t: 0 };
  ds.data[i] = d;
  ds.mesh.setMatrixAt(i, decalMatrix(d, 0.3)); ds.mesh.setColorAt(i, _bc.setRGB(0.75 + Math.random() * 0.5, 0.8 + Math.random() * 0.3, 0.8 + Math.random() * 0.3));
  ds.mesh.instanceMatrix.needsUpdate = true; ds.mesh.instanceColor.needsUpdate = true;
  if (BL.growing.length < 60) BL.growing.push({ ds, i, d });
}

/* ---------------- droplets ---------------- */
const DROP_MAX = 700;
const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0x6a0507, roughness: 0.08, metalness: 0.0, emissive: 0x0c0000 }), DROP_MAX);
dropMesh.frustumCulled = false; dropMesh.castShadow = false;
for (let i = 0; i < DROP_MAX; i++) dropMesh.setMatrixAt(i, zeroMat);
scene.add(dropMesh);
const drops = []; for (let i = 0; i < DROP_MAX; i++) drops.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.01, life: 0 });
let dropHead = 0, dropAlive = 0;
function addDrop(x, y, z, vx, vy, vz, r) {
  const d = drops[dropHead]; dropHead = (dropHead + 1) % DROP_MAX;
  d.alive = true; d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.r = r; d.life = 4;
}
// n droplets sprayed along dir with a cone spread (dir optional = random sphere)
function sprayDrops(x, y, z, n, dir, speed, cone, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    let rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    let vx = rx, vy = ry, vz = rz;
    if (dir) { vx = dir.x + rx * cone; vy = dir.y + ry * cone; vz = dir.z + rz * cone; const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l; }
    const sp = speed * (0.25 + Math.random() * 0.75);
    addDrop(x, y, z, vx * sp, vy * sp, vz * sp, rMin + Math.random() * Math.random() * (rMax - rMin));
  }
}
function updateDrops(dt) {
  const G = 9.8; let alive = 0;
  for (let i = 0; i < DROP_MAX; i++) {
    const d = drops[i];
    if (!d.alive) continue;
    d.life -= dt; d.vy -= G * dt; const drag = Math.exp(-0.35 * dt); d.vx *= drag; d.vz *= drag;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    let hit = false, nx = 0, ny = 0, nz = 0;
    if (d.y <= 0.002) { hit = true; ny = 1; d.y = 0.002; }
    else if (d.x < -ARENA) { hit = true; nx = 1; d.x = -ARENA; }
    else if (d.x > ARENA) { hit = true; nx = -1; d.x = ARENA; }
    else if (d.z < -ARENA) { hit = true; nz = 1; d.z = -ARENA; }
    else if (d.z > ARENA) { hit = true; nz = -1; d.z = ARENA; }
    else if (d.y > ROOM_H) { hit = true; ny = -1; d.y = ROOM_H; }
    if (hit || d.life <= 0) {
      if (hit) {
        const sp = Math.hypot(d.vx, d.vy, d.vz), size = d.r * (9 + Math.min(sp, 9) * 1.3) * (0.7 + Math.random() * 0.6);
        if (ny === 1) addSplat(d.x, d.y, d.z, 0, 1, 0, size, sp > 4 ? 3 : 1, sp > 4 ? 1 : 1);
        else addSplat(d.x, d.y, d.z, nx, ny, nz, size * 1.1, sp > 3 ? 0 : 2, 1, nx || nz ? Math.PI * 0 : null);
      }
      d.alive = false; dropMesh.setMatrixAt(i, zeroMat); continue;
    }
    alive++;
    const sp = Math.hypot(d.vx, d.vy, d.vz), len = d.r * (1 + Math.min(sp * 0.45, 5));
    if (sp > 0.05) { _bv.set(d.vx / sp, d.vy / sp, d.vz / sp); _bq.setFromUnitVectors(Z_AXIS, _bv); } else _bq.identity();
    _bs.set(d.r, d.r, len); _bv2.set(d.x, d.y, d.z); dropMesh.setMatrixAt(i, _bm.compose(_bv2, _bq, _bs));
  }
  dropAlive = alive; dropMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- mist sprites ---------------- */
const mistPool = [];
for (let i = 0; i < 40; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6a0608, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  s.visible = false; scene.add(s); mistPool.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
}
let mistHead = 0;
function addMist(x, y, z, vx, vy, vz, size, life, op = 0.5) {
  const m = mistPool[mistHead]; mistHead = (mistHead + 1) % mistPool.length;
  m.s.position.set(x, y, z); m.vx = vx; m.vy = vy; m.vz = vz; m.size = size; m.life = m.max = life; m.op = op; m.s.visible = true;
}
function updateMist(dt) {
  for (const m of mistPool) {
    if (!m.s.visible) continue;
    m.life -= dt; if (m.life <= 0) { m.s.visible = false; continue; }
    const k = 1 - m.life / m.max, f = Math.exp(-3 * dt);
    m.vx *= f; m.vy *= f; m.vz *= f; m.s.position.x += m.vx * dt; m.s.position.y += m.vy * dt - 0.1 * dt; m.s.position.z += m.vz * dt;
    const sz = m.size * (0.4 + k * 1.1); m.s.scale.set(sz, sz, 1); m.s.material.opacity = m.op * (1 - k) * Math.min(1, k * 8 + 0.3);
  }
}

/* ---------------- pools ---------------- */
const poolMat = new THREE.MeshStandardMaterial({ map: poolTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, roughness: 0.05, metalness: 0.0, emissive: 0x060000 });
const poolGeo = new THREE.PlaneGeometry(1, 1);
function startPool(h, seg, rMax) {
  if (h.pools >= 2) return;
  h.pools = (h.pools || 0) + 1;
  const mesh = new THREE.Mesh(poolGeo, poolMat); mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.random() * TAU; mesh.receiveShadow = true; mesh.visible = false;
  scene.add(mesh); BL.pools.push({ h, seg, mesh, r: 0.05, rMax, t: 0, x: 0, z: 0, fixed: false, age: 0 });
}
function updatePools(dt) {
  for (let i = BL.pools.length - 1; i >= 0; i--) {
    const p = BL.pools[i];
    if (p.h.removed) { scene.remove(p.mesh); BL.pools.splice(i, 1); continue; }
    if (p.h.state !== 'ragdoll') continue;
    p.age += dt;
    if (!p.fixed) { const g = p.seg.group.position; p.x = g.x; p.z = g.z; if (p.h.asleep && p.age > 1) p.fixed = true; }
    if (p.age > 0.4) { p.r += (p.rMax - p.r) * (1 - Math.exp(-dt / 5.5)); p.mesh.visible = true; }
    p.mesh.position.set(p.x, 0.012 + (i % 5) * 0.0006, p.z); p.mesh.scale.set(p.r * 2, p.r * 2, 1);
  }
}

/* ---------------- bleeding wounds + blood on clothes ---------------- */
const patchGeo = new THREE.PlaneGeometry(1, 1);
const patchMats = [0, 1].map(k => { const t = drawSplat(k); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.2, emissive: 0x120000 }); });
function addWound(h, hit, dir, strength) {
  const seg = hit.seg, lp = seg.group.worldToLocal(new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z));
  const ld = new THREE.Vector3(dir.x, dir.y, dir.z).transformDirection(_bm.copy(seg.group.matrixWorld).invert());
  const w = { h, seg, lp, ld, str: strength, t: Math.random() * 6 };
  h.wounds.push(w); if (h.wounds.length > 6) h.wounds.shift();
  BL.emitters.push(w);
  // dark patch soaking into the clothes / skin
  const n = ld.clone().negate();
  const m = new THREE.Mesh(patchGeo, patchMats[Math.random() < 0.5 ? 0 : 1]);
  m.position.copy(lp).addScaledVector(n, 0.012 + Math.random() * 0.004);
  m.quaternion.setFromUnitVectors(Z_AXIS, n); m.rotateZ(Math.random() * TAU);
  const base = (hit.zone === 'head' ? 0.09 : 0.07) * (0.8 + Math.random() * 0.5); m.scale.set(base, base, 1);
  seg.group.add(m); BL.patches.push({ m, h, base, t: 0 });
}
function updateEmitters(dt) {
  for (let i = BL.emitters.length - 1; i >= 0; i--) {
    const w = BL.emitters[i], h = w.h;
    if (h.removed) { BL.emitters.splice(i, 1); continue; }
    w.str *= Math.exp(-dt / (h.state === 'ragdoll' ? 7 : 11)); w.t += dt;
    if (w.str < 0.05) { BL.emitters.splice(i, 1); continue; }
    if (dropAlive > DROP_MAX - 60) continue;
    w.seg.group.localToWorld(_bv.copy(w.lp));
    const pulse = Math.max(0, Math.sin(w.t * 7.2)), spurt = pulse > 0.85 && w.str > 0.4;
    // steady drip / ooze
    if (Math.random() < w.str * 26 * dt) addDrop(_bv.x + rand(-0.01, 0.01), _bv.y, _bv.z + rand(-0.01, 0.01), rand(-0.15, 0.15), rand(-0.1, 0.2), rand(-0.15, 0.15), 0.006 + Math.random() * 0.01);
    if (spurt && Math.random() < 0.5) {                      // arterial spurt along the wound direction
      _bv2.copy(w.ld).transformDirection(w.seg.group.matrixWorld);
      sprayDrops(_bv.x, _bv.y, _bv.z, Math.ceil(3 + w.str * 3), { x: _bv2.x, y: _bv2.y + 0.25, z: _bv2.z }, 1.2 + w.str * 2.2, 0.45, 0.005, 0.013);
    }
  }
  for (let i = BL.patches.length - 1; i >= 0; i--) {
    const p = BL.patches[i];
    if (p.h.removed) { BL.patches.splice(i, 1); continue; }
    p.t += dt; const g = p.base * (1 + Math.min(p.t * 0.12, 1.4)); p.m.scale.set(g, g, 1);
  }
}

/* ---------------- main entry: a bullet hit a person ---------------- */
function bloodHit(h, hit, dir, wp) {
  const P = hit.point, head = hit.zone === 'head', pow = (wp === 'ak47' ? 1.3 : 1.0) * (head ? 1.6 : 1.0);
  const ry = h.state === 'ragdoll' ? 0.75 : 1;
  // entry puff (comes back toward the shooter)
  sprayDrops(P.x, P.y, P.z, Math.round(5 * pow), { x: -dir.x, y: -dir.y + 0.2, z: -dir.z }, 2.4, 0.9, 0.005, 0.012);
  addMist(P.x, P.y, P.z, -dir.x * 0.5, 0.1, -dir.z * 0.5, 0.35, 0.5, 0.35);
  // exit spray
  const exitChance = head ? 1 : wp === 'ak47' ? 0.85 : 0.5;
  if (Math.random() < exitChance && hit.zone !== 'foot') {
    const ex = P.x + dir.x * 0.14, ey = P.y + dir.y * 0.14, ez = P.z + dir.z * 0.14;
    const n = Math.round((head ? 60 : 22) * pow * ry);
    sprayDrops(ex, ey, ez, n, dir, head ? 9 : 6, head ? 0.65 : 0.4, 0.005, head ? 0.02 : 0.015);
    addMist(ex, ey, ez, dir.x * 1.4, dir.y * 1.4 + 0.2, dir.z * 1.4, head ? 1.1 : 0.7, head ? 0.9 : 0.65, head ? 0.6 : 0.45);
    if (head) { for (let i = 0; i < 3; i++) addMist(ex + rand(-0.1, 0.1), ey + rand(-0.1, 0.1), ez + rand(-0.1, 0.1), dir.x * rand(0.5, 2), rand(0, 1), dir.z * rand(0.5, 2), rand(0.7, 1.4), rand(0.7, 1.2), 0.5); }
    // instant splatter on whatever the spray reaches
    const rays = head ? 14 : 4;
    for (let i = 0; i < rays; i++) {
      let rx = dir.x + rand(-0.38, 0.38), ry2 = dir.y + rand(-0.3, 0.25) - (head ? 0.1 : 0), rz = dir.z + rand(-0.38, 0.38); const l = Math.hypot(rx, ry2, rz); rx /= l; ry2 /= l; rz /= l;
      const t = rayWorld(ex, ey, ez, rx, ry2, rz, 12);
      if (t < 12) {
        const hx = ex + rx * t, hy = ey + ry2 * t, hz = ez + rz * t, big = rand(0.25, 0.75) * (head ? 1.25 : 0.85);
        const kd = rayN.y === 1 ? (Math.random() < 0.5 ? 1 : 3) : (Math.random() < 0.55 ? 0 : 2);
        addSplat(hx, hy, hz, rayN.x, rayN.y, rayN.z, big, kd, 1, kd === 2 && rayN.y === 0 ? 0 : null);
      }
    }
  }
  if (head) {                                                  // skull fragments and tissue
    emit(P.x + dir.x * 0.1, P.y + dir.y * 0.1, P.z + dir.z * 0.1, 18, { color: [0xe6d6c8, 0xcdb4a4, 0x8a1618, 0x6a0507, 0xb58a86], speed: 6, life: 1.4, size: 0.045, grav: 12, dir: { x: dir.x, y: dir.y + 0.2, z: dir.z }, cone: 0.9 });
  }
  // spatter thrown onto the floor around the victim
  { const nf = head ? 7 : 4, ox = P.x, oy = P.y, oz = P.z;
    for (let i = 0; i < nf; i++) {
      const a = Math.random() * TAU, sp = rand(0.25, 1.1);
      let rx = dir.x * 0.6 + Math.cos(a) * sp, ry3 = -rand(0.5, 1.3), rz = dir.z * 0.6 + Math.sin(a) * sp; const l = Math.hypot(rx, ry3, rz); rx /= l; ry3 /= l; rz /= l;
      const t = rayWorld(ox, oy, oz, rx, ry3, rz, 6);
      if (t < 6 && rayN.y === 1) addSplat(ox + rx * t, 0.003, oz + rz * t, 0, 1, 0, rand(0.15, 0.5) * (head ? 1.3 : 1), Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : 3));
    } }
  // floor splash under the victim
  if (h.state !== 'ragdoll') { const fp = h.root.position; addSplat(fp.x + rand(-0.4, 0.4), 0.003, fp.z + rand(-0.4, 0.4), 0, 1, 0, rand(0.2, 0.45), 3); }
  // wound that keeps bleeding
  addWound(h, hit, dir, head ? 2.4 : hit.zone === 'torso' ? 1.5 : 1.0);
  // player is close: blood on the lens
  if (typeof player !== 'undefined') { const d = Math.hypot(P.x - camera.position.x, P.y - camera.position.y, P.z - camera.position.z); if (d < (head ? 3.4 : 1.8)) screenBlood(head ? 1 : 0.3, d); }
}
function onBodyAtRest(h) { /* reserved */ }
function removeBloodFor(h) {
  for (let i = BL.pools.length - 1; i >= 0; i--) if (BL.pools[i].h === h) { scene.remove(BL.pools[i].mesh); BL.pools.splice(i, 1); }
  for (let i = BL.emitters.length - 1; i >= 0; i--) if (BL.emitters[i].h === h) BL.emitters.splice(i, 1);
  for (let i = BL.patches.length - 1; i >= 0; i--) if (BL.patches[i].h === h) { BL.patches[i].m.parent && BL.patches[i].m.parent.remove(BL.patches[i].m); BL.patches.splice(i, 1); }
}
// called when someone dies: the pool starts spreading under the body
function startDeathBleeding(h, hit) {
  const head = hit && hit.zone === 'head';
  startPool(h, head ? h.seg.head : h.seg.torso, head ? 1.15 : 0.95 + Math.min(1, h.wounds.length * 0.1) * 0.3);
  if (!head && h.wounds.length > 2) startPool(h, h.seg.pelvis, 0.7);
  for (const w of h.wounds) w.str = Math.max(w.str, 1.2);
}

/* ---------------- blood on the screen ---------------- */
let screenEl = null, screenCtx = null, screenT = 0, screenY = 0;
function screenBlood(amount, dist) {
  if (!screenEl) { screenEl = document.getElementById('bloodScreen'); if (!screenEl) return; screenCtx = screenEl.getContext('2d'); }
  if (screenEl.width !== window.innerWidth) { screenEl.width = window.innerWidth; screenEl.height = window.innerHeight; }
  const g = screenCtx, W = screenEl.width, Ht = screenEl.height, n = amount > 0.6 ? 6 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
  if (screenT <= 0) { g.clearRect(0, 0, W, Ht); screenY = 0; }
  const near = 1 / (1 + (dist || 3) * 0.25);
  for (let i = 0; i < n; i++) {                                   // real splat textures, scattered and rotated
    const img = decalSets[(Math.random() * 4) | 0].mesh.material.map.image;
    const size = (70 + Math.random() * 190) * (0.45 + amount * 0.6) * (0.6 + near);
    const x = W * (0.1 + Math.random() * 0.8), y = Ht * (0.08 + Math.random() * 0.72);
    g.save(); g.translate(x, y); g.rotate(Math.random() * TAU); g.globalAlpha = 0.78 + Math.random() * 0.2;
    g.drawImage(img, -size / 2, -size / 2, size, size); g.restore();
  }
  screenT = 3.0 + amount * 2.5; screenEl.style.opacity = 1; screenEl.style.transform = 'translateY(0)';
}
function updateScreenBlood(dt) {
  if (!screenEl || screenT <= 0) return;
  screenT -= dt; screenY += dt * 14;
  screenEl.style.opacity = clamp(screenT / 1.6, 0, 1); screenEl.style.transform = `translateY(${screenY}px)`;
}

/* ---------------- frame update / reset ---------------- */
function bloodUpdate(dt) {
  updateDrops(dt); updateMist(dt); updateEmitters(dt); updatePools(dt); updateScreenBlood(dt);
  for (let i = BL.growing.length - 1; i >= 0; i--) {                       // decals spread out when they land
    const g = BL.growing[i]; g.d.t += dt;
    const k = 0.3 + 0.7 * smooth(clamp(g.d.t / 0.22, 0, 1));
    g.ds.mesh.setMatrixAt(g.i, decalMatrix(g.d, k)); g.ds.mesh.instanceMatrix.needsUpdate = true;
    if (g.d.t >= 0.22) BL.growing.splice(i, 1);
  }
}
function clearBlood() {
  decalSets.forEach(ds => { for (let i = 0; i < DECAL_CAP; i++) { ds.mesh.setMatrixAt(i, zeroMat); ds.data[i] = null; } ds.mesh.instanceMatrix.needsUpdate = true; ds.head = 0; });
  drops.forEach((d, i) => { d.alive = false; dropMesh.setMatrixAt(i, zeroMat); }); dropMesh.instanceMatrix.needsUpdate = true;
  mistPool.forEach(m => m.s.visible = false);
  BL.pools.forEach(p => scene.remove(p.mesh)); BL.pools.length = 0; BL.emitters.length = 0; BL.growing.length = 0;
  BL.patches.forEach(p => p.m.parent && p.m.parent.remove(p.m)); BL.patches.length = 0;
  screenT = 0; if (screenEl) screenEl.style.opacity = 0;
}
