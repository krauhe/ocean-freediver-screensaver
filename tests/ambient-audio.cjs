const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  const listeners={},tracks=[],controls={};let tick;
  for(const id of ['ambient-volume','ambient-volume-value','ambient-status'])controls[id]={value:id==='ambient-volume'?'15':'',setAttribute(){},addEventListener(type,fn){const previous=this[type];this[type]=async(...args)=>{if(previous)await previous(...args);await fn(...args);};}};
  class Audio {constructor(src){this.src=src;this.volume=1;this.paused=true;tracks.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}}
  const document={hidden:false,getElementById:id=>controls[id],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
  const context={Audio,document,location:{protocol:'file:'},setInterval:fn=>{tick=fn;return 1;},window:{}};
  vm.runInNewContext(fs.readFileSync('ambient-audio.js','utf8'),context);
  assert(tracks.every(a=>a.paused),'no autoplay before gesture');
  listeners.pointerdown({type:'pointerdown',isTrusted:true});await new Promise(resolve=>setImmediate(resolve));
  assert(tracks.every(a=>!a.paused));assert.equal(tracks[0].volume,.15);
  const boat=tracks[1];context.window.oceanSound.setBoatMotion(3,true,0);
  tick();assert(boat.volume>0&&boat.volume<.005,'gentle fade in');
  for(let i=0;i<100;i++)tick();assert(boat.volume>.029&&boat.volume<=.03,'low boat mix under master volume');
  context.window.oceanSound.setBoatMotion(0,true,0);const previous=boat.volume;tick();assert(boat.volume<previous&&boat.volume>0,'fade out instead of abrupt cutoff');
  for(let i=0;i<200;i++)tick();assert(boat.volume<.00001,'stationary boat silent');
  controls['ambient-volume'].value='0';await controls['ambient-volume'].input();assert(tracks.every(a=>a.paused));
  document.hidden=true;listeners.visibilitychange();assert(tracks.every(a=>a.paused));
  console.log('Audio: gesture unlock, quiet moving-boat fade, stationary silence, master mute and hidden pause PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
