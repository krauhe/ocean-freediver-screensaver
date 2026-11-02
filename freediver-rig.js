/* SPDX-License-Identifier: GPL-3.0-only
 * Reusable anatomical skeleton for the procedural freediver meshes.
 * Native Three.js skinning preserves volume and normals from every view.
 */
(() => {
  'use strict';
  window.createFreediverRig=function(T,geometry,material,options={}){
    const monofin=!!options.monofin,finRoot=monofin?-1.05:-1.04;
    const mesh=new T.SkinnedMesh(geometry,material),bones=[],joints={};
    function bone(name,parent,x,y,z){const b=new T.Bone();b.name=name;b.position.set(x,y,z);(parent||mesh).add(b);bones.push(b);joints[name]=b;return b;}
    const pelvis=bone('pelvis',null,0,-.06,0);
    const spine=bone('spine',pelvis,0,.20,0),chest=bone('chest',spine,0,.20,0);
    const neck=bone('neck',chest,.012,.28,0);
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const suffix=side<0?'L':'R';
      const upper=bone('shoulder'+suffix,chest,.015,.18,side*.175);
      const fore=bone('elbow'+suffix,upper,.013,.34,-side*.069);
      const hand=bone('wrist'+suffix,fore,.007,.425,-side*.084);
      arms.push({side,upper,fore,hand,restUpper:fore.position.clone(),restFore:hand.position.clone()});
      const hip=bone('hip'+suffix,pelvis,0,0,side*.095);
      const knee=bone('knee'+suffix,hip,0,-.48,0);
      const ankle=bone('ankle'+suffix,knee,0,options.articulatedFeet?-.34:-.48,0);
      const fin=options.articulatedFeet?bone('fin'+suffix,ankle,0,finRoot+.88,0):null;
      legs.push({side,hip,knee,ankle,fin});
    }
    const indices=[],weights=[],centers=[],p=geometry.attributes.position,aw=geometry.attributes.armWeight,sideAttribute=geometry.attributes.legSide;
    function skin(a,b,w){indices.push(bones.indexOf(a),bones.indexOf(b),0,0);weights.push(1-w,w,0,0);}
    const smooth=(a,b,v)=>{const f=T.MathUtils.clamp((v-a)/(b-a),0,1);return f*f*(3-2*f);};
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),z=p.getZ(i);
      const isArm=aw.getX(i)>0,side=sideAttribute.getX(i)<0?-1:1;
      if(isArm){const t=T.MathUtils.clamp((y-.52)/.76,0,1);centers.push(.015+t*.020+Math.sin(t*Math.PI)*.012,y,side*(.175*(1-t)+.022*t));}
      else centers.push(p.getX(i),y,z);
      if(isArm){const a=arms[side<0?0:1];if(y<.62)skin(chest,a.upper,smooth(.52,.61,y));else skin(a.upper,a.fore,smooth(.81,.91,y));}
      else if(y>.60)skin(chest,neck,smooth(.60,.73,y));
      else if(y>.25)skin(spine,chest,smooth(.25,.44,y));
      else if(y>-.12)skin(pelvis,spine,smooth(-.12,.24,y));
      else {const limbSide=Math.abs(sideAttribute.getX(i))>.5?sideAttribute.getX(i):z;const l=legs[limbSide<0?0:1];if(options.articulatedFeet&&y<=finRoot+.0001)skin(l.fin,l.fin,0);else if(options.articulatedFeet&&y<-.82)skin(l.knee,l.ankle,smooth(-.82,-.94,y));else if(y>-.3)skin(pelvis,l.hip,smooth(-.12,-.30,y));else skin(l.hip,l.knee,smooth(-.46,-.62,y));}
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    geometry.setAttribute('armCenter',new T.Float32BufferAttribute(centers,3));
    mesh.bind(new T.Skeleton(bones));mesh.frustumCulled=false;
    const target=new T.Vector3(),shoulder=new T.Vector3(),direction=new T.Vector3(),pole=new T.Vector3(),elbow=new T.Vector3(),q=new T.Quaternion(),local=new T.Vector3();
    const worldHands=[new T.Vector3(),new T.Vector3()],gripTarget=new T.Vector3();
    let gripWeight=0;const headMatrix=new T.Matrix4();
    const elbowForward=new T.Vector3(),elbowSide=new T.Vector3(),elbowCandidate=new T.Vector3(),elbowBest=new T.Vector3();
    const armBasis=new T.Matrix4(),bindBasis=new T.Matrix4(),hingeNormal=new T.Vector3(),restNormal=new T.Vector3(),upperAxis=new T.Vector3(),foreAxis=new T.Vector3(),armSide=new T.Vector3();
    function solveArm(a,worldTarget,swimming=false,time=0){
      const poseDt=a.swimTime===undefined?null:T.MathUtils.clamp(time-a.swimTime,0,.05);
      // Solve two fixed-length segments in chest space. No limb stretching.
      target.copy(worldTarget);chest.worldToLocal(target);shoulder.copy(a.upper.position);
      direction.subVectors(target,shoulder);const length=direction.length(),l1=a.restUpper.length(),l2=a.restFore.length();
      const minReach=Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos((swimming?125:145)*Math.PI/180));
      const d=T.MathUtils.clamp(length,minReach,l1+l2-.008);direction.normalize();
      // +X is the chest/face side. The elbow belongs behind the
      // shoulder-to-hand line, so flexion brings the forearm forwards.
      // Keep a small outward component, mirrored for the two arms.
      if(swimming)pole.set(.08,-1,a.side*.15);
      else pole.set(-.72,-.12,a.side*.32);
      pole.addScaledVector(direction,-pole.dot(direction));
      if(pole.lengthSq()<.001){pole.set(0,0,a.side);pole.addScaledVector(direction,-pole.dot(direction));}
      pole.normalize();
      if(swimming&&a.swimPole){
        elbowCandidate.copy(a.swimPole).addScaledVector(direction,-a.swimPole.dot(direction));
        if(elbowCandidate.lengthSq()>.001){
          const dt=T.MathUtils.clamp(time-(a.swimTime??time),0,.05);
          pole.copy(elbowCandidate.normalize().lerp(pole,1-Math.exp(-dt*6))).normalize();
        }
      }
      const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
      if(swimming&&height>1e-6){
        // Rotate on the IK elbow circle rather than clipping/stretching a limb.
        // Keep elbow extension behind the shoulder below 6.5 model centimetres.
        const minX=-.035,baseX=direction.x*along;
        if(baseX+pole.x*height<minX){
          elbowForward.set(1,0,0).addScaledVector(direction,-direction.x);
          const radius=elbowForward.length();
          if(radius>1e-6){
            elbowForward.divideScalar(radius);elbowSide.crossVectors(direction,elbowForward).normalize();
            const f=T.MathUtils.clamp((minX-baseX)/(height*radius),-1,1),sign=pole.dot(elbowSide)<0?-1:1;
            pole.copy(elbowForward).multiplyScalar(f).addScaledVector(elbowSide,sign*Math.sqrt(Math.max(0,1-f*f)));
          }
        }
      }
      if(swimming&&height>1e-6&&a.side*(direction.z*along+pole.z*height)>.075){
        // Select a tucked solution ON the fixed-length IK circle. Constrain
        // sideways flare together with the existing behind-the-back limit.
        elbowSide.crossVectors(direction,pole).normalize();
        let bestScore=Infinity;
        for(let k=0;k<128;k++){
          const angle=(k%2?1:-1)*Math.ceil(k/2)*Math.PI/64;
          elbowCandidate.copy(pole).multiplyScalar(Math.cos(angle)).addScaledVector(elbowSide,Math.sin(angle));
          const x=direction.x*along+elbowCandidate.x*height;
          const z=a.side*(direction.z*along+elbowCandidate.z*height);
          const violation=Math.max(0,-.035-x)**2+Math.max(0,z-.075)**2+Math.max(0,.10-(a.side*shoulder.z+z))**2;
          const score=violation*1e6+Math.abs(angle);
          if(score<bestScore){bestScore=score;elbowBest.copy(elbowCandidate);}
          if(violation<1e-12)break;
        }
        pole.copy(elbowBest);
      }
      elbow.copy(shoulder).addScaledVector(direction,along).addScaledVector(pole,height);
      if(swimming){
        if(!a.swimPole)a.swimPole=new T.Vector3();
        a.swimPole.copy(pole);a.swimTime=time;
        // Orient the upper arm's hinge plane, then bend the forearm about ONE
        // anatomical hinge axis. Independent shortest-arc rotations twisted
        // the elbow/skin into an apparently broken joint in folded poses.
        upperAxis.subVectors(elbow,shoulder).normalize();
        foreAxis.copy(shoulder).addScaledVector(direction,d).sub(elbow).normalize();
        hingeNormal.crossVectors(upperAxis,foreAxis).normalize();
        restNormal.crossVectors(a.restUpper,a.restFore).normalize();
        local.copy(a.restUpper).normalize();armSide.crossVectors(restNormal,local).normalize();
        bindBasis.makeBasis(local,armSide,restNormal).invert();
        armSide.crossVectors(hingeNormal,upperAxis).normalize();
        armBasis.makeBasis(upperAxis,armSide,hingeNormal).multiply(bindBasis);
        q.setFromRotationMatrix(armBasis);
        if(poseDt===null)a.upper.quaternion.copy(q);
        else a.upper.quaternion.rotateTowards(q,poseDt*3);
        const restAngle=a.restUpper.angleTo(a.restFore),bend=upperAxis.angleTo(foreAxis);
        const desiredBend=bend-restAngle;
        a.hingeBend=poseDt===null?desiredBend:(a.hingeBend??desiredBend)+T.MathUtils.clamp(desiredBend-(a.hingeBend??desiredBend),-poseDt*3,poseDt*3);
        a.fore.quaternion.setFromAxisAngle(restNormal,a.hingeBend);
        return;
      }
      a.upper.quaternion.setFromUnitVectors(a.restUpper.clone().normalize(),local.subVectors(elbow,shoulder).normalize());
      target.copy(shoulder).addScaledVector(direction,d).sub(elbow).applyQuaternion(q.copy(a.upper.quaternion).invert()).normalize();
      a.fore.quaternion.setFromUnitVectors(a.restFore.clone().normalize(),target);
    }
    function pose(uniforms,time,options={}){
      const u=uniforms,turn=options.turn||0;gripWeight=options.grip||0;if(options.gripTarget)gripTarget.copy(options.gripTarget);
      spine.rotation.z=-u.uSpineBend.value*.55;chest.rotation.z=-u.uSpineBend.value*.45;
      neck.rotation.set(0,-u.uHeadYaw.value,u.uHeadPitch.value);
      for(const l of legs){l.hip.rotation.z=u.uPikeAngle.value;l.knee.rotation.z=-u.uKneeTuck.value;}
      for(const l of legs)if(l.fin){
        const phase=u.uKickPhase.value+(monofin?0:l.side<0?Math.PI:0);
        l.ankle.rotation.z=.62+.045*T.MathUtils.clamp(u.uKickAmp.value,0,1)*Math.sin(phase-.6);
        l.fin.rotation.z=monofin?-.35:-28*Math.PI/180;
      }
      if(options.swimJoints)for(let i=0;i<legs.length;i++){
        const l=legs[i],j=options.swimJoints[i];
        l.hip.rotation.z=T.MathUtils.clamp(j.hip,-.55,1.1);
        l.knee.rotation.z=-T.MathUtils.clamp(j.knee,0,1.15);
        if(l.fin){
          // Rest mesh has toes pointing straight down the shin. Keep a visible
          // foot angle, then let the manufactured blade angle offset part of it.
          l.ankle.rotation.z=T.MathUtils.clamp(j.ankle??.68,.52,.82);
          l.fin.rotation.z=-28*Math.PI/180;
        }
      }
      const floating=options.surface||0,motion=options.surfaceMotion||{},phase=motion.phase||0,effort=motion.effort||0;
      if(floating){
        spine.rotation.z+=floating*((motion.curvature||0)+.025*Math.sin(phase*.43));
        chest.rotation.z+=floating*(-(motion.curvature||0)*.55+.018*Math.sin(phase*.43+.7));
        neck.rotation.y+=floating*(.23*Math.sin(time*.24+phase*.07)+.07*Math.sin(time*.61));
        neck.rotation.z+=floating*.07*Math.sin(time*.31+phase*.09);
        for(const l of legs){
          l.hip.rotation.z+=floating*(.035+.035*Math.sin(phase+l.side*.6)+effort*.055);
          l.knee.rotation.z-=floating*(.08+.045*Math.sin(phase*.7+l.side*.5)+effort*.12);
        }
      }
      if(monofin){
        // Both feet share one blade: keep the lower-leg frames synchronized,
        // including the small surface corrections, so its centre cannot tear.
        const hip=(legs[0].hip.rotation.z+legs[1].hip.rotation.z)*.5;
        const knee=(legs[0].knee.rotation.z+legs[1].knee.rotation.z)*.5;
        for(const l of legs){l.hip.rotation.z=hip;l.knee.rotation.z=knee;}
      }
      mesh.updateMatrixWorld(true);
      if(options.grip){
        arms[1].upper.getWorldPosition(shoulder);
        direction.subVectors(options.gripTarget,shoulder);
        const reach=(arms[1].restUpper.length()+arms[1].restFore.length()-.015)*mesh.scale.x;
        if(direction.length()>reach){
          mesh.position.addScaledVector(direction.normalize(),(shoulder.distanceTo(options.gripTarget)-reach)*options.grip);
          mesh.updateMatrixWorld(true);
        }
      }
      for(let i=0;i<arms.length;i++){
        const a=arms[i],relax=i?u.uArmRelaxR.value:u.uArmRelaxL.value;
        // Shoulder sweeps on an arc; the elbow stays slightly flexed in streamline.
        const angle=relax*2.78,reach=.735-.095*relax;
        local.set(.015+Math.sin(angle)*reach,.52+Math.cos(angle)*reach,a.side*(.055+.17*relax));
        local.x+=.012*relax*Math.sin(time*.8+a.side);
        // Surface watch: soft elbows, hands forward of the shoulders, not pinned to thighs.
        if(options.surface){local.lerp(target.set(.30+.025*Math.sin(phase+a.side),.88+.035*Math.cos(phase*.7+a.side),a.side*(.29+effort*.05)+.02*Math.sin(phase)),options.surface);}
        // One hand at the nose during descent/freefall; the other remains relaxed.
        if(i===0&&options.equalize)local.lerp(target.set(.18,.78,.025),options.equalize);
        // Free hand folds across the chest while hips and fins swing under the diver.
        if(i===0&&turn)local.lerp(target.set(.28,.36,-.12),turn);
        // Optional model-local hand goals, solved by the same fixed-length IK.
        if(options.handTargets)local.copy(options.handTargets[i]);
        local.y-=.34;chest.localToWorld(local);
        if(i===1&&options.grip)local.lerp(options.gripTarget,options.grip);
        if(i===0&&options.tag)local.lerp(options.tagTarget,options.tag);
        solveArm(a,local,!!options.handTargets,time);
      }
      mesh.updateMatrixWorld(true);mesh.skeleton.update();
      arms.forEach((a,i)=>a.hand.getWorldPosition(worldHands[i]));
      headMatrix.multiplyMatrices(neck.matrixWorld,mesh.skeleton.boneInverses[bones.indexOf(neck)]);
    }
    return {mesh,joints,arms,legs,worldHands,headMatrix,gripTarget,get gripWeight(){return gripWeight;},pose};
  };
})();
