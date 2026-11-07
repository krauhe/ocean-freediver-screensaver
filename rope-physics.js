/* SPDX-License-Identifier: GPL-3.0-only
 * Reduced inextensible dive-line model: fixed ballast, buoyant top, damped nodes.
 */
(() => {
  window.createDiveRope=function(T,x,z,bottom=-21,top=15){
    const count=24,length=(top-bottom)*1.015,segment=length/count;
    const nodes=[],previous=[],delta=new T.Vector3();
    for(let i=0;i<=count;i++){
      const u=i/count,p=new T.Vector3(x+.8*Math.sin(Math.PI*u),bottom+(top-bottom)*u,z);
      nodes.push(p);previous.push(p.clone());
    }
    function update(dt,anchorX,anchorZ,surfaceY,collide){
      const steps=Math.max(1,Math.ceil(Math.min(.1,dt)*120)),h=Math.min(.1,dt)/steps;
      if(h<=0)return;
      for(let s=0;s<steps;s++){
        nodes[0].set(anchorX,bottom,anchorZ);previous[0].copy(nodes[0]);
        for(let i=1;i<=count;i++){
          const p=nodes[i],old=previous[i];delta.subVectors(p,old).multiplyScalar(Math.exp(-h*(i===count?2:1.4)));
          old.copy(p);p.add(delta);p.x+=.025*h*h;
          if(i<count)p.y-=.12*h*h;else p.y=surfaceY;
        }
        // Tension prevents extension; slack is free to bend instead of pushing.
        for(let iteration=0;iteration<10;iteration++){
          for(let i=0;i<count;i++){
            const a=nodes[i],b=nodes[i+1];delta.subVectors(b,a);const d=delta.length();
            if(d<=segment)continue;
            const wa=i===0?0:1,wb=i+1===count?.3:1;
            delta.multiplyScalar((d-segment)/d/(wa+wb));
            if(wa)a.addScaledVector(delta,wa);b.addScaledVector(delta,-wb);
          }
          nodes[0].set(anchorX,bottom,anchorZ);nodes[count].y=surfaceY;
        }
        if(collide)for(let i=1;i<count;i++)collide(nodes[i]);
      }
    }
    function sample(y,out){
      // Nominal depth indexes the material points; endpoints remain connected.
      const t=T.MathUtils.clamp((y-bottom)/(top-bottom),0,1)*count,i=Math.min(count-1,Math.floor(t));
      return out.copy(nodes[i]).lerp(nodes[i+1],t-i);
    }
    return {nodes,segment,length,update,sample};
  };
})();
