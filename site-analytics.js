/* Dedicated public GoatCounter endpoint; no credentials are required. */
(() => {
  const endpoint='https://ocean-freediver-screensaver.goatcounter.com/count';
  if(!endpoint || location.protocol!=='https:' || location.hostname!=='krauhe.github.io')return;
  if(!location.pathname.startsWith('/ocean-freediver-screensaver/'))return;
  window.goatcounter={
    path:'/ocean-freediver-screensaver/',
    title:'Ocean Freediver Screensaver'
  };
  const script=document.createElement('script');
  script.src='https://gc.zgo.at/count.js';script.async=true;
  script.dataset.goatcounter=endpoint;
  document.head.appendChild(script);
})();
