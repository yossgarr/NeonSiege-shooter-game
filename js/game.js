'use strict';
/* =========================================================
   GAME — renderer, player, input, spawning, HUD, loop
   ========================================================= */
const $ = id => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(82, 1, 0.05, 80);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* ---------------- settings ---------------- */
const settings = { sens: 4, fov: 80, vol: 70, shadow: true, slowmo: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('bloodtrail.settings') || '{}')); } catch (e) { }
function applySettings() {
  setVolume(settings.vol / 100);
  keyLight.castShadow = settings.shadow;
  try { localStorage.setItem('bloodtrail.settings', JSON.stringify(settings)); } catch (e) { }
}
[['optSens', 'oSens', 'sens'], ['optFov', 'oFov', 'fov'], ['optVol', 'oVol', 'vol']].forEach(([i, o, k]) => {
  const el = $(i); el.value = settings[k]; $(o).textContent = settings[k];
  el.addEventListener('input', () => { settings[k] = +el.value; $(o).textContent = el.value; applySettings(); });
});
[['optShadow', 'shadow'], ['optSlow', 'slowmo']].forEach(([i, k]) => { const el = $(i); el.checked = settings[k]; el.addEventListener('change', e => { settings[k] = e.target.checked; applySettings(); }); });
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
let state = 'menu';                    // menu | playing | paused
const player = {
  x: 0, z: ARENA - 1.3, feetY: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, eye: 1.7, grounded: true, sprinting: false, crouch: false,
  alive: true, shake: 0, lookDX: 0, lookDY: 0, stepD: 0, roll: 0, landDip: 0, bobT: 0, recAcc: 0,
};
const stats = { shots: 0, hits: 0, heads: 0, kills: 0 };
const input = { fire: false, ads: false, reload: false };
const keys = {};
let timeScale = 1, slowT = 0, lastKind = 'hostage';

/* ---------------- HUD refs ---------------- */
const H = {
  hud: $('hud'), hit: $('hit'), popups: $('popups'), msg: $('msg'), cross: $('crosshair'), fps: $('fps'), padHint: $('padHint'),
  ammo: $('ammo'), wname: $('wname'), slots: $('slots'), sAlive: $('sAlive'), sKills: $('sKills'), sHeads: $('sHeads'), sAcc: $('sAcc'),
  chL: $('chL'), chR: $('chR'), chT: $('chT'), chB: $('chB'), slow: $('slowTag'),
};
WEAPONS.forEach((w, i) => { const s = document.createElement('div'); s.className = 'slot'; s.textContent = (i + 1) + ' ' + w.name; H.slots.appendChild(s); });
let hitTimer = 0;

function showMsg(text, ms = 2200) {
  H.msg.textContent = text; H.msg.classList.add('on'); clearTimeout(showMsg.t); showMsg.t = setTimeout(() => H.msg.classList.remove('on'), ms);
}
function popup(text, head) {
  const d = document.createElement('div'); d.className = 'pop' + (head ? ' head' : ''); d.textContent = text;
  d.style.setProperty('--x', rand(-20, 70) + 'px'); d.style.left = '60px'; d.style.top = rand(-70, -20) + 'px';
  H.popups.appendChild(d); setTimeout(() => d.remove(), 1100);
}

/* ---------------- spawning ---------------- */
function aimedPad() {
  const e = camera.matrixWorld.elements, p = rayFloor(camera.position.x, camera.position.y, camera.position.z, -e[8], -e[9], -e[10]);
  if (!p) return null;
  let best = null, bd = 1.25;
  for (const pad of SPAWN_PADS) { const d = Math.hypot(pad.x - p.x, pad.z - p.z); if (d < bd) { bd = d; best = pad; } }
  return best;
}
function freePad(from = 0) {
  for (let k = 0; k < SPAWN_PADS.length; k++) { const p = SPAWN_PADS[(from + k) % SPAWN_PADS.length]; if (!p.human) return p; }
  return null;
}
let padCursor = 0;
function spawnKind(kind) {
  lastKind = kind;
  let pad = aimedPad();
  if (!pad || pad.human) pad = freePad(padCursor) || pad || SPAWN_PADS[padCursor % SPAWN_PADS.length];
  padCursor = (pad.i + 1) % SPAWN_PADS.length;
  spawnHuman(kind, pad.i);
}
function spawnAll() {
  SPAWN_PADS.forEach((p, i) => { if (!p.human) spawnHuman(Math.random() < 0.5 ? 'hostage' : 'standing', i); });
}
function clearAll() { clearHumans(); clearBlood(); clearHoles(); showMsg('RUANGAN DIBERSIHKAN', 1200); }

/* ---------------- input ---------------- */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (state !== 'playing') return;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'KeyM') { SND.musicOn = !SND.musicOn; setAmbient(SND.musicOn); showMsg(SND.musicOn ? 'SUARA RUANGAN: ON' : 'SUARA RUANGAN: OFF', 1000); }
  if (e.code === 'KeyF') spawnKind('standing');
  if (e.code === 'KeyG') spawnKind('hostage');
  if (e.code === 'KeyZ') spawnAll();
  if (e.code === 'KeyX') clearAll();
  if (e.code === 'KeyT') { settings.slowmo = !settings.slowmo; $('optSlow').checked = settings.slowmo; applySettings(); showMsg(settings.slowmo ? 'SLOW-MO HEADSHOT: ON' : 'SLOW-MO HEADSHOT: OFF', 1000); }
  const n = e.code.match(/^Digit([1-2])$/); if (n) switchWeapon(+n[1] - 1);
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
  } else if (state === 'playing') pauseGame();
});
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused'; SND.paused = true; input.fire = input.ads = false;
  $('pause').classList.add('on');
}
$('btnResume').onclick = () => { lockPointer(); if (TEST) { state = 'playing'; $('pause').classList.remove('on'); SND.paused = false; } };
$('pause').addEventListener('mousedown', e => { if (e.target.id === 'pause') lockPointer(); });
$('btnStart').onclick = () => { initAudio(); startGame(); lockPointer(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

/* ---------------- game flow ---------------- */
function startGame() {
  initAudio();
  state = 'playing'; SND.paused = false;
  Object.assign(player, { x: 0, z: ARENA - 1.3, feetY: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, eye: 1.7, grounded: true, sprinting: false, crouch: false, alive: true, shake: 0, roll: 0, landDip: 0, recAcc: 0 });
  Object.assign(stats, { shots: 0, hits: 0, heads: 0, kills: 0 });
  timeScale = 1; slowT = 0;
  clearHumans(); clearBlood(); clearHoles(); resetWeapons();
  H.popups.innerHTML = '';
  ['menu', 'pause'].forEach(id => $(id).classList.remove('on'));
  H.hud.classList.add('on');
  showMsg('ARAHKAN KE CINCIN BIRU  ·  [F] ORANG BERDIRI  ·  [G] SANDERA BERLUTUT', 4500);
}

/* ---------------- combat callbacks ---------------- */
function registerHit(head, killed, first) {
  if (first) stats.hits++;
  H.hit.classList.remove('on', 'head'); void H.hit.getBoundingClientRect();
  H.hit.classList.add('on'); if (head || killed) H.hit.classList.add('head');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => H.hit.classList.remove('on'), 90);
}
function onHumanKilled(h, head) {
  stats.kills++; if (head) stats.heads++;
  popup(head ? 'HEADSHOT' : (h.kind === 'hostage' ? 'EKSEKUSI' : 'TERTEMBAK'), head);
  if (head && settings.slowmo && state === 'playing') slowT = 0.55;
}

/* ---------------- player ---------------- */
const PR = 0.38;
function updatePlayer(dt) {
  const w = currentWeapon();
  const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const st = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
  const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
  player.crouch = !!(keys.KeyC || keys.ControlLeft);
  player.sprinting = !!keys.ShiftLeft && fw > 0 && !player.crouch && weap.ads < 0.3;
  const eyeT = player.crouch ? 1.15 : 1.7; player.eye += (eyeT - player.eye) * Math.min(1, dt * 12);
  let speed = player.crouch ? 3.0 : player.sprinting ? 7.4 : 4.6;
  speed *= 1 - weap.ads * 0.35;
  const accel = player.grounded ? 13 : 2.2, k = 1 - Math.exp(-accel * dt);
  player.vx += (wx * speed - player.vx) * k; player.vz += (wz * speed - player.vz) * k;
  if (keys.Space && player.grounded) { player.vy = 6.2; player.grounded = false; sfx('jump'); }
  player.roll += (-st * 0.014 - player.roll) * Math.min(1, dt * 8);

  const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt, p = { x: nx, z: nz };
  resolveCircle(p, PR, player.feetY, 0.4);
  for (const h of humans) {                                 // people are solid while alive
    if (h.state === 'ragdoll' || h.removed) continue;
    const dx = p.x - h.root.position.x, dz = p.z - h.root.position.z, d = Math.hypot(dx, dz), min = 0.55 + PR;
    if (d < min && d > 1e-4) { p.x = h.root.position.x + dx / d * min; p.z = h.root.position.z + dz / d * min; }
  }
  if (Math.abs(p.x - nx) > 1e-4) player.vx = 0;
  if (Math.abs(p.z - nz) > 1e-4) player.vz = 0;
  player.x = p.x; player.z = p.z;
  player.vy -= 22 * dt;
  const prevVy = player.vy;
  player.feetY += player.vy * dt;
  if (player.feetY <= 0 && player.vy <= 0) {
    if (!player.grounded && prevVy < -6) { sfx('land', null, clamp(-prevVy / 14, 0.3, 1)); player.landDip = Math.min(0.25, -prevVy * 0.018); }
    player.feetY = 0; player.vy = 0; player.grounded = true;
  } else if (player.feetY > 0.02) player.grounded = false;

  const spd = Math.hypot(player.vx, player.vz);
  if (player.grounded && spd > 1.5) {
    player.stepD += spd * dt; player.bobT += dt * spd * 1.15;
    if (player.stepD > (player.sprinting ? 3.2 : 2.5)) { player.stepD = 0; sfx('step', null, player.crouch ? 0.3 : 0.7); }
  }
  weap.sinceShot += dt;
  if (player.recAcc > 0 && weap.sinceShot > 0.16) { const r = player.recAcc * Math.min(1, dt * 5); player.pitch -= r; player.recAcc -= r; }
  player.pitch = clamp(player.pitch, -1.5, 1.5);

  player.landDip += (0 - player.landDip) * Math.min(1, dt * 9);
  player.shake = Math.max(0, player.shake - dt * 3.2);
  const bobY = player.grounded ? Math.sin(player.bobT * 2) * 0.035 * Math.min(1, spd / 6) : 0;
  const bobX = player.grounded ? Math.cos(player.bobT) * 0.02 * Math.min(1, spd / 6) : 0;
  camera.position.set(player.x + Math.cos(player.yaw) * bobX, player.feetY + player.eye + bobY - player.landDip, player.z - Math.sin(player.yaw) * bobX);
  const sh = player.shake * 0.012;
  camera.rotation.set(player.pitch + rand(-sh, sh), player.yaw + rand(-sh, sh), player.roll + rand(-sh, sh) * 2);
  const fovT = settings.fov * lerp(1, w.zoom, weap.ads) + (player.sprinting ? 4 : 0);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

/* ---------------- HUD ---------------- */
const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
let hudFrame = 0, aimedNow = null;
function updateHUD(dt) {
  const w = currentWeapon(), a = weap.ammo[weap.cur];
  setText(H.sAlive, 'alive', aliveHumans().length); setText(H.sKills, 'kills', stats.kills); setText(H.sHeads, 'heads', stats.heads);
  setText(H.sAcc, 'acc', (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%');
  setText(H.wname, 'wname', w.name);
  const reloading = weap.reloadT >= 0;
  const ah = (reloading ? '<span style="opacity:.5">RELOAD</span>' : a.mag) + '<small>/ ∞</small>';
  if (cache.ammo !== ah) { cache.ammo = ah; H.ammo.innerHTML = ah; }
  H.ammo.classList.toggle('empty', a.mag === 0 && !reloading);
  [...H.slots.children].forEach((s, i) => s.classList.toggle('act', i === weap.cur));
  H.slow.classList.toggle('on', timeScale < 0.8);
  // crosshair
  const spreadPx = Math.tan(currentSpread()) * (window.innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360);
  const gap = 5 + spreadPx + weap.kick * 4;
  H.chL.style.transform = `translateX(${-gap - 9}px)`; H.chR.style.transform = `translateX(${gap}px)`;
  H.chT.style.transform = `translateY(${-gap - 9}px)`; H.chB.style.transform = `translateY(${gap}px)`;
  // what are we looking at: person (red crosshair) or a spawn pad (hint)
  hudFrame++;
  if (hudFrame % 2 === 0) {
    const e = camera.matrixWorld.elements, dx = -e[8], dy = -e[9], dz = -e[10];
    const tw = rayWorld(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, 60);
    const th = hitscanHumans(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, tw);
    const col = th ? '#ff3b4e' : '#fff';
    if (cache.cross !== col) { cache.cross = col; [H.chL, H.chR, H.chT, H.chB].forEach(c => c.style.background = col); }
    aimedNow = th ? null : aimedPad();
  }
  for (const p of SPAWN_PADS) setPadState(p, p.human ? 'busy' : p === aimedNow ? 'aim' : 'free');
  const hint = aimedNow ? (aimedNow.human ? `CINCIN ${aimedNow.i + 1} TERISI  ·  [F]/[G] GANTI ORANG` : `CINCIN ${aimedNow.i + 1}  ·  [F] BERDIRI   [G] SANDERA`) : '';
  setText(H.padHint, 'padHint', hint); H.padHint.classList.toggle('on', !!hint);
}

/* ---------------- main loop ---------------- */
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function menuCamera(t) {
  const a = Math.sin(t * 0.00025) * 0.5;
  camera.position.set(Math.sin(a) * 2.5, 2.0, 5.8);
  camera.lookAt(Math.sin(a) * -1.2, 0.15, -2.4); camera.fov = 62; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { H.fps.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = fpsN = 0; }
  tick(dt, now, true);
}
function tick(dt, now, doRender) {
  // slow motion (headshot) eases in and out
  if (slowT > 0) { slowT -= dt; timeScale += (0.18 - timeScale) * Math.min(1, dt * 18); } else timeScale += (1 - timeScale) * Math.min(1, dt * 5);
  const wdt = state === 'paused' ? 0 : dt * timeScale;
  if (state === 'playing') {
    updatePlayer(dt);
    updateWeapon(dt, input); input.reload = false;
    updateHUD(dt);
  } else if (state === 'menu') menuCamera(now);
  if (state !== 'paused') {
    updateHumans(wdt); bloodUpdate(wdt);
    updateParticles(wdt); updateTracers(wdt); updateFlashes(wdt);
  }
  if (doRender) {
    renderer.clear();
    renderer.render(scene, camera);
    if (state === 'playing') {
      animateViewmodel(dt);
      renderer.clearDepth(); renderer.render(wScene, wCamera);
    }
  }
  player.lookDX = player.lookDY = 0;
}
// test hook: advance the simulation by `sec` seconds at 60Hz (renders only the last frame)
function advance(sec, render = true) { const n = Math.max(1, Math.round(sec * 60)); for (let i = 0; i < n; i++) tick(1 / 60, performance.now(), render && i === n - 1); }

window.addEventListener('error', e => { $('err').textContent = 'ERROR: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno; });
window.G = { advance, keys, input, player, weap, stats, camera, scene, renderer, humans, spawnHuman, clearHumans, startGame, switchWeapon, fireWeapon, state: () => state, spawnKind, spawnAll, clearAll, damageHuman, hitscanHumans, physWorld, BL, setTime: v => { timeScale = v; } };
applySettings();
// demo people in the menu background
spawnHuman('hostage', 4); spawnHuman('standing', 5); spawnHuman('standing', 3);
requestAnimationFrame(frame);
setTimeout(() => { $('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 600); }, 400);
if (TEST) { startGame(); }
