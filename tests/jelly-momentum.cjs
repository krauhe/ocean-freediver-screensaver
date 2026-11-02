const assert=require('node:assert/strict'),T=require('../three.min.js');global.window=global;require('../jelly-orientation.js');
const axis=new T.Vector3(1,0,0);
for(const fps of [15,30,60,144]){const v=new T.Vector3(.6,0,0);for(let i=0;i<fps*3;i++)stepJellyMomentum(v,axis,0,.8,1/fps);assert(Math.abs(v.x-.6/(1+.8*.6*3))<1e-12);assert(v.x>.24);}
const slow=new T.Vector3(.1,0,0),fast=new T.Vector3(.2,0,0),dt=1e-5;stepJellyMomentum(slow,axis,0,.8,dt);stepJellyMomentum(fast,axis,0,.8,dt);assert(Math.abs((.2-fast.x)/(.1-slow.x)-4)<.0001,'double speed gives fourfold drag');
const v=new T.Vector3(.5,0,0);stepJellyMomentum(v,new T.Vector3(0,1,0),0,.8,1);assert.equal(v.y,0,'turning body does not rotate existing momentum');const old=v.clone();stepJellyMomentum(v,axis,1,.8,0);assert(v.equals(old));console.log('Quadratic drag, prolonged glide, frame-rate consistency, momentum direction and pause PASS');
