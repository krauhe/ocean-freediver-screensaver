const assert=require('node:assert/strict'),T=require('../three.min.js');global.window=global;require('../freediver-rig.js');
const g=new T.BufferGeometry();for(const [name,size,data] of [['position',3,[0,0,0]],['armWeight',1,[0]],['legSide',1,[0]]])g.setAttribute(name,new T.Float32BufferAttribute(data,size));
const rig=createFreediverRig(T,g,new T.MeshStandardMaterial()),u=new Proxy({},{get:(o,k)=>o[k]||(o[k]={value:0})});
let maxBend=0,maxStep=0;const previous=[];
for(let i=0;i<=1200;i++){
 const f=i/1200,phase=f*Math.PI*4,y=.55+.67*Math.cos(phase),x=.14+.10*Math.sin(phase)**2;
 rig.pose(u,i/60,{handTargets:[new T.Vector3(x,y,-.18),new T.Vector3(x,y,.18)]});
 rig.arms.forEach((a,j)=>{
  const upper=a.upper.getWorldPosition(new T.Vector3()),elbow=a.fore.getWorldPosition(new T.Vector3()),hand=a.hand.getWorldPosition(new T.Vector3());
  const bend=elbow.clone().sub(upper).angleTo(hand.clone().sub(elbow))*180/Math.PI;maxBend=Math.max(maxBend,bend);
  const hinge=new T.Vector3().crossVectors(a.restUpper,a.restFore).normalize();const axis=new T.Vector3(a.fore.quaternion.x,a.fore.quaternion.y,a.fore.quaternion.z).normalize();
  assert(Math.abs(axis.dot(hinge))>1-1e-8,'forearm rotates only about elbow hinge');
  assert(Math.abs(upper.distanceTo(elbow)-a.restUpper.length())<1e-8);assert(Math.abs(elbow.distanceTo(hand)-a.restFore.length())<1e-8);
  if(previous[j])maxStep=Math.max(maxStep,elbow.distanceTo(previous[j]));previous[j]=elbow;
 });
}
assert(maxBend<125.001);assert(maxStep<.06,'continuous hand paths must not flip the elbow');console.log({maxBend,maxStep});

// Recreational transport uses a shoulder arc, with a shorter forearm and
// separate hands. Test the entire overhead-to-thigh transition, not only a
// maximum-flexion limit that could still permit a contorted swimming pose.
const swimmer=createFreediverRig(T,g.clone(),new T.MeshStandardMaterial(),{separateHands:true});
let swimBend=0,swimStep=0;const lastElbows=[];
for(let k=0;k<=720;k++){
 const angle=.09+(3.07-.09)*(1-Math.cos(k/720*Math.PI*2))/2;
 const targets=[-1,1].map(s=>new T.Vector3(.015+Math.sin(angle)*.66,.52+Math.cos(angle)*.66,s*(.175-.12*Math.max(0,Math.cos(angle)))));
 swimmer.pose(u,k/60,{handTargets:targets});
 swimmer.arms.forEach((a,j)=>{
  const s=a.upper.getWorldPosition(new T.Vector3()),e=a.fore.getWorldPosition(new T.Vector3()),h=a.hand.getWorldPosition(new T.Vector3());
  swimBend=Math.max(swimBend,e.clone().sub(s).angleTo(h.clone().sub(e))*180/Math.PI);
  if(lastElbows[j])swimStep=Math.max(swimStep,e.distanceTo(lastElbows[j]));lastElbows[j]=e;
  assert(Math.abs(s.distanceTo(e)-a.restUpper.length())<1e-8);
  assert(Math.abs(e.distanceTo(h)-a.restFore.length())<1e-8);
  if(angle>3.06)assert(e.x<s.x,'relaxed elbow remains behind shoulder, forearm bends forwards');
 });
}
assert(swimBend<25,'transport arms stay nearly extended throughout the transition');
assert(swimStep<.02,'shoulder arc must not cause elbow flips');
console.log({swimBend,swimStep});
