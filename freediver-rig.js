/* SPDX-License-Identifier: GPL-3.0-only
 * Reusable anatomical skeleton for the procedural freediver meshes.
 * Native Three.js skinning preserves volume and normals from every view.
 */
(() => {
  'use strict';
  window.createFreediverRig=function(T,geometry,material){
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
      const ankle=bone('ankle'+suffix,knee,0,-.48,0);
      legs.push({side,hip,knee,ankle});
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
      else {const l=legs[z<0?0:1];if(y>-.3)skin(pelvis,l.hip,smooth(-.12,-.30,y));else skin(l.hip,l.knee,smooth(-.46,-.62,y));}
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    geometry.setAttribute('armCenter',new T.Float32BufferAttribute(centers,3));
    mesh.bind(new T.Skeleton(bones));mesh.frustumCulled=false;
    const target=new T.Vector3(),shoulder=new T.Vector3(),direction=new T.Vector3(),pole=new T.Vector3(),elbow=new T.Vector3(),q=new T.Quaternion(),local=new T.Vector3();
    const worldHands=[new T.Vector3(),new T.Vector3()],gripTarget=new T.Vector3();
    let gripWeight=0;const headMatrix=new T.Matrix4();
    function solveArm(a,worldTarget){
      // Solve two fixed-length segments in chest space. No limb stretching.
      target.copy(worldTarget);chest.worldToLocal(target);shoulder.copy(a.upper.position);
      direction.subVectors(target,shoulder);const length=direction.length(),l1=a.restUpper.length(),l2=a.restFore.length();
      const minReach=Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos(145*Math.PI/180));
      const d=T.MathUtils.clamp(length,minReach,l1+l2-.008);direction.normalize();
      pole.set(.48,-.32,a.side*.72);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
      elbow.copy(shoulder).addScaledVector(direction,along).addScaledVector(pole,height);
      a.upper.quaternion.setFromUnitVectors(a.restUpper.clone().normalize(),local.subVectors(elbow,shoulder).normalize());
      target.copy(shoulder).addScaledVector(direction,d).sub(elbow).applyQuaternion(q.copy(a.upper.quaternion).invert()).normalize();
      a.fore.quaternion.setFromUnitVectors(a.restFore.clone().normalize(),target);
    }
    function pose(uniforms,time,options={}){
      const u=uniforms,turn=options.turn||0;gripWeight=options.grip||0;if(options.gripTarget)gripTarget.copy(options.gripTarget);
      spine.rotation.z=-u.uSpineBend.value*.55;chest.rotation.z=-u.uSpineBend.value*.45;
      neck.rotation.set(0,-u.uHeadYaw.value,u.uHeadPitch.value);
      for(const l of legs){l.hip.rotation.z=u.uPikeAngle.value;l.knee.rotation.z=-u.uKneeTuck.value;}
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
        local.y-=.34;chest.localToWorld(local);
        if(i===1&&options.grip)local.lerp(options.gripTarget,options.grip);
        if(i===0&&options.tag)local.lerp(options.tagTarget,options.tag);
        solveArm(a,local);
      }
      mesh.updateMatrixWorld(true);mesh.skeleton.update();
      arms.forEach((a,i)=>a.hand.getWorldPosition(worldHands[i]));
      headMatrix.multiplyMatrices(neck.matrixWorld,mesh.skeleton.boneInverses[bones.indexOf(neck)]);
    }
    return {mesh,joints,arms,legs,worldHands,headMatrix,gripTarget,get gripWeight(){return gripWeight;},pose};
  };
})();
