'use strict';
/* =========================================================
   WEAPONS — view models, ballistics, reload, ADS
   ========================================================= */
const wScene = new THREE.Scene();
const wCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
wScene.add(new THREE.HemisphereLight(0x99aacc, 0x141822, 0.38));
const wSun = new THREE.DirectionalLight(0xffffff, 0.62); wSun.position.set(0.6, 1, 0.8); wScene.add(wSun);
const wRim = new THREE.PointLight(0x19f0ff, 0.5, 3); wRim.position.set(-0.6, 0.1, -0.2); wScene.add(wRim);

const mMetal = new THREE.MeshStandardMaterial({ color: 0x2b303b, metalness: 0.9, roughness: 0.32 });
const mBody = new THREE.MeshStandardMaterial({ color: 0x4d5566, metalness: 0.75, roughness: 0.4 });
const mDark = new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.6, roughness: 0.55 });
const mGlove = new THREE.MeshStandardMaterial({ color: 0x15171d, metalness: 0.1, roughness: 0.85 });
const mSleeve = new THREE.MeshStandardMaterial({ color: 0x131a2a, metalness: 0.2, roughness: 0.7 });
const glowC = c => new THREE.MeshBasicMaterial({ color: c });

function B(p, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); p.add(m); return m; }
function C(p, r, len, mat, x, y, z, seg = 14) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; }
function limb(p, ax, ay, az, bx, by, bz, th, mat) {      // box stretched between two points
  const len = Math.hypot(bx - ax, by - ay, bz - az), m = new THREE.Mesh(new THREE.BoxGeometry(th, th, len), mat);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.lookAt(bx, by, bz); p.add(m); return m;
}
function arms(g, rh, lh) {   // rh/lh: hand centre [x,y,z]; forearms trail back toward the camera
  B(g, 0.062, 0.07, 0.1, mGlove, rh[0], rh[1], rh[2]); limb(g, rh[0], rh[1], rh[2] + 0.04, rh[0] + 0.1, rh[1] - 0.2, rh[2] + 0.5, 0.075, mSleeve);
  B(g, 0.07, 0.06, 0.11, mGlove, lh[0], lh[1], lh[2]); limb(g, lh[0], lh[1], lh[2] + 0.04, lh[0] - 0.16, lh[1] - 0.22, lh[2] + 0.5, 0.075, mSleeve);
}

const VM = {};   // view-model factories
VM.rifle = () => {
  const g = new THREE.Group(), o = {};
  B(g, 0.07, 0.1, 0.34, mBody, 0, 0, 0); B(g, 0.04, 0.03, 0.3, mMetal, 0, 0.065, -0.02);
  B(g, 0.06, 0.07, 0.22, mMetal, 0, 0, -0.26); C(g, 0.014, 0.3, mDark, 0, 0.015, -0.46); B(g, 0.036, 0.036, 0.06, mDark, 0, 0.015, -0.6);
  B(g, 0.05, 0.09, 0.2, mMetal, 0, -0.01, 0.27); B(g, 0.04, 0.1, 0.05, mDark, 0, -0.085, 0.1).rotation.x = -0.25;
  o.mag = B(g, 0.042, 0.15, 0.075, mDark, 0, -0.12, -0.03); o.mag.rotation.x = -0.12; o.magY = -0.12;
  B(g, 0.03, 0.03, 0.04, mDark, 0, 0.095, 0.08); B(g, 0.012, 0.045, 0.012, mDark, 0, 0.075, -0.5);
  B(g, 0.073, 0.012, 0.22, glowC(0x19f0ff), 0, 0.03, 0.02); B(g, 0.062, 0.01, 0.16, glowC(0xff2d95), 0, -0.02, -0.27);
  arms(g, [0, -0.115, 0.1], [0, -0.07, -0.27]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.015, -0.64); g.add(o.muzzle);
  o.g = g; return o;
};
VM.shotgun = () => {
  const g = new THREE.Group(), o = {};
  B(g, 0.08, 0.11, 0.3, mBody, 0, 0, 0); C(g, 0.024, 0.62, mMetal, 0, 0.022, -0.42); C(g, 0.019, 0.5, mDark, 0, -0.028, -0.38);
  o.pump = B(g, 0.075, 0.062, 0.18, mDark, 0, -0.03, -0.3); o.pumpZ = -0.3;
  B(g, 0.05, 0.075, 0.3, mMetal, 0, -0.025, 0.29).rotation.x = 0.1; B(g, 0.04, 0.1, 0.05, mDark, 0, -0.09, 0.12).rotation.x = -0.25;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 18), glowC(0xff8a2d)); ring.position.set(0, 0.022, -0.66); g.add(ring);
  B(g, 0.082, 0.012, 0.18, glowC(0xff8a2d), 0, 0.058, 0.02); B(g, 0.012, 0.03, 0.012, mDark, 0, 0.055, -0.7);
  arms(g, [0, -0.115, 0.12], [0, -0.065, -0.3]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.022, -0.74); g.add(o.muzzle);
  o.g = g; return o;
};
VM.pistol = () => {
  const g = new THREE.Group(), o = {};
  B(g, 0.046, 0.04, 0.22, mBody, 0, 0, 0);
  o.slide = B(g, 0.05, 0.058, 0.25, mMetal, 0, 0.045, -0.02); o.slideZ = -0.02;
  C(g, 0.012, 0.06, mDark, 0, 0.045, -0.17); B(g, 0.046, 0.12, 0.06, mDark, 0, -0.085, 0.07).rotation.x = -0.18;
  o.mag = B(g, 0.04, 0.02, 0.05, mMetal, 0, -0.15, 0.075); o.magY = -0.15;
  B(g, 0.054, 0.008, 0.16, glowC(0x3dff8b), 0, 0.052, -0.02); B(g, 0.01, 0.015, 0.012, mDark, 0, 0.082, -0.12);
  arms(g, [0, -0.095, 0.09], [-0.02, -0.12, 0.05]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.045, -0.21); g.add(o.muzzle);
  o.g = g; return o;
};
VM.rail = () => {
  const g = new THREE.Group(), o = {}, cy = glowC(0x19f0ff);
  B(g, 0.085, 0.11, 0.46, mBody, 0, 0, 0);
  C(g, 0.011, 0.7, mMetal, -0.03, 0.03, -0.45); C(g, 0.011, 0.7, mMetal, 0.03, 0.03, -0.45);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.009, 8, 20), cy); t.position.set(0, 0.03, -0.24 - i * 0.12); g.add(t); }
  o.core = B(g, 0.03, 0.03, 0.55, cy, 0, 0.03, -0.46);
  B(g, 0.06, 0.1, 0.26, mMetal, 0, -0.01, 0.34); B(g, 0.04, 0.1, 0.05, mDark, 0, -0.09, 0.14).rotation.x = -0.25;
  C(g, 0.03, 0.26, mDark, 0, 0.1, -0.06, 16); C(g, 0.026, 0.01, glowC(0xff2d95), 0, 0.1, -0.195, 16);
  B(g, 0.05, 0.05, 0.1, mDark, 0, 0.09, 0.12);
  o.mag = B(g, 0.05, 0.1, 0.09, mDark, 0, -0.1, -0.05); o.magY = -0.1;
  arms(g, [0, -0.115, 0.14], [0, -0.07, -0.2]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.03, -0.83); g.add(o.muzzle);
  o.g = g; return o;
};

const WEAPONS = [
  { id: 'rifle',   name: 'AR-7 PULSE',  auto: true,  rate: 0.092, dmg: 21,  pellets: 1, spread: 0.011, mag: 30, reserve: 120, maxReserve: 270, reload: 1.75, kick: 0.0095, kickX: 0.0035, back: 0.05, hip: [0.17, -0.19, -0.47],  ads: [0, -0.112, -0.3],  zoom: 0.78, adsMul: 0.3, snd: 'rifle',   tracer: 0xffe08a, shell: true,  ev: [[0.2, 'magout'], [0.62, 'magin'], [0.88, 'bolt']] },
  { id: 'shotgun', name: 'BREACHER',    auto: false, rate: 0.82,  dmg: 12,  pellets: 9, spread: 0.055, mag: 6,  reserve: 30,  maxReserve: 60,  reload: 2.4,  kick: 0.05,   kickX: 0.01,   back: 0.12, hip: [0.18, -0.2, -0.46],  ads: [0, -0.115, -0.28], zoom: 0.88, adsMul: 0.65, snd: 'shotgun', tracer: 0xffb060, shell: false, ev: [[0.1, 'magout'], [0.3, 'magin'], [0.48, 'magin'], [0.66, 'magin'], [0.9, 'bolt']] },
  { id: 'pistol',  name: 'VX-9 SIDEARM', auto: false, rate: 0.18, dmg: 36,  pellets: 1, spread: 0.006, mag: 12, reserve: 72,  maxReserve: 168, reload: 1.3,  kick: 0.02,   kickX: 0.004,  back: 0.06, hip: [0.12, -0.14, -0.4], rot: [0.02, 0.1, 0], ads: [0, -0.1, -0.27],   zoom: 0.85, adsMul: 0.4,  snd: 'pistol',  tracer: 0x9dffb4, shell: true,  ev: [[0.22, 'magout'], [0.65, 'magin'], [0.9, 'bolt']] },
  { id: 'rail',    name: 'RAILGUN X',   auto: false, rate: 1.05,  dmg: 170, pellets: 1, spread: 0.0,   mag: 4,  reserve: 16,  maxReserve: 36,  reload: 2.2,  kick: 0.06,   kickX: 0.0,    back: 0.1,  hip: [0.18, -0.19, -0.46],   ads: [0, -0.11, -0.3],   zoom: 0.3,  adsMul: 0.0,  snd: 'rail',    tracer: 0x19f0ff, shell: false, pierce: true, scope: true, ev: [[0.2, 'magout'], [0.65, 'magin'], [0.9, 'bolt']] },
];
WEAPONS.forEach(w => { w.vm = VM[w.id](); w.vm.g.visible = false; w.vm.g.scale.setScalar(0.85); wScene.add(w.vm.g); w.range = 250; });

const weap = { cur: 0, pending: 0, ammo: [], fireCd: 0, reloadT: -1, reloadEvIdx: 0, swT: 0, bloom: 0, ads: 0, held: false, kick: 0, sprint: 0, bobT: 0, swayX: 0, swayY: 0, flashT: 0, rail: 0 };
const flashLight = new THREE.PointLight(0xffc880, 0, 16, 1.5); scene.add(flashLight);
const muzzleSprite = makeGlow(0xffd890, 0.28); muzzleSprite.material.fog = false; muzzleSprite.visible = false; wScene.add(muzzleSprite);

function resetWeapons() {
  weap.ammo = WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve }));
  weap.cur = weap.pending = 0; weap.fireCd = 0; weap.reloadT = -1; weap.swT = 0; weap.bloom = 0; weap.ads = 0; weap.held = false; weap.kick = 0;
  WEAPONS.forEach((w, i) => w.vm.g.visible = i === 0);
}
function currentWeapon() { return WEAPONS[weap.cur]; }
function switchWeapon(i) {
  if (i < 0) i = WEAPONS.length - 1; if (i >= WEAPONS.length) i = 0;
  if (i === weap.cur || weap.swT > 0) return;
  weap.pending = i; weap.swT = 0.3; weap.reloadT = -1; sfx('switch');
}
function startReload() {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  if (weap.reloadT >= 0 || weap.swT > 0 || a.mag >= w.mag || a.reserve <= 0) return;
  weap.reloadT = 0; weap.reloadEvIdx = 0;
}
function addAmmo(frac) {
  weap.ammo.forEach((a, i) => { const w = WEAPONS[i]; a.reserve = Math.min(w.maxReserve, a.reserve + Math.max(1, Math.ceil(w.maxReserve * frac))); });
}

function currentSpread() {
  const w = currentWeapon();
  let s = w.spread;
  const spd = Math.hypot(player.vx, player.vz);
  s *= (1 - weap.ads * (1 - w.adsMul));
  if (spd > 1) s *= player.sprinting ? 2.2 : 1.45;
  if (!player.grounded) s *= 2.5;
  if (player.crouch) s *= 0.7;
  return s + weap.bloom * (w.id === 'rifle' ? 0.03 : w.id === 'pistol' ? 0.02 : 0) * (1 - weap.ads * 0.6);
}

const _R = new THREE.Vector3(), _U = new THREE.Vector3(), _F = new THREE.Vector3();
function fireWeapon() {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  a.mag--; weap.fireCd = w.rate; stats.shots++;
  const e = camera.matrixWorld.elements;
  _R.set(e[0], e[1], e[2]); _U.set(e[4], e[5], e[6]); _F.set(-e[8], -e[9], -e[10]);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z, sp = currentSpread();
  const hipK = 1 - weap.ads;
  const mx = ox + _F.x * 0.9 + _R.x * 0.15 * hipK, my = oy + _F.y * 0.9 + _U.y * (-0.1 * hipK), mz = oz + _F.z * 0.9 + _R.z * 0.15 * hipK;
  let anyHit = false;
  for (let p = 0; p < w.pellets; p++) {
    const ang = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp, cr = Math.cos(ang) * r, sr = Math.sin(ang) * r;
    let dx = _F.x + _R.x * cr + _U.x * sr, dy = _F.y + _R.y * cr + _U.y * sr, dz = _F.z + _R.z * cr + _U.z * sr;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const tw = rayWorld(ox, oy, oz, dx, dy, dz, w.range), nx = rayN.x, ny = rayN.y, nz = rayN.z;
    const hits = hitscanEnemies(ox, oy, oz, dx, dy, dz, tw);
    let endT = tw, hitEnemy = false;
    for (const h of hits) {
      const hx = ox + dx * h.t, hy = oy + dy * h.t, hz = oz + dz * h.t;
      let dmg = w.dmg * (h.head ? 2.5 : 1);
      if (w.id === 'shotgun') dmg *= clamp(1.25 - h.t / 28, 0.3, 1);
      robotHit(hx, hy, hz, dx, dy, dz, h.head, h.e.def.color);
      const killed = damageEnemy(h.e, dmg, h.head);
      registerHit(h.head, killed, !anyHit);
      anyHit = hitEnemy = true;
      if (!w.pierce) { endT = h.t; break; }
    }
    if (!hitEnemy && tw < w.range) wallImpact(ox + dx * tw, oy + dy * tw, oz + dz * tw, nx, ny, nz, w.id === 'rail');
    else if (w.pierce && tw < w.range) wallImpact(ox + dx * tw, oy + dy * tw, oz + dz * tw, nx, ny, nz, true);
    const far = Math.min(endT, w.pierce ? tw : endT, 120);
    if (w.id !== 'shotgun' || p < 4) addTracer(mx, my, mz, ox + dx * far, oy + dy * far, oz + dz * far, w.tracer, w.id === 'rail' ? 0.07 : w.id === 'shotgun' ? 0.012 : 0.02, w.id === 'rail' ? 0.35 : 0.07);
  }
  if (w.id === 'rail') addFlash(mx, my, mz, 0x19f0ff, 1.2, 0.2, 1.5);
  // recoil + feedback
  weap.kick = 1; weap.flashT = 0.055; weap.bloom = Math.min(1, weap.bloom + 0.16);
  const adsK = 1 - weap.ads * 0.45;
  const kp = w.kick * adsK * rand(0.8, 1.25);
  player.pitch += kp; player.yaw += rand(-1, 1) * w.kickX * adsK;
  player.recAcc += kp * 0.55; weap.sinceShot = 0;
  player.shake = Math.max(player.shake, w.id === 'shotgun' ? 0.35 : w.id === 'rail' ? 0.5 : 0.1);
  flashLight.position.set(ox + _F.x * 1.2, oy + _F.y * 1.2, oz + _F.z * 1.2); flashLight.intensity = w.id === 'shotgun' ? 5 : 3;
  muzzleSprite.material.rotation = Math.random() * TAU;
  const ms = (w.id === 'shotgun' ? 0.55 : w.id === 'rail' ? 0.5 : 0.3) * (1 - weap.ads * 0.5); muzzleSprite.scale.set(ms, ms, 1);
  if (w.shell) emit(ox + _F.x * 0.5 + _R.x * 0.2, oy + _F.y * 0.5 - 0.08, oz + _F.z * 0.5 + _R.z * 0.2, 1, { color: 0xe0a840, speed: 2.8, life: 0.9, size: 0.035, grav: 16, dir: { x: _R.x + _U.x, y: _R.y + _U.y, z: _R.z + _U.z }, cone: 0.5, hdr: 1.4 });
  sfx(w.snd);
}

function updateWeapon(dt, input) {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  weap.fireCd = Math.max(0, weap.fireCd - dt);
  weap.bloom = Math.max(0, weap.bloom - dt * 1.6);
  if (weap.flashT > 0) weap.flashT -= dt;
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 40);
  weap.kick = Math.max(0, weap.kick - dt * 9);

  // switching
  if (weap.swT > 0) {
    const before = weap.swT; weap.swT = Math.max(0, weap.swT - dt);
    if (before > 0.15 && weap.swT <= 0.15) { weap.cur = weap.pending; WEAPONS.forEach((x, i) => x.vm.g.visible = i === weap.cur); }
  }
  // reload
  if (weap.reloadT >= 0) {
    weap.reloadT += dt;
    const p = weap.reloadT / w.reload;
    while (weap.reloadEvIdx < w.ev.length && p >= w.ev[weap.reloadEvIdx][0]) sfx(w.ev[weap.reloadEvIdx++][1]);
    if (p >= 1) {
      const take = Math.min(w.mag - a.mag, a.reserve); a.mag += take; a.reserve -= take; weap.reloadT = -1;
    }
  }
  const canShoot = weap.swT <= 0 && weap.reloadT < 0;
  const wantsFire = input.fire && (w.auto || !weap.held);
  weap.held = input.fire;
  if (wantsFire && canShoot && weap.fireCd <= 0) {
    if (a.mag > 0) fireWeapon();
    else { weap.fireCd = 0.25; sfx('empty'); if (a.reserve > 0) startReload(); }
  }
  if (input.reload) startReload();
  if (a.mag <= 0 && a.reserve > 0 && canShoot && weap.fireCd <= 0) startReload();

  // ADS
  const wantAds = input.ads && weap.reloadT < 0 && weap.swT <= 0 && !player.sprinting;
  weap.ads += ((wantAds ? 1 : 0) - weap.ads) * Math.min(1, dt * (w.scope ? 9 : 12));
  weap.sprint += ((player.sprinting && player.grounded ? 1 : 0) - weap.sprint) * Math.min(1, dt * 9);
}

// positions the visible view-model (called every rendered frame)
function animateViewmodel(dt) {
  const w = currentWeapon(), vm = w.vm, g = vm.g, k = weap.ads, spd = Math.hypot(player.vx, player.vz);
  const moving = player.grounded ? Math.min(1, spd / 6) : 0;
  weap.bobT += dt * (player.sprinting ? 12 : 8.5) * (0.4 + moving);
  const bob = moving * (1 - k * 0.85);
  let x = lerp(w.hip[0], w.ads[0], k) + Math.cos(weap.bobT * 0.5) * 0.012 * bob;
  let y = lerp(w.hip[1], w.ads[1], k) + Math.abs(Math.sin(weap.bobT * 0.5)) * 0.014 * bob - Math.sin(performance.now() * 0.0018) * 0.0015;
  let z = lerp(w.hip[2], w.ads[2], k) + weap.kick * w.back * (1 - k * 0.5);
  let rx = weap.kick * 0.1 * (1 - k * 0.5), ry = 0, rz = 0;
  if (w.rot) { rx += w.rot[0] * (1 - k); ry += w.rot[1] * (1 - k); rz += w.rot[2] * (1 - k); }
  // sway from mouse movement
  weap.swayX += (-player.lookDX * 0.0009 - weap.swayX) * Math.min(1, dt * 10); weap.swayY += (player.lookDY * 0.0009 - weap.swayY) * Math.min(1, dt * 10);
  const sw = 1 - k * 0.8; x += clamp(weap.swayX, -0.04, 0.04) * sw; y += clamp(weap.swayY, -0.04, 0.04) * sw; ry += clamp(weap.swayX, -0.04, 0.04) * 1.5 * sw; rx += clamp(weap.swayY, -0.04, 0.04) * sw;
  // sprint pose
  y -= weap.sprint * 0.07; x -= weap.sprint * 0.06; ry += weap.sprint * 0.55; rx += weap.sprint * 0.12; rz += weap.sprint * 0.12;
  // switch animation
  if (weap.swT > 0) { const t = 1 - Math.abs(weap.swT - 0.15) / 0.15; y -= t * 0.38; rx -= t * 0.5; }
  // reload animation
  if (weap.reloadT >= 0) {
    const p = clamp(weap.reloadT / w.reload, 0, 1), s = Math.sin(Math.PI * Math.min(1, p * 1.05));
    y -= s * 0.1; rx += s * 0.35; rz += s * 0.45; x -= s * 0.04;
    if (vm.mag) { const drop = p > 0.15 && p < 0.55 ? Math.min(1, (p - 0.15) / 0.12) : p >= 0.55 && p < 0.7 ? 1 - (p - 0.55) / 0.15 : 0; vm.mag.position.y = vm.magY - drop * 0.22; vm.mag.visible = !(p > 0.28 && p < 0.55); }
    if (vm.pump) vm.pump.position.z = vm.pumpZ + (p > 0.9 ? Math.sin((p - 0.9) / 0.1 * Math.PI) * 0.1 : 0);
  } else if (vm.mag) { vm.mag.position.y = vm.magY; vm.mag.visible = true; }
  if (vm.pump && weap.reloadT < 0) vm.pump.position.z = vm.pumpZ + (weap.fireCd > w.rate * 0.35 && weap.fireCd < w.rate * 0.85 ? 0.1 : 0);
  if (vm.slide) vm.slide.position.z = vm.slideZ + (weap.kick > 0.4 ? 0.07 * weap.kick : 0);
  if (vm.core) { vm.core.material.color.setRGB(0.1, 0.7 + 0.3 * (1 - weap.fireCd / w.rate), 1); vm.core.scale.set(1, 1, 0.3 + 0.7 * (1 - clamp(weap.fireCd / w.rate, 0, 1))); }
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  g.visible = !(w.scope && weap.ads > 0.9);
  // muzzle flash
  if (weap.flashT > 0 && g.visible) { g.updateMatrixWorld(true); vm.muzzle.getWorldPosition(muzzleSprite.position); muzzleSprite.visible = true; muzzleSprite.material.opacity = weap.flashT / 0.055; }
  else muzzleSprite.visible = false;
}
