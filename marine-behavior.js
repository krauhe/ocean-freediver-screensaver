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
    const bounds=[{lo:new T.Vector3(-17,-25,-29),hi:new T.Vector3(13,-10,-19)}];
    // Keep the actual truck envelope, including its rotation and burial.
    if(truck){truck.group.updateMatrixWorld(true);bounds.push(new T.Box3().setFromObject(truck.group,true));}
    const floor=(x,z)=>-24+.18*Math.sin(x*.23)*Math.sin(z*.17)+.09*Math.sin(x*.49+z*.28);
    function steer(p,velocity,r,out){
      out.set(0,0,0);scratch.copy(p).addScaledVector(velocity,r>2?6:3.2);
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
  window.createMarineAgents=function(T,environment,fishSeeds,sharks,camera=null){
    const random=a=>{a.seed=(1664525*a.seed+1013904223)>>>0;return a.seed/4294967296;};
    const schools=[[-11,1,10],[-12,-5,-28],[35,7,-23]].map((p,i)=>({center:new T.Vector3(...p),home:new T.Vector3(...p),goal:new T.Vector3(...p),velocity:new T.Vector3(),members:0,seed:1777+i*391,timer:0,radius:3.5}));
    const fish=fishSeeds.map((s,i)=>{
      const school=i%5===4?2:i%2,home=schools[school].home;
      const p=home.clone().add(new T.Vector3((s[0]-.5)*7,(s[1]-.5)*3,(s[2]-.5)*6));
      return {p,v:new T.Vector3(.5,0,.15),force:new T.Vector3(),target:p.clone(),home:home.clone(),school,seed:7919*(i+1),timer:i*.13,alert:0,mode:'school',stroke:s[3],bank:0,size:.48+s[1]*.20,pace:.55+s[0]*.14};
    });
    const cells=new Map(),cellSize=1.1,neighbours=[],nearDistances=[],stats={checks:0};
    const key=(x,y,z)=>x+','+y+','+z;
    function prepareSchools(count,dt){
      cells.clear();stats.checks=0;
      for(const s of schools){s.center.set(0,0,0);s.velocity.set(0,0,0);s.members=0;}
      for(let i=0;i<count;i++){
        const f=fish[i],s=schools[f.school];s.center.add(f.p);s.velocity.add(f.v);s.members++;
        const k=key(Math.floor(f.p.x/cellSize),Math.floor(f.p.y/cellSize),Math.floor(f.p.z/cellSize));
        if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
      }
      schools.forEach((s,i)=>{
        if(s.members){s.center.multiplyScalar(1/s.members);s.velocity.multiplyScalar(1/s.members);}
        s.timer-=dt;
        if(s.timer<=0||s.center.distanceTo(s.goal)<2){
          const reef=i===2;
          s.goal.copy(s.home).add(new T.Vector3((random(s)-.5)*(reef?20:32),(random(s)-.5)*(reef?2:9),(random(s)-.5)*(reef?13:22)));
          s.goal.z=Math.min(16,s.goal.z);
          s.timer=25+random(s)*25;
        }
      });
    }
    const profiles={greatwhite:{pace:1.05,spacing:10,alignment:0,turn:.24},hammerhead:{pace:.76,spacing:6,alignment:.14,turn:.31}};
    const flow=new T.Vector3(),avoid=new T.Vector3(),delta=new T.Vector3(),average=new T.Vector3(),alignment=new T.Vector3();
    let lastTime,accumulator=0,simTime=0;
    function initShark(s,time,i){
      // Stratify angular position as well as depth. Distant animals need a
      // wider world-space habitat to occupy the sides of a perspective view.
      const lane=i%3,depth=Math.floor(i/3)%3;
      const z=[-9,-32,-59][depth]+Math.sin(s.phase)*4;
      const angular=[-.68,.02,.66][lane]+Math.sin(s.phase*1.7)*.09;
      const home=new T.Vector3(angular*(27-z),lane===2?7.2+1.2*Math.sin(s.phase):s.y,z);
      s.navigation={p:home.clone(),home,v:new T.Vector3(s.direction,0,0),target:new T.Vector3(),seed:9389*(i+1),timer:0,mode:'cruise',turn:0,yaw:s.direction>0?0:Math.PI,pitch:0,speed:.85,returnAt:0,journey:0,wasHeld:false};
      const n=s.navigation;environment.constrain(n.p,s.scale*4.9,n.v);n.target.copy(n.p);
    }
    const viewPoint=new T.Vector3(),collisionVelocity=new T.Vector3();
    function outsideView(p,radius){
      if(!camera)return Math.abs(p.x)>(27-p.z)*2.2+radius;
      viewPoint.copy(p).applyMatrix4(camera.matrixWorldInverse);const depth=-viewPoint.z;
      if(depth<radius)return false;
      const margin=radius*camera.projectionMatrix.elements[0]/depth+.18;
      viewPoint.copy(p).project(camera);return Math.abs(viewPoint.x)>1+margin;
    }
    function planPatrol(n,s,i){
      const cross=i%3!==0||n.journey%3===2;
      if(cross){const sign=n.p.x>0?-1:1;n.target.set(sign*(27-n.p.z)*2.8,7+Math.sin(i)*.7,n.p.z+(random(n)-.5)*18);n.mode='passage';}
      else {const far=n.journey%2===0;n.target.set(7+random(n)*3,-4+random(n)*7,far?-72:-8);n.mode='reef patrol';}
      n.timer=130+random(n)*100;n.journey++;
    }
    function step(dt,time,threats,count,held){
      prepareSchools(count,dt);
      const observers=sharks.map((s,i)=>({i,d:s.mesh.visible&&s!==held?Math.min(...schools.filter(g=>g.members>15).map(g=>s.navigation.p.distanceToSquared(g.center))):Infinity})).sort((a,b)=>a.d-b.d).slice(0,2);

      for(let i=0;i<sharks.length;i++){
        const s=sharks[i],n=s.navigation;
        if(n.returnAt){
          if(s.populationEnabled===false)continue;
          if(time<n.returnAt){s.mesh.visible=false;continue;}
          const z=-8-random(n)*65,side=random(n)<.5?-1:1;
          n.p.set(side*(27-z)*3.2,6+random(n)*2,z);
          n.home.copy(n.p);n.yaw=side>0?Math.PI:0;n.pitch=0;n.turn=0;n.timer=0;n.returnAt=0;
          n.v.set(Math.cos(n.yaw)*n.speed,0,Math.sin(n.yaw)*n.speed);
          s.offset.set(0,0,0);s.velocity.set(0,0,0);s.angularVelocity.set(0,0,0);s.rotationOffset.identity();
          s.mesh.position.copy(n.p);s.mesh.visible=true;s.hasPrevFinPos=false;s.bioBodyReady=false;
        }
        if(!s.mesh.visible)continue;
        if(s===held){n.wasHeld=true;continue;}
        // Fold collision/drag displacement into the navigation state, preserving
        // position on release instead of returning to an invisible orbit.
        n.p.add(s.offset);s.offset.set(0,0,0);
        const profile=profiles[s.species]||profiles.hammerhead;
        n.timer-=dt;
        if(n.timer<=0 || n.p.distanceToSquared(n.target)<16){
          planPatrol(n,s,i);
        }
        delta.subVectors(n.target,n.p).normalize().multiplyScalar(profile.pace*(.85+.25*s.scale));
        n.mode=i%3===0?'reef patrol':'passage';n.inspecting=false;
        // Only a subset of nearby sharks investigate; terrain and personal space
        // retain priority. This is an artistic hunting cue, not an ecological claim.
        if(observers.some(o=>o.i===i)&&count>=30&&Math.sin(time*.025+i)>.05){
          let nearest=null,best=40;
          for(const school of schools){const d=n.p.distanceTo(school.center);if(school.members>15&&d<best){nearest=school;best=d;}}
          if(nearest){
            const radial=avoid.subVectors(n.p,nearest.center);radial.y=0;const distance=radial.length();radial.normalize();
            const radius=7+s.scale*3,sign=i%2?1:-1;
            delta.set(-radial.z*sign,0,radial.x*sign).multiplyScalar(profile.pace*.8)
              .addScaledVector(radial,T.MathUtils.clamp((radius-distance)*.22,-.8,.8))
              .addScaledVector(nearest.velocity,.5);
            delta.y=T.MathUtils.clamp((nearest.center.y+1.5-n.p.y)*.15,-.25,.25);n.mode='inspect school';n.inspecting=true;
          }
        }
        environment.steer(n.p,n.v,s.scale*4.9,avoid);if(avoid.lengthSq()>.02)n.mode='avoid terrain';delta.add(avoid);
        for(let j=0;j<sharks.length;j++){
          const other=sharks[j];if(other===s||!other.mesh.visible)continue;
          const op=other.navigation.p,d=n.p.distanceTo(op),range=profile.spacing+s.scale*2;
          if(d<range&&d>.01){avoid.subVectors(n.p,op).multiplyScalar((1-d/range)*1.8/d);delta.add(avoid);n.mode='give way';}
          // Only a weak, local tendency for hammerheads. White sharks do not flock.
          if(profile.alignment&&other.species===s.species&&d>range&&d<20&&other.navigation)delta.addScaledVector(other.navigation.v,profile.alignment);
        }
        for(const t of threats){if(t.kind!=='diver')continue;const d=n.p.distanceTo(t.p);if(d<8&&d>.01)delta.addScaledVector(avoid.subVectors(n.p,t.p),(1-d/8)*1.4/d);}
        // Persistent heading and positive forward speed: never derive yaw from
        // a velocity vector that can cancel to zero or reverse under repulsion.
        if(n.p.z<-100)delta.z+=(-100-n.p.z)*.15;if(n.p.z>7)delta.z-=(n.p.z-7)*.25;
        if(n.p.x>-3&&n.p.y<7){delta.x-=Math.max(0,n.p.x+3)*.65;delta.z+=n.v.z>=0?.7:-.7;}
        if(n.p.x>8&&n.p.y<9)delta.y+=Math.max(0,9-n.p.y)*1.5;
        const desiredYaw=Math.atan2(delta.z,delta.x);
        const error=Math.atan2(Math.sin(desiredYaw-n.yaw),Math.cos(desiredYaw-n.yaw));
        const maxYawRate=n.speed/Math.max(6,s.scale*8);
        const desiredTurn=T.MathUtils.clamp(error*.55,-maxYawRate,maxYawRate);
        n.turn+=T.MathUtils.clamp(desiredTurn-n.turn,-.055*dt,.055*dt);
        n.yaw+=n.turn*dt;
        const desiredPitch=T.MathUtils.clamp(Math.atan2(delta.y,Math.max(.2,Math.hypot(delta.x,delta.z))),-.28,.28);
        n.pitch+=T.MathUtils.clamp(desiredPitch-n.pitch,-.045*dt,.045*dt);
        const targetSpeed=profile.pace*(.85+.18*s.scale)*(1-.18*Math.min(1,Math.abs(error)));
        n.speed+=T.MathUtils.clamp(targetSpeed-n.speed,-.12*dt,.12*dt);
        n.speed=Math.max(profile.pace*.65,n.speed);
        n.v.set(Math.cos(n.yaw)*Math.cos(n.pitch),Math.sin(n.pitch),Math.sin(n.yaw)*Math.cos(n.pitch)).multiplyScalar(n.speed);
        environment.current(n.p,time,flow);n.p.addScaledVector(n.v,dt).addScaledVector(flow,dt*.25);
        collisionVelocity.copy(n.v);environment.constrain(n.p,s.scale*4.9,collisionVelocity);
        // Departures and replacements happen only beyond the full camera frustum.
        if(outsideView(n.p,s.scale*6)&&n.p.x*n.v.x>0&&Math.abs(n.p.x)>30){
          n.returnAt=time+12+random(n)*25;s.mesh.visible=false;n.mode='away';
        }
        n.wasHeld=false;
      }
      // Read every neighbour before integrating any fish: no update-order flock bias.
      for(let i=0;i<count;i++){
        const a=fish[i];a.alert=Math.max(0,a.alert-dt);const school=schools[a.school];
        const f=a.force;f.subVectors(school.goal,a.p).normalize().multiplyScalar(.22);
        average.set(0,0,0);alignment.set(0,0,0);neighbours.length=0;nearDistances.length=0;
        const cx=Math.floor(a.p.x/cellSize),cy=Math.floor(a.p.y/cellSize),cz=Math.floor(a.p.z/cellSize);
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
          const bucket=cells.get(key(cx+x,cy+y,cz+z));if(!bucket)continue;
          for(const j of bucket){
            if(i===j)continue;stats.checks++;const b=fish[j],d2=a.p.distanceToSquared(b.p);
            if(d2<.42*.42&&d2>.000001)f.addScaledVector(delta.subVectors(a.p,b.p),(.42-Math.sqrt(d2))*7/d2);
            // Eight nearest visible neighbours is a bounded modelling choice,
            // not the starling-specific seven-neighbour measurement.
            if(a.school!==b.school||d2>cellSize*cellSize)continue;
            delta.subVectors(b.p,a.p);if(delta.dot(a.v)<-.8*Math.sqrt(d2)*a.v.length())continue;
            let at=nearDistances.findIndex(d=>d>d2);if(at<0)at=nearDistances.length;
            if(at<8){neighbours.splice(at,0,b);nearDistances.splice(at,0,d2);if(neighbours.length>8){neighbours.pop();nearDistances.pop();}}
          }
        }
        for(const b of neighbours){average.add(b.p);alignment.add(b.v);}
        if(neighbours.length){average.multiplyScalar(1/neighbours.length).sub(a.p);alignment.multiplyScalar(1/neighbours.length);f.addScaledVector(average,.48).addScaledVector(alignment,1.10);}
        else f.addScaledVector(delta.subVectors(school.center,a.p).normalize(),.65);
        // Small individual course variation travels through local interactions.
        f.y+=Math.sin(time*.31+a.seed*.001)*.018;
        for(const threat of threats){
          const range=threat.kind==='shark'?threat.radius+5:threat.kind==='diver'?3.5:1.2;
          const d=a.p.distanceTo(threat.p);
          if(d<range&&d>.001){f.addScaledVector(delta.subVectors(a.p,threat.p),(1-d/range)*3/d);a.alert=2.5;}
        }
        a.mode=a.alert>0?'escape':neighbours.length<2?'regroup':'school';
        environment.steer(a.p,a.v,.25,avoid);f.addScaledVector(avoid,1.5);
        if(a.school===2&&a.p.y<-1.2)f.y+=(-1.2-a.p.y)*1.5;
        if(a.p.y<-11)f.y+=(-11-a.p.y)*.4;
        if(a.p.y>11)f.y-=(a.p.y-11)*.4;
        // Keep the foreground school in the water, clear of the camera at z=27.
        if(a.p.z>18)f.z-=(a.p.z-18)*.6;
        f.clampLength(.10,a.pace*(a.alert>0?2.7:1.35));f.sub(a.v).clampLength(0,a.alert>0?2.2:.65);
      }
      for(let i=0;i<count;i++){const a=fish[i];const yaw=Math.atan2(a.v.z,a.v.x);a.v.addScaledVector(a.force,dt);const turn=Math.atan2(Math.sin(Math.atan2(a.v.z,a.v.x)-yaw),Math.cos(Math.atan2(a.v.z,a.v.x)-yaw))/dt;a.bank+=(T.MathUtils.clamp(-turn*.25,-.55,.55)-a.bank)*(1-Math.exp(-dt*4));a.stroke=(a.stroke+dt*(3+a.v.length()*10))%(Math.PI*2);environment.current(a.p,time,flow);a.p.addScaledVector(a.v,dt).addScaledVector(flow,dt);environment.constrain(a.p,.18,a.v);}
    }
    function update(time,threats,count,held){
      // Sliders can create animals while paused; initialise before rendering them.
      sharks.forEach((s,i)=>{if(!s.navigation)initShark(s,time,i);});
      if(lastTime===undefined){lastTime=time;simTime=time;return;}
      const elapsed=time-lastTime;lastTime=time;
      if(elapsed<=0)return;
      accumulator+=Math.min(.5,elapsed);
      while(accumulator>=1/30){simTime+=1/30;step(1/30,simTime,threats,count,held);accumulator-=1/30;}
    }
    return {fish,schools,stats,profiles,update};
  };
})();
