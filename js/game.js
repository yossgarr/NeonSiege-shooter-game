'use strict';
/* =========================================================
   GAME — renderer, player, input, waves, pickups, HUD, loop
   ========================================================= */
const $ = id => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(82, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* ---------------- settings ---------------- */
const settings = { sens: 4, fov: 82, vol: 70, shadow: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('neonsiege.settings') || '{}')); } catch (e) { }
function applySettings() {
  setVolume(settings.vol / 100);
  sun.castShadow = settings.shadow;
  try { localStorage.setItem('neonsiege.settings', JSON.stringify(settings)); } catch (e) { }
}
[['optSens', 'oSens', 'sens'], ['optFov', 'oFov', 'fov'], ['optVol', 'oVol', 'vol']].forEach(([i, o, k]) => {
  const el = $(i); el.value = settings[k]; $(o).textContent = settings[k];
  el.addEventListener('input', () => { settings[k] = +el.value; $(o).textContent = el.value; applySettings(); });
});
$('optShadow').checked = settings.shadow;
$('optShadow').addEventListener('change', e => { settings.shadow = e.target.checked; applySettings(); });
applySettings();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = wCamera.aspect = w / h;
  camera.updateProjectionMatrix(); wCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* ---------------- state ---------------- */
const TEST = /[?&]test/.test(location.search);
let state = 'menu';                    // menu | playing | paused | over
const player = {
  x: 0, z: 22, feetY: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, eye: 1.7, grounded: true, sprinting: false, crouch: false,
  hp: 100, armor: 0, alive: true, shake: 0, lookDX: 0, lookDY: 0, stepD: 0, roll: 0, landDip: 0, bobT: 0, deathT: 0, recAcc: 0,
};
const stats = { shots: 0, hits: 0, heads: 0, kills: 0, score: 0 };
const input = { fire: false, ads: false, reload: false };
const keys = {};
let combo = 0, comboT = 0, gameTime = 0;
const waveState = { n: 0, queue: [], spawnT: 0, interT: 0, active: false, banner: 0 };
let best = 0; try { best = +localStorage.getItem('neonsiege.best') || 0; } catch (e) { }
$('hs').textContent = best ? 'REKOR: ' + best : '';

/* ---------------- HUD refs ---------------- */
const H = {
  hud: $('hud'), vig: $('vignette'), lowhp: $('lowhp'), dirs: $('dirs'), hit: $('hit'), banner: $('banner'), bTitle: $('bTitle'), bSub: $('bSub'),
  popups: $('popups'), hint: $('hint'), msg: $('msg'), scope: $('scope'), flash: $('flash'), cross: $('crosshair'), fps: $('fps'),
  hpBar: $('hp'), arBar: $('ar'), ammo: $('ammo'), wname: $('wname'), slots: $('slots'),
  sWave: $('sWave'), sScore: $('sScore'), sKills: $('sKills'), sLeft: $('sLeft'),
  chL: $('chL'), chR: $('chR'), chT: $('chT'), chB: $('chB'),
  radar: $('radar').getContext('2d'),
};
WEAPONS.forEach((w, i) => { const s = document.createElement('div'); s.className = 'slot'; s.textContent = (i + 1) + ' ' + w.id.toUpperCase(); H.slots.appendChild(s); });
let hurtV = 0, hitTimer = 0, msgTimer = 0;

function showBanner(title, sub, ms = 2600) {
  H.bTitle.textContent = title; H.bSub.textContent = sub || '';
  H.banner.classList.add('on'); clearTimeout(showBanner.t); showBanner.t = setTimeout(() => H.banner.classList.remove('on'), ms);
}
function showMsg(text, ms = 2200) {
  H.msg.textContent = text; H.msg.classList.add('on'); clearTimeout(showMsg.t); showMsg.t = setTimeout(() => H.msg.classList.remove('on'), ms);
}
function popup(text, head) {
  const d = document.createElement('div'); d.className = 'pop' + (head ? ' head' : ''); d.textContent = text;
  d.style.setProperty('--x', rand(-20, 70) + 'px'); d.style.left = '60px'; d.style.top = rand(-70, -20) + 'px';
  H.popups.appendChild(d); setTimeout(() => d.remove(), 1100);
}

/* ---------------- input ---------------- */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (state !== 'playing') return;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'KeyM') { SND.musicOn = !SND.musicOn; showMsg(SND.musicOn ? 'MUSIK: ON' : 'MUSIK: OFF', 1000); }
  const n = e.code.match(/^Digit([1-4])$/); if (n) switchWeapon(+n[1] - 1);
  if (e.code === 'KeyQ') switchWeapon(weap.cur + 1);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.fire = input.ads = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousedown', e => {
  if (state !== 'playing') return;
  if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true;
});
document.addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
document.addEventListener('wheel', e => { if (state === 'playing' && Math.abs(e.deltaY) > 1) switchWeapon(weap.cur + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('mousemove', e => {
  if (state !== 'playing' || !(document.pointerLockElement === canvas || TEST)) return;
  const w = currentWeapon(), zoom = lerp(1, w.zoom, weap.ads), s = 0.0005 * settings.sens * zoom;
  player.yaw -= e.movementX * s; player.pitch -= e.movementY * s;
  player.pitch = clamp(player.pitch, -1.5, 1.5);
  player.lookDX += e.movementX; player.lookDY += e.movementY;
});

function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    if (state === 'paused') { state = 'playing'; $('pause').classList.remove('on'); SND.paused = false; }
  } else if (state === 'playing' && player.alive) pauseGame();
});
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused'; SND.paused = true; input.fire = input.ads = false;
  $('pause').classList.add('on');
}
$('btnResume').onclick = () => { lockPointer(); if (TEST) { state = 'playing'; $('pause').classList.remove('on'); SND.paused = false; } };
$('pause').addEventListener('mousedown', e => { if (e.target.id === 'pause') lockPointer(); });
$('btnStart').onclick = () => { initAudio(); startGame(); lockPointer(); };
$('btnRestart').onclick = () => { startGame(); lockPointer(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

/* ---------------- game flow ---------------- */
function startGame() {
  initAudio();
  state = 'playing'; SND.paused = false;
  Object.assign(player, { x: 0, z: 22, feetY: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, eye: 1.7, grounded: true, sprinting: false, crouch: false, hp: 100, armor: 0, alive: true, shake: 0, roll: 0, landDip: 0, deathT: 0, recAcc: 0 });
  Object.assign(stats, { shots: 0, hits: 0, heads: 0, kills: 0, score: 0 });
  Object.assign(waveState, { n: 0, queue: [], spawnT: 0, interT: 3.2, active: false });
  combo = 0; comboT = 0; gameTime = 0; hurtV = 0;
  clearEnemies(); clearPickups(); clearHoles(); resetWeapons();
  H.dirs.innerHTML = ''; H.popups.innerHTML = '';
  ['menu', 'pause', 'over'].forEach(id => $(id).classList.remove('on'));
  H.hud.classList.add('on');
  SND.intensity = 0;
  showBanner('GET READY', 'BERTAHANLAH!', 2800);
  flowTimer = 0;
}
function gameOver() {
  state = 'over';
  if (document.pointerLockElement) document.exitPointerLock();
  H.hud.classList.remove('on');
  const newBest = stats.score > best; if (newBest) { best = stats.score; try { localStorage.setItem('neonsiege.best', best); } catch (e) { } }
  $('rWave').textContent = Math.max(1, waveState.n); $('rScore').textContent = stats.score; $('rKills').textContent = stats.kills;
  $('rHead').textContent = stats.heads; $('rAcc').textContent = (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%';
  $('rBest').textContent = best + (newBest ? ' ★' : '');
  $('hs').textContent = 'REKOR: ' + best;
  $('over').classList.add('on');
}

/* ---------------- combat callbacks ---------------- */
function hurtPlayer(dmg, src) {
  if (!player.alive || TEST_GOD) return;
  if (player.armor > 0) { const ab = Math.min(player.armor, dmg * 0.6); player.armor -= ab; dmg -= ab; }
  player.hp -= dmg;
  hurtV = Math.min(1, hurtV + 0.25 + dmg / 40);
  player.shake = Math.max(player.shake, 0.5);
  sfx('hurt');
  if (src) {
    const dx = src.x - player.x, dz = src.z - player.z;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const d = document.createElement('div'); d.className = 'dir'; d.style.transform = `rotate(${a}rad)`; H.dirs.appendChild(d);
    requestAnimationFrame(() => d.style.opacity = 0); setTimeout(() => d.remove(), 1000);
  }
  if (player.hp <= 0) { player.hp = 0; player.alive = false; player.deathT = 0; input.fire = input.ads = false; sfx('kill'); showMsg('', 1); }
}
let TEST_GOD = false;

function registerHit(head, killed, first) {
  if (first) { stats.hits++; }
  if (head) stats.heads += killed ? 1 : 0;
  sfx(head ? 'head' : 'hit');
  H.hit.classList.remove('on', 'head'); void H.hit.getBoundingClientRect();
  H.hit.classList.add('on'); if (head || killed) H.hit.classList.add('head');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => H.hit.classList.remove('on'), 90);
}
function onEnemyKilled(e, head) {
  stats.kills++;
  combo = comboT > 0 ? combo + 1 : 1; comboT = 3.5;
  const mult = 1 + Math.min(combo - 1, 5) * 0.2;
  const pts = Math.round((e.def.score + (head ? 50 : 0)) * mult);
  stats.score += pts;
  popup('+' + pts + (head ? ' HEADSHOT' : '') + (combo > 1 ? '  x' + mult.toFixed(1) : ''), head);
  const dropN = e.type === 'heavy' ? 2 : Math.random() < ({ grunt: 0.2, runner: 0.12, drone: 0.25 }[e.type]) ? 1 : 0;
  for (let i = 0; i < dropN; i++) {
    const r = Math.random(), low = player.hp < 50;
    spawnPickup(r < (low ? 0.55 : 0.3) ? 'health' : r < 0.82 ? 'ammo' : 'armor', e.x + rand(-1, 1), e.z + rand(-1, 1));
  }
}

/* ---------------- pickups ---------------- */
const pickups = [];
const PICK = {
  health: { color: 0x3dff8b, make: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), new THREE.MeshStandardMaterial({ color: 0xeaffef, emissive: 0x1a8f4a, roughness: 0.3, metalness: 0.2 }))); const m = new THREE.MeshBasicMaterial({ color: 0x20e070 }); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), m), new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), m), new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), m)); return g; } },
  ammo:   { color: 0xffc531, make: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0x4a5236, emissive: 0x2a2208, roughness: 0.5, metalness: 0.4 }))); const m = new THREE.MeshBasicMaterial({ color: 0xffc531 }); const a = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.36), m); a.position.y = 0.06; g.add(a); for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), m); b.position.set(i * 0.12, 0.28, 0); g.add(b); } return g; } },
  armor:  { color: 0x19f0ff, make: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.36), new THREE.MeshStandardMaterial({ color: 0x1b8cff, emissive: 0x0a5a8a, roughness: 0.2, metalness: 0.8 }))); const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: 0x19f0ff })); r.rotation.x = Math.PI / 2; g.add(r); return g; } },
};
function spawnPickup(type, x, z) {
  const p = PICK[type], g = new THREE.Group(); g.add(p.make());
  const glow = makeGlow(p.color, 1.1); glow.material.opacity = 0.7; glow.position.y = 0.05; g.add(glow);
  const ring = makeGlow(p.color, 1.7); ring.material.opacity = 0.35; ring.position.y = -0.55; g.add(ring);
  const pos = { x: clamp(x, -ARENA + 1.5, ARENA - 1.5), z: clamp(z, -ARENA + 1.5, ARENA - 1.5) };
  resolveCircle(pos, 0.5, 0, 0.1);
  g.position.set(pos.x, 0.9, pos.z); scene.add(g);
  pickups.push({ type, x: pos.x, z: pos.z, g, life: 28, t: Math.random() * 6 });
}
function clearPickups() { for (const p of pickups) scene.remove(p.g); pickups.length = 0; }
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.life -= dt;
    p.g.rotation.y += dt * 1.8; p.g.position.y = 0.9 + Math.sin(p.t * 2.5) * 0.12;
    p.g.visible = p.life > 6 || Math.floor(p.life * 5) % 2 === 0;
    let take = false;
    const dx = p.x - player.x, dz = p.z - player.z;
    if (dx * dx + dz * dz < 1.6 && player.alive && Math.abs(player.feetY - 0) < 3.5) {
      if (p.type === 'health' && player.hp < 100) { player.hp = Math.min(100, player.hp + 35); take = true; popup('+35 HP'); }
      else if (p.type === 'armor' && player.armor < 100) { player.armor = Math.min(100, player.armor + 45); take = true; popup('+ARMOR'); }
      else if (p.type === 'ammo') { addAmmo(0.28); take = true; popup('+AMMO'); }
    }
    if (take) { sfx('pickup'); addFlash(p.x, 1, p.z, PICK[p.type].color, 2.5, 0.3, 1); }
    if (take || p.life <= 0) { scene.remove(p.g); pickups.splice(i, 1); }
  }
}

/* ---------------- waves ---------------- */
const SPAWNS = [[-26, -26], [26, -26], [-26, 26], [26, 26], [0, -27], [0, 27], [-27, 0], [27, 0], [-27, -14], [27, 14], [-14, 27], [14, -27], [-14, -27], [27, -14], [-27, 14], [14, 27]];
function startWave(n) {
  const q = [];
  const add = (t, c) => { for (let i = 0; i < c; i++) q.push(t); };
  add('grunt', Math.min(4 + 2 * (n - 1), 22));
  if (n >= 2) add('runner', Math.min(1 + Math.floor((n - 1) * 1.5), 14));
  if (n >= 3) add('heavy', Math.min(Math.floor((n - 1) / 2), 6));
  if (n >= 4) add('drone', Math.min(n - 2, 10));
  for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
  Object.assign(waveState, { n, queue: q, spawnT: 1.0, active: true });
  SND.intensity = Math.min(5, n);
  const sub = n === 1 ? 'GRUNT' : n === 2 ? 'RUNNER MUNCUL' : n === 3 ? 'HEAVY MUNCUL' : n === 4 ? 'DRONE MUNCUL' : q.length + ' MUSUH';
  showBanner('WAVE ' + n, sub);
  sfx('wave');
}
function pickSpawn() {
  const cand = SPAWNS.filter(([x, z]) => Math.hypot(x - player.x, z - player.z) > 17);
  const list = cand.length ? cand : SPAWNS;
  for (let i = 0; i < 8; i++) {
    const [sx, sz] = list[(Math.random() * list.length) | 0], x = sx + rand(-1.5, 1.5), z = sz + rand(-1.5, 1.5);
    if (!navBlocked[navCell(z) * NAV_N + navCell(x)]) return { x, z };
  }
  return randomFreeSpot(player, 18);
}
function updateWaves(dt) {
  if (!player.alive) return;
  if (comboT > 0) comboT -= dt;
  const w = waveState;
  if (!w.active) {
    w.interT -= dt;
    if (w.interT <= 0) startWave(w.n + 1);
    return;
  }
  w.spawnT -= dt;
  const maxAlive = Math.min(6 + w.n * 2, 16);
  if (w.queue.length && w.spawnT <= 0 && enemies.length < maxAlive) {
    const p = pickSpawn(); spawnEnemy(w.queue.pop(), p.x, p.z, w.n);
    w.spawnT = Math.max(0.35, 1.0 - w.n * 0.06);
  }
  if (!w.queue.length && enemies.length === 0) {
    w.active = false; w.interT = 6.5;
    const bonus = 400 * w.n; stats.score += bonus;
    player.hp = Math.min(100, player.hp + 20);
    showBanner('WAVE ' + w.n + ' SELESAI', '+' + bonus + ' BONUS', 3200);
    sfx('clear');
    for (let i = 0; i < 2; i++) { const s = randomFreeSpot(null, 0); spawnPickup(i ? 'ammo' : 'health', s.x * 0.5, s.z * 0.5); }
    const s = randomFreeSpot(null, 0); spawnPickup(Math.random() < 0.5 ? 'armor' : 'ammo', s.x * 0.5, s.z * 0.5);
  }
}

/* ---------------- flow field refresh ---------------- */
let flowTimer = 0, flowCell = -1;
function updateFlow(dt) {
  flowTimer -= dt;
  const cell = navCell(player.z) * NAV_N + navCell(player.x);
  if (flowTimer <= 0 || cell !== flowCell && flowTimer < 0.15) { computeFlow(player.x, player.z); flowTimer = 0.3; flowCell = cell; }
}

/* ---------------- player ---------------- */
const PR = 0.38;
function updatePlayer(dt) {
  const w = currentWeapon();
  if (!player.alive) {                          // death cam
    player.deathT += dt;
    const k = Math.min(1, player.deathT / 0.9);
    player.eye = lerp(player.eye, 0.35, Math.min(1, dt * 5));
    player.roll = lerp(player.roll, 0.9, Math.min(1, dt * 3)); player.pitch = lerp(player.pitch, -0.35, Math.min(1, dt * 2));
    player.vx *= 0.9; player.vz *= 0.9;
    if (player.deathT > 1.8 && state === 'playing') gameOver();
  } else {
    const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const st = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    player.crouch = !!(keys.KeyC || keys.ControlLeft);
    player.sprinting = !!keys.ShiftLeft && fw > 0 && !player.crouch && weap.ads < 0.3;
    const eyeT = player.crouch ? 1.15 : 1.7; player.eye += (eyeT - player.eye) * Math.min(1, dt * 12);
    let speed = player.crouch ? 3.3 : player.sprinting ? 9.8 : 6.6;
    speed *= 1 - weap.ads * 0.35;
    const accel = player.grounded ? 13 : 2.2, k = 1 - Math.exp(-accel * dt);
    player.vx += (wx * speed - player.vx) * k; player.vz += (wz * speed - player.vz) * k;
    if (keys.Space && player.grounded) { player.vy = 8.4; player.grounded = false; sfx('jump'); }
    player.roll += (-st * 0.014 - player.roll) * Math.min(1, dt * 8);
  }
  // horizontal
  const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt, p = { x: nx, z: nz };
  resolveCircle(p, PR, player.feetY, 0.4);
  if (Math.abs(p.x - nx) > 1e-4) player.vx = 0;     // blocked: slide along the wall
  if (Math.abs(p.z - nz) > 1e-4) player.vz = 0;
  player.x = p.x; player.z = p.z;
  // vertical
  player.vy -= 26 * dt;
  const prevVy = player.vy;
  player.feetY += player.vy * dt;
  const g = groundAt(player.x, player.z, PR, player.feetY, 0.4);
  if (player.feetY <= g && player.vy <= 0) {
    if (!player.grounded && prevVy < -7) { sfx('land', null, clamp(-prevVy / 14, 0.3, 1)); player.landDip = Math.min(0.28, -prevVy * 0.018); player.shake = Math.max(player.shake, 0.15); }
    player.feetY = g; player.vy = 0; player.grounded = true;
  } else if (player.feetY > g + 0.02) player.grounded = false;

  // footsteps + bob
  const spd = Math.hypot(player.vx, player.vz);
  if (player.grounded && spd > 1.5 && player.alive) {
    player.stepD += spd * dt; player.bobT += dt * spd * 1.15;
    if (player.stepD > (player.sprinting ? 3.2 : 2.5)) { player.stepD = 0; sfx('step', null, player.crouch ? 0.3 : 0.7); }
  }
  // recoil recovery
  weap.sinceShot = (weap.sinceShot || 0) + dt;
  if (player.recAcc > 0 && weap.sinceShot > 0.16) { const r = player.recAcc * Math.min(1, dt * 5); player.pitch -= r; player.recAcc -= r; }
  player.pitch = clamp(player.pitch, -1.5, 1.5);

  // camera
  player.landDip += (0 - player.landDip) * Math.min(1, dt * 9);
  player.shake = Math.max(0, player.shake - dt * 3.2);
  const bobY = player.grounded && player.alive ? Math.sin(player.bobT * 2) * 0.035 * Math.min(1, spd / 6) : 0;
  const bobX = player.grounded && player.alive ? Math.cos(player.bobT) * 0.02 * Math.min(1, spd / 6) : 0;
  camera.position.set(player.x + Math.cos(player.yaw) * bobX, player.feetY + player.eye + bobY - player.landDip, player.z - Math.sin(player.yaw) * bobX);
  const sh = player.shake * 0.012;
  camera.rotation.set(player.pitch + rand(-sh, sh), player.yaw + rand(-sh, sh), player.roll + rand(-sh, sh) * 2);
  const fovT = settings.fov * lerp(1, w.zoom, weap.ads) + (player.sprinting ? 5 : 0);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

/* ---------------- HUD ---------------- */
const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
function updateHUD(dt) {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  setText(H.sWave, 'wave', Math.max(1, waveState.n)); setText(H.sScore, 'score', stats.score); setText(H.sKills, 'kills', stats.kills);
  setText(H.sLeft, 'left', waveState.active ? enemies.length + waveState.queue.length : '—');
  H.hpBar.firstElementChild.style.transform = `scaleX(${clamp(player.hp / 100, 0, 1)})`; H.hpBar.lastElementChild.textContent = Math.ceil(player.hp);
  H.arBar.firstElementChild.style.transform = `scaleX(${clamp(player.armor / 100, 0, 1)})`; H.arBar.lastElementChild.textContent = Math.ceil(player.armor);
  H.hpBar.classList.toggle('low', player.hp < 30 && player.alive);
  H.lowhp.style.display = player.hp < 30 && player.alive ? 'block' : 'none';
  setText(H.wname, 'wname', w.name);
  const reloading = weap.reloadT >= 0;
  const ah = (reloading ? '<span style="opacity:.5">RELOAD</span>' : a.mag) + '<small>/ ' + a.reserve + '</small>';
  if (cache.ammo !== ah) { cache.ammo = ah; H.ammo.innerHTML = ah; }
  H.ammo.classList.toggle('empty', a.mag === 0 && !reloading);
  [...H.slots.children].forEach((s, i) => s.classList.toggle('act', i === weap.cur));
  const lowAmmo = a.mag <= Math.ceil(w.mag * 0.25) && a.reserve > 0 && !reloading;
  H.hint.textContent = a.mag === 0 && a.reserve === 0 ? 'HABIS AMUNISI — GANTI SENJATA' : 'RELOAD  [R]';
  H.hint.classList.toggle('on', (lowAmmo || (a.mag === 0 && a.reserve === 0)) && player.alive);
  // damage vignette
  hurtV = Math.max(0, hurtV - dt * 1.1); H.vig.style.opacity = hurtV;
  // crosshair
  const spreadPx = Math.tan(currentSpread()) * (window.innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360);
  const gap = 5 + spreadPx + weap.kick * 4;
  H.chL.style.transform = `translateX(${-gap - 9}px)`; H.chR.style.transform = `translateX(${gap}px)`;
  H.chT.style.transform = `translateY(${-gap - 9}px)`; H.chB.style.transform = `translateY(${gap}px)`;
  const scoped = !!(w.scope && weap.ads > 0.9);
  H.cross.classList.toggle('hide', scoped || !player.alive); H.scope.classList.toggle('on', scoped);
  // target colour
  const e = camera.matrixWorld.elements, dx = -e[8], dy = -e[9], dz = -e[10];
  const tw = rayWorld(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, 120);
  const th = hitscanEnemies(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, tw);
  const col = th.length ? '#ff3b4e' : '#fff';
  if (cache.cross !== col) { cache.cross = col; [H.chL, H.chR, H.chT, H.chB].forEach(c => c.style.background = col); }
}
let radarT = 0;
function drawRadar(dt) {
  radarT -= dt; if (radarT > 0) return; radarT = 0.045;
  const c = H.radar, R = 82, s = R / 27;
  c.clearRect(0, 0, 164, 164);
  c.fillStyle = 'rgba(4,10,20,.65)'; c.fillRect(0, 0, 164, 164);
  c.save(); c.translate(R, R); c.rotate(player.yaw); c.scale(s, s); c.translate(-player.x, -player.z);
  c.fillStyle = 'rgba(25,240,255,.18)'; c.strokeStyle = 'rgba(25,240,255,.55)'; c.lineWidth = 0.15;
  for (const b of boxes) { c.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ); c.strokeRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ); }
  for (const p of pickups) { c.fillStyle = '#' + PICK[p.type].color.toString(16).padStart(6, '0'); c.fillRect(p.x - 0.5, p.z - 0.5, 1, 1); }
  for (const e of enemies) {
    c.fillStyle = e.type === 'heavy' ? '#c060ff' : e.type === 'drone' ? '#40e0ff' : '#ff3b4e';
    c.beginPath(); c.arc(e.x, e.z, e.type === 'heavy' ? 1.3 : 0.9, 0, TAU); c.fill();
  }
  c.restore();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R, R - 6); c.lineTo(R - 4, R + 4); c.lineTo(R + 4, R + 4); c.closePath(); c.fill();
}

/* ---------------- main loop ---------------- */
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function menuCamera(t) {
  const a = t * 0.00008, r = 24;
  camera.position.set(Math.cos(a) * r, 9 + Math.sin(a * 3) * 1.2, Math.sin(a) * r);
  camera.lookAt(0, 2.2, 0); camera.fov = 70; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { H.fps.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = fpsN = 0; }
  tick(dt, now, true);
}
function tick(dt, now, doRender) {
  if (state === 'playing') {
    gameTime += dt;
    updatePlayer(dt);
    if (player.alive) { updateWeapon(dt, input); input.reload = false; }
    updateFlow(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateWaves(dt);
    updateEnemyBars();
    updateHUD(dt); drawRadar(dt);
  } else if (state === 'menu' || state === 'over') menuCamera(now);
  if (state !== 'paused') {
    updateParticles(dt); updateTracers(dt); updateFlashes(dt);
    if (state === 'menu' || state === 'over') { for (let i = 0; i < accentLights.length; i++) accentLights[i].intensity = 1.15 + Math.sin(now * 0.002 + i) * 0.2; }
  }
  if (doRender) {
    renderer.clear();
    renderer.render(scene, camera);
    if (state === 'playing' && player.alive) {
      animateViewmodel(dt);
      renderer.clearDepth(); renderer.render(wScene, wCamera);
    }
  }
  player.lookDX = player.lookDY = 0;
}
// test hook: advance the simulation by `sec` seconds at 60Hz (renders only the last frame)
function advance(sec, render = true) { const n = Math.max(1, Math.round(sec * 60)); for (let i = 0; i < n; i++) tick(1 / 60, performance.now(), render && i === n - 1); }

window.addEventListener('error', e => { $('err').textContent = 'ERROR: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno; });
window.G = { advance, keys, input, pickups, player, enemies, weap, stats, camera, scene, renderer, spawnEnemy, startGame, switchWeapon, fireWeapon, waveState, spawnPickup, setGod: v => TEST_GOD = v, hurtPlayer, state: () => state };
applySettings();
requestAnimationFrame(frame);
setTimeout(() => { $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 600); }, 400);
if (TEST) { startGame(); }
