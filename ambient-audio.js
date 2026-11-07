/* Underwater Ambience by Tim_Verberne (CC0); water.wav by n2p5 (CC BY 4.0). See README.md. */
(() => {
  const slider=document.getElementById('ambient-volume'),output=document.getElementById('ambient-volume-value'),status=document.getElementById('ambient-status');
  const audio=new Audio('audio/underwater-ambience.wav');
  audio.loop=true;audio.preload='none';
  const boat=new Audio('audio/underwater-motorboat.wav');
  boat.loop=true;boat.preload='none';boat.volume=0;
  let context,gain,boatGain,boatTarget=0,boatLevel=0;
  window.oceanSound={setBoatMotion(speed,visible,distance){
    boatTarget=visible?Math.min(1,Math.max(0,(speed-.12)/2))/(1+(distance/55)**2):0;
  }};
  function mixBoat(){
    const wanted=document.hidden?0:boatTarget*Number(slider.value)/100*.2;
    boatLevel+=(wanted-boatLevel)*(1-Math.exp(-.1/(wanted>boatLevel?1.4:1.9)));
    if(boatGain)boatGain.gain.setTargetAtTime(boatLevel,context.currentTime,.1);
    else boat.volume=Math.max(0,Math.min(1,boatLevel));
  }
  async function applyVolume(){
    const level=Number(slider.value)/100;
    output.value=level?Math.round(level*100)+'%':'Off';slider.setAttribute('aria-valuetext',output.value);
    status.textContent='';
    try {
      // Web Audio gain also works on phones where media.volume is read-only.
      if(!context&&location.protocol!=='file:'){
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(AudioContext){context=new AudioContext();gain=context.createGain();context.createMediaElementSource(audio).connect(gain);gain.connect(context.destination);
          boatGain=context.createGain();boatGain.gain.value=0;boat.volume=1;context.createMediaElementSource(boat).connect(boatGain);boatGain.connect(context.destination);}
      }
      if(gain)gain.gain.setTargetAtTime(level,context.currentTime,.06);else audio.volume=level;
      if(!level){audio.pause();boat.pause();boatLevel=0;mixBoat();return;}
      if(context)await context.resume();
      if(Number(slider.value)>0){await Promise.all([audio.play(),boat.play()]);}
      if(Number(slider.value)===0){audio.pause();boat.pause();}
    }catch(_){status.textContent='Sound could not start. Adjust the slider to try again.';}
  }
  slider.addEventListener('input',applyVolume);
  // Start quietly on the first deliberate interaction, including on phones.
  // Do not download or attempt playback before the browser's gesture unlock.
  let unlocked=false;
  let mixer=null;
  function startMixer(){if(mixer===null)mixer=setInterval(mixBoat,100);}
  slider.addEventListener('input',startMixer);
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
    if(document.hidden){audio.pause();boat.pause();boatLevel=0;mixBoat();}
    else if(unlocked)applyVolume();
  });
})();
