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
{
 const {system,e,root}=setup({cameraRadius:3});system.release();e.active=false;
 root.position.set(0,3,26);system.keepCameraClear(e);
 assert(root.position.distanceTo(new T.Vector3(0,3,27))>=7-1e-8,'four metres of clearance includes the body envelope even when not held');
}
{
 const {system}=setup();
 for(const depth of [3,6,8,20,80,160]){
  assert(system.advanceGripDepth(depth,-1,1/30)<=depth,'pull never pushes an already-near hit outward');
  assert(system.advanceGripDepth(depth,1,1/30)>=depth,'push never snaps a distant hit inward');
 }
}
for(const hz of [15,30,60]){
  const {system,e,root}=setup({kinematic:true});let last=root.position.clone();
  for(let i=1;i<=hz*3;i++){
    root.position.set(0,0,0);system.step(e,i/hz);
    assert(root.position.distanceTo(last)<=36/hz+1e-8);last.copy(root.position);
  }
  results.push(root.position.clone());system.release();
  const v=e.velocity.clone();root.position.set(-30,-10,-20);system.step(e,3+1/hz);
  assert(root.position.distanceTo(last)<=Math.max(e.maxSpeed,v.length())/hz+1e-8,'release must not snap to a route');
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
{
  function approach(maxSpeed,hz){
    const {system,e,root}=setup({kinematic:true,maxHold:30,maxSpeed});
    root.position.set(0,3,-53);system.release();e.active=false;
    system.grab(e,root.position);system.pulling=true;system.target.set(0,3,19);
    for(let i=1;i<=3*hz;i++)system.step(e,i/hz);
    return e.position.z+53;
  }
  const fast=approach(.65,60);
  for(const cap of [1.2,1.3,1.4,2.2,40])assert(Math.abs(approach(cap,60)-fast)<1e-8,'held response is independent of species swimming speed');
  assert(fast>25,'distant pull is responsive');
  assert(Math.abs(approach(.65,15)-fast)<.8,'distant pull stays consistent across frame rates');
}
{
  function rotate(offset,hz){
    const {system,e,root}=setup({rotatable:true});system.release();e.active=false;
    system.grab(e,root.position.clone().add(offset));
    system.target.copy(root.position).add(offset).add(new T.Vector3(0,3,0));
    for(let i=1;i<=hz;i++)system.step(e,i/hz);
    const angle=e.orientation.angleTo(new T.Quaternion());
    assert(Math.abs(e.orientation.length()-1)<1e-9,'rotation remains normalized');
    const q=e.orientation.clone();system.step(e,1);assert(e.orientation.angleTo(q)<1e-7,'pause freezes rotation');
    system.release();for(let i=1;i<=hz*5;i++)system.step(e,1+i/hz);
    assert(e.angularVelocity.length()<.03,'released spin damps');
    return angle;
  }
  assert(rotate(new T.Vector3(),60)<.001,'central pull does not create torque');
  const turn=rotate(new T.Vector3(0,0,1),60);
  assert(turn>.15,'off-centre pull rotates the whole animal');
  assert(Math.abs(rotate(new T.Vector3(0,0,1),15)-turn)<.12,'rotation agrees across frame rates');
}
console.log('Interaction: bounded force/release, nonlinear distant pull, rotation, frame rates, pause, air escape/recovery, crab landing and visibility PASS');
