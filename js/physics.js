'use strict';
/* =========================================================
   PHYSICS — cannon.js world used for ragdolls
   ========================================================= */
const physWorld = new CANNON.World();
physWorld.gravity.set(0, -9.82, 0);
physWorld.solver.iterations = 16;
physWorld.solver.tolerance = 0.001;
physWorld.allowSleep = true;
physWorld.defaultContactMaterial.contactEquationStiffness = 4e7;
physWorld.defaultContactMaterial.contactEquationRelaxation = 3;

const PH_WORLD = 1;                       // collision group of the room
const matWorld = new CANNON.Material('world'), matBody = new CANNON.Material('body');
physWorld.addContactMaterial(new CANNON.ContactMaterial(matWorld, matBody, { friction: 0.75, restitution: 0.02 }));
physWorld.addContactMaterial(new CANNON.ContactMaterial(matBody, matBody, { friction: 0.5, restitution: 0.0 }));

(function buildRoomColliders() {
  const planes = [[0, 1, 0, 0, 0, 0], [0, -1, 0, 0, ROOM_H, 0], [1, 0, 0, -ARENA, 0, 0], [-1, 0, 0, ARENA, 0, 0], [0, 0, 1, 0, 0, -ARENA], [0, 0, -1, 0, 0, ARENA]];
  planes.forEach(([nx, ny, nz, px, py, pz]) => {
    const b = new CANNON.Body({ mass: 0, material: matWorld, shape: new CANNON.Plane() });
    b.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(nx, ny, nz));
    b.position.set(nx ? px : 0, ny ? py : 0, nz ? pz : 0);
    b.collisionFilterGroup = PH_WORLD; b.collisionFilterMask = -1;
    physWorld.addBody(b);
  });
})();

// each ragdoll gets its own collision bit so its parts don't hit each other but do hit other ragdolls
const RAG_SLOTS = 14, ragSlotUsed = new Array(RAG_SLOTS).fill(false);
function allocRagSlot() { for (let i = 0; i < RAG_SLOTS; i++) if (!ragSlotUsed[i]) { ragSlotUsed[i] = true; return i; } return -1; }
function freeRagSlot(i) { if (i >= 0) ragSlotUsed[i] = false; }
function ragGroup(slot) { return 1 << (slot + 1); }
function ragMask(slot) { let m = PH_WORLD; for (let i = 0; i < RAG_SLOTS; i++) if (i !== slot) m |= ragGroup(i); return m; }

let physAccum = 0;
function stepPhysics(dt) {
  physAccum += dt;
  let n = 0;
  while (physAccum >= 1 / 60 && n < 4) { physWorld.step(1 / 60); physAccum -= 1 / 60; n++; }
  if (physAccum > 1 / 30) physAccum = 0;
}
