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
  window.createMarineEnvironment=function(T,site,truck,camera=null){
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
        const lip=site.terrain?site.terrain.lipHeight(scratch.z):-3.4;
        const f=T.MathUtils.clamp((scratch.y+24)/(lip+24),0,1);
        const wall=site.terrain?site.terrain.wallPosition(f,scratch.z):20.8;
        if(scratch.y<lip+r&&scratch.x>wall-r&&scratch.z>-81&&scratch.z<38)out.x-=Math.min(3,(scratch.x-wall+r)*.4);
        if(scratch.y<-23+r)out.y+=(-23+r-scratch.y)*.6;
        if(site.terrain&&site.terrain.reefBlocks)for(const b of site.terrain.reefBlocks){
          const x=T.MathUtils.clamp(scratch.x,b.lo[0],b.hi[0]),y=T.MathUtils.clamp(scratch.y,b.lo[1],b.hi[1]),z=T.MathUtils.clamp(scratch.z,b.lo[2],b.hi[2]);
          v.set(scratch.x-x,scratch.y-y,scratch.z-z);const d=v.length(),range=r+1.1;
          if(d<range){if(d>.001)out.addScaledVector(v,(1-d/range)*1.6/d);else out.y+=1.2;}
        }
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
    function constrain(p,r,velocity,surfaceLimit=13-r){
      offset.set(0,0,0);
      if(site)site.constrain(p,r,offset,velocity);
      offset.set(0,0,0);if(truck)truck.constrain(p,r,offset,velocity);
      p.y=Math.min(surfaceLimit,Math.max(-24+r,p.y));
      if(camera){
        scratch.subVectors(p,camera.position);const distance=scratch.length(),limit=4+r;
        if(distance<limit){
          if(distance>1e-6)scratch.divideScalar(distance);else camera.getWorldDirection(scratch);
          p.copy(camera.position).addScaledVector(scratch,limit);
          const inward=velocity.dot(scratch);if(inward<0)velocity.addScaledVector(scratch,-inward);
        }
      }
    }
    // Navigation targets beside solid cover; these never move an animal directly.
    function cliffPoint(f,z,out){
      const terrain=site&&site.terrain,lip=terrain?terrain.lipHeight(z):-3.4;
      const y=-24+(lip+24)*f;
      let x=(terrain?terrain.wallPosition(f,z):20.8)-1.3;
      if(terrain)for(const b of terrain.cliffBlocks){if(y>b.lo[1]-.6&&y<b.hi[1]+.6&&z>b.lo[2]-.6&&z<b.hi[2]+.6)x=Math.min(x,b.lo[0]-1);}
      return out.set(x,y,z);
    }
    const coverCandidate=new T.Vector3();
    function shelterPoint(p,out){
      out.copy(p);let best=Infinity;
      const consider=()=>{const d=p.distanceToSquared(coverCandidate);if(d<best){best=d;out.copy(coverCandidate);}};
      if(site&&site.group.visible){
        cliffPoint(T.MathUtils.clamp((p.y+24)/20.6,.07,.94),p.z,coverCandidate);consider();
        for(const x of [-15,-7,2,10]){coverCandidate.set(x,-20,-17.5);consider();}
        const terrain=site.terrain;
        if(terrain&&terrain.reefBlocks)for(const b of terrain.reefBlocks){
          const x=(b.lo[0]+b.hi[0])*.5,z=(b.lo[2]+b.hi[2])*.5;
          coverCandidate.set(x,b.hi[1]+.8,z);consider();
        }
      }
      return out;
    }
    return {floor,cliffPoint,shelterPoint,cliffFraction:(y,z)=>T.MathUtils.clamp((y+24)/((site&&site.terrain?site.terrain.lipHeight(z):-3.4)+24),.08,.94),grazingPatches:site?site.grazingPatches:[],hasHabitat:()=>!!(site&&site.group.visible),current:window.OceanCurrent.sample,steer,constrain,setRig(value){rig=value;}};
  };
  window.createMarineAgents=function(T,environment,fishSeeds,sharks,camera=null){
    const random=a=>{a.seed=(1664525*a.seed+1013904223)>>>0;return a.seed/4294967296;};
    const habitats=[[-8,-13,-14],[30,4,-23],[4,-19,-5]],openWater=[[-11,1,10],[-12,-5,-28],[12,3,-23]];
    const routes=[
      [[-8,-20,-14],[-24,-19,-17],[-25,-20,-25],[-30,-20,-28],[-23,-19,-16],[-13,-21,-9],[6,-21,-11]],
      null,
      [[4,-21,-5],[-11,-21,-10],[-24,-19,-17],[-30,-20,-27],[-24,-20,-25],[-20,-20,-14],[-2,-21,-11],[8,-21,-12]]
    ],routeDir=new T.Vector3(),desiredGoal=new T.Vector3();
    habitats[0][1]=-20;habitats[2][1]=-21;
    if(environment.cliffPoint){
      routes[1]=[[.12,-12],[.38,-8],[.66,-5],[.9,0],[.67,6],[.36,9],[.12,3]].map(([f,z])=>environment.cliffPoint(f,z,new T.Vector3()).toArray());
      habitats[1]=routes[1][2].slice();
    }
    const schools=habitats.map((p,i)=>({center:new T.Vector3(...p),home:new T.Vector3(...p),goal:new T.Vector3(...p),velocity:new T.Vector3(),wander:new T.Vector3(),wp:1,members:0,seed:(Math.random()*4294967296)>>>0,timer:Math.random()*12,radius:3.5}));
    const fish=fishSeeds.map((s,i)=>{
      const school=i%3,home=schools[school].home;
      const p=home.clone().add(new T.Vector3((s[0]-.5)*7,(s[1]-.5)*3,(s[2]-.5)*6));
      if(school===1)environment.constrain(p,.18,new T.Vector3());
      return {p,v:new T.Vector3(.5,0,.15),force:new T.Vector3(),target:p.clone(),home:home.clone(),school,seed:(Math.random()*4294967296)>>>0,timer:Math.random()*4,alert:0,mode:'school',stroke:s[3],bank:0,size:.48+s[1]*.20,pace:.55+s[0]*.14,vigilance:.78+s[0]*.44,reactionRate:2.2+s[2]*3.2,lateralBias:(i%2?1:-1)*(.22+s[1]*.26),exposure:0,fleeLevel:0,recover:0};
    });
    for(const a of fish){a.cover=new T.Vector3();a.coverTime=0;a.coverPending=false;}
    const cells=new Map(),cellSize=1.1,neighbours=[],nearDistances=[],stats={checks:0};
    const key=(x,y,z)=>x+','+y+','+z;
    function prepareSchools(count,dt){
      cells.clear();stats.checks=0;
      for(const s of schools){s.center.set(0,0,0);s.velocity.set(0,0,0);s.members=0;}
      for(let i=0;i<count;i++){
        const f=fish[i];if(f.interactionHeld)continue;
        const s=schools[f.school];s.center.add(f.p);s.velocity.add(f.v);s.members++;
        const k=key(Math.floor(f.p.x/cellSize),Math.floor(f.p.y/cellSize),Math.floor(f.p.z/cellSize));
        if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
      }
      schools.forEach((s,i)=>{
        if(s.members){s.center.multiplyScalar(1/s.members);s.velocity.multiplyScalar(1/s.members);}
        const route=environment.hasHabitat()?routes[i]:null;
        if(route){
          let wp=delta.set(...route[s.wp]),dist=s.home.distanceTo(wp);
          if(dist<2||(dist<4.5&&s.members&&s.center.distanceTo(wp)<5.5)){
            s.wp=(s.wp+1)%route.length;
            wp.set(...route[s.wp]);dist=s.home.distanceTo(wp);
          }
          if(dt>0){
            routeDir.subVectors(wp,s.home);
            if(dist>1e-4)routeDir.divideScalar(dist);
            const lag=s.members?s.home.distanceTo(s.center):0;
            const speed=lag>5?Math.max(.18,.68-(lag-5)*.12):.68;
            s.home.addScaledVector(routeDir,Math.min(dist,speed*dt));
            if(s.members&&lag>6.5)s.home.lerp(s.center,1-Math.exp(-dt*.8));
            s.timer-=dt;
            if(s.timer<=0){
              s.wander.set((random(s)-.5)*3,(random(s)-.5)*1.2,(random(s)-.5)*3);
              s.timer=10+random(s)*12;
            }
            desiredGoal.copy(s.home).addScaledVector(routeDir,Math.min(dist,3.5)).add(s.wander);
            desiredGoal.y=T.MathUtils.clamp(desiredGoal.y,-22,-4.5);
            if(i===1&&environment.cliffPoint){
              environment.cliffPoint(environment.cliffFraction(s.home.y,s.home.z),s.home.z,s.home);
              environment.cliffPoint(environment.cliffFraction(desiredGoal.y,desiredGoal.z),desiredGoal.z,desiredGoal);
            }
            desiredGoal.z=Math.min(16,desiredGoal.z);
            s.goal.lerp(desiredGoal,1-Math.exp(-dt*2.2));
          }
        }else if(dt>0){
          const px=s.home.x,py=s.home.y,pz=s.home.z;
          s.home.lerp(delta.set(...(environment.hasHabitat()?habitats[i]:openWater[i])),1-Math.exp(-dt*.2));
          s.goal.x+=s.home.x-px;s.goal.y+=s.home.y-py;s.goal.z+=s.home.z-pz;
          s.timer-=dt;
          if(s.timer<=0||s.center.distanceTo(s.goal)<2){
            const reef=i===1;
            s.goal.copy(s.home).add(new T.Vector3((random(s)-.5)*(reef?9:7),(random(s)-.5)*(reef?2:3),(random(s)-.5)*(reef?8:6)));
            s.goal.z=Math.min(16,s.goal.z);
            s.timer=25+random(s)*25;
          }
        }
      });
      for(let i=0;i<fish.length;i++)fish[i].home.copy(schools[fish[i].school].home);
    }
    const profiles={greatwhite:{pace:1.05,spacing:10,alignment:0,turn:.24},hammerhead:{pace:.76,spacing:6,alignment:.14,turn:.31}};
    const flow=new T.Vector3(),avoid=new T.Vector3(),delta=new T.Vector3(),average=new T.Vector3(),alignment=new T.Vector3(),predatorDir=new T.Vector3(),lateralVec=new T.Vector3(),relVel=new T.Vector3(),fleeForce=new T.Vector3();
    let lastTime,accumulator=0,simTime=0;
    function initShark(s,time,i){
      // Stratify angular position as well as depth. Distant animals need a
      // wider world-space habitat to occupy the sides of a perspective view.
      const lane=i%3,depth=Math.floor(i/3)%3;
      const z=[-9,-32,-59][depth]+(Math.random()-.5)*14;
      const angular=[-.68,.02,.66][lane]+Math.sin(s.phase*1.7)*.09;
      const home=new T.Vector3(angular*(27-z),lane===2?7.2+1.2*Math.sin(s.phase):s.y,z);
      s.navigation={p:home.clone(),home,v:new T.Vector3(s.direction,0,0),target:new T.Vector3(),seed:(Math.random()*4294967296)>>>0,timer:0,mode:'cruise',turn:0,yaw:s.direction>0?0:Math.PI,pitch:0,speed:.85,returnAt:0,journey:0,wasHeld:false,enteredAt:time,travel:s.direction};
      const n=s.navigation;environment.constrain(n.p,s.scale*4.9,n.v);n.target.copy(n.p);
      if(i%8!==0){n.returnAt=time+20+i*11+random(n)*90;s.mesh.visible=false;n.mode='away';}
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
      n.target.set(n.travel*(27-n.p.z)*2.8,7+Math.sin(i)*.7,n.p.z+(random(n)-.5)*12);
      n.mode='passage';n.timer=130+random(n)*100;n.journey++;
    }
    function step(dt,time,threats,count,held){
      prepareSchools(count,dt);
      const observers=sharks.map((s,i)=>({i,d:s.mesh.visible&&s!==held?Math.min(...schools.filter(g=>g.members>15).map(g=>s.navigation.p.distanceToSquared(g.center))):Infinity})).sort((a,b)=>a.d-b.d).slice(0,2);

      for(let i=0;i<sharks.length;i++){
        const s=sharks[i],n=s.navigation;
        if(n.returnAt){
          if(s.populationEnabled===false)continue;
          if(time<n.returnAt){s.mesh.visible=false;continue;}
          const visitorLimit=Math.max(1,Math.ceil(sharks.filter(a=>a.populationEnabled!==false).length/8));
          if(sharks.filter(a=>a.mesh.visible).length>=visitorLimit){n.returnAt=time+20+random(n)*45;continue;}
          const z=-8-random(n)*45,side=random(n)<.5?-1:1;
          n.travel=-side;n.enteredAt=time;
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
        n.mode='passage';n.inspecting=false;
        // Only a subset of nearby sharks investigate; terrain and personal space
        // retain priority. This is an artistic hunting cue, not an ecological claim.
        if(time-n.enteredAt<35&&observers.some(o=>o.i===i)&&count>=30&&Math.sin(time*.025+i)>.05){
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
          n.returnAt=time+60+random(n)*180;s.mesh.visible=false;n.mode='away';
        }
        n.wasHeld=false;
      }
      // Read every neighbour before integrating any fish: no update-order flock bias.
      for(let i=0;i<count;i++){
        const a=fish[i];if(a.interactionHeld){a.force.set(0,0,0);continue;}
        a.alert=Math.max(0,a.alert-dt);const school=schools[a.school];
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
        for(const b of neighbours){average.add(b.p);alignment.addScaledVector(b.v,(b.alert>0&&a.exposure<=.05&&a.alert<=0)?.45:1);}
        if(neighbours.length){average.multiplyScalar(1/neighbours.length).sub(a.p);alignment.multiplyScalar(1/neighbours.length);f.addScaledVector(average,.48).addScaledVector(alignment,1.10);}
        else f.addScaledVector(delta.subVectors(school.center,a.p).normalize(),.65);
        // Small individual course variation travels through local interactions.
        f.y+=Math.sin(time*.31+a.seed*.001)*.018;
        fleeForce.set(0,0,0);
        let maxPredStimulus=0,minPredDist=Infinity,closestClosing=0;
        for(const threat of threats){
          if(!threat||!threat.p)continue;
          if(threat.kind==='predator'){
            const r=threat.radius!==undefined?threat.radius:.85;
            if(r<=0)continue;
            delta.subVectors(a.p,threat.p);
            const d=delta.length();
            if(d<.0001)continue;
            predatorDir.copy(delta).divideScalar(d);
            const closing=threat.v?threat.v.dot(predatorDir):0;
            const relClose=threat.v?relVel.subVectors(threat.v,a.v).dot(predatorDir):0;
            const approachBoost=closing>0?1+Math.min(.85,closing*.75+Math.max(0,relClose)*.25):Math.max(.32,1+closing*.48);
            const effRange=(r+3.5)*a.vigilance*(closing>0?1+Math.min(.32,closing*.24):.76);
            if(d<effRange){
              const prox=1-d/effRange,stim=prox*approachBoost;
              if(stim>maxPredStimulus)maxPredStimulus=stim;
              if(d<minPredDist){minPredDist=d;closestClosing=closing;}
              let sideSign=a.lateralBias>=0?1:-1;
              if(threat.v&&(threat.v.x*threat.v.x+threat.v.z*threat.v.z)>.005){
                const cross=predatorDir.x*(-threat.v.z)+predatorDir.z*threat.v.x;
                if(Math.abs(cross)>.04)sideSign=cross>0?1:-1;
              }
              lateralVec.set(-predatorDir.z,0,predatorDir.x);
              const latLen=lateralVec.length();
              if(latLen>.001)lateralVec.divideScalar(latLen);
              const latMag=(.22+Math.abs(a.lateralBias)*.45)*sideSign+.10*Math.sin(time*1.6+(a.seed&4095)*.0015);
              const urgency=prox*(.75+1.45*prox)*approachBoost*(1.8/Math.max(.35,d));
              fleeForce.addScaledVector(predatorDir,urgency).addScaledVector(lateralVec,urgency*latMag);
              fleeForce.y*=.45;
            }
          }else{
            const range=threat.kind==='shark'?threat.radius+5:threat.kind==='diver'?3.5:1.2;
            const d=a.p.distanceTo(threat.p);
            if(d<range&&d>.001){f.addScaledVector(delta.subVectors(a.p,threat.p),(1-d/range)*3/d);a.alert=Math.max(a.alert,2.5);}
          }
        }
        const threshold=.18+(1.22-a.vigilance)*.32;
        if(maxPredStimulus>0){
          const innerCore=minPredDist<1.95||(minPredDist<2.5&&closestClosing>.15);
          if(innerCore)a.exposure=Math.max(a.exposure,threshold+.38+Math.min(.42,(2.5-minPredDist)*.28));
          else a.exposure=Math.min(1,a.exposure+dt*a.reactionRate*(.42+1.75*maxPredStimulus*maxPredStimulus));
        }else{
          a.exposure=Math.max(0,a.exposure-dt*(1.15+.35*a.vigilance));
        }
        if(a.exposure>threshold&&fleeForce.lengthSq()>1e-6){
          const rawFlee=(a.exposure-threshold)/(1-threshold)*Math.min(1.25,.55+maxPredStimulus*.95);
          a.fleeLevel=Math.min(1,Math.max(a.fleeLevel*.85,rawFlee));
          const schoolKeep=Math.max(0,1-a.fleeLevel*1.35);
          f.multiplyScalar(schoolKeep);
          f.addScaledVector(fleeForce,.65+.75*a.fleeLevel);
          const oppose=f.dot(fleeForce);
          if(oppose<0)f.addScaledVector(fleeForce,-oppose/fleeForce.lengthSq());
          a.alert=Math.max(a.alert,.45+a.fleeLevel*1.45);
          a.recover=Math.max(a.recover,2.0+a.fleeLevel*2.2+((a.seed&255)/255)*.8);
        }else{
          a.fleeLevel=Math.max(0,a.fleeLevel-dt*1.8);
          a.recover=Math.max(0,a.recover-dt);
        }
        const homeDistance=a.p.distanceTo(school.home);
        if(a.alert>0){a.coverTime=4;a.coverPending=true;}
        else if(a.coverTime>0){
          if(a.coverPending){if(environment.shelterPoint)environment.shelterPoint(a.p,a.cover);else a.cover.copy(school.center);a.coverPending=false;}
          a.coverTime=Math.max(0,a.coverTime-dt);
          if(environment.hasHabitat())f.addScaledVector(delta.subVectors(a.cover,a.p).normalize(),.8);
        }
        if(homeDistance>5&&a.alert<=0&&a.fleeLevel<=0&&a.coverTime<=0)f.addScaledVector(delta.subVectors(school.home,a.p).normalize(),Math.min(1.4,(homeDistance-5)*.18));
        if(a.alert<=0&&a.fleeLevel<=0&&a.recover>0){
          f.addScaledVector(delta.subVectors(school.center,a.p).normalize(),Math.min(1,a.recover*.45)*.38);
        }
        a.mode=a.alert>0||a.fleeLevel>.05?'escape':homeDistance>8?'return to shelter':(neighbours.length<2||a.recover>0)?'regroup':'resident school';
        environment.steer(a.p,a.v,.25,avoid);f.addScaledVector(avoid,1.5);
        if(a.school===1&&environment.hasHabitat()&&environment.cliffPoint&&a.alert<=0){
          environment.cliffPoint(environment.cliffFraction(a.p.y,a.p.z),a.p.z,avoid);
          f.x+=T.MathUtils.clamp((avoid.x-a.p.x)*.45,-1,1);
        }
        const lower=environment.hasHabitat()?-22:-11;if(a.p.y<lower)f.y+=(lower-a.p.y)*.4;
        if(a.p.y>11)f.y-=(a.p.y-11)*.4;
        // Keep the foreground school in the water, clear of the camera at z=27.
        if(a.p.z>18)f.z-=(a.p.z-18)*.6;
        const escapeLevel=a.alert>0?Math.max(a.fleeLevel,Math.min(1,a.alert/1.8)):a.fleeLevel;
        f.clampLength(.10,a.pace*(1.35+1.35*escapeLevel));f.sub(a.v).clampLength(0,.65+1.55*escapeLevel);
      }
      for(let i=0;i<count;i++){const a=fish[i];if(a.interactionHeld){a.stroke=(a.stroke+dt*7)%(Math.PI*2);continue;}const yaw=Math.atan2(a.v.z,a.v.x);a.v.addScaledVector(a.force,dt);const turn=Math.atan2(Math.sin(Math.atan2(a.v.z,a.v.x)-yaw),Math.cos(Math.atan2(a.v.z,a.v.x)-yaw))/dt;a.bank+=(T.MathUtils.clamp(-turn*.25,-.55,.55)-a.bank)*(1-Math.exp(-dt*4));a.stroke=(a.stroke+dt*(3+a.v.length()*10))%(Math.PI*2);environment.current(a.p,time,flow);a.p.addScaledVector(a.v,dt).addScaledVector(flow,dt);environment.constrain(a.p,.18,a.v);}
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
