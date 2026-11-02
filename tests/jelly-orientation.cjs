const assert=require('node:assert/strict');const T=require('../three.min.js');global.window=global;require('../jelly-orientation.js');
let seed=527;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const env={current(p,t,out){out.set(.1+.02*p.y,.01*Math.sin(t*.1),.03);}};
for(const kind of ['moon','comb']){
const animals=Array.from({length:24},()=>createJellyOrientation(T,kind)),p=new T.Vector3(0,0,0);let maxRate=0;
assert(animals.filter(a=>a.axis.y<.4).length>4,'different initial inclinations');
for(let i=0;i<3600;i++)for(const a of animals){const q=a.quaternion.clone();a.update(i/30,p,env,.7);maxRate=Math.max(maxRate,q.angleTo(a.quaternion)*30);assert(Number.isFinite(a.axis.y));}
assert(maxRate<.19,kind+' slow bounded turns');for(const a of animals){const before=a.quaternion.clone();a.update(3599/30,p,env,.7);assert(before.equals(a.quaternion),'pause');assert(Math.abs(a.axis.length()-1)<1e-6);}
console.log(kind,{maxRate,sideways:animals.filter(a=>Math.abs(a.axis.y)<.5).length});}
console.log('Individual jelly orientation / turn limits / pause PASS');
