const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 for(const protocol of ['file:','https:']){
  const listeners={},tracks=[],controls={},nodes=[];let tick;
  class AudioContext {constructor(){this.currentTime=0;this.destination={};}createGain(){const node={gain:{value:1,setTargetAtTime(v){this.value=v;}},connect(){}};nodes.push(node);return node;}createMediaElementSource(){return{connect(){}};}resume(){return Promise.resolve();}}
  for(const id of ['ambient-volume','ambient-volume-value','ambient-status'])controls[id]={value:id==='ambient-volume'?'15':'',setAttribute(){},addEventListener(type,fn){const previous=this[type];this[type]=async(...args)=>{if(previous)await previous(...args);await fn(...args);};}};
  class Audio {constructor(src){this.src=src;this.volume=1;this.paused=true;tracks.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}}
  const document={hidden:false,getElementById:id=>controls[id],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
  const context={Audio,document,location:{protocol},setInterval:fn=>{tick=fn;return 1;},window:{AudioContext}};
  vm.runInNewContext(fs.readFileSync('ambient-audio.js','utf8'),context);
  assert(tracks.every(a=>a.paused),'no autoplay before gesture');
  listeners.pointerdown({type:'pointerdown',isTrusted:false});
  assert(tracks.every(a=>a.paused),'untrusted events do not unlock audio');
  listeners.pointerdown({type:'pointerdown',isTrusted:true});await new Promise(resolve=>setImmediate(resolve));
  assert(tracks.every(a=>!a.paused),'trusted gesture unlocks playback');
  const ambient={get volume(){return tracks[0].volume*(nodes[0]?.gain.value??1);}},boat={get volume(){return tracks[1].volume*(nodes[1]?.gain.value??1);}};
  assert.equal(ambient.volume,.15);
  assert.equal(boat.volume,0,'boat starts silent on unlock to avoid loud surprise');
  context.window.oceanSound.setBoatMotion(3,true,0);
  tick();
  assert(boat.volume>0&&boat.volume<.01,'gentle fade in on first mixer tick');
  for(let i=0;i<100;i++)tick();
  assert(boat.volume>.095&&boat.volume<=.0975,'meaningful default-level boat gain under 15% master');
  assert(ambient.volume>.11&&ambient.volume<.12,'gradual ambient ducking when boat passes close overhead');
  context.window.oceanSound.setBoatMotion(3,true,85);
  for(let i=0;i<120;i++)tick();
  assert(boat.volume>.048&&boat.volume<.05,'distance attenuation halves boat level at 85 units');
  context.window.oceanSound.setBoatMotion(.75,true,0);
  for(let i=0;i<120;i++)tick();
  assert(boat.volume>.058&&boat.volume<.061,'moderate speed produces intermediate boat gain');
  context.window.oceanSound.setBoatMotion(0,true,0);
  const beforeIdle=boat.volume;tick();
  assert(boat.volume<beforeIdle&&boat.volume>.02,'smooth ramp down toward stationary idle');
  for(let i=0;i<150;i++)tick();
  assert(boat.volume>.021&&boat.volume<.022,'stationary visible boat maintains subtle idle hum');
  context.window.oceanSound.setBoatMotion(0,false,0);
  const beforeHide=boat.volume;tick();
  assert(boat.volume<beforeHide&&boat.volume>0,'fade out instead of abrupt cutoff when hidden or paused');
  for(let i=0;i<200;i++)tick();
  assert(boat.volume<.00001,'hidden or paused boat fades to silence');
  assert(ambient.volume>.1499&&ambient.volume<=.15,'ambient volume recovers after boat leaves');
  controls['ambient-volume'].value='0';await controls['ambient-volume'].input();
  assert(tracks.every(a=>a.paused)&&boat.volume===0,'master mute pauses all tracks and zeroes boat');
  controls['ambient-volume'].value='15';await controls['ambient-volume'].input();
  assert(tracks.every(a=>!a.paused),'restoring slider resumes playback');
  document.hidden=true;listeners.visibilitychange();
  assert(tracks.every(a=>a.paused)&&boat.volume===0,'hidden tab pauses playback');
  document.hidden=false;listeners.visibilitychange();await new Promise(resolve=>setImmediate(resolve));
  assert(tracks.every(a=>!a.paused),'visible tab resumes unlocked playback');
  console.log('Audio: gesture unlock, audible boat pass with ducking, speed/distance response, stationary idle, hidden silence, master mute and visibility pause PASS');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
