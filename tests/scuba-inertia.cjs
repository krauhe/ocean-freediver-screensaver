const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../three.min.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../scuba.js'),'utf8'),start=source.indexOf('    function stepSpring('),end=source.indexOf('    function update(time, paused, speed)',start);
assert(start>=0&&end>start);const scope={T};vm.runInNewContext(source.slice(start,end)+'\nthis.advance=stepSpring;',scope);
const step=(s,target,dt)=>scope.advance(s,'angle','velocity',target,dt,4.2,.85,1.8,true),finals=[];
for(const hz of [15,30,60,120]){
 const s={angle:0,velocity:0};let previous=0,oldVelocity=0,peak=0;
 for(let i=0;i<hz*8;i++){step(s,Math.PI/2,1/hz);assert(s.angle>=previous-1e-7&&s.angle<=Math.PI/2+1e-7,'arrival remains monotonic');assert(Math.abs(s.velocity-oldVelocity)<=1.8/hz+1e-8,'bounded angular acceleration');assert(Math.abs(s.velocity)<=.85+1e-8);peak=Math.max(peak,s.velocity);previous=s.angle;oldVelocity=s.velocity;}
 assert(peak>.6&&s.velocity<.001,'accelerates and brakes');finals.push(s.angle);
 const frozen={...s};step(s,-1,0);assert.deepEqual(s,frozen,'pause preserves position and momentum');
}
assert(Math.max(...finals)-Math.min(...finals)<.001,'frame-rate stable');
const wrap={angle:Math.PI-.08,velocity:0};for(let i=0;i<240;i++)step(wrap,-Math.PI+.08,1/60);assert(Math.abs(wrap.angle-(-Math.PI+.08))<.002,'takes short path through angle wrap');
const reverse={angle:0,velocity:.5};step(reverse,-1,1/60);assert(reverse.velocity>.45,'direction reversal preserves inertia');
console.log('Scuba inertia: acceleration, braking, no overshoot, frame rates, angular wrap and pause PASS');
