const T=require('../three.min.js'),assert=require('node:assert/strict');global.window=global;
require('../marine-behavior.js');require('../predator-fish.js');require('../seabed.js');
let seed=42;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const scene=new T.Scene(),site=createDiveSite(T,scene,{time:{value:0},daylight:{value:1}});
const env=createMarineEnvironment(T,site,null),seeds=Array.from({length:180},()=>[Math.random(),Math.random(),Math.random(),Math.random()]);
const agents=createMarineAgents(T,env,seeds,[]),pred=createPredatoryFish(T,new T.Group(),null,env,agents.schools),a=pred.animals[0];
let closest=Infinity,peak=0,peakEscape=0,bursts=0,oldMode='',maxStep=0;const phases={},events=[];
pred.update(0);agents.update(0,[],seeds.length);
for(let k=1;k<=30*180;k++){
 const time=k/30,prev=a.root.position.clone();pred.update(time,[]);const threats=[{kind:'predator',p:a.root.position,v:a.velocity,radius:a.radius}];agents.update(time,threats,seeds.length);
 let near=Infinity,escape=0;for(const f of agents.fish){if(f.school===1)continue;near=Math.min(near,f.p.distanceTo(a.root.position));if(f.mode==='escape')escape++;}
 closest=Math.min(closest,near);peak=Math.max(peak,a.velocity.length());peakEscape=Math.max(peakEscape,escape);maxStep=Math.max(maxStep,prev.distanceTo(a.root.position));
 phases[a.mode]=(phases[a.mode]||0)+1/30;if(a.mode!==oldMode){events.push({time:+time.toFixed(1),mode:a.mode,near:+near.toFixed(2),escape});if(a.mode==='burst')bursts++;oldMode=a.mode;}
}
console.log(JSON.stringify({closest,peak,peakEscape,bursts,maxStep,phases},null,2));
{assert(bursts>=2,'repeated bounded attacks');assert(closest<1.8,'reaches individual fish');assert(peak>2,'visible acceleration');assert(peak<=3.3);assert(maxStep<.12);assert(peakEscape>=5,'several individuals visibly scatter');assert(phases.recover>15||phases.retreat>15,'substantial recovery periods');}
