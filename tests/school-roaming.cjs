const T=require('../three.min.js'),assert=require('node:assert/strict');global.window=global;require('../marine-behavior.js');require('../seabed.js');
let seed=42;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const site=createDiveSite(T,new T.Scene(),{time:{value:0},daylight:{value:1}}),env=createMarineEnvironment(T,site,null);
const seeds=Array.from({length:90},()=>[Math.random(),Math.random(),Math.random(),Math.random()]),agents=createMarineAgents(T,env,seeds,[]);
const ranges=agents.schools.map(()=>({lo:new T.Vector3(Infinity,Infinity,Infinity),hi:new T.Vector3(-Infinity,-Infinity,-Infinity)}));
agents.update(0,[],90);for(let k=1;k<=30*360;k++){agents.update(k/30,[],90);agents.schools.forEach((s,i)=>{ranges[i].lo.min(s.center);ranges[i].hi.max(s.center);});}
const result=ranges.map((r,i)=>({school:i,span:r.hi.clone().sub(r.lo).toArray(),lo:r.lo.toArray(),hi:r.hi.toArray(),wp:agents.schools[i].wp}));console.log(JSON.stringify(result,null,2));
assert(result[0].span[0]>20&&result[2].span[0]>20,'both bottom schools roam widely');assert(result[1].span[1]>10,'cliff school ascends and descends');assert(site.terrain.reefBlocks.length>=20);
for(const block of site.terrain.reefBlocks){
 const p=new T.Vector3(...block.lo).add(new T.Vector3(...block.hi)).multiplyScalar(.5);
 site.constrain(p,.2,new T.Vector3(),new T.Vector3());
 assert(!site.terrain.reefBlocks.some(b=>p.x>b.lo[0]-.2+1e-5&&p.x<b.hi[0]+.2-1e-5&&p.y>b.lo[1]-.2+1e-5&&p.y<b.hi[1]+.2-1e-5&&p.z>b.lo[2]-.2+1e-5&&p.z<b.hi[2]+.2-1e-5),'overlapping reef collision envelopes resolve outside the rock');
}
