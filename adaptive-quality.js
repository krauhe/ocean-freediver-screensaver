/* Wall-clock quality governor. No dependency on scene time or animation speed. */
(function(root){
  function startingLevel({mobile=false,renderer='' }={}){
    if(mobile || /swiftshader|llvmpipe|software/i.test(renderer))return 1;
    if(/nvidia|radeon rx|geforce|quadro/i.test(renderer))return 3;
    return 2;
  }
  function create(level=2){
    let start=null,frames=0,settleUntil=0,healthy=0,upgradeAfter=0,lastUpgrade=-Infinity;
    function reset(now=0){start=null;frames=0;healthy=0;settleUntil=now+6000;}
    return {
      reset,
      sample(now){
        if(now<settleUntil)return null;
        if(start===null){start=now;frames=0;return null;}
        frames++;
        if(now-start<6000)return null;
        const fps=frames*1000/(now-start);start=now;frames=0;
        let next=level;
        if(fps<24){
          next=Math.max(0,level-1);healthy=0;
          // Failed upward probes should not repeat every half minute.
          upgradeAfter=Math.max(upgradeAfter,now+(now-lastUpgrade<20000?120000:45000));
        }else if(fps>=29){
          healthy+=6000;
          if(healthy>=30000&&now>=upgradeAfter&&level<4){next=level+1;lastUpgrade=now;}
        }else healthy=0;
        const changed=next!==level;level=next;
        if(changed)reset(now);
        return {fps,level,changed};
      },
      setLevel(value,now=0){level=value;reset(now);}
    };
  }
  root.OceanAdaptiveQuality={create,startingLevel};
})(typeof window==='undefined'?globalThis:window);
