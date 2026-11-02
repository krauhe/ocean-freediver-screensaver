const assert = require('node:assert/strict');
const T = require('../three.min.js');
global.window = global;
require('../freediver-physics.js');
const vec = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const create = (depth = 20) => createFreediverPhysics(T, {position: vec(0, 15 - depth, 0)});
const stepFor = (body, seconds, command, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    body.step(dt, command);
    assert(Number.isFinite(body.position.lengthSq()));
    assert(Math.abs(body.quaternion.length() - 1) < 1e-8);
    assert(body.angularVelocity.length() <= body.config.maxAngularSpeed + 1e-8);
    assert(Math.abs(body.state.thrust) <= body.config.maxThrust + 1e-8);
  }
};
const probe = create();
assert(probe.buoyancy(0) > 0, 'positive surface buoyancy');
assert(Math.abs(probe.buoyancy(10.3)) < 1e-8, 'configured neutral depth');
assert(probe.buoyancy(30) < probe.buoyancy(20) && probe.buoyancy(20) < 0, 'compression increases sinking force');

const shallow = create(2), deep = create(25);
stepFor(shallow, 1, {glide: true}); stepFor(deep, 1, {glide: true});
assert(shallow.velocity.y > 0 && deep.velocity.y < 0, 'unpowered body responds to buoyancy');
assert.equal(deep.state.effort, 0, 'gliding does not create invisible propulsion');

const swimmer = create(20);
stepFor(swimmer, 18, {heading: vec(1), desiredVelocity: vec(.7)});
assert(Math.abs(swimmer.velocity.x - .7) < .04, 'horizontal cruise converges');
assert(Math.abs(swimmer.velocity.y) < .04, 'finite sculling compensates negative buoyancy');
assert(swimmer.state.kickEffort > .05, 'visible effort accompanies cruising thrust');
const speedBefore = swimmer.velocity.x;
swimmer.step(1 / 60, {glide: true, heading: vec(1)});
assert(swimmer.velocity.x > speedBefore * .95, 'glide keeps momentum instead of stopping');

const ascent = create(35);
stepFor(ascent, 12, {heading: vec(0, 1), desiredVelocity: vec(0, .75)});
assert(Math.abs(ascent.velocity.y - .75) < .05, 'ascent controller overcomes deep negative buoyancy');
const descent = create(5);
stepFor(descent, 15, {heading: vec(0, -1), desiredVelocity: vec(0, -.65)});
assert(Math.abs(descent.velocity.y + .65) < .05, 'descent turns and reaches its commanded speed');

const movingWater = create(20), stillWater = create(20), current = vec(.18, 0, -.06);
movingWater.velocity.copy(current);
const stillCommand = {heading: vec(1), desiredVelocity: vec(.5)};
const movingCommand = {heading: vec(1), current, desiredVelocity: vec(.5).add(current)};
stepFor(stillWater, 10, stillCommand); stepFor(movingWater, 10, movingCommand);
assert(movingWater.velocity.clone().sub(current).distanceTo(stillWater.velocity) < 1e-8, 'drag and control are invariant to uniform current translation');
assert(movingWater.position.clone().sub(stillWater.position).distanceTo(current.clone().multiplyScalar(10)) < 1e-8, 'current is not applied twice');

const floating = create(.1);
floating.quaternion.setFromUnitVectors(vec(0, 1), vec(1));
stepFor(floating, 35, {glide: true, heading: vec(1)});
assert(floating.position.y < 15 && floating.position.y > 14.6, 'surface immersion settles without a position clamp');
assert(Math.abs(floating.velocity.y) < .06, 'surface buoyancy is stable');
assert(floating.state.immersion > .9 && floating.state.immersion < 1, 'surface equilibrium is partially immersed');

const fine = create(20), coarse = create(20), maneuver = {heading: vec(1, -.15, .2).normalize(), desiredVelocity: vec(.6, -.1, .12)};
stepFor(fine, 20, maneuver, 1 / 60); stepFor(coarse, 20, maneuver, 1 / 30);
assert(fine.position.distanceTo(coarse.position) < .15, 'integration remains consistent across sensible fixed steps');
const before = fine.position.clone(); fine.step(0, maneuver); assert(fine.position.equals(before), 'paused state remains unchanged');
console.log('Freediver physics: buoyancy, finite propulsion, inertia, turns, currents, surface immersion and timestep checks PASS');

// A deep, loaded ascent uses the same stroke clock as the rendered legs.
const loaded = create(30);
let lowThrust=Infinity, highThrust=0, cycles=0, previousPhase=0;
for(let i=0;i<600;i++) {
  loaded.step(1/60,{heading:vec(0,1),desiredVelocity:vec(0,1.15),strokeDriven:true});
  if(loaded.state.kickPhase<previousPhase)cycles++;
  previousPhase=loaded.state.kickPhase;
  if(i>180){lowThrust=Math.min(lowThrust,loaded.state.finThrust);highThrust=Math.max(highThrust,loaded.state.finThrust);}
}
assert(loaded.state.netBuoyancy<0);
assert(loaded.velocity.y>1 && loaded.velocity.y<1.3);
assert(cycles>=9 && loaded.state.kickFrequency>.9);
assert(highThrust-lowThrust>20,'force pulses with the visible stroke');
const frozenPhase=loaded.state.kickPhase;loaded.step(0,{strokeDriven:true});
assert.equal(loaded.state.kickPhase,frozenPhase);
console.log('Loaded ascent: negative buoyancy, active stroke frequency, pulsed thrust and pause PASS');

// The same swimmer must kick DOWN above neutral depth, then can freefall.
const downShallow=create(3),downDeep=create(22);
for(const b of [downShallow,downDeep])b.quaternion.setFromUnitVectors(vec(0,1),vec(0,-1));
stepFor(downShallow,2,{heading:vec(0,-1),desiredVelocity:vec(0,-1.05),strokeDriven:true});
stepFor(downDeep,4,{heading:vec(0,-1),desiredVelocity:vec(0,-1.05),strokeDriven:true,finPowerScale:0});
assert(downShallow.state.netBuoyancy>0 && downShallow.state.finThrust>30 && downShallow.state.kickFrequency>.9);
assert(downShallow.velocity.y<-.7,'active kicks overcome shallow positive buoyancy');
assert(downDeep.state.netBuoyancy<0 && downDeep.velocity.y<-.2,'gravity drives deep freefall');
assert.equal(downDeep.state.finThrust,0,'no hidden forward thrust during freefall');
console.log('Descent: active shallow kicks and unpowered deep freefall PASS');

for(const sign of [-1,1]){
  const blade={x:0,v:0};
  for(let i=0;i<120;i++)stepFreediverBlade(blade,sign*2,1/60);
  assert(blade.x*sign<-.5,'blade trails the load');
  const loadedBend=blade.x;
  for(let i=0;i<30;i++)stepFreediverBlade(blade,0,1/60);
  assert(Math.abs(blade.x)<Math.abs(loadedBend)*.15,'blade visibly straightens within half a second');
  for(let i=0;i<90;i++)stepFreediverBlade(blade,0,1/60);
  assert(Math.abs(blade.x)<.001 && Math.abs(blade.v)<.002,'unloaded blade returns to straight rest');
  const saved={...blade};stepFreediverBlade(blade,3,0);assert.deepEqual(blade,saved);
}
console.log('Elastic blades: both load directions, prompt recoil, straight rest and pause PASS');

const leftBlade={x:0,v:0},rightBlade={x:0,v:0};
for(let i=0;i<120;i++){
  stepFreediverBlade(leftBlade,2,1/60);
  stepFreediverBlade(rightBlade,0,1/60);
}
assert(Math.abs(leftBlade.x)>.5);
assert(Object.values(rightBlade).every(v=>v===0),'loading one blade must not pull the other');

// Recoil must occur during the next half-stroke, not lag by nearly a full one.
const cyclingBlade={x:0,v:0};let reversalTime=null,worstLag=0,reversals=0,oldLoad=0;
for(let i=0;i<1200;i++){
  const t=i/120,normal=2*Math.sin(2*Math.PI*1.1*t),sign=Math.sign(normal);
  if(i>240&&sign!==oldLoad&&sign!==0)reversalTime=t;
  stepFreediverBlade(cyclingBlade,normal,1/120);
  if(reversalTime!==null&&cyclingBlade.x*sign<0){worstLag=Math.max(worstLag,t-reversalTime);reversals++;reversalTime=null;}
  if(sign!==0)oldLoad=sign;
}
assert(reversals>12);assert(worstLag<.18,'tip changes bend within the new half-stroke');
console.log('Fin reversal delay at 1.1 Hz:',worstLag.toFixed(3),'seconds PASS');
