const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../three.min.js');
let randomSeed=1;const seededMath=Object.create(Math);seededMath.random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};
const sandbox = { window: { THREE: T }, THREE: T, Math:seededMath, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../marine-behavior.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../predator-fish.js'), 'utf8'), sandbox);

const originalCreate=sandbox.window.createMarineAgents;sandbox.window.createMarineAgents=(...args)=>{randomSeed=42;return originalCreate(...args);};
function makeSeeds(n = 60) {
  const seeds = [];
  let s = 1234567;
  const next = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    seeds.push([next(), next(), next(), next() * Math.PI * 2]);
  }
  return seeds;
}

// 1. Predator creation, finite-volume geometry, outward winding, density & pause checks
{
  const site = { group: { visible: true }, constrain() {} };
  const env = sandbox.window.createMarineEnvironment(T, site, null, null);
  const agents = sandbox.window.createMarineAgents(T, env, makeSeeds(30), [], null);
  const scene = new T.Group();
  const pred = sandbox.window.createPredatoryFish(T, scene, null, env, agents.schools);

  assert.equal(pred.animals.length, 1, '1 predator by default');
  const a0 = pred.animals[0];
  const bodyMesh = a0.root.children.find(c => c.name === 'body');
  assert.ok(bodyMesh && bodyMesh.geometry.boundingBox, 'Body mesh has bounding box');
  const bb = bodyMesh.geometry.boundingBox;
  assert.ok(bb.max.x - bb.min.x > 0.8, 'Finite body length');
  assert.ok(bb.max.y - bb.min.y > 0.25, 'Finite body height');
  assert.ok(bb.max.z - bb.min.z > 0.15, 'Finite body width');
  assert.ok(bodyMesh.geometry.attributes.color.count > 40, 'Vertex colors for species markings');

  // Zero time and pause check
  const pStart = a0.root.position.clone();
  pred.update(0, []);
  assert.equal(a0.root.position.distanceTo(pStart), 0, 'Zero time means no motion');
  pred.update(1.0, []);
  const pAfter1 = a0.root.position.clone();
  assert.ok(pAfter1.distanceTo(pStart) > 0 && pAfter1.distanceTo(pStart) < 0.2, 'Bounded first step');
  pred.update(1.0, []);
  assert.equal(a0.root.position.distanceTo(pAfter1), 0, 'Paused timestamp produces zero motion');

  // Density transitions do not teleport animal 0
  pred.setDensity(2, 1);
  assert.equal(pred.animals.length, 2, 'At most 2 at high density');
  pred.setDensity(5, 2);
  assert.equal(pred.animals.length, 2, 'Clamped to 2');
  assert.equal(pred.animals[0].root.position.distanceTo(pAfter1), 0, 'No teleporting on density change');

  // Patrol altitude 1-5 units above floor and bounded speed
  let t = 1.0;
  for (let step = 0; step < 300; step++) {
    t += 0.05;
    pred.update(t, []);
    for (const a of pred.animals) {
      const fy = env.floor(a.root.position.x, a.root.position.z);
      const clearance = a.root.position.y - fy;
      assert.ok(clearance >= 1.0 && clearance <= 5.0, `Clearance ${clearance} within 1-5 units`);
      assert.ok(a.velocity.length() <= 1.45, 'Predator speed bounded');
    }
  }
}

// 2. Approach vs retreat, distant fish unchanged, emergency escape & regroup
{
  const site = { group: { visible: true }, constrain() {} };
  const envA = sandbox.window.createMarineEnvironment(T, site, null, null);
  const envR = sandbox.window.createMarineEnvironment(T, site, null, null);
  const envBase = sandbox.window.createMarineEnvironment(T, site, null, null);
  const seeds = makeSeeds(45);
  const agentsApproach = sandbox.window.createMarineAgents(T, envA, seeds, [], null);
  const agentsRetreat = sandbox.window.createMarineAgents(T, envR, seeds, [], null);
  const agentsNone = sandbox.window.createMarineAgents(T, envBase, seeds, [], null);

  const targetFishIdx = 2; // school 2 lower habitat
  const fishPos = agentsApproach.fish[targetFishIdx].p.clone();
  const threatPos = fishPos.clone().add(new T.Vector3(-2.1, 0, 0));

  const threatApproaching = [{
    kind: 'predator',
    p: threatPos.clone(),
    v: new T.Vector3(1.15, 0, 0),
    radius: 0.85
  }];
  const threatRetreating = [{
    kind: 'predator',
    p: threatPos.clone(),
    v: new T.Vector3(-1.15, 0, 0),
    radius: 0.85
  }];

  agentsApproach.update(0, threatApproaching, 45, null);
  agentsRetreat.update(0, threatRetreating, 45, null);
  agentsNone.update(0, [], 45, null);

  for (let k = 1; k <= 12; k++) {
    const t = k / 30;
    agentsApproach.update(t, threatApproaching, 45, null);
    agentsRetreat.update(t, threatRetreating, 45, null);
    agentsNone.update(t, [], 45, null);
  }

  const fApp = agentsApproach.fish[targetFishIdx];
  const fRet = agentsRetreat.fish[targetFishIdx];
  const distApp = fApp.p.distanceTo(threatPos);
  const distRet = fRet.p.distanceTo(threatPos);
  assert.ok(distApp > distRet, 'Approaching predator elicits stronger escape than retreating predator');

  // Distant school 1 fish at (30, 4, -23) must be completely unchanged
  const distantIdx = 1;
  assert.equal(
    agentsApproach.fish[distantIdx].p.distanceTo(agentsNone.fish[distantIdx].p),
    0,
    'Distant fish trajectory is unchanged'
  );

  // Recovery and regroup after predator leaves
  for (let k = 13; k <= 120; k++) {
    const t = k / 30;
    agentsApproach.update(t, [], 45, null);
    assert.ok(fApp.v.length() <= fApp.pace * 2.75, 'Fish speed remains bounded during escape and recovery');
  }
  assert.notEqual(fApp.mode, 'escape', 'Fish recovers from escape after predator departs');
}

// Shared interaction integration uses absolute animation time and both pool members.
{
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../animal-interaction.js'),'utf8'),sandbox);
 const camera=new T.PerspectiveCamera();camera.position.set(0,3,27);
 const env=sandbox.window.createMarineEnvironment(T,{group:{visible:true},constrain(){}},null,camera);
 const pred=sandbox.window.createPredatoryFish(T,new T.Group(),null,env,[]);
 const system=sandbox.window.createAnimalInteraction(T,camera,env);
 const entries=pred.pool.map(a=>system.register({root:a.root,radius:a.radius,rotatable:true,nativeVelocity:a.velocity,onGrab(){a.root.userData.grabbed=true;},onRelease(){a.root.userData.grabbed=false;}}));
 pred.setDensity(1,1);assert.equal(pred.animals.length,2,'normalized high density enables second fish');
 pred.update(0);pred.update(1);const a=pred.pool[1],start=a.root.position.clone();
 assert(system.grab(entries[1],start));system.target.copy(start).add(new T.Vector3(0,8,4));
 for(let i=1;i<=90;i++)pred.update(1+i/30);
 assert(a.root.position.y>start.y+4,'second predator follows held target');
 system.release();let prev=a.root.position.clone();
 for(let i=1;i<=90;i++){pred.update(4+i/30);assert(a.root.position.distanceTo(prev)<.3,'release never teleports to patrol depth');prev.copy(a.root.position);}
 pred.setVisible(false);pred.update(8);assert(!pred.group.visible);pred.setVisible(true);assert(pred.group.visible);
}
console.log('All predator-fish and marine-behavior tests passed.');
