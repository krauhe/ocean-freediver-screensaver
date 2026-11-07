const assert=require('node:assert/strict');
const T=require('../three.min.js');global.window=global;require('../animal-interaction.js');
function setup(options={}){
  const camera=new T.PerspectiveCamera();camera.position.set(0,3,27);
  const system=createAnimalInteraction(T,camera,null),root=new T.Object3D();
  root.position.set(0,0,0);
  const e=system.register({root,...options});system.step(e,0);
  assert(system.grab(e,root.position));system.target.set(5,2,5);return {system,e,root};
}
const results=[];
for(const hz of [15,30,60]){
  const {system,e,root}=setup({kinematic:true});let last=root.position.clone();
  for(let i=1;i<=hz*3;i++){
    root.position.set(0,0,0);system.step(e,i/hz);
    assert(root.position.distanceTo(last)<=e.maxSpeed/hz+1e-8);last.copy(root.position);
  }
  results.push(root.position.clone());system.release();
  const v=e.velocity.clone();root.position.set(-30,-10,-20);system.step(e,3+1/hz);
  assert(root.position.distanceTo(last)<=e.maxSpeed/hz+1e-8,'release must not snap to a route');
  assert(e.velocity.distanceTo(v)<=3/hz+1e-8,'release preserves bounded momentum');
  const p=root.position.clone();system.step(e,3+1/hz);assert.deepEqual(root.position.toArray(),p.toArray(),'unchanged simulation clock freezes motion');
}
assert(results[0].distanceTo(results[2])<.12,'similar response across frame rates');
{
  let escaped=0;const {system,e,root}=setup({breathes:true,forceSurface:true,kinematic:true,maxHold:1,onSafety(){escaped++;}});
  for(let i=1;i<=45*30;i++){root.position.set(0,-20,0);system.step(e,i/30);
    if(i===60){assert.equal(system.held,null);assert.equal(system.grab(e,root.position),false,'cannot regrab during ascent');}
  }
  assert.equal(escaped,1);assert(e.safetyHandled,'reach surface and complete recovery');
  assert.equal(e.protected,false);
}
{
  const {system,e,root}=setup({breathes:true,forceSurface:true,kinematic:true,maxHold:8,
    safetyNeeded:e=>!e.safetyHandled&&e.airAge>12});
  for(let i=1;i<=15*30;i++){
    root.position.set(0,-20,0);system.step(e,i/30);
    if(i%15===0){system.release();system.grab(e,e.position);}
  }
  assert(e.protected,'repeated short grabs must not reset the breathing reserve');
  assert.equal(system.held,null);
}
{
  const {system,e,root}=setup({kind:'crab',ground:()=>-4,cruiseSpeed:.5});
  system.release();for(let i=1;i<=30*30;i++)system.step(e,i/30);
  assert(Math.abs(root.position.y+3.64)<.025,'released crab settles onto seabed');
  assert.equal(e.active,false);
}
{
  const {system,e,root}=setup();root.visible=false;system.step(e,1/30);
  assert.equal(system.held,null);assert.equal(e.active,false);
}
console.log('Interaction: bounded force/release, frame rates, pause, air escape/recovery, crab landing and visibility PASS');
