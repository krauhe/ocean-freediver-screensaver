/* SPDX-License-Identifier: GPL-3.0-only */
(() => {
  window.createRecreationalFreediver=function(T,scene,freedivers,site,world={}){
    const {rig,uniforms:u}=freedivers.createRecreationalRig(),group=new T.Group();
    group.name='Recreational freediver';group.add(rig.mesh);scene.add(group);
    const body=window.createFreediverPhysics(T,{position:new T.Vector3(-7+Math.random()*6,14.55,-15+Math.random()*6)});
    body.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),-Math.PI/2);
    const env=world.environment,goal=new T.Vector3(),subject=new T.Vector3(),desired=new T.Vector3(),heading=new T.Vector3(1,0,0),flow=new T.Vector3(),avoid=new T.Vector3(),local=new T.Vector3(),probe=new T.Vector3(),before=new T.Vector3(),axis=new T.Vector3(),wave={};
    const state={phase:'surface',diveSeconds:0,target:null,visits:0,physics:body.state};
    const handTargets=[new T.Vector3(.04,-.12,-.20),new T.Vector3(.04,-.12,.20)],handGoal=new T.Vector3();
    let armPhase=0,armActivity=0,streamline=0;
    const joints=[{hip:0,knee:0,ankle:.68},{hip:0,knee:0,ankle:.68}],blades=[{x:0,v:0},{x:0,v:0}];
    const memory=new Map();let last=null,elapsed=0,accumulator=0,phaseTime=Math.random()*16,kickPhase=Math.random()*Math.PI*2,effort=0,target=null,seed=(Math.random()*4294967296)>>>0,budget=0,inspectionTime=0;
    const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const clamp=T.MathUtils.clamp;
    function targets(){
      const list=[];
      if(site.group.visible){
        list.push({id:'wreck',p:new T.Vector3(-3,-14,-24),offset:new T.Vector3(0,1,9),interest:1.3});
        list.push({id:'reef',p:new T.Vector3(17,-2,-10),offset:new T.Vector3(-5,3,0),interest:1});
        if(world.truck&&world.truck.group.visible){const p=new T.Vector3();world.truck.group.getWorldPosition(p);list.push({id:'truck',p,offset:new T.Vector3(0,5,6),interest:1.1});}
        (world.crabs||[]).forEach((c,i)=>{if(c.group.visible){const p=new T.Vector3();c.body.getWorldPosition(p);list.push({id:'crab'+i,p,offset:new T.Vector3(0,3,3),interest:1});}});
      }
      if(world.turtles&&world.turtles.group.visible)world.turtles.animals.forEach((a,i)=>{if(a.root.visible)list.push({id:'turtle'+i,p:a.root.position.clone(),offset:new T.Vector3(-3,1,3),interest:1.5});});
      (world.schools||[]).forEach((s,i)=>{if(s.members)list.push({id:'fish'+i,p:s.center.clone(),offset:new T.Vector3(-3,1,3),interest:1});});
      return list;
    }
    function choose(){
      let best=null,score=-Infinity;
      for(const t of targets()){
        const age=elapsed-(memory.get(t.id)??-300),distance=body.position.distanceTo(t.p);
        const s=t.interest+random()*.65-Math.max(0,130-age)/65-distance*.014;
        if(t.p.y>-24&&t.p.y<12&&s>score){score=s;best=t;}
      }
      target=best;state.target=best?best.id:null;
      if(best){memory.set(best.id,elapsed);inspectionTime=12+random()*12;streamline=random()<.6?1:0;}
      return best;
    }
    function enter(phase){state.phase=phase;phaseTime=0;}
    function step(dt){
      elapsed+=dt;phaseTime+=dt;
      window.sampleOceanWaves(body.position.x,body.position.z,elapsed,wave);
      const surfaceY=15+wave.y,depth=Math.max(0,surfaceY-body.position.y);
      if(env)env.current(body.position,elapsed,flow);else flow.set(0,0,0);
      if(state.phase==='surface'){
        state.diveSeconds=0;desired.copy(flow);heading.set(1,.035*Math.sin(elapsed*.7),.15*Math.sin(elapsed*.13)).normalize();
        if(phaseTime>22&&choose()){budget=170;enter('descent');}
      }else{
        state.diveSeconds+=dt;budget-=dt*(1+.28*effort);
        if(state.phase!=='ascent'){
          const current=targets().find(t=>target&&t.id===target.id);
          if(current){target=current;subject.copy(current.p);goal.copy(subject).add(current.offset);}
          else if(!choose())enter('ascent');
          if(target){subject.copy(target.p);goal.copy(subject).add(target.offset);}
          const reserve=depth/.7+18;
          if(budget<reserve||phaseTime>80)enter('ascent');
          if(state.phase==='descent'&&body.position.distanceTo(goal)<3){enter('inspect');state.visits++;}
          if(state.phase==='inspect'){
            goal.x+=1.1*Math.sin(phaseTime*.15);goal.z+=.8*Math.sin(phaseTime*.21);
            if(phaseTime>inspectionTime){if(budget>reserve+35&&choose())enter('descent');else enter('ascent');}
          }
        }
        if(state.phase==='ascent'){
          goal.copy(body.position);goal.y=surfaceY-.22;
          if(depth<.5){enter('surface');target=null;state.target=null;}
        }
        desired.subVectors(goal,body.position);
        const distance=desired.length(),speed=state.phase==='inspect'?.38:state.phase==='ascent'?(depth>3?1.2:.75):1.05;
        desired.multiplyScalar(distance>0?Math.min(speed,Math.sqrt(distance*.6))/distance:0);
        if(env){env.steer(body.position,body.velocity,1.25,avoid);desired.addScaledVector(avoid,.65);desired.clampLength(0,1.15);}
        heading.copy(desired);if(heading.lengthSq()<.025)heading.subVectors(subject,body.position);heading.normalize();
      }
      const correcting=state.phase!=='surface'&&(state.phase==='inspect'||body.state.angularSpeed>.12||body.state.scullEffort>.55);
      armActivity+=((correcting?Math.max(.3,body.state.scullEffort||0):0)-armActivity)*(1-Math.exp(-dt*2));
      armPhase+=dt*(.85+armActivity*.65);
      const stroke=(armPhase/(Math.PI*2))%1,pull=stroke<.45?Math.sin(Math.PI*stroke/.45)**2:0;
      const handPower=armActivity*pull;
      // Work against positive buoyancy near the surface. Once compressed lungs
      // make her negative, gradually settle into freefall on a clear, steep
      // descent. Resume swimming when approaching a subject or turning aside.
      const clearDescent=state.phase==='descent'&&heading.y<-.8&&goal.y<body.position.y-5&&(!env||avoid.lengthSq()<.04);
      const freefall=clearDescent?T.MathUtils.smoothstep(depth,10.3,18):0;
      state.freefall=freefall;
      body.step(dt,{surfaceY,current:flow,desiredVelocity:desired,heading,handPower,strokeDriven:true,finPowerScale:1-freefall,glide:state.phase==='surface',faceUp:state.phase==='surface'});
      state.armActivity=armActivity;state.handPower=handPower;
      for(let i=0;i<2;i++){
        const side=i?1:-1,phase=(stroke+i*.06)%1;
        // Efficient transport: close to thighs or narrow overhead streamline.
        const raised=streamline&&state.phase!=='inspect'&&state.phase!=='surface';
        handGoal.set(raised?.025:.045,raised?1.23:-.12,side*(raised?.045:.20));
        if(armActivity>.001){
          // Outward catch, backward pull, then a tucked recovery. The same
          // power phase supplies lateral force and a share of forward thrust.
          let x,y,z;
          if(phase<.45){const f=phase/.45;x=.18+.10*Math.sin(Math.PI*f);y=.95-1.03*f;z=.21+.07*Math.sin(Math.PI*f);}
          else {const f=(phase-.45)/.55;x=.08;y=-.08+1.03*f;z=.20;}
          handGoal.lerp(local.set(x,y,side*z),armActivity);
        }
        // Brief nose touches, instead of pinning one hand there all descent.
        if(i===0&&state.phase==='descent'&&phaseTime>3){const f=(phaseTime%7)/1.3;if(f<1)handGoal.lerp(local.set(.18,.78,.025),Math.sin(Math.PI*f)**2);}
        local.subVectors(handGoal,handTargets[i]);local.clampLength(0,dt*1.25);handTargets[i].add(local);
      }
      // Sample a full head-to-fin capsule, with no animal-only surface ceiling.
      if(env){axis.set(0,1,0).applyQuaternion(body.quaternion);
        for(const d of [-2.1,-1.55,-1,-.45,.1,.65]){probe.copy(body.position).addScaledVector(axis,d);before.copy(probe);env.constrain(probe,.38,body.velocity,Infinity);body.position.add(probe.sub(before));}
      }
      effort+=(body.state.effort-effort)*(1-Math.exp(-dt*3));
      kickPhase=body.state.kickPhase;
      const duck=state.phase==='descent'&&depth<3&&heading.y<-.5?Math.sin(Math.PI*clamp(phaseTime/4,0,1))**2:0;
      for(let i=0;i<2;i++){
        const phase=kickPhase+i*Math.PI+(i?.10*Math.sin(elapsed*.71):0),work=Math.sqrt(body.state.kickEffort),amplitude=(.035+.46*work)*(1+.04*Math.sin(elapsed*.53+i*2.1));
        // Moderate hip-led scissor kick, with a trailing knee and articulated
        // ankle. Blade spring dynamics, not a tip-spacing target, finish it.
        const hip=.04+Math.sin(phase)*amplitude+duck*.65,knee=.04+Math.max(0,Math.sin(phase-.6))*.30*work+duck*.2;
        const oldHip=joints[i].hip,oldKnee=joints[i].knee;
        // Permit the loaded ~1 Hz stroke instead of clipping it to a slow
        // 1.8 rad/s sweep. Knees trail the hip; they do not drive a bicycle kick.
        joints[i].hip+=clamp(hip-oldHip,-dt*4.5,dt*4.5);joints[i].knee+=clamp(knee-oldKnee,-dt*4.5,dt*4.5);
        const oldAnkle=joints[i].ankle;
        const ankleTarget=.58+.055*work*Math.sin(phase-.7);
        joints[i].ankle+=(ankleTarget-oldAnkle)*(1-Math.exp(-dt*7));
        const ankleRate=(joints[i].ankle-oldAnkle)/dt,bladeOffset=joints[i].ankle-28*Math.PI/180;
        const hipRate=(joints[i].hip-oldHip)/dt,kneeRate=(joints[i].knee-oldKnee)/dt;
        const bladeAngle=joints[i].hip-joints[i].knee+bladeOffset;
        local.copy(body.velocity).sub(flow).applyQuaternion(body.quaternion.clone().invert());
        // Velocity NORMAL to this blade, in the lower-leg frame. Forward
        // travel may load either face depending on its angle, not always add
        // more bend in the direction of the kick.
        const normalSpeed=local.x*Math.cos(bladeAngle)+local.y*Math.sin(bladeAngle)
          +.48*hipRate*Math.cos(joints[i].knee-bladeOffset)+.34*(hipRate-kneeRate)*Math.cos(bladeOffset)
          +(.16*Math.cos(28*Math.PI/180)+.38)*(hipRate-kneeRate+ankleRate);
        window.stepFreediverBlade(blades[i],normalSpeed,dt);
      }
    }
    function update(time){
      const dt=last===null?0:clamp(time-last,0,.2);last=time;if(!group.visible)return;
      accumulator+=dt;while(accumulator+1e-9>=1/60){step(1/60);accumulator=Math.max(0,accumulator-1/60);}
      rig.mesh.position.copy(body.position);rig.mesh.quaternion.copy(body.quaternion);
      u.uTime.value=elapsed;u.uKickPhase.value=kickPhase;u.uKickAmp.value=effort;
      u.uBiBladeFlexL.value=blades[0].x;u.uBiBladeFlexR.value=blades[1].x;
      u.uBiBladeMidL.value=blades[0].mid||0;u.uBiBladeMidR.value=blades[1].mid||0;
      u.uBiBladeTipL.value=blades[0].tip||0;u.uBiBladeTipR.value=blades[1].tip||0;
      const inspection=state.phase==='inspect';
      u.uArmRelaxL.value=1;u.uArmRelaxR.value=1;
      u.uArmReachR.value=0;u.uSpineBend.value=.035*Math.sin(kickPhase);u.uPikeAngle.value=0;u.uKneeTuck.value=0;
      local.copy(subject).sub(body.position).applyQuaternion(rig.mesh.quaternion.clone().invert()).normalize();
      const yaw=target?clamp(Math.atan2(local.z,Math.max(.2,local.x)),-.85,.85):0,pitch=target?clamp(Math.atan2(local.y,Math.max(.3,local.x)),-.35,.35):-.1;
      u.uHeadYaw.value+=(yaw-u.uHeadYaw.value)*(1-Math.exp(-dt*2));u.uHeadPitch.value+=(pitch-u.uHeadPitch.value)*(1-Math.exp(-dt*2));
      u.uBioShimmer.value=0;u.uDepthCompression.value=clamp((15-body.position.y)/55,0,.6);
      rig.pose(u,elapsed,{swimJoints:joints,handTargets,surface:state.phase==='surface'?1:0,surfaceMotion:{phase:elapsed*.65,effort:.12}});
    }
    return {group,rig,state,body,joints,blades,handTargets,update,setVisible(v){group.visible=!!v;accumulator=0;}};
  };
})();
