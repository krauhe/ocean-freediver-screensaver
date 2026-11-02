/* SPDX-License-Identifier: GPL-3.0-only */
(() => {
  window.createMarineWakes=function(T,bio,water,environment,diver,turtles,agents,mantas){
    const tracks=new Map(),a=new T.Vector3(),b=new T.Vector3(),va=new T.Vector3(),vb=new T.Vector3(),flow=new T.Vector3();
    let last=null;const stats={diver:0,turtle:0,fish:0,manta:0};
    function edge(key,p,q,dt,night,activity,kind){
      let old=tracks.get(key);
      if(!old){old={a:p.clone(),b:q.clone(),seen:last};tracks.set(key,old);return;}
      const contiguous=last-old.seen<=.2;
      va.subVectors(p,old.a).divideScalar(dt);vb.subVectors(q,old.b).divideScalar(dt);
      old.a.copy(p);old.b.copy(q);old.seen=last;
      environment.current(p,last,flow);va.sub(flow);vb.sub(flow);
      const speed=Math.max(va.length(),vb.length());
      if(contiguous&&night>.01&&activity>.04&&speed>.2&&speed<7){
        const brightness=kind==='turtle'?.5:1;
        bio.emitEdge(p,q,va,vb,night*Math.min(1.2,speed*.65)*activity*brightness,7*activity,.10);stats[kind]++;
      }
    }
    function finPoint(rig,index,x,y,z,out){
      const bone=rig.joints[index?'finR':'finL']||rig.joints[index?'kneeR':'kneeL'],slot=rig.mesh.skeleton.bones.indexOf(bone);
      return out.set(x,y,z).applyMatrix4(rig.mesh.skeleton.boneInverses[slot]).applyMatrix4(bone.matrixWorld);
    }
    function update(time,paused,count){
      const dt=last===null?0:time-last;last=time;
      if(paused||dt<=0)return;
      if(dt>.2){tracks.clear();return;}
      const night=1-T.MathUtils.smoothstep(water.daylight.value,.05,.55);
      if(diver.group.visible){
        const rig=diver.rig;rig.mesh.updateMatrixWorld(true);
        for(let i=0;i<2;i++){
          const z=i?.095:-.095,bend=window.sampleFreediverBlade(diver.blades[i]);
          finPoint(rig,i,bend.x,-1.82+bend.y,z-.10,a);finPoint(rig,i,bend.x,-1.82+bend.y,z+.10,b);
          edge('diver-fin'+i,a,b,dt,night,.35+.65*diver.body.state.effort,'diver');
          a.copy(rig.worldHands[i]);b.copy(a);b.y+=.07;
          edge('diver-hand'+i,a,b,dt,night,diver.state.armActivity||0,'diver');
        }
      }
      if(turtles.group.visible)for(let i=0;i<turtles.animals.length;i++){
        const animal=turtles.animals[i];if(!animal.root.visible)continue;animal.root.updateMatrixWorld(true);
        for(let j=0;j<animal.flippers.length;j++){
          const f=animal.flippers[j];a.set(-.15,0,f.side*.52);b.set(-.38,0,f.side*1.05);f.pivot.localToWorld(a);f.pivot.localToWorld(b);
          edge('turtle'+i+'-'+j,a,b,dt,night,animal.finUniforms.effort.value,'turtle');
        }
      }
      if(mantas&&mantas.group.visible)for(let i=0;i<mantas.animals.length;i++){
        const animal=mantas.animals[i];if(!animal.root.visible)continue;animal.root.updateMatrixWorld(true);
        function wing(x,z,out){const r=Math.abs(z)/2.8,w=r**1.65,phase=animal.u.phase.value-r*.95-x*.17,e=animal.u.effort.value;
          const y=w*((Math.sin(phase)+.16*Math.sin(phase*2-.6))*(.30+.92*e)+.16*(1-e))+w*x*.13*Math.cos(phase-.4)*e+z*animal.u.bank.value*.12;
          out.set(x,y,z);animal.root.localToWorld(out);}
        for(const side of [-1,1]){wing(-.8,side*1.6,a);wing(-.6,side*2.75,b);edge('manta'+i+side,a,b,dt,night,animal.u.effort.value,'manta');}
      }
      // Bound the cost for large schools; rotate the sample across individuals.
      const stride=Math.max(1,Math.ceil(count/24)),offset=Math.floor(time*30)%stride;
      if(night>.01)for(let i=offset;i<count;i+=stride){
        const f=agents.fish[i];if(!f||f.alert<=0||f.v.length()<.55)continue;
        a.copy(f.p).addScaledVector(f.v,-.2);
        bio.emitBurst(a.x,a.y,a.z,f.v.x,f.v.y,f.v.z,night*.8,2,.06);stats.fish++;
      }
    }
    return {update,stats};
  };
})();
