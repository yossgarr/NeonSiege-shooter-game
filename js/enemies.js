'use strict';
/* =========================================================
   ENEMIES — procedural robots, AI, projectiles
   ========================================================= */
const ENEMY_TYPES = {
  grunt:  { name: 'GRUNT',  hp: 60,  speed: 3.9, scale: 1.0,  color: 0xff7a2e, eye: 0xffd000, score: 100, kind: 'gun',   fire: [1.4, 2.4], wind: 0.35, dmg: 8,  pspeed: 25, spread: 0.04, range: 34, near: 7,  far: 15, burst: 1, pcolor: 0xffa030, radius: 0.45 },
  runner: { name: 'RUNNER', hp: 38,  speed: 7.4, scale: 0.9,  color: 0xff2244, eye: 0xff0066, score: 120, kind: 'melee', dmg: 14, radius: 0.42 },
  heavy:  { name: 'HEAVY',  hp: 300, speed: 2.4, scale: 1.5,  color: 0x8a3dff, eye: 0xff3df0, score: 300, kind: 'gun',   fire: [2.2, 3.2], wind: 0.55, dmg: 9,  pspeed: 21, spread: 0.07, range: 36, near: 9,  far: 18, burst: 3, pcolor: 0xc060ff, radius: 0.7 },
  drone:  { name: 'DRONE',  hp: 48,  speed: 5.6, scale: 1.0,  color: 0x19c8ff, eye: 0xffffff, score: 150, kind: 'air',   fire: [1.0, 1.7], wind: 0.25, dmg: 6,  pspeed: 30, spread: 0.05, range: 36, near: 9,  far: 17, burst: 1, pcolor: 0x40e0ff, radius: 0.5, alt: 3.4 },
};

const enemies = [];
const projectiles = [];
const _geoCache = {};
function cgeo(k, f) { return _geoCache[k] || (_geoCache[k] = f()); }
function bgeo(w, h, d) { const k = w + ',' + h + ',' + d; return _geoCache[k] || (_geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.5, metalness: 0.85 });
const glowMats = {};
function glowMat(c) { return glowMats[c] || (glowMats[c] = new THREE.MeshBasicMaterial({ color: c })); }

function part(parent, geo, mat, x, y, z, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; parent.add(m); return m;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

function buildHumanoid(t) {
  const g = new THREE.Group(), armor = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.45, metalness: 0.3 });
  const P = { armor };
  const heavy = t.kind === 'gun' && t.scale > 1.2, melee = t.kind === 'melee';
  P.legL = pivot(g, -0.17, 0.8, 0); P.legR = pivot(g, 0.17, 0.8, 0);
  [P.legL, P.legR].forEach(l => { part(l, bgeo(0.2, 0.46, 0.24), armor, 0, -0.22, 0); part(l, bgeo(0.16, 0.36, 0.18), darkMat, 0, -0.58, 0.01); part(l, bgeo(0.22, 0.1, 0.34), armor, 0, -0.76, 0.06); });
  part(g, bgeo(0.52, 0.18, 0.32), darkMat, 0, 0.82, 0);
  P.torso = pivot(g, 0, 0.95, 0);
  part(P.torso, bgeo(0.66, 0.62, 0.38), armor, 0, 0.31, 0);
  part(P.torso, bgeo(0.5, 0.2, 0.06), darkMat, 0, 0.36, 0.2);
  part(P.torso, bgeo(0.36, 0.05, 0.03), glowMat(t.eye), 0, 0.36, 0.235, false);
  part(P.torso, bgeo(0.3, 0.34, 0.2), darkMat, 0, 0.3, -0.27);              // backpack
  if (heavy) { part(P.torso, bgeo(0.3, 0.2, 0.3), armor, -0.46, 0.55, 0); part(P.torso, bgeo(0.3, 0.2, 0.3), armor, 0.46, 0.55, 0); }
  else { part(P.torso, bgeo(0.22, 0.12, 0.26), armor, -0.4, 0.58, 0); part(P.torso, bgeo(0.22, 0.12, 0.26), armor, 0.4, 0.58, 0); }
  P.head = pivot(P.torso, 0, 0.74, 0);
  part(P.head, bgeo(0.3, 0.28, 0.3), darkMat, 0, 0.1, 0);
  part(P.head, bgeo(0.31, 0.08, 0.31), armor, 0, 0.26, 0);
  P.visor = part(P.head, bgeo(0.26, 0.07, 0.04), glowMat(t.eye), 0, 0.12, 0.16, false);
  part(P.head, bgeo(0.02, 0.2, 0.02), darkMat, 0.12, 0.35, -0.05);
  if (melee) part(P.head, bgeo(0.1, 0.1, 0.1), armor, 0, 0.3, 0.08);
  P.armL = pivot(P.torso, -0.42, 0.52, 0); P.armR = pivot(P.torso, 0.42, 0.52, 0);
  [P.armL, P.armR].forEach(a => { part(a, bgeo(0.15, 0.32, 0.15), armor, 0, -0.16, 0); part(a, bgeo(0.13, 0.3, 0.13), darkMat, 0, -0.46, 0); part(a, bgeo(melee ? 0.16 : 0.14, 0.14, melee ? 0.3 : 0.14), melee ? glowMat(t.eye) : armor, 0, -0.66, melee ? 0.08 : 0, false); });
  P.muzzle = new THREE.Object3D();
  if (!melee) {
    // weapon is held out in front, arms follow it
    part(P.torso, bgeo(0.12, 0.16, 0.62), darkMat, 0.34, 0.5, 0.45);
    part(P.torso, bgeo(0.05, 0.05, 0.14), glowMat(t.eye), 0.34, 0.5, 0.78, false);
    P.muzzle.position.set(0.34, 0.5, 0.88); P.torso.add(P.muzzle);
    P.armR.rotation.set(-1.3, 0, -0.2); P.armL.rotation.set(-1.15, 0, 0.35);
    P.armL.position.x = -0.38;
  }
  g.scale.setScalar(t.scale);
  return { g, P };
}
function buildDrone(t) {
  const g = new THREE.Group(), armor = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.35, metalness: 0.7, emissive: 0x000000 });
  const P = { armor };
  part(g, cgeo("ico", () => new THREE.IcosahedronGeometry(0.42, 1)), armor, 0, 0, 0);
  const ring = new THREE.Mesh(cgeo("ring", () => new THREE.TorusGeometry(0.58, 0.04, 8, 28)), glowMat(t.color)); ring.rotation.x = Math.PI / 2; g.add(ring); P.ring = ring;
  const eye = new THREE.Mesh(cgeo("eye", () => new THREE.SphereGeometry(0.16, 12, 8)), glowMat(0xff3050)); eye.position.set(0, 0.02, 0.36); g.add(eye); P.eye = eye;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, arm = pivot(g, Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5);
    part(arm, bgeo(0.06, 0.06, 0.06), darkMat, 0, 0, 0);
    const r = new THREE.Mesh(cgeo("rotor", () => new THREE.CylinderGeometry(0.2, 0.2, 0.015, 14)), glowMat(0x88ddff)); r.material = r.material.clone(); r.material.transparent = true; r.material.opacity = 0.45; r.position.y = 0.06; arm.add(r);
    P['rotor' + i] = r;
  }
  part(g, bgeo(0.08, 0.08, 0.36), darkMat, 0, -0.26, 0.2);
  P.muzzle = new THREE.Object3D(); P.muzzle.position.set(0, -0.26, 0.42); g.add(P.muzzle);
  return { g, P };
}

const barBackMat = new THREE.SpriteMaterial({ color: 0x000000, opacity: 0.65, transparent: true, depthWrite: false });
function spawnEnemy(typeName, x, z, wave) {
  const t = ENEMY_TYPES[typeName], built = t.kind === 'air' ? buildDrone(t) : buildHumanoid(t);
  const hpScale = 1 + 0.07 * (wave - 1);
  const e = {
    type: typeName, def: t, group: built.g, P: built.P, x, z, y: t.kind === 'air' ? t.alt : 0, vx: 0, vz: 0,
    hp: t.hp * hpScale, maxHp: t.hp * hpScale, speed: t.speed * Math.min(1.35, 1 + 0.025 * (wave - 1)),
    state: 'spawn', t: 0, face: 0, fireT: rand(0.8, 2.2), windup: 0, burstLeft: 0, burstT: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(1.5, 3.5),
    los: false, walkClear: false, losT: Math.random() * 0.2, flash: 0, phase: Math.random() * 6, meleeT: 0, barT: 0, bob: Math.random() * 6, radius: t.radius * t.scale,
    killed: false,
  };
  e.group.position.set(x, e.y, z);
  e.group.scale.setScalar(0.01);
  scene.add(e.group);
  e.barBack = new THREE.Sprite(barBackMat); e.barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x3dff8b, transparent: true, depthWrite: false }));
  e.barBack.renderOrder = 10; e.barFill.renderOrder = 11;
  e.barBack.visible = e.barFill.visible = false; scene.add(e.barBack); scene.add(e.barFill);
  addFlash(x, 1, z, t.color, 1.8, 0.6, 0.8);
  emit(x, 0.1, z, 14, { color: t.color, speed: 3, life: 0.7, size: 0.07, grav: -3, dir: { x: 0, y: 1, z: 0 }, cone: 0.5, hdr: 1.8 });
  sfx('spawn', e, 0.8);
  enemies.push(e);
  return e;
}

/* ---------------- ray helpers ---------------- */
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
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca, r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}
// returns [{e,t,head}] sorted by distance (closest first)
function hitscanEnemies(ox, oy, oz, dx, dy, dz, maxT) {
  const hits = [];
  for (const e of enemies) {
    if (e.state !== 'alive') continue;
    const s = e.def.scale, r = e.radius;
    if (e.def.kind === 'air') {
      const t = raySphere(ox, oy, oz, dx, dy, dz, e.x, e.y, e.z, 0.55);
      if (t >= 0 && t < maxT) hits.push({ e, t, head: false });
    } else {
      const th = raySphere(ox, oy, oz, dx, dy, dz, e.x, e.y + 1.68 * s, e.z, 0.24 * s);
      const tb = rayAABB(ox, oy, oz, dx, dy, dz, e.x - r, e.x + r, e.y, e.y + 1.5 * s, e.z - r, e.z + r);
      if (th >= 0 && th < maxT && (tb < 0 || th <= tb + 0.3)) hits.push({ e, t: th, head: true });
      else if (tb >= 0 && tb < maxT) hits.push({ e, t: tb, head: false });
    }
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

/* ---------------- projectiles ---------------- */
const projPool = [];
function getProjectile() {
  let p = projPool.pop();
  if (!p) {
    const grp = new THREE.Group(), halo = makeGlow(0xffffff, 1.0), core = makeGlow(0xffffff, 0.34);
    grp.add(halo); grp.add(core); p = { grp, halo, core };
    p.core.material.color.set(0xffffff);
  }
  return p;
}
function spawnProjectile(x, y, z, dx, dy, dz, speed, dmg, color) {
  const p = getProjectile();
  p.x = x; p.y = y; p.z = z; p.vx = dx * speed; p.vy = dy * speed; p.vz = dz * speed; p.dmg = dmg; p.life = 4; p.color = color;
  p.halo.material.color.set(color); p.grp.position.set(x, y, z); scene.add(p.grp);
  projectiles.push(p);
}
function removeProjectile(i) { const p = projectiles[i]; scene.remove(p.grp); projPool.push(p); projectiles.splice(i, 1); }
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    const sp = Math.hypot(p.vx, p.vy, p.vz), steps = Math.max(1, Math.ceil(sp * dt / 0.45)), sdt = dt / steps;
    let dead = p.life <= 0;
    for (let s = 0; s < steps && !dead; s++) {
      p.x += p.vx * sdt; p.y += p.vy * sdt; p.z += p.vz * sdt;
      if (p.y <= 0.02) { wallImpact(p.x, 0.02, p.z, 0, 1, 0, false); dead = true; break; }
      const b = boxAt(p.x, p.y, p.z);
      if (b) { emit(p.x, p.y, p.z, 8, { color: [p.color, 0xffffff], speed: 4, life: 0.3, size: 0.05, grav: 6, hdr: 2 }); addFlash(p.x, p.y, p.z, p.color, 0.8, 0.12, 0.6); dead = true; break; }
      if (Math.abs(p.x) > ARENA + 1 || Math.abs(p.z) > ARENA + 1) { dead = true; break; }
      const dx = p.x - player.x, dz = p.z - player.z;
      if (dx * dx + dz * dz < 0.36 && p.y > player.feetY - 0.1 && p.y < player.feetY + player.eye + 0.2 && player.alive) {
        hurtPlayer(p.dmg, { x: p.x - p.vx * 0.2, z: p.z - p.vz * 0.2 });
        addFlash(p.x, p.y, p.z, p.color, 0.6, 0.1, 0.5);
        dead = true; break;
      }
    }
    if (dead) { removeProjectile(i); continue; }
    p.grp.position.set(p.x, p.y, p.z);
    const pulse = 0.9 + Math.sin(performance.now() * 0.03 + i) * 0.1;
    p.halo.scale.set(pulse, pulse, 1);
  }
}
function clearProjectiles() { for (let i = projectiles.length - 1; i >= 0; i--) removeProjectile(i); }

/* ---------------- AI ---------------- */
const _fd = { x: 0, z: 0 };
function angleLerp(a, b, t) { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; }
const _mw = new THREE.Vector3();

function enemyFire(e) {
  const d = e.def;
  e.P.muzzle.getWorldPosition(_mw);
  const lead = Math.hypot(player.x - e.x, player.z - e.z) / d.pspeed * 0.55;
  const tx = player.x + player.vx * lead, tz = player.z + player.vz * lead, ty = player.feetY + player.eye * 0.75;
  let dx = tx - _mw.x, dy = ty - _mw.y, dz = tz - _mw.z;
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  const sp = d.spread * (1 + e.burstLeft * 0.3);
  dx += rand(-sp, sp); dy += rand(-sp, sp) * 0.6; dz += rand(-sp, sp);
  const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
  spawnProjectile(_mw.x, _mw.y, _mw.z, dx, dy, dz, d.pspeed, d.dmg, d.pcolor);
  addFlash(_mw.x, _mw.y, _mw.z, d.pcolor, 0.9 * d.scale, 0.08, 0.5);
  sfx(e.type === 'heavy' ? 'eheavy' : e.type === 'drone' ? 'edrone' : 'eshot', e, 0.9);
}

function updateEnemy(e, dt) {
  const d = e.def, P = e.P;
  e.t += dt;
  if (e.flash > 0) { e.flash -= dt * 7; const f = Math.max(0, e.flash); P.armor.emissive.setRGB(f * 0.9, f * 0.9, f * 0.9); }
  if (e.barT > 0) e.barT -= dt;

  if (e.state === 'spawn') {
    const k = Math.min(1, e.t / 0.7);
    e.group.scale.setScalar(Math.max(0.01, d.scale * (0.2 + 0.8 * k)));
    e.group.position.y = e.y - (1 - k) * 0.4;
    e.group.rotation.y = e.face;
    if (k >= 1) { e.state = 'alive'; e.group.position.y = e.y; }
    return;
  }
  const px = player.x, pz = player.z, dx = px - e.x, dz = pz - e.z, dist = Math.hypot(dx, dz) || 0.001;
  const nx = dx / dist, nz = dz / dist;

  // sensing (staggered)
  e.losT -= dt;
  if (e.losT <= 0) {
    e.losT = 0.14 + Math.random() * 0.08;
    const ey = e.y + (d.kind === 'air' ? 0 : 1.5 * d.scale), tyy = player.feetY + player.eye - 0.1;
    const vx = px - e.x, vy = tyy - ey, vz = pz - e.z, vl = Math.hypot(vx, vy, vz);
    e.los = rayWorld(e.x, ey, e.z, vx / vl, vy / vl, vz / vl, vl) >= vl - 0.3;
    e.walkClear = !segBlocked2D(e.x, e.z, px, pz, e.radius + 0.1);
  }

  // intent
  let ix = 0, iz = 0, speed = e.speed;
  const advance = () => {
    if (e.walkClear) { ix = nx; iz = nz; } else if (flowDir(e.x, e.z, _fd)) { ix = _fd.x; iz = _fd.z; }
  };
  if (d.kind === 'melee') {
    if (dist > 1.25) advance(); else speed = 0;
    e.meleeT -= dt;
    if (dist < 1.7 && e.meleeT <= 0 && Math.abs(player.feetY - e.y) < 1.4 && player.alive) {
      e.meleeT = 0.85; hurtPlayer(d.dmg, { x: e.x, z: e.z }); sfx('melee', e); e.lunge = 0.25;
      emit(px, player.feetY + 1.3, pz, 6, { color: [0xff2244, 0xffffff], speed: 3, life: 0.3, size: 0.05, grav: 4, hdr: 2 });
    }
  } else {
    e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = rand(1.5, 3.8); if (Math.random() < 0.6) e.strafe = -e.strafe; }
    if (!e.los || dist > d.far) advance();
    else if (dist < d.near) { ix = -nx; iz = -nz; speed *= 0.85; }
    else { ix = -nz * e.strafe; iz = nx * e.strafe; speed *= 0.6; }
    // shooting state machine
    if (e.burstLeft > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) { enemyFire(e); e.burstLeft--; e.burstT = 0.13; if (e.burstLeft === 0) e.fireT = rand(d.fire[0], d.fire[1]); }
    } else if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) { e.burstLeft = d.burst; e.burstT = 0; }
    } else {
      e.fireT -= dt;
      if (e.fireT <= 0 && e.los && dist < d.range && dist > 2.5 && player.alive) e.windup = d.wind;
    }
    if (e.windup > 0) speed *= 0.3;
    // wind-up telegraph: gun glows
    if (P.visor) P.visor.scale.set(1 + (e.windup > 0 ? 0.7 : 0), 1 + (e.windup > 0 ? 1.2 : 0), 1);
  }

  // separation from others
  let sx = 0, sz = 0;
  for (const o of enemies) {
    if (o === e || o.state === 'dying') continue;
    const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), min = e.radius + o.radius + 0.25;
    if (od < min && od > 0.001) { const k = (min - od) / min; sx += ox / od * k; sz += oz / od * k; }
  }
  ix += sx * 1.6; iz += sz * 1.6;
  const il = Math.hypot(ix, iz);
  if (il > 1) { ix /= il; iz /= il; }
  const k = Math.min(1, dt * (d.kind === 'melee' ? 10 : 6));
  e.vx += (ix * speed - e.vx) * k; e.vz += (iz * speed - e.vz) * k;
  e.x += e.vx * dt; e.z += e.vz * dt;
  if (d.kind === 'air') {
    resolveCircle(e, e.radius, e.y - 0.5, 0);
    e.bob += dt * 2.2; e.y = d.alt + Math.sin(e.bob) * 0.35 + Math.sin(e.bob * 0.6) * 0.2;
  } else resolveCircle(e, e.radius, 0, 0.1);

  // orientation
  const moving = Math.hypot(e.vx, e.vz);
  let want = d.kind === 'melee' ? (moving > 0.3 ? Math.atan2(e.vx, e.vz) : Math.atan2(nx, nz)) : Math.atan2(nx, nz);
  if (d.kind !== 'melee' && !e.los && moving > 0.5) want = Math.atan2(e.vx, e.vz);
  e.face = angleLerp(e.face, want, Math.min(1, dt * (d.kind === 'melee' ? 12 : 7)));
  e.group.position.set(e.x, e.y, e.z);
  e.group.rotation.y = e.face;

  // animation
  if (d.kind === 'air') {
    e.group.rotation.z = -e.vx * 0.04 * Math.cos(e.face) + e.vz * 0.04 * Math.sin(e.face);
    e.group.rotation.x = (e.vx * Math.sin(e.face) + e.vz * Math.cos(e.face)) * 0.05;
    P.ring.rotation.z += dt * 2;
    for (let i = 0; i < 4; i++) P['rotor' + i].rotation.y += dt * 40;
    const w = e.windup > 0 ? 1 : 0; P.eye.scale.setScalar(1 + w * 0.9);
  } else {
    e.phase += moving * dt * 2.4 / d.scale;
    const amp = Math.min(1, moving / 3), sw = Math.sin(e.phase) * 0.85 * amp;
    P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
    P.torso.position.y = 0.95 + Math.abs(Math.cos(e.phase)) * 0.05 * amp;
    P.torso.rotation.y = d.kind === 'gun' ? Math.sin(e.phase) * 0.05 * amp : 0;
    if (d.kind === 'melee') {
      P.armL.rotation.x = -sw * 1.3 - 0.3; P.armR.rotation.x = sw * 1.3 - 0.3;
      P.torso.rotation.x = 0.25 + (e.lunge > 0 ? 0.35 : 0);
      if (e.lunge > 0) { e.lunge -= dt; P.armL.rotation.x = P.armR.rotation.x = -1.6; }
    } else P.torso.rotation.x = e.windup > 0 ? -0.08 : 0;
  }
}

/* ---------------- damage / death ---------------- */
function damageEnemy(e, dmg, head) {
  if (e.state !== 'alive') return false;
  e.hp -= dmg; e.flash = 1; e.barT = 3;
  if (e.hp <= 0) { killEnemy(e, head); return true; }
  return false;
}
function killEnemy(e, head) {
  e.state = 'dying'; e.killed = true;
  const s = e.def.scale, cy = e.y + (e.def.kind === 'air' ? 0 : 1.0 * s);
  deathBlast(e.x, cy, e.z, e.def.color, Math.max(0.8, s));
  addHole(e.x, 0, e.z, 0, 1, 0, 1.6 * s);
  sfx('kill', e, 1);
  scene.remove(e.group); scene.remove(e.barBack); scene.remove(e.barFill);
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  onEnemyKilled(e, head);
}
function clearEnemies() {
  for (const e of enemies) { scene.remove(e.group); scene.remove(e.barBack); scene.remove(e.barFill); }
  enemies.length = 0; clearProjectiles();
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) updateEnemy(enemies[i], dt);
  updateProjectiles(dt);
}
// floating health bars (call after camera is positioned)
function updateEnemyBars() {
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  for (const e of enemies) {
    const show = e.barT > 0 && e.state === 'alive';
    e.barBack.visible = e.barFill.visible = show;
    if (!show) continue;
    const W = 0.9 * Math.pow(e.def.scale, 0.6), H = 0.1, pct = clamp(e.hp / e.maxHp, 0, 1);
    const y = e.y + (e.def.kind === 'air' ? 0.95 : 2.05 * e.def.scale);
    e.barBack.position.set(e.x, y, e.z); e.barBack.scale.set(W + 0.04, H + 0.04, 1);
    const off = -(W - W * pct) / 2;
    e.barFill.position.set(e.x + rx * off, y, e.z + rz * off); e.barFill.scale.set(Math.max(0.001, W * pct), H, 1);
    e.barFill.material.color.setHSL(0.33 * pct, 1, 0.5);
  }
}
