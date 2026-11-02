/* SPDX-License-Identifier: GPL-3.0-only
 * Small bottom-dwelling animals and contact-triggered settling sediment.
 * Species-inspired state machines, not a calibrated ecological model.
 */
(() => {
 'use strict';
 window.createBenthicLife=function(T,scene,water,environment){
  const group=new T.Group();group.name='Bottom fish, shrimp and sea stars';scene.add(group);
  const random=a=>{a.seed=(1664525*a.seed+1013904223)>>>0;return a.seed/4294967296;};
  const transform=new T.Object3D(),up=new T.Vector3(0,1,0),flow=new T.Vector3(),dir=new T.Vector3();
  const sphere=new T.SphereGeometry(1,10,7),cylinder=new T.CylinderGeometry(.45,1,1,5);
  // Merge each species' small anatomical parts once, then instance the result.
  function model(make){
   const positions=[],colors=[],normals=[];
   function add(g,p,s,color,rotation){
    transform.position.set(...p);transform.scale.set(...s);transform.quaternion.identity();if(rotation)transform.rotation.set(...rotation);transform.updateMatrix();
    const copy=g.index?g.toNonIndexed():g.clone();copy.applyMatrix4(transform.matrix);const c=new T.Color(color);
    positions.push(...copy.attributes.position.array);normals.push(...copy.attributes.normal.array);
    for(let i=0;i<copy.attributes.position.count;i++)colors.push(c.r,c.g,c.b);copy.dispose();
   }
   function line(p,q,r,color){const a=new T.Vector3(...p),b=new T.Vector3(...q),v=b.clone().sub(a),g=cylinder.clone();g.scale(r,v.length(),r);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,v.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());add(g,[0,0,0],[1,1,1],color);g.dispose();}
   function fin(points,color){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();add(g,[0,0,0],[1,1,1],color);g.dispose();}
   make(add,line,fin);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingSphere();return g;
  }
  const goby=model((add,line,fin)=>{
   add(sphere,[0,0,0],[.22,.065,.074],0x8c927a);add(sphere,[.15,.012,0],[.105,.073,.082],0xa2a18a);
   for(const side of [-1,1]){
    add(sphere,[.19,.055,side*.055],[.018,.018,.014],0x111e1d);
    fin([.06,-.012,side*.045,-.08,-.025,side*.15,-.09,-.032,side*.045],0xa4a18b);
   }
   fin([-.18,0,0,-.32,.07,0,-.32,-.07,0],0x817e61);
   fin([.10,.05,0,.035,.13,0,-.06,.05,0],0x8f8c72);
   fin([-.07,.04,0,-.12,.10,0,-.21,.025,0],0x918f76);
  });
  const shrimp=model((add,line,fin)=>{
   add(sphere,[.075,.02,0],[.105,.042,.038],0xc4ab88);
   for(let i=0;i<6;i++)add(sphere,[-i*.032,.01-i*.003,0],[.025,.035-i*.003,.032-i*.002],i%2?0xb29375:0xdbbb91);
   for(const side of [-1,1]){
    add(sphere,[.14,.05,side*.025],[.010,.012,.010],0x162324);
    line([.14,.02,side*.025],[.34,.04,side*.10],.003,0xe2ccac);
    line([.34,.04,side*.10],[.43,.025,side*.15],.002,0xd5b896);
    for(let i=0;i<5;i++){const x=.08-i*.033;line([x,0,side*.02],[x-.025,-.035,side*.055],.004,0xab8e72);line([x-.025,-.035,side*.055],[x+.005,-.065,side*.075],.003,0xb89c79);}
    fin([-.16,0,0,-.23,.018,side*.065,-.24,-.012,0],0xb79375);
   }
   line([.13,.04,0],[.24,.055,0],.009,0xc6a77f);
  });
  // Continuous five-armed body rather than overlapping beads; a low domed
  // upper surface rests on the substrate, with gently rounded arm tips.
  const star=new T.BufferGeometry(),starP=[],starI=[],starC=[],rings=5,segments=70;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const angle=i/segments*Math.PI*2,f=j/rings;
    const radius=(.08+.19*Math.pow(.5+.5*Math.cos(angle*5),1.5))*f;
    starP.push(Math.cos(angle)*radius,.008+.045*(1-f*f),Math.sin(angle)*radius);
    const c=new T.Color(0xbf896f).multiplyScalar(.87+.13*Math.sin(i*8+j*3));starC.push(c.r,c.g,c.b);
  }
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;starI.push(a,b,a+1,a+1,b,b+1);}
  star.setAttribute('position',new T.Float32BufferAttribute(starP,3));star.setAttribute('color',new T.Float32BufferAttribute(starC,3));star.setIndex(starI);star.computeVertexNormals();star.computeBoundingSphere();
  const species=[{kind:'goby',geometry:goby,count:8},{kind:'shrimp',geometry:shrimp,count:10},{kind:'star',geometry:star,count:7}];
  const agents=[],pools=[];
  const shelterSites=[[-15,-13],[-8.7,-15.8],[-2.2,-12.7],[5.2,-15],[10,-10.7],[-17,-8.2],[-10,-7.8],[-3,-9],[3.8,-7.3],[8.9,-6.7]];
  for(const spec of species){
   const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.82,side:T.DoubleSide});
   const activity=new Float32Array(spec.count),phase=new Float32Array(spec.count);
   spec.geometry.setAttribute('bottomActivity',new T.InstancedBufferAttribute(activity,1));spec.geometry.setAttribute('bottomPhase',new T.InstancedBufferAttribute(phase,1));
   material.onBeforeCompile=s=>{
    s.uniforms.bottomDay=water.daylight;
    s.vertexShader='attribute float bottomActivity;attribute float bottomPhase;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      ${spec.kind==='goby'?'transformed.z+=sin(bottomPhase+position.x*17.)*max(0.,-position.x)*bottomActivity*.22;':spec.kind==='shrimp'?'transformed.y+=pow(max(0.,-position.x)*4.,2.)*bottomActivity*.09;':''}`);
    s.fragmentShader='uniform float bottomDay;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=mix(vec3(.12,.22,.30),vec3(.55,.78,.85),bottomDay);\n#include <opaque_fragment>');
   };
   material.customProgramCacheKey=()=> 'bottom-'+spec.kind;
   const mesh=new T.InstancedMesh(spec.geometry,material,spec.count);mesh.name=spec.kind;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);pools.push({mesh,activity,phase});
   for(let i=0;i<spec.count;i++){
    const seed=1823+i*967+(spec.kind==='goby'?0:spec.kind==='shrimp'?7001:14002);
    const a={kind:spec.kind,seed,index:i,pool:pools.length-1,p:new T.Vector3(),v:new T.Vector3(),home:new T.Vector3(),target:new T.Vector3(),mode:spec.kind==='star'?'crawl':'rest',timer:2+i*.83,alarm:0,yaw:i*.83,stroke:i,scale:.85+(i%3)*.16,sediment:0};
    a.home.set(shelterSites[i][0],0,shelterSites[i][1]+(spec.kind==='star'?1.3:0));
    // Shrimp shelter behind small arches; gobies rest just outside them.
    a.p.copy(a.home);a.p.z+=spec.kind==='goby'?.65:spec.kind==='star'?.9:-.15;a.target.copy(a.p);agents.push(a);
   }
  }
  const rock=new T.IcosahedronGeometry(1,1);
  const refuge=model(add=>{
   add(rock,[-.30,.10,0],[.18,.22,.25],0x6c7970,[.3,.4,.2]);
   add(rock,[.31,.09,-.03],[.21,.20,.28],0x7b8376,[.5,-.2,.3]);
   add(rock,[.02,.28,-.06],[.38,.13,.24],0x818a7d,[.1,.2,-.12]);
  });rock.dispose();
  const arches=new T.InstancedMesh(refuge,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),10);
  arches.name='Rubble shelters';group.add(arches);
  for(let i=0;i<10;i++){const h=agents.find(a=>a.kind==='shrimp'&&a.index===i).home;transform.position.set(h.x,environment.floor(h.x,h.z)-.035,h.z);transform.rotation.set(0,Math.sin(i*8.3)*.25,0);transform.scale.set(1+Math.sin(i*7)*.12,.85+Math.cos(i*3)*.1,1.15);transform.updateMatrix();arches.setMatrixAt(i,transform.matrix);}
  arches.computeBoundingSphere();
  const capacity=320,pos=new Float32Array(capacity*3),opacity=new Float32Array(capacity),size=new Float32Array(capacity);
  const dust=Array.from({length:capacity},(_,i)=>({p:new T.Vector3(),v:new T.Vector3(),age:99,life:4,seed:4321+i}));let cursor=0;
  const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(pos,3));dg.setAttribute('dustAlpha',new T.BufferAttribute(opacity,1));dg.setAttribute('dustSize',new T.BufferAttribute(size,1));
  const dm=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{day:water.daylight},
   vertexShader:'attribute float dustAlpha;attribute float dustSize;varying float alpha;varying float depth;void main(){vec4 p=modelViewMatrix*vec4(position,1.);alpha=dustAlpha;depth=-p.z;gl_PointSize=clamp(dustSize*500./max(1.,-p.z),1.,7.);gl_Position=projectionMatrix*p;}',
   fragmentShader:'uniform float day;varying float alpha;varying float depth;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;vec3 c=mix(vec3(.025,.055,.07),vec3(.44,.48,.40),day);gl_FragColor=vec4(c,alpha*(1.-r*r)*exp(-depth*.018));}'});
  const sediment=new T.Points(dg,dm);sediment.name='Contact sediment';sediment.frustumCulled=false;group.add(sediment);
  function emit(point,amount=2){
   const clearance=point.y-environment.floor(point.x,point.z);
   if(!group.visible||clearance>.35||clearance<-.05)return;
   for(let i=0;i<Math.min(8,amount);i++){
    const d=dust[cursor];cursor=(cursor+1)%capacity;d.p.copy(point);d.p.y=Math.max(environment.floor(d.p.x,d.p.z)+.02,d.p.y);
    d.v.set((random(d)-.5)*.06,.05+random(d)*.065,(random(d)-.5)*.06);d.age=0;d.life=3+random(d)*4;size[(cursor+capacity-1)%capacity]=.045+random(d)*.045;
   }
  }
  let lastTime;const contacts=new Map();
  function contact(key,point,time){
   const previous=contacts.get(key);
   if(previous){const dt=time-previous.time;if(dt>0&&dt<.5&&point.distanceTo(previous.p)/dt>.06&&time-previous.emitted>.45){emit(point,2);previous.emitted=time;}previous.p.copy(point);previous.time=time;}
   else contacts.set(key,{p:point.clone(),time,emitted:time});
  }
  function update(time,threats=[]){
   const dt=lastTime===undefined?0:Math.max(0,Math.min(.25,time-lastTime));lastTime=time;if(!group.visible)return;
   for(const a of agents){
    if(a.index>=pools[a.pool].mesh.count)continue;
    if(dt>0){
     a.timer-=dt;a.alarm=Math.max(0,a.alarm-dt);
     if(a.kind!=='star')for(const t of threats){if(t.kind==='jelly')continue;const range=(t.radius||0)+(a.kind==='goby'?3:1.8);if(a.p.distanceTo(t.p)<range){a.alarm=5;if(a.mode!=='hide'&&a.mode!=='escape'){a.mode='escape';a.entering=false;a.timer=.6;emit(a.p,4);}a.target.copy(a.home);a.target.z-=.22;}}
     if(a.kind==='star'){
      if(a.timer<=0||Math.hypot(a.p.x-a.target.x,a.p.z-a.target.z)<.045){a.target.copy(a.home).add(new T.Vector3((random(a)-.5)*1.8,0,(random(a)-.5)*1.8));a.timer=90+random(a)*90;}
     }else if(a.mode==='escape'){
      if(Math.hypot(a.p.x-a.target.x,a.p.z-a.target.z)<.22){a.mode='hide';a.timer=5+random(a)*8;}
     }else if(a.mode==='hide'){
      if(a.timer<=0&&a.alarm<=0){a.mode='rest';a.timer=2+random(a)*4;}
     }else if(a.timer<=0){
      const night=water.daylight.value<.3;
      if(a.kind==='shrimp'&&!night&&random(a)<.7){a.mode='escape';a.entering=false;a.target.copy(a.home);a.target.z-=.22;}
      else {a.mode=a.mode==='forage'?'rest':'forage';a.timer=a.mode==='rest'?3+random(a)*12:2+random(a)*5;a.target.copy(a.home).add(new T.Vector3((random(a)-.5)*2.4,0,.4+random(a)*1.4));}
     }
     const move=a.mode==='crawl'||a.mode==='forage'||a.mode==='escape';
     // Approach a refuge through its opening, rather than swimming through
     // the side stones. A sheltered animal first exits into open sand.
     dir.subVectors(a.target,a.p);dir.y=0;
     if(a.kind!=='star'){
       if(a.mode==='escape'&&!a.entering){
         const entryX=Math.abs(a.p.x-a.home.x)>.20&&a.p.z<a.home.z+.5?a.p.x:a.home.x;
         dir.set(entryX-a.p.x,0,a.home.z+.65-a.p.z);
         if(dir.length()<.16&&Math.abs(a.p.x-a.home.x)<.2)a.entering=true;
       }else if(a.mode==='forage'&&a.p.z<a.home.z+.5){dir.set(a.home.x-a.p.x,0,a.home.z+.65-a.p.z);}
     }
     const pace=a.kind==='star'?.0035:a.mode==='escape'?(a.kind==='shrimp'?.6:1.0):a.kind==='shrimp'?.045:.22;
     if(move&&dir.lengthSq()>.0001)dir.normalize().multiplyScalar(pace);else dir.set(0,0,0);
     a.v.lerp(dir,1-Math.exp(-dt*(a.mode==='escape'?12:4)));a.p.addScaledVector(a.v,dt);
     if(a.v.lengthSq()>.00001){const facing=Math.atan2(-a.v.z,a.v.x)+(a.kind==='shrimp'&&a.mode==='escape'?Math.PI:0);const angle=Math.atan2(Math.sin(facing-a.yaw),Math.cos(facing-a.yaw));a.yaw+=Math.max(-dt*3,Math.min(dt*3,angle));}
     a.stroke+=dt*(a.kind==='goby'?2+a.v.length()*30:5);
     a.sediment+=dt;if(a.sediment>1&&a.mode==='forage'&&a.kind==='goby'&&a.v.lengthSq()>.0025){emit(a.p,1);a.sediment=0;}
    }
    a.p.y=environment.floor(a.p.x,a.p.z)+(a.kind==='goby'?.08+(a.mode==='forage'?.06:0):a.kind==='shrimp'?.07:.022);
    const pool=pools[a.pool];transform.position.copy(a.p);transform.rotation.set(0,a.yaw,0);transform.scale.setScalar(a.scale);transform.updateMatrix();pool.mesh.setMatrixAt(a.index,transform.matrix);
    pool.activity[a.index]=a.kind==='goby'?Math.min(1,a.v.length()*3)+.07:a.mode==='escape'?(.5+.5*Math.sin(a.stroke*3)):0;pool.phase[a.index]=a.stroke;
   }
   for(const p of pools){p.mesh.instanceMatrix.needsUpdate=true;p.mesh.geometry.attributes.bottomActivity.needsUpdate=true;p.mesh.geometry.attributes.bottomPhase.needsUpdate=true;}
   for(let i=0;i<capacity;i++){
    const d=dust[i];if(d.age<d.life&&dt>0){d.age+=dt;environment.current(d.p,time,flow);d.v.y-=.025*dt;d.p.addScaledVector(d.v,dt).addScaledVector(flow,dt*.6);if(d.p.y<=environment.floor(d.p.x,d.p.z)+.01)d.age=d.life;}
    d.p.toArray(pos,i*3);opacity[i]=d.age<d.life?.2*(1-d.age/d.life)**2:0;
   }
   dg.attributes.position.needsUpdate=dg.attributes.dustAlpha.needsUpdate=dg.attributes.dustSize.needsUpdate=true;
  }
  update(0);
  return {group,agents,dust,sediment,update,emit,contact,setDensity(amount){for(const p of pools)p.mesh.count=Math.ceil(p.activity.length*T.MathUtils.clamp(amount,0,1));},setVisible(v){group.visible=!!v;if(!v){for(const d of dust)d.age=d.life;opacity.fill(0);contacts.clear();}}};
 };
})();
