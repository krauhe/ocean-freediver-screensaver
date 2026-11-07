/* Underwater Ambience by Tim_Verberne (CC0); water.wav by n2p5 (CC BY 4.0). See README.md. */
(() => {
  const slider=document.getElementById('ambient-volume'),output=document.getElementById('ambient-volume-value'),status=document.getElementById('ambient-status');
  const audio=new Audio('audio/underwater-ambience.wav');
  audio.loop=true;audio.preload='none';
  const boat=new Audio('audio/underwater-motorboat.wav');
  boat.loop=true;boat.preload='none';boat.volume=0;
  const BOAT_MAX_GAIN=.65,IDLE_FACTOR=.22,CRUISE_SPEED=1.5,HALF_POWER_DIST=85,AMBIENT_DUCK=.25,ATTACK_TAU=1.4,RELEASE_TAU=1.6;
  let context,gain,boatGain,boatTarget=0,boatMix=0,boatLevel=0,ambientLevel=0,unlocked=false,mixer=null;
  window.oceanSound={
    setBoatMotion(speed,visible,distance){
      if(!visible){boatTarget=0;return;}
      const s=Math.max(0,Number(speed)||0),d=Math.max(0,Number(distance)||0);
      const speedFactor=IDLE_FACTOR+(1-IDLE_FACTOR)*Math.min(1,s/CRUISE_SPEED);
      const distFactor=1/(1+(d/HALF_POWER_DIST)**2);
      boatTarget=speedFactor*distFactor;
    },
    getState(){
      return {master:Number(slider.value)/100,boatTarget,boatMix,boatLevel,ambientLevel,unlocked};
    }
  };
  function syncGains(tau){
    const master=document.hidden?0:Math.max(0,Math.min(1,Number(slider.value)/100));
    boatLevel=master*BOAT_MAX_GAIN*boatMix;
    ambientLevel=master*(1-AMBIENT_DUCK*boatMix);
    if(boatGain)boatGain.gain.setTargetAtTime(boatLevel,context.currentTime,tau);
    else boat.volume=Math.max(0,Math.min(1,boatLevel));
    if(gain)gain.gain.setTargetAtTime(ambientLevel,context.currentTime,tau);
    else audio.volume=Math.max(0,Math.min(1,ambientLevel));
  }
  function mixBoat(){
    const master=document.hidden?0:Math.max(0,Math.min(1,Number(slider.value)/100));
    const wanted=master>0?boatTarget:0;
    boatMix+=(wanted-boatMix)*(1-Math.exp(-.1/(wanted>boatMix?ATTACK_TAU:RELEASE_TAU)));
    if(boatMix<1e-7&&wanted===0)boatMix=0;
    syncGains(.1);
  }
  async function applyVolume(){
    const level=Math.max(0,Math.min(1,Number(slider.value)/100));
    output.value=level?Math.round(level*100)+'%':'Off';slider.setAttribute('aria-valuetext',output.value);
    status.textContent='';
    try {
      // Web Audio gain also works on phones where media.volume is read-only.
      if(!context&&location.protocol!=='file:'){
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(AudioContext){context=new AudioContext();gain=context.createGain();audio.volume=1;context.createMediaElementSource(audio).connect(gain);gain.connect(context.destination);
          boatGain=context.createGain();boatGain.gain.value=0;boat.volume=1;context.createMediaElementSource(boat).connect(boatGain);boatGain.connect(context.destination);}
      }
      if(!level||document.hidden){audio.pause();boat.pause();boatMix=0;syncGains(.06);return;}
      syncGains(.06);
      if(context)await context.resume();
      if(Number(slider.value)>0&&!document.hidden){await Promise.all([audio.play(),boat.play()]);}
      if(Number(slider.value)===0||document.hidden){audio.pause();boat.pause();}
    }catch(_){status.textContent='Sound could not start. Adjust the slider to try again.';}
  }
  function startMixer(){if(mixer===null)mixer=setInterval(mixBoat,100);}
  slider.addEventListener('input',()=>{unlocked=true;startMixer();return applyVolume();});
  function unlock(event){
    if(unlocked||!event.isTrusted)return;
    if(event.type==='keydown'&&(event.repeat||['Shift','Control','Alt','Meta'].includes(event.key)))return;
    unlocked=true;
    startMixer();
    document.removeEventListener('pointerdown',unlock);
    document.removeEventListener('keydown',unlock);
    applyVolume();
  }
  document.addEventListener('pointerdown',unlock);
  document.addEventListener('keydown',unlock);
  audio.addEventListener('error',()=>{status.textContent='The underwater sound could not be loaded.';});
  boat.addEventListener('error',()=>{status.textContent='The motorboat sound could not be loaded.';});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){audio.pause();boat.pause();boatMix=0;syncGains(.06);}
    else if(unlocked)applyVolume();
  });
})();
