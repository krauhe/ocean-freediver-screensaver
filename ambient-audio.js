/* Underwater Ambience by Tim_Verberne, CC0. See README.md. */
(() => {
  const slider=document.getElementById('ambient-volume'),output=document.getElementById('ambient-volume-value'),status=document.getElementById('ambient-status');
  const audio=new Audio('audio/underwater-ambience.wav');
  audio.loop=true;audio.preload='none';
  let context,gain;
  async function applyVolume(){
    const level=Number(slider.value)/100;
    output.value=level?Math.round(level*100)+'%':'Off';slider.setAttribute('aria-valuetext',output.value);
    status.textContent='';
    try {
      // Web Audio gain also works on phones where media.volume is read-only.
      if(!context&&location.protocol!=='file:'){
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(AudioContext){context=new AudioContext();gain=context.createGain();context.createMediaElementSource(audio).connect(gain);gain.connect(context.destination);}
      }
      if(gain)gain.gain.setTargetAtTime(level,context.currentTime,.06);else audio.volume=level;
      if(!level){audio.pause();return;}
      if(context)await context.resume();
      if(Number(slider.value)>0)await audio.play();
      if(Number(slider.value)===0)audio.pause();
    }catch(_){status.textContent='Sound could not start. Adjust the slider to try again.';}
  }
  slider.addEventListener('input',applyVolume);
  // Start quietly on the first deliberate interaction, including on phones.
  // Do not download or attempt playback before the browser's gesture unlock.
  let unlocked=false;
  function unlock(event){
    if(unlocked||!event.isTrusted)return;
    if(event.type==='keydown'&&(event.repeat||['Shift','Control','Alt','Meta'].includes(event.key)))return;
    unlocked=true;
    document.removeEventListener('pointerdown',unlock);
    document.removeEventListener('keydown',unlock);
    applyVolume();
  }
  document.addEventListener('pointerdown',unlock);
  document.addEventListener('keydown',unlock);
  audio.addEventListener('error',()=>{status.textContent='The underwater sound could not be loaded.';});
})();
