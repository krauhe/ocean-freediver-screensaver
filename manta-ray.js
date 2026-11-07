/* SPDX-License-Identifier: GPL-3.0-only
 * Mobula-inspired procedural manta: forward swimming, flexible pectoral fins,
 * intermittent ram feeding. Visual model, not calibrated animal biomechanics.
 */
(() => {
 'use strict';
 window.createMantaRays=function(T,scene,water,environment,camera){
  const group=new T.Group();group.name='Passing manta rays';scene.add(group);
  const position=[],color=[],uv=[],indices=[],spanSegments=36,chordSegments=12;
  const index=(surface,s,c)=>surface*(spanSegments+1)*(chordSegments+1)+s*(chordSegments+1)+c;
  for(let surface=0;surface<2;surface++)for(let s=0;s<=spanSegments;s++)for(let c=0;c<=chordSegments;c++){
   const z=(s/spanSegments*2-1)*2.8,r=Math.abs(z)/2.8,u=c/chordSegments;
   const center=-.15-.45*r,half=1.18*Math.pow(Math.max(0,1-r),.58)+.008;
   const x=center+(1-2*u)*half;
   const thickness=(.20*Math.exp(-r*r*13)+.025)*Math.sin(Math.PI*u);
   position.push(x,(surface===0?1:-1)*thickness,z);
   uv.push(s/spanSegments,(surface+(x+1.4)/2.7)*.5);
   const edge=T.MathUtils.smoothstep(r,.7,1),belly=surface===1;
   const base=belly?.78:.11,shade=belly?base-edge*.35:base+.025*Math.sin(u*7+r*5);
   color.push(shade*.88,shade*.98,shade*1.05);
  }
  for(let surface=0;surface<2;surface++)for(let s=0;s<spanSegments;s++)for(let c=0;c<chordSegments;c++){
   const a=index(surface,s,c),b=index(surface,s+1,c),d=a+1,e=b+1;
   if(surface===0)indices.push(a,d,b,b,d,e);else indices.push(a,b,d,b,e,d);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.boundingSphere.radius+=1.8;
  // Baked pigmentation: stays attached to the undulating wings, with no
  // per-frame noise or extra draw calls. Each animal has its own belly pattern.
  function skinAtlas(individual){
   let seed=7103+individual*3181;
   const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
   const c=canvas.getContext('2d');
   // Canvas top is the ventral half (UV v > .5); bottom is dorsal.
   c.fillStyle='#ece9df';c.fillRect(0,0,1024,256);
   c.fillStyle='#9b9f9e';c.fillRect(0,256,1024,256);
   for(let side=0;side<2;side++){
    c.save();c.beginPath();c.rect(0,side*256,1024,256);c.clip();
    for(let j=0;j<220;j++){
     const x=random()*1024,y=side*256+random()*256,r=12+random()*65;
     const g=c.createRadialGradient(x,y,0,x,y,r);
     g.addColorStop(0,side?'rgba(25,37,42,.16)':'rgba(72,84,81,.06)');g.addColorStop(1,'rgba(60,70,70,0)');
     c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    if(side===0)for(let j=0;j<48;j++){
     const x=512+(random()-.5)*380,y=115+random()*125;
     c.fillStyle=`rgba(22,34,40,${.3+random()*.5})`;c.beginPath();
     c.ellipse(x,y,2+random()*13,2+random()*7,random()*Math.PI,0,Math.PI*2);c.fill();
    }
    // Sparse healed-looking pale streaks; not damage to the silhouette.
    for(let j=0;j<(side?9:3);j++){
     const x=80+random()*864,y=side*256+45+random()*160;
     c.strokeStyle=side?'rgba(225,226,216,.35)':'rgba(108,118,112,.15)';c.lineWidth=.6+random()*1.4;
     c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+12,y-3,x+20+random()*24,y+random()*9);c.stroke();
    }
    for(let j=0;j<16000;j++){
     c.fillStyle=random()<.5?'rgba(15,25,30,.06)':'rgba(245,239,220,.065)';
     c.fillRect(random()*1024,side*256+random()*256,1,1);
    }
    c.restore();
   }
   const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
  }
  const dark=new T.MeshStandardMaterial({color:0x10222b,roughness:.65}),ivory=new T.MeshStandardMaterial({color:0xb9c7c7,roughness:.65}),mouthMat=new T.MeshStandardMaterial({color:0x02090d,roughness:1}),eyeMat=new T.MeshStandardMaterial({color:0x010305,roughness:.2});
  const sphere=new T.SphereGeometry(1,12,8);
  function ellipsoid(root,p,scale,mat){const m=new T.Mesh(sphere,mat);m.position.set(...p);m.scale.set(...scale);root.add(m);return m;}
  function tube(points,r,mat,root){const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,6,false),mat);root.add(m);return m;}
  const animals=[];
  for(let i=0;i<2;i++){
   const root=new T.Group();root.name='Manta ray '+(i+1);root.scale.setScalar(i?.83:1.05);group.add(root);
   const u={phase:{value:i*2.9},effort:{value:.7},bank:{value:0}};
   const map=skinAtlas(i);
   const mat=new T.MeshStandardMaterial({vertexColors:true,map,bumpMap:map,bumpScale:.006,roughness:.8,metalness:0,side:T.DoubleSide});
   mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{mantaPhase:u.phase,mantaEffort:u.effort,mantaBank:u.bank});
    shader.vertexShader=`uniform float mantaPhase,mantaEffort,mantaBank;
      float wingY(vec3 p){float r=clamp(abs(p.z)/2.8,0.,1.);float w=pow(r,1.65);
       float phase=mantaPhase-r*.95-p.x*.17;
       float beat=sin(phase)+.16*sin(phase*2.-.6);
       return w*(beat*(.30+.92*mantaEffort)+.16*(1.-mantaEffort))
         +w*p.x*.13*cos(phase-.4)*mantaEffort + p.z*mantaBank*.12;}
      `+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float e=.015;float dx=(wingY(position+vec3(e,0.,0.))-wingY(position-vec3(e,0.,0.)))/(2.*e);
      float dz=(wingY(position+vec3(0.,0.,e))-wingY(position-vec3(0.,0.,e)))/(2.*e);
      objectNormal=normalize(vec3(objectNormal.x-dx*objectNormal.y,objectNormal.y,objectNormal.z-dz*objectNormal.y));`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y+=wingY(position);');
   };
   const body=new T.Mesh(geometry,mat);body.frustumCulled=false;root.add(body);
   // Broad terminal mouth, lower jaw and paired cephalic lobes in front of it.
   ellipsoid(root,[.62,0,0],[.43,.145,.59],dark);
   const cavity=ellipsoid(root,[1.025,-.025,0],[.06,.1,.50],mouthMat);
   const jaw=ellipsoid(root,[.96,-.09,0],[.17,.035,.49],ivory);
   ellipsoid(root,[.94,.055,0],[.16,.045,.50],dark);
   const lobes=[];
   for(const side of [-1,1]){
    ellipsoid(root,[.68,.025,side*.56],[.075,.055,.07],dark);
    ellipsoid(root,[.72,.035,side*.61],[.028,.028,.018],eyeMat);
    const lobe=new T.Group();lobe.position.set(.84,-.015,side*.46);root.add(lobe);
    const lobeMesh=tube([[0,0,0],[.20,-.025,side*.02],[.35,-.085,-side*.025],[.38,-.14,-side*.08]],.055,dark,lobe);
    lobeMesh.scale.y=.65;
    lobes.push(lobe);
    for(let g=0;g<5;g++){
     tube([[.48-g*.18,-.183,side*.15],[.46-g*.18,-.20,side*.34],[.40-g*.18,-.17,side*.52]],.012,mouthMat,root);
    }
    // Pale dorsal shoulder flashes; restrained relief rather than painted logos.
    ellipsoid(root,[.50,.162,side*.31],[.28,.014,.10],ivory);
   }
   const tail=tube([[-1.2,0,0],[-1.8,.01,0],[-2.7,.04,.02],[-3.8,.1,.08]],.025,dark,root);
   const dorsal=new T.Mesh(new T.ConeGeometry(.14,.31,3),dark);dorsal.position.set(-1,.2,0);dorsal.rotation.x=Math.PI/2;root.add(dorsal);
   // Batch fixed facial/gill details by material; keep only moving parts separate.
   const batches=new Map();
   for(const mesh of [...root.children]){
    if(!mesh.isMesh||[body,cavity,jaw,tail].includes(mesh))continue;
    mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix),flat=g.index?g.toNonIndexed():g;
    if(!batches.has(mesh.material))batches.set(mesh.material,{position:[],normal:[]});
    const batch=batches.get(mesh.material);
    for(const attr of ['position','normal'])batch[attr].push(...flat.attributes[attr].array);
    root.remove(mesh);if(flat!==g)flat.dispose();g.dispose();
   }
   for(const [material,batch] of batches){const g=new T.BufferGeometry();for(const attr of ['position','normal'])g.setAttribute(attr,new T.Float32BufferAttribute(batch[attr],3));root.add(new T.Mesh(g,material));}
   animals.push({root,body,u,cavity,jaw,lobes,tail,p:root.position,v:new T.Vector3(),heading:i?Math.PI:0,pitch:0,bank:0,phase:Math.random()*Math.PI*2,feed:0,mode:'cruise',returnAt:0,arrivalPlanned:false,pass:Math.floor(Math.random()*2),lastTime:null});
   const a=animals[i],fromRight=a.pass%2===1;
   root.position.set((fromRight?1:-1)*(15+Math.random()*40),fromRight?7+Math.random()*2:1+Math.random()*6,-6-Math.random()*40);a.heading=fromRight?Math.PI:0;root.rotation.y=a.heading;
  }
  let count=1;const desired=new T.Vector3(),avoid=new T.Vector3(),flow=new T.Vector3(),view=new T.Vector3();
  const stats={departures:0,arrivals:0};
  function outOfView(a){view.copy(a.p).project(camera);return Math.abs(view.x)>1.45&&Math.abs(a.p.x)>45;}
  function update(time,threats=[]){
   if(!group.visible){for(const a of animals)a.lastTime=time;return;}
   for(let i=0;i<animals.length;i++){
    const a=animals[i],dt=a.lastTime===null?0:Math.max(0,Math.min(.1,time-a.lastTime));a.lastTime=time;
    if(!a.arrivalPlanned){a.arrivalPlanned=true;if(i)a.returnAt=time+45+Math.random()*90;}
    if(i>=count){a.root.visible=false;continue;}
    if(a.returnAt){if(time<a.returnAt){a.root.visible=false;continue;}
     const side=a.pass%2?1:-1,z=-8-Math.random()*43;
     a.p.set(side*Math.max(70,(27-z)*2.8),side>0?8:1+Math.random()*5,z);a.heading=side>0?Math.PI:0;a.pitch=0;a.bank=0;a.returnAt=0;stats.arrivals++;
    }
    a.root.visible=true;
    const feedWave=Math.sin(time*.027+i*3.7),feeding=feedWave>.3;
    const desiredFeed=feeding?1:0;a.feed+=(desiredFeed-a.feed)*(1-Math.exp(-dt*.5));a.mode=feeding?'filter feeding':'cruise';
    const speed=feeding?.52:.82,travel=a.pass%2?-1:1;
    // Wide forward passes. Climb well before the reef; no stationary pivots.
    const targetHeight=a.p.x>0?8:2.5+i*2+.65*Math.sin(time*.035+i);
    desired.set(travel,Math.max(-.18,Math.min(.18,(targetHeight-a.p.y)*.12)),.13*Math.sin(time*.018+i*2));
    a.v.set(Math.cos(a.heading),Math.tan(a.pitch),-Math.sin(a.heading)).normalize().multiplyScalar(speed);
    environment.steer(a.p,a.v,3.2,avoid);desired.addScaledVector(avoid,.7);
    for(const t of threats){const d=a.p.distanceTo(t.p);if(d<5&&d>.01)desired.addScaledVector(flow.subVectors(a.p,t.p).normalize(),(5-d)*.18);}
    const wanted=Math.atan2(-desired.z,desired.x),error=Math.atan2(Math.sin(wanted-a.heading),Math.cos(wanted-a.heading));
    const turn=T.MathUtils.clamp(error*.15,-.055,.055);a.heading+=turn*dt;
    a.pitch+=(Math.atan2(desired.y,Math.hypot(desired.x,desired.z))-a.pitch)*(1-Math.exp(-dt*.35));
    a.bank+=(T.MathUtils.clamp(-turn*5,-.4,.4)-a.bank)*(1-Math.exp(-dt*.6));
    a.v.set(Math.cos(a.heading)*Math.cos(a.pitch),Math.sin(a.pitch),-Math.sin(a.heading)*Math.cos(a.pitch)).multiplyScalar(speed);
    a.p.addScaledVector(a.v,dt);environment.current(a.p,time,flow);a.p.addScaledVector(flow,dt*.3);
    a.root.rotation.set(a.bank,a.heading,a.pitch,'YXZ');
    if(a.root.userData.applyInteraction)a.root.userData.applyInteraction(time);
    if(!a.root.userData.grabbed&&outOfView(a)&&a.p.x*travel>45){a.root.visible=false;a.pass++;a.returnAt=time+65+Math.random()*145;stats.departures++;}
    // Tip lag and chord twist are in the vertex shader. Short glide intervals.
    const glide=Math.pow(Math.max(0,Math.sin(time*.11+i*2)),8);
    a.phase+=dt*(1.0+speed*.9);a.u.phase.value=a.phase;a.u.effort.value=a.root.userData.grabbed?1:.75-glide*.65;a.u.bank.value=a.bank;
    a.cavity.scale.y=.018+.11*a.feed;a.jaw.position.y=-.045-.14*a.feed;
    a.lobes.forEach((lobe,j)=>{const side=j?1:-1;lobe.rotation.x=side*(1-a.feed)*1.1;lobe.rotation.z=-.10*a.feed;});
    a.tail.rotation.y=.025*Math.sin(a.phase*.5);a.body.visible=true;
   }
  }
  return {group,animals,stats,update,setDensity(value,quality=1){count=value>.72&&quality>.8?2:1;},setVisible(value){group.visible=!!value;}};
 };
})();
