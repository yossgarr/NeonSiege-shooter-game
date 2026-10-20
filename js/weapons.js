'use strict';
/* =========================================================
   WEAPONS — pistol + AK-47: view models, ballistics, reload, ADS
   ========================================================= */
const wScene = new THREE.Scene();
const wCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
wScene.add(new THREE.HemisphereLight(0xdde6f5, 0x2a2f3a, 0.7));
const wSun = new THREE.DirectionalLight(0xfff4e6, 0.9); wSun.position.set(0.6, 1, 0.8); wScene.add(wSun);

const woodTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#7b4a26'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) { const v = (Math.random() * 60 - 30) | 0; g.strokeStyle = `rgba(${90 + v},${50 + v / 2},${22 + v / 3},.55)`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); let x = Math.random() * s; g.moveTo(x, 0); for (let y = 0; y <= s; y += 16) { x += (Math.random() - 0.5) * 6; g.lineTo(x, y); } g.stroke(); }
});
const mMetal = new THREE.MeshStandardMaterial({ color: 0x2b2f37, metalness: 0.85, roughness: 0.36 });
const mSteel = new THREE.MeshStandardMaterial({ color: 0x4a4f58, metalness: 0.9, roughness: 0.3 });
const mDark = new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.5, roughness: 0.6 });
const mWood = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, metalness: 0.05, roughness: 0.5 });
const mGlove = new THREE.MeshStandardMaterial({ color: 0x15171d, metalness: 0.1, roughness: 0.85 });
const mSleeve = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.1, roughness: 0.85 });

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
VM.pistol = () => {
  const g = new THREE.Group(), o = {};
  B(g, 0.046, 0.04, 0.22, mSteel, 0, 0, 0);
  o.slide = B(g, 0.05, 0.058, 0.25, mMetal, 0, 0.045, -0.02); o.slideZ = -0.02;
  for (let i = 0; i < 6; i++) B(g, 0.052, 0.05, 0.006, mDark, 0, 0.045, 0.06 + i * 0.012);                   // rear serrations
  C(g, 0.012, 0.06, mDark, 0, 0.045, -0.17);
  B(g, 0.046, 0.12, 0.06, mDark, 0, -0.085, 0.07).rotation.x = -0.18;
  B(g, 0.05, 0.1, 0.012, mWood, 0.0, -0.085, 0.07).rotation.x = -0.18;
  B(g, 0.01, 0.012, 0.075, mDark, 0, -0.03, -0.02);                                                          // trigger guard
  o.mag = B(g, 0.04, 0.02, 0.05, mMetal, 0, -0.15, 0.075); o.magY = -0.15;
  B(g, 0.01, 0.015, 0.012, mDark, 0, 0.082, -0.12); B(g, 0.02, 0.012, 0.012, mDark, 0, 0.082, 0.1);        // sights
  arms(g, [0, -0.095, 0.09], [-0.02, -0.12, 0.05]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.045, -0.21); g.add(o.muzzle);
  o.g = g; return o;
};
VM.ak47 = () => {
  const g = new THREE.Group(), o = {};
  B(g, 0.056, 0.086, 0.3, mMetal, 0, 0, 0.02);                                             // receiver
  B(g, 0.05, 0.03, 0.27, mSteel, 0, 0.056, 0.02);                                          // dust cover
  B(g, 0.03, 0.026, 0.05, mDark, 0, 0.082, 0.12); B(g, 0.014, 0.03, 0.06, mDark, 0, 0.095, 0.12).rotation.x = 0.35;   // rear sight
  C(g, 0.011, 0.44, mSteel, 0, 0.022, -0.41);                                              // barrel
  C(g, 0.014, 0.2, mMetal, 0, 0.058, -0.32);                                               // gas tube
  B(g, 0.056, 0.062, 0.26, mWood, 0, 0.004, -0.31);                                        // lower handguard
  B(g, 0.048, 0.026, 0.19, mWood, 0, 0.046, -0.28);                                        // upper handguard
  B(g, 0.032, 0.05, 0.035, mMetal, 0, 0.042, -0.5); B(g, 0.007, 0.045, 0.007, mDark, 0, 0.082, -0.5);   // gas block + front sight
  C(g, 0.017, 0.055, mMetal, 0, 0.022, -0.65);                                             // muzzle brake
  const grip = B(g, 0.04, 0.115, 0.056, mWood, 0, -0.088, 0.13); grip.rotation.x = 0.38;   // pistol grip
  const stock = B(g, 0.046, 0.095, 0.21, mWood, 0, -0.012, 0.37); stock.rotation.x = -0.06; // stock
  B(g, 0.048, 0.1, 0.012, mSteel, 0, -0.02, 0.475);                                        // butt plate
  B(g, 0.01, 0.01, 0.075, mDark, 0, -0.056, 0.05);                                         // trigger guard
  o.mag = new THREE.Group(); o.mag.position.set(0, -0.075, -0.045); g.add(o.mag); o.magY = o.mag.position.y;
  for (let i = 0; i < 4; i++) { const s = B(o.mag, 0.036, 0.05, 0.07, mDark, 0, -0.04 - i * 0.042, -0.004 - i * i * 0.0045); s.rotation.x = 0.06 + 0.1 * i; }   // curved magazine
  arms(g, [0, -0.115, 0.13], [0, -0.06, -0.31]);
  o.muzzle = new THREE.Object3D(); o.muzzle.position.set(0, 0.022, -0.69); g.add(o.muzzle);
  o.g = g; return o;
};

const WEAPONS = [
  { id: 'pistol', name: 'PISTOL 9MM', auto: false, rate: 0.15, dmg: 38, spread: 0.006, mag: 15, reserve: Infinity, reload: 1.3, kick: 0.022, kickX: 0.005, back: 0.06, hip: [0.12, -0.14, -0.42], rot: [0.02, 0.1, 0], ads: [0, -0.1, -0.29], zoom: 0.85, adsMul: 0.4, snd: 'pistol', tracer: 0xffe9b0, shell: true, ev: [[0.22, 'magout'], [0.65, 'magin'], [0.9, 'bolt']] },
  { id: 'ak47', name: 'AK-47', auto: true, rate: 0.1, dmg: 34, spread: 0.013, mag: 30, reserve: Infinity, reload: 2.3, kick: 0.013, kickX: 0.006, back: 0.07, hip: [0.17, -0.2, -0.5], ads: [0, -0.118, -0.37], zoom: 0.8, adsMul: 0.3, snd: 'ak47', tracer: 0xffd08a, shell: true, ev: [[0.18, 'magout'], [0.6, 'magin'], [0.88, 'bolt']] },
];
WEAPONS.forEach(w => { w.vm = VM[w.id](); w.vm.g.visible = false; w.vm.g.scale.setScalar(0.85); wScene.add(w.vm.g); w.range = 250; });

const weap = { cur: 0, pending: 0, ammo: [], fireCd: 0, reloadT: -1, reloadEvIdx: 0, swT: 0, bloom: 0, ads: 0, held: false, kick: 0, sprint: 0, bobT: 0, swayX: 0, swayY: 0, flashT: 0, sinceShot: 9 };
const flashLight = new THREE.PointLight(0xffc880, 0, 14, 1.5); scene.add(flashLight);
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
  if (weap.reloadT >= 0 || weap.swT > 0 || a.mag >= w.mag) return;
  weap.reloadT = 0; weap.reloadEvIdx = 0;
}

function currentSpread() {
  const w = currentWeapon();
  let s = w.spread;
  const spd = Math.hypot(player.vx, player.vz);
  s *= (1 - weap.ads * (1 - w.adsMul));
  if (spd > 1) s *= player.sprinting ? 2.2 : 1.45;
  if (!player.grounded) s *= 2.5;
  if (player.crouch) s *= 0.7;
  return s + weap.bloom * (w.id === 'ak47' ? 0.03 : 0.02) * (1 - weap.ads * 0.6);
}

const _R = new THREE.Vector3(), _Uv = new THREE.Vector3(), _Fv = new THREE.Vector3();
function fireWeapon() {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  a.mag--; weap.fireCd = w.rate; stats.shots++;
  const e = camera.matrixWorld.elements;
  _R.set(e[0], e[1], e[2]); _Uv.set(e[4], e[5], e[6]); _Fv.set(-e[8], -e[9], -e[10]);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z, sp = currentSpread();
  const hipK = 1 - weap.ads;
  const mx = ox + _Fv.x * 0.9 + _R.x * 0.15 * hipK, my = oy + _Fv.y * 0.9 + _Uv.y * (-0.1 * hipK), mz = oz + _Fv.z * 0.9 + _R.z * 0.15 * hipK;
  const ang = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp, cr = Math.cos(ang) * r, sr = Math.sin(ang) * r;
  let dx = _Fv.x + _R.x * cr + _Uv.x * sr, dy = _Fv.y + _R.y * cr + _Uv.y * sr, dz = _Fv.z + _R.z * cr + _Uv.z * sr;
  const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
  const tw = rayWorld(ox, oy, oz, dx, dy, dz, w.range), nx = rayN.x, ny = rayN.y, nz = rayN.z;
  const hit = hitscanHumans(ox, oy, oz, dx, dy, dz, tw);
  let endT = tw;
  if (hit) {
    endT = hit.t;
    const res = damageHuman(hit, w.dmg, { x: dx, y: dy, z: dz }, w.id);
    registerHit(hit.zone === 'head', res.killed, true);
    if (hit.t < tw && Math.random() < (w.id === 'ak47' ? 0.75 : 0.4)) wallImpact(ox + dx * tw, oy + dy * tw, oz + dz * tw, nx, ny, nz, false);   // round passes through
  } else if (tw < w.range) wallImpact(ox + dx * tw, oy + dy * tw, oz + dz * tw, nx, ny, nz, false);
  addTracer(mx, my, mz, ox + dx * Math.min(endT, 60), oy + dy * Math.min(endT, 60), oz + dz * Math.min(endT, 60), w.tracer, 0.018, 0.06);
  // recoil + feedback
  weap.kick = 1; weap.flashT = 0.055; weap.bloom = Math.min(1, weap.bloom + 0.16);
  const adsK = 1 - weap.ads * 0.45, kp = w.kick * adsK * rand(0.8, 1.25);
  player.pitch += kp; player.yaw += rand(-1, 1) * w.kickX * adsK;
  player.recAcc += kp * 0.55; weap.sinceShot = 0;
  player.shake = Math.max(player.shake, w.id === 'ak47' ? 0.22 : 0.12);
  flashLight.position.set(ox + _Fv.x * 1.2, oy + _Fv.y * 1.2, oz + _Fv.z * 1.2); flashLight.intensity = 2.6;
  muzzleSprite.material.rotation = Math.random() * TAU;
  const ms = (w.id === 'ak47' ? 0.4 : 0.28) * (1 - weap.ads * 0.5); muzzleSprite.scale.set(ms, ms, 1);
  emit(ox + _Fv.x * 0.5 + _R.x * 0.2, oy + _Fv.y * 0.5 - 0.08, oz + _Fv.z * 0.5 + _R.z * 0.2, 1, { color: 0xe0a840, speed: 2.8, life: 1.0, size: 0.035, grav: 16, dir: { x: _R.x + _Uv.x, y: _R.y + _Uv.y, z: _R.z + _Uv.z }, cone: 0.5, hdr: 1.4 });
  sfx(w.snd);
  startleAll(0.45);
}

function updateWeapon(dt, input) {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  weap.fireCd = Math.max(0, weap.fireCd - dt);
  weap.bloom = Math.max(0, weap.bloom - dt * 1.6);
  if (weap.flashT > 0) weap.flashT -= dt;
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 40);
  weap.kick = Math.max(0, weap.kick - dt * 9);

  if (weap.swT > 0) {
    const before = weap.swT; weap.swT = Math.max(0, weap.swT - dt);
    if (before > 0.15 && weap.swT <= 0.15) { weap.cur = weap.pending; WEAPONS.forEach((x, i) => x.vm.g.visible = i === weap.cur); }
  }
  if (weap.reloadT >= 0) {
    weap.reloadT += dt;
    const p = weap.reloadT / w.reload;
    while (weap.reloadEvIdx < w.ev.length && p >= w.ev[weap.reloadEvIdx][0]) sfx(w.ev[weap.reloadEvIdx++][1]);
    if (p >= 1) { a.mag = w.mag; weap.reloadT = -1; }
  }
  const canShoot = weap.swT <= 0 && weap.reloadT < 0;
  const wantsFire = input.fire && (w.auto || !weap.held);
  weap.held = input.fire;
  if (wantsFire && canShoot && weap.fireCd <= 0) {
    if (a.mag > 0) fireWeapon();
    else { weap.fireCd = 0.25; sfx('empty'); startReload(); }
  }
  if (input.reload) startReload();
  if (a.mag <= 0 && canShoot && weap.fireCd <= 0) startReload();

  const wantAds = input.ads && weap.reloadT < 0 && weap.swT <= 0 && !player.sprinting;
  weap.ads += ((wantAds ? 1 : 0) - weap.ads) * Math.min(1, dt * 12);
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
  weap.swayX += (-player.lookDX * 0.0009 - weap.swayX) * Math.min(1, dt * 10); weap.swayY += (player.lookDY * 0.0009 - weap.swayY) * Math.min(1, dt * 10);
  const sw = 1 - k * 0.8; x += clamp(weap.swayX, -0.04, 0.04) * sw; y += clamp(weap.swayY, -0.04, 0.04) * sw; ry += clamp(weap.swayX, -0.04, 0.04) * 1.5 * sw; rx += clamp(weap.swayY, -0.04, 0.04) * sw;
  y -= weap.sprint * 0.07; x -= weap.sprint * 0.06; ry += weap.sprint * 0.55; rx += weap.sprint * 0.12; rz += weap.sprint * 0.12;
  if (weap.swT > 0) { const t = 1 - Math.abs(weap.swT - 0.15) / 0.15; y -= t * 0.38; rx -= t * 0.5; }
  if (weap.reloadT >= 0) {
    const p = clamp(weap.reloadT / w.reload, 0, 1), s = Math.sin(Math.PI * Math.min(1, p * 1.05));
    y -= s * 0.1; rx += s * 0.35; rz += s * 0.45; x -= s * 0.04;
    if (vm.mag) { const drop = p > 0.15 && p < 0.55 ? Math.min(1, (p - 0.15) / 0.12) : p >= 0.55 && p < 0.7 ? 1 - (p - 0.55) / 0.15 : 0; vm.mag.position.y = vm.magY - drop * 0.22; vm.mag.visible = !(p > 0.28 && p < 0.55); }
  } else if (vm.mag) { vm.mag.position.y = vm.magY; vm.mag.visible = true; }
  if (vm.slide) vm.slide.position.z = vm.slideZ + (weap.kick > 0.4 ? 0.07 * weap.kick : 0);
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  if (weap.flashT > 0 && g.visible) { g.updateMatrixWorld(true); vm.muzzle.getWorldPosition(muzzleSprite.position); muzzleSprite.visible = true; muzzleSprite.material.opacity = weap.flashT / 0.055; }
  else muzzleSprite.visible = false;
}
