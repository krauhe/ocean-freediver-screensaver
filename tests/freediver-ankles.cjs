const assert=require('node:assert/strict'),T=require('../three.min.js');global.window=global;require('../freediver-rig.js');
function geometry(){const g=new T.BufferGeometry(),positions=[],sides=[];for(const side of [-1,1])for(const y of [-.84,-.96,-1.04,-1.82]){positions.push(0,y,side*.095);sides.push(side);}g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('armWeight',new T.Float32BufferAttribute(new Array(8).fill(0),1));g.setAttribute('legSide',new T.Float32BufferAttribute(sides,1));return g;}
const rig=createFreediverRig(T,geometry(),new T.MeshStandardMaterial(),{articulatedFeet:true}),u=new Proxy({},{get:(o,k)=>o[k]||(o[k]={value:0})});
const pose=ankle=>rig.pose(u,0,{swimJoints:[{hip:.2,knee:.1,ankle},{hip:0,knee:0,ankle:.68}]});
pose(.68);
assert(Math.abs(rig.joints.ankleL.rotation.z-.68)<1e-9);
assert(Math.abs(rig.joints.finL.rotation.z+28*Math.PI/180)<1e-9);
const point=i=>rig.mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(rig.mesh.geometry.attributes.position,i));
const tipBefore=point(3),otherBefore=point(7);pose(.8);
assert(point(3).distanceTo(tipBefore)>.08,'ankle moves its own fin');assert(point(7).distanceTo(otherBefore)<1e-8,'opposite fin remains independent');
assert(Math.abs(point(3).distanceTo(point(2))-.78)<1e-6,'joint movement preserves fin length');
pose(0);assert.equal(rig.joints.ankleL.rotation.z,.52);pose(2);assert.equal(rig.joints.ankleL.rotation.z,.82);
const original=createFreediverRig(T,geometry(),new T.MeshStandardMaterial());assert(!original.joints.finL);assert.equal(original.joints.ankleL.position.y,-.48);
console.log('Ankles: foot and blade angles, independent skinning, fixed length, limits and legacy rig PASS');

const mono=createFreediverRig(T,geometry(),new T.MeshStandardMaterial(),{articulatedFeet:true,monofin:true});
u.uKickAmp.value=.8;
for(let i=0;i<60;i++){
 u.uKickPhase.value=i*.1;
 mono.pose(u,i/30,{surface:1,surfaceMotion:{phase:i*.1,effort:.2}});
 assert(mono.joints.ankleL.rotation.z>.55&&mono.joints.ankleL.rotation.z<.7);
 for(const name of ['hip','knee','ankle','fin'])assert.equal(mono.joints[name+'L'].rotation.z,mono.joints[name+'R'].rotation.z,'shared monofin stays synchronized');
}
const ropeBi=createFreediverRig(T,geometry(),new T.MeshStandardMaterial(),{articulatedFeet:true});
ropeBi.pose(u,0);assert(ropeBi.joints.ankleL.rotation.z>.55);assert(ropeBi.joints.ankleR.rotation.z>.55);
console.log('Rope divers: visible ankle angle and synchronized monofin PASS');
