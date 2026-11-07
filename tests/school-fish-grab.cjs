const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../three.min.js');
global.window=global;require('../marine-behavior.js');require('../animal-interaction.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../ocean.js'),'utf8');
const start=source.indexOf('  const grabbedFish=new Map();'),end=source.indexOf('  // Four scene units',start);
for(const hz of [15,30,60]){
 const camera=new T.PerspectiveCamera();camera.position.set(0,3,27);camera.updateMatrixWorld();
 const environment=createMarineEnvironment(T,null,null,camera),marineAgents=createMarineAgents(T,environment,Array.from({length:30},()=>[.5,.5,.5,0]),[],camera);
 const interactions=createAnimalInteraction(T,camera,environment),scope={T,marineAgents,interactions,fish:{visible:true,count:30}};
 vm.runInNewContext(source.slice(start,end)+'\nthis.entry=fishEntry(0);',scope);
 const e=scope.entry,a=marineAgents.fish[0];marineAgents.update(0,[],30);interactions.step(e,0);interactions.grab(e,a.p);interactions.target.copy(camera.position);
 for(let i=1;i<=hz*10;i++){
  const before=a.p.clone();marineAgents.update(i/hz,[],30);assert(a.p.equals(before),'held fish has exactly one position controller');
  interactions.step(e,i/hz);assert(a.v.length()<=8+1e-8,'bounded pull speed');assert(a.p.distanceTo(camera.position)>=4.18-1e-6,'camera clearance throughout pull');
  assert(a.p.distanceTo(before)<=8/hz+1e-6,'no pull teleport');
 }
 // Release during a fast outward drag, not just after coming to rest.
 interactions.target.set(-60,-8,-60);for(let i=1;i<=hz;i++){const t=10+i/hz;marineAgents.update(t,[],30);interactions.step(e,t);}
 assert(a.v.length()>5,'test reaches fast drag');const released=a.p.clone();interactions.release();assert(!e.active&&!a.interactionHeld,'swimming owns release');assert(a.p.equals(released),'release does not teleport');assert(a.v.length()<=1.7+1e-8);
 for(let i=1;i<=hz*8;i++){const before=a.p.clone(),t=11+i/hz;marineAgents.update(t,[],30);interactions.step(e,t);assert(a.p.distanceTo(before)<=2.1*(Math.ceil(30/hz)+1)/30+1e-6,'no ballistic release '+JSON.stringify({hz,i,d:a.p.distanceTo(before),v:a.v.length(),before:before.toArray(),after:a.p.toArray()}));assert(a.p.distanceTo(camera.position)>=4.18-1e-6);}
}
console.log('School fish: single controller, bounded pull/release, camera clearance at 15/30/60 Hz PASS');



