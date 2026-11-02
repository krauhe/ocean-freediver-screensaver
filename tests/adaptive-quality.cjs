const assert=require('node:assert/strict');
require('../adaptive-quality.js');
const A=global.OceanAdaptiveQuality;
assert.equal(A.startingLevel({mobile:true,renderer:'NVIDIA'}),1);
assert.equal(A.startingLevel({renderer:'ANGLE NVIDIA GeForce RTX'}),3);
assert.equal(A.startingLevel({renderer:'Intel UHD'}),2);
assert.equal(A.startingLevel({renderer:'SwiftShader'}),1);
let g=A.create(3),t=0,changes=[];
for(let i=0;i<600;i++){t+=1000/18;const r=g.sample(t);if(r?.changed)changes.push(r.level);}
assert.deepEqual(changes,[2,1,0]);
g=A.create(1);changes=[];t=0;
for(let i=0;i<1150;i++){t+=1000/30;const r=g.sample(t);if(r?.changed)changes.push(r.level);}
assert.deepEqual(changes,[2]);
for(let i=0;i<250;i++){t+=1000/18;const r=g.sample(t);if(r?.changed)changes.push(r.level);}
assert.equal(changes.at(-1),1);
const after=changes.length;
for(let i=0;i<1800;i++){t+=1000/30;const r=g.sample(t);if(r?.changed)changes.push(r.level);}
assert(changes.slice(after).every(level=>level===0),'failed probe cooldown: no upward retry');
g=A.create(2);g.reset(500000);assert.equal(g.sample(501000),null);
console.log('Governor PASS: slow descent, upgrade, rollback cooldown, startup hints, reset');

// Limiter phase carry must maintain 30 fps on common display refresh rates.
for(const hz of [60,90,120,144,165]){
 let last=0,rendered=0;
 for(let frame=1;frame<=hz*60;frame++){
  const now=frame*1000/hz,period=1000/30;
  if(now-last<period)continue;
  last=now-((now-last)%period);rendered++;
 }
 assert(Math.abs(rendered/60-30)<.05,`${hz} Hz pacing`);
}
console.log('30 fps pacing PASS at 60/90/120/144/165 Hz');
