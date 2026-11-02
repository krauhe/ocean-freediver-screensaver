/* SPDX-License-Identifier: GPL-3.0-only
 * Bounded individual-agent models, not a calibrated ecological simulation.
 */
(() => {
  'use strict';
  const shelter=(x,y,z)=>1-.72*Math.exp(-(((x-8)/15)**2)-(((z+24)/9)**2))*Math.max(0,Math.min(1,(-y-12)/8));
  window.OceanCurrent={
    glsl:`
      float marineShelter(vec3 p){return 1.-.72*exp(-pow((p.x-8.)/15.,2.)-pow((p.z+24.)/9.,2.))*clamp((-p.y-12.)/8.,0.,1.);}
      vec3 marineCurrent(vec3 p,float t){return vec3(.08+.022*sin(t*.07),.006*sin(t*.09),-.018+.012*cos(t*.07))*marineShelter(p);}
      vec3 marineDisplacement(vec3 p,float t){return vec3(.08*t+.022/.07*(1.-cos(t*.07)),.006/.09*(1.-cos(t*.09)),-.018*t+.012/.07*sin(t*.07))*marineShelter(p);}
    `,
    sample(p,t,out){const s=shelter(p.x,p.y,p.z);return out.set((.08+.022*Math.sin(t*.07))*s,.006*Math.sin(t*.09)*s,(-.018+.012*Math.cos(t*.07))*s);}
  };
  window.createMarineEnvironment=function(T,site,truck){
    let rig=null;
    const scratch=new T.Vector3(),offset=new T.Vector3(),v=new T.Vector3();
    const bounds=[{lo:new T.Vector3(-17,-25,-29),hi:new T.Vector3(13,-16,-19)}];
    // Keep the actual truck envelope, including its rotation and burial.
    if(truck){truck.group.updateMatrixWorld(true);bounds.push(new T.Box3().setFromObject(truck.group,true));}
    const floor=(x,z)=>-24+.18*Math.sin(x*.23)*Math.sin(z*.17)+.09*Math.sin(x*.49+z*.28);
    function steer(p,velocity,r,out){
      out.set(0,0,0);scratch.copy(p).addScaledVector(velocity,3.2);
      if(rig&&rig.group.visible&&scratch.y>rig.ropeBottomY-2&&scratch.y<rig.ropeTopY+1){
        const dx=scratch.x-rig.rigX,dz=scratch.z-rig.rigZ,d=Math.hypot(dx,dz),range=r+2;
        if(d<range&&d>.001){out.x+=dx/d*(1-d/range)*2;out.z+=dz/d*(1-d/range)*2;}
      }
      if(site&&site.group.visible){
        if(scratch.y<-1+r && scratch.x>15-r && scratch.z>-81 && scratch.z<38)out.x-=Math.min(3,(scratch.x-15+r)*.4);
        if(scratch.y<-23+r)out.y+=(-23+r-scratch.y)*.6;
        for(let i=0;i<bounds.length;i++){
          if(i===1&&(!truck||!truck.group.visible))continue;
          const box=bounds[i],lo=box.lo||box.min,hi=box.hi||box.max;
          const qx=Math.max(lo.x,Math.min(hi.x,scratch.x)),qy=Math.max(lo.y,Math.min(hi.y,scratch.y)),qz=Math.max(lo.z,Math.min(hi.z,scratch.z));
          const dx=scratch.x-qx,dy=scratch.y-qy,dz=scratch.z-qz,d=Math.hypot(dx,dy,dz),range=r+2.5;
          if(d<range){if(d>.001)out.addScaledVector(v.set(dx,dy,dz),(1-d/range)*2/d);else out.y+=2;}
        }
      }
      return out;
    }
    function constrain(p,r,velocity){
      offset.set(0,0,0);
      if(site)site.constrain(p,r,offset,velocity);
      offset.set(0,0,0);if(truck)truck.constrain(p,r,offset,velocity);
      p.y=Math.min(13-r,Math.max(-24+r,p.y));
    }
    return {floor,current:window.OceanCurrent.sample,steer,constrain,setRig(value){rig=value;}};
  };
  window.createMarineAgents=function(T,environment,fishSeeds,sharks){
    const random=a=>{a.seed=(1664525*a.seed+1013904223)>>>0;return a.seed/4294967296;};
    const fish=fishSeeds.map((s,i)=>{
      const school=i%4===0?2:(i<55?0:1),home=school===2?[16,-.3,-19]:school===0?[-12,7,-34]:[-15,-6,-48];
      const p=new T.Vector3(home[0]+(s[0]-.5)*6,home[1]+(s[1]-.5)*2,home[2]+(s[2]-.5)*6);
      return {p,v:new T.Vector3(.3,0,.1),force:new T.Vector3(),target:p.clone(),home:new T.Vector3(...home),school,seed:7919*(i+1),timer:i*.13,alert:0,mode:'school',stroke:s[3],size:.48+s[1]*.42,pace:.40+s[0]*.24};
    });
    const profiles={greatwhite:{pace:1.05,spacing:10,alignment:0,turn:.24},hammerhead:{pace:.76,spacing:6,alignment:.14,turn:.31}};
    const flow=new T.Vector3(),avoid=new T.Vector3(),delta=new T.Vector3(),average=new T.Vector3(),alignment=new T.Vector3();
    let lastTime,accumulator=0,simTime=0;
    function initShark(s,time,i){
      const a=s.phase+time*s.rate*s.direction;
      s.navigation={p:new T.Vector3(Math.sin(a)*s.rx,s.y+Math.sin(a*2+s.phase)*.85,s.z+Math.cos(a)*s.rz),v:new T.Vector3(Math.cos(a)*s.direction,0,-Math.sin(a)*s.direction),target:new T.Vector3(),seed:9389*(i+1),timer:0,mode:'cruise',turn:0,wasHeld:false};
      const n=s.navigation;environment.constrain(n.p,s.scale*4.9,n.v);n.target.copy(n.p);
    }
    function step(dt,time,threats,count,held){
      for(let i=0;i<sharks.length;i++){
        const s=sharks[i],n=s.navigation;if(!s.mesh.visible)continue;
        if(s===held){n.wasHeld=true;continue;}
        // Fold collision/drag displacement into the navigation state, preserving
        // position on release instead of returning to an invisible orbit.
        n.p.add(s.offset);s.offset.set(0,0,0);
        const profile=profiles[s.species]||profiles.hammerhead;
        n.timer-=dt;
        if(n.timer<=0 || n.p.distanceToSquared(n.target)<16){
          const spread=s.species==='greatwhite'?36:26;
          n.target.set(-14+(random(n)-.5)*spread,Math.max(-12,Math.min(10,s.y+(random(n)-.5)*9)),-12-random(n)*55);
          n.timer=18+random(n)*24;n.mode='cruise';
        }
        delta.subVectors(n.target,n.p).normalize().multiplyScalar(profile.pace*(.85+.25*s.scale));
        environment.steer(n.p,n.v,s.scale*4.9,avoid);n.mode=avoid.lengthSq()>.02?'avoid terrain':'cruise';delta.add(avoid);
        for(let j=0;j<sharks.length;j++){
          const other=sharks[j];if(other===s||!other.mesh.visible)continue;
          const op=other.mesh.position,d=n.p.distanceTo(op),range=profile.spacing+s.scale*2;
          if(d<range&&d>.01){avoid.subVectors(n.p,op).multiplyScalar((1-d/range)*1.8/d);delta.add(avoid);n.mode='give way';}
          // Only a weak, local tendency for hammerheads. White sharks do not flock.
          if(profile.alignment&&other.species===s.species&&d>range&&d<20&&other.navigation)delta.addScaledVector(other.navigation.v,profile.alignment);
        }
        for(const t of threats){if(t.kind!=='diver')continue;const d=n.p.distanceTo(t.p);if(d<8&&d>.01)delta.addScaledVector(avoid.subVectors(n.p,t.p),(1-d/8)*1.4/d);}
        if(n.p.x<-62)delta.x+=(-62-n.p.x)*.1;if(n.p.x>14)delta.x-=(n.p.x-14)*.15;
        if(n.p.z<-85)delta.z+=(-85-n.p.z)*.1;if(n.p.z>6)delta.z-=(n.p.z-6)*.2;
        delta.y+=Math.max(0,n.p.y-11)*-.4;
        delta.clampLength(.35,profile.pace*1.3);
        const oldYaw=Math.atan2(n.v.z,n.v.x);
        avoid.subVectors(delta,n.v).clampLength(0,profile.turn);n.v.addScaledVector(avoid,dt);
        environment.current(n.p,time,flow);n.p.addScaledVector(n.v,dt).addScaledVector(flow,dt*.25);
        environment.constrain(n.p,s.scale*4.9,n.v);
        n.turn=Math.atan2(Math.sin(Math.atan2(n.v.z,n.v.x)-oldYaw),Math.cos(Math.atan2(n.v.z,n.v.x)-oldYaw))/dt;
        n.wasHeld=false;
      }
      // Read every neighbour before integrating any fish: no update-order flock bias.
      for(let i=0;i<count;i++){
        const a=fish[i];a.timer-=dt;a.alert=Math.max(0,a.alert-dt);
        if(a.timer<=0 || a.p.distanceToSquared(a.target)<1){
          const reef=a.school===2;
          a.target.copy(a.home).add(new T.Vector3((random(a)-.5)*(reef?5:25),(random(a)-.5)*(reef?1.6:6),(random(a)-.5)*(reef?16:20)));
          a.timer=7+random(a)*13;
        }
        const f=a.force;f.subVectors(a.target,a.p).normalize().multiplyScalar(a.pace);
        average.set(0,0,0);alignment.set(0,0,0);let neighbours=0;
        for(let j=0;j<count;j++){
          if(i===j)continue;const b=fish[j],d=a.p.distanceTo(b.p);
          if(d<.65&&d>.001)f.addScaledVector(delta.subVectors(a.p,b.p),(.65-d)*2/d);
          if(a.school===b.school&&d<5){average.add(b.p);alignment.add(b.v);neighbours++;}
        }
        if(neighbours){average.multiplyScalar(1/neighbours).sub(a.p);alignment.multiplyScalar(1/neighbours);f.addScaledVector(average,.08).addScaledVector(alignment,.55);}
        for(const threat of threats){
          const range=threat.kind==='shark'?threat.radius+5:threat.kind==='diver'?3.5:1.2;
          const d=a.p.distanceTo(threat.p);
          if(d<range&&d>.001){f.addScaledVector(delta.subVectors(a.p,threat.p),(1-d/range)*3/d);a.alert=2.5;}
        }
        a.mode=a.alert>0?'escape':neighbours<2?'regroup':'school';
        environment.steer(a.p,a.v,.25,avoid);f.addScaledVector(avoid,1.5);
        if(a.school===2&&a.p.y<-1.2)f.y+=(-1.2-a.p.y)*1.5;
        if(a.p.y>11)f.y-=(a.p.y-11)*.4;
        f.clampLength(.10,a.pace*(a.alert>0?2.7:1.35));f.sub(a.v).clampLength(0,a.alert>0?2.2:.65);
      }
      for(let i=0;i<count;i++){const a=fish[i];a.v.addScaledVector(a.force,dt);a.stroke=(a.stroke+dt*(3+a.v.length()*10))%(Math.PI*2);environment.current(a.p,time,flow);a.p.addScaledVector(a.v,dt).addScaledVector(flow,dt);environment.constrain(a.p,.18,a.v);}
    }
    function update(time,threats,count,held){
      if(lastTime===undefined){sharks.forEach((s,i)=>initShark(s,time,i));lastTime=time;simTime=time;return;}
      const elapsed=time-lastTime;lastTime=time;
      if(elapsed<=0)return;
      accumulator+=Math.min(.5,elapsed);
      while(accumulator>=1/30){simTime+=1/30;step(1/30,simTime,threats,count,held);accumulator-=1/30;}
    }
    return {fish,profiles,update};
  };
})();
