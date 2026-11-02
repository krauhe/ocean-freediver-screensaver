/* SPDX-License-Identifier: GPL-3.0-only
 * Procedural red king crab study: six walking legs, unequal claws and a
 * reduced grooming pair tucked under the carapace. Scene units approximate m.
 */
(() => {
  'use strict';
  window.createKingCrab = function(T,scene,water,index=0) {
    const group=new T.Group();group.name='Walking red king crab';scene.add(group);
    const shell=new T.MeshStandardMaterial({color:0x98634d,roughness:.87,metalness:.02});
    shell.onBeforeCompile=s=>{
      s.uniforms.crabDay=water.daylight;
      s.vertexShader='varying vec3 crabLocal;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrabLocal=position;');
      s.fragmentShader='uniform float crabDay; varying vec3 crabLocal;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float mottling=sin(crabLocal.x*49.)*sin(crabLocal.z*37.+crabLocal.y*31.);
        diffuseColor.rgb*=.85+.15*mottling;`);
      s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight*=mix(vec3(.13,.24,.32),vec3(.55,.77,.81),crabDay);
        #include <opaque_fragment>`);
    };
    shell.customProgramCacheKey=()=> 'king-crab-shell-v1';
    const sphere=new T.SphereGeometry(1,12,8),rod=new T.CylinderGeometry(.68,1,1,7),cone=new T.ConeGeometry(1,1,5);
    const joints=new T.InstancedMesh(sphere,shell,40),bones=new T.InstancedMesh(rod,shell,40),spines=new T.InstancedMesh(cone,shell,100);
    for(const m of [joints,bones,spines]){m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;group.add(m);}
    const carapace=new T.SphereGeometry(1,24,16),cp=carapace.attributes.position;
    for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);cp.setXYZ(i,x*(1-.18*z),y*(y<0?.72:1),z);}
    carapace.computeVertexNormals();
    const body=new T.Mesh(carapace,shell);body.scale.set(.27,.135,.30);body.name='Spiny pear-shaped carapace';group.add(body);
    const eyes=new T.InstancedMesh(sphere,new T.MeshStandardMaterial({color:0x091416,roughness:.26}),2);eyes.frustumCulled=false;group.add(eyes);
    // Ground contact darkening, not a luminous halo; translucent irregular oval.
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
    const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,31);
    gradient.addColorStop(0,'rgba(0,0,0,.22)');gradient.addColorStop(.45,'rgba(0,0,0,.12)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadow=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.scale.set(.48,.39,1);group.add(shadow);
    const pose=new T.Object3D(),up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),mid=new T.Vector3();
    const ground=(x,z)=>-24+.18*Math.sin(x*.23)*Math.sin(z*.17)+.09*Math.sin(x*.49+z*.28);
    // Route stays on open sand in front of the wreck, away from rock colliders.
    const homeX=[-7,1,9][index],homeZ=[-13,-10,-14][index];
    const behavior={position:new T.Vector3(homeX,0,homeZ),velocity:new T.Vector3(),target:new T.Vector3(homeX+2,0,homeZ+.5),mode:'walk',timer:18+index*7,seed:9137+index*7919,walk:0,lastTime:undefined};
    const random=()=>{behavior.seed=(1664525*behavior.seed+1013904223)>>>0;return behavior.seed/4294967296;};
    const center=()=>behavior.position.clone();
    const feet=Array.from({length:6},()=>new T.Vector3());
    const footStates=Array.from({length:6},()=>({ready:false,phase:0,anchor:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3()}));
    let jointCount=0,boneCount=0,spineCount=0;
    function ellipsoid(mesh,index,p,x,y,z){pose.position.copy(p);pose.quaternion.identity();pose.scale.set(x,y,z);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);}
    function segment(p,q,width){pose.position.copy(p).add(q).multiplyScalar(.5);a.subVectors(q,p);pose.quaternion.setFromUnitVectors(up,a.clone().normalize());pose.scale.set(width,a.length(),width);pose.updateMatrix();bones.setMatrixAt(boneCount++,pose.matrix);}
    function spike(p,dir,size){pose.position.copy(p);pose.quaternion.setFromUnitVectors(up,dir.clone().normalize());pose.scale.set(size*.34,size,size*.34);pose.updateMatrix();spines.setMatrixAt(spineCount++,pose.matrix);}
    function footAt(t,side,row){const c=center(t);c.x+=side*(.73+row*.055);c.z+=(row-1)*.44; c.y=ground(c.x,c.z)+.018;return c;}
    function update(time,context={}){
      const dt=behavior.lastTime===undefined?0:Math.max(0,Math.min(.25,time-behavior.lastTime));behavior.lastTime=time;
      if(!group.visible)return;
      if(dt>0){
        behavior.timer-=dt;
        let danger=false;for(const t of context.threats||[])if(body.position.distanceTo(t.p)<(t.radius||0)+1.2){danger=true;break;}
        if(danger){behavior.mode='freeze';behavior.timer=3;}
        else if(behavior.timer<=0){
          behavior.mode=behavior.mode==='walk'?'forage':'walk';behavior.timer=behavior.mode==='walk'?18+random()*22:2+random()*5;
          behavior.target.set(homeX-2+random()*4,0,homeZ-1.2+random()*2.4);
        }
        const targetVelocity=behavior.target.clone().sub(behavior.position);targetVelocity.y=0;
        if(behavior.mode==='walk'&&targetVelocity.length()>.08)targetVelocity.normalize().multiplyScalar(.075+index*.012);else targetVelocity.set(0,0,0);
        behavior.velocity.lerp(targetVelocity,1-Math.exp(-dt*5));behavior.position.addScaledVector(behavior.velocity,dt);
        const moving=behavior.velocity.length(),landing=footStates.some(f=>f.phase>.67);
        behavior.walk+=dt*(moving>.002?moving/.105:landing?.16:0);
      }
      jointCount=boneCount=spineCount=0;
      const c=center(time);c.y=ground(c.x,c.z)+.36;
      body.position.copy(c);body.rotation.set(.025*Math.sin(time*.6),0,.018*Math.sin(time*.9));
      shadow.position.set(c.x,ground(c.x,c.z)+.012,c.z);
      // Each foot is anchored in world space during stance. Alternating tripods
      // lift only on the return stroke; body movement never drags planted toes.
      for(let side=-1;side<=1;side+=2)for(let row=0;row<3;row++){
        const index=(side+1)/2*3+row,offset=((row+(side===1?1:0))%2)*.5;
        const cycle=behavior.walk+offset,phase=cycle-Math.floor(cycle),state=footStates[index];
        if(!state.ready){state.anchor.copy(footAt(time,side,row));state.to.copy(state.anchor);state.ready=true;}
        if(phase>.67&&state.phase<=.67){state.from.copy(state.anchor);state.to.copy(footAt(time,side,row)).addScaledVector(behavior.velocity,2.0);state.to.y=ground(state.to.x,state.to.z)+.018;}
        if(phase<state.phase){state.anchor.copy(state.to);if(context.sediment)context.sediment.emit(state.anchor,1);}
        const foot=feet[index];foot.copy(state.anchor);
        if(phase>.67){const f=(phase-.67)/.33,s=f*f*(3-2*f);foot.copy(state.from).lerp(state.to,s);foot.y+=Math.sin(f*Math.PI)*.09;}
        state.phase=phase;
        const hip=new T.Vector3(c.x+side*.21,c.y-.025,c.z+(row-1)*.16);
        // Equal-length two-bone IK; elevated knee forms the characteristic arch.
        const delta=foot.clone().sub(hip),length=delta.length(),half=delta.multiplyScalar(.5);
        const perpendicular=up.clone().addScaledVector(delta,-up.dot(delta)/Math.max(delta.lengthSq(),1e-8)).normalize();
        const knee=hip.clone().add(half).addScaledVector(perpendicular,Math.sqrt(Math.max(0,.55*.55-length*length*.25)));
        segment(hip,knee,.033);segment(knee,foot,.019);
        ellipsoid(joints,jointCount++,knee,.037,.039,.037);
        ellipsoid(joints,jointCount++,hip,.044,.038,.044);
        for(let n=1;n<=3;n++){mid.copy(hip).lerp(knee,n/4);spike(mid,new T.Vector3(side*.4,1,0),.043);}
      }
      // Larger right crushing claw and smaller left feeding claw, held ahead.
      for(const side of [-1,1]){
        const size=side===1?1:.73,wave=Math.sin(time*.51+side)*.025;
        const shoulder=new T.Vector3(c.x+side*.19,c.y-.02,c.z+.20);
        const elbow=new T.Vector3(c.x+side*.39,c.y-.09,c.z+.39);
        const palm=new T.Vector3(c.x+side*.37,c.y-.08+wave,c.z+.57);
        segment(shoulder,elbow,.039*size);segment(elbow,palm,.045*size);
        ellipsoid(joints,jointCount++,palm,.085*size,.063*size,.11*size);
        const gape=.024+.014*(1+Math.sin(time*.7+side));
        for(const finger of [-1,1]){
          const base=palm.clone().add(new T.Vector3(finger*.047*size,0,.06*size));
          const tip=palm.clone().add(new T.Vector3(finger*gape*size,0,.20*size));
          segment(base,tip,.022*size);
        }
        // Reduced fifth pair stays under the shell, not an extra walking pair.
        segment(new T.Vector3(c.x+side*.14,c.y-.09,c.z-.18),new T.Vector3(c.x+side*.19,c.y-.14,c.z-.22),.012);
        const eye=new T.Vector3(c.x+side*.10,c.y+.06,c.z+.28);
        segment(new T.Vector3(c.x+side*.09,c.y,c.z+.22),eye,.013);
        ellipsoid(eyes,(side+1)/2,eye,.020,.018,.020);
        spike(new T.Vector3(c.x+side*.045,c.y+.015,c.z+.31),new T.Vector3(side*.2,.2,1),.085);
      }
      // Crown and rim spines follow the domed shell, varying size without random flicker.
      for(let n=0;n<42;n++){
        const angle=n*2.399963,r=Math.sqrt((n+.5)/42)*.95;
        const nx=Math.cos(angle)*r,nz=Math.sin(angle)*r,ny=Math.sqrt(1-r*r);
        b.set(c.x+nx*.27,c.y+ny*.135,c.z+nz*.30);
        spike(b,new T.Vector3(nx,ny,nz),.032+.022*(.5+.5*Math.sin(n*8.1)));
      }
      joints.count=jointCount;bones.count=boneCount;spines.count=spineCount;
      for(const m of [joints,bones,spines,eyes])m.instanceMatrix.needsUpdate=true;
    }
    update(0);
    return {group,body,feet,ground,behavior,update,setVisible(v){group.visible=!!v;}};
  };
})();
