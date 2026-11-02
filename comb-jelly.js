/* SPDX-License-Identifier: GPL-3.0-only
 * Mnemiopsis leidyi-inspired lobate ctenophores. Enlarged display specimens.
 * Moving comb iridescence requires incident light; stimulated green emission
 * is a separate nighttime effect. Neither is a surrounding plankton halo.
 */
(() => {
 'use strict';
 window.createCombJellies=function(T,scene,water,environment){
  const group=new T.Group();group.name='Mnemiopsis leidyi — comb jellies';scene.add(group);
  const animals=[],flow=new T.Vector3(),direction=new T.Vector3(),origin=new T.Vector3(),forward=new T.Vector3();
  const skinGeometry=new T.SphereGeometry(1,32,24);
  const positions=[],normals=[],uv=[],rows=[],indices=[];
  // Eight distinct meridional comb rows on a laterally compressed oval body.
  for(let row=0;row<8;row++)for(let j=0;j<=96;j++){
   const v=j/96,theta=.22+v*2.46,angle=row*Math.PI/4;
   for(const side of [-1,1]){
    const a=angle+side*.055;
    positions.push(.286*Math.sin(theta)*Math.cos(a),.47*Math.cos(theta),.196*Math.sin(theta)*Math.sin(a));
    const n=new T.Vector3(Math.sin(theta)*Math.cos(a)/.286,Math.cos(theta)/.47,Math.sin(theta)*Math.sin(a)/.196).normalize();normals.push(...n.toArray());uv.push((side+1)/2,v);rows.push(row);
   }
   if(j<96){const a=row*194+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const combGeometry=new T.BufferGeometry();combGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));combGeometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));combGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));combGeometry.setAttribute('combRow',new T.Float32BufferAttribute(rows,1));combGeometry.setIndex(indices);
  const vertex=`varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;
    void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-p.xyz;gl_Position=projectionMatrix*p;}`;
  const skinFragment=`uniform float illumination;uniform float day;varying vec3 vNormal;varying vec3 vView;
    void main(){float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.);
      vec3 tint=mix(vec3(.025,.09,.12),vec3(.35,.65,.71),clamp(illumination,0.,1.));
      float fog=exp(-length(vView)*.021);gl_FragColor=vec4(tint,(.025+edge*.19)*fog*(.18+.82*max(day,illumination)));}`;
  const combVertex='attribute float combRow;varying float row;'+vertex.replace('vUv=uv;','vUv=uv;row=combRow;');
  const combFragment=`uniform float clock;uniform float phase;uniform float illumination;uniform float day;uniform float flash;uniform float flashAge;uniform float bioAmount;
    varying float row;varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;
    vec3 spectrum(float h){vec3 p=abs(fract(vec3(h)+vec3(0.,.6667,.3333))*6.-3.);return clamp(p-1.,0.,1.);}
    void main(){
      float endMask=smoothstep(0.,.06,vUv.y)*(1.-smoothstep(.93,1.,vUv.y));
      float plate=1.-smoothstep(.28,.49,abs(fract(vUv.y*38.)-.5));
      float edge=1.-smoothstep(.20,.50,abs(vUv.x-.5));
      float beat=.45+.55*pow(.5+.5*cos(vUv.y*37.-clock*8.+phase+row*.32),3.);
      float viewAngle=abs(dot(normalize(vNormal),normalize(vView)));
      vec3 rainbow=spectrum(vUv.y*1.7-clock*.23+row*.11+viewAngle*.28+phase*.07);
      // Travelling coloured highlights are scattered illumination, not emitted light.
      vec3 light=rainbow*illumination*beat*(.48+.52*viewAngle)*1.6;
      float night=1.-smoothstep(.02,.32,day);
      float front=exp(-pow((vUv.y-flashAge*1.8)/.16,2.));
      light+=vec3(.06,.84,.54)*flash*front*night*bioAmount*.65;
      float fog=exp(-length(vView)*.021);
      gl_FragColor=vec4(light,plate*edge*endMask*fog*.88);
    }`;
  const starts=[[-4.5,2.5,14],[4.0,.3,12],[-1.0,-2,8]];
  for(let i=0;i<3;i++){
   const root=new T.Group();root.name='Comb jelly '+(i+1);root.position.set(starts[i][0]+(Math.random()-.5)*8,starts[i][1]+(Math.random()-.5)*5,starts[i][2]+(Math.random()-.5)*2);root.scale.setScalar(1.5-i*.20);group.add(root);
   const uniforms={clock:{value:0},phase:{value:i*2.39996},illumination:{value:1},day:water.daylight,flash:{value:0},flashAge:{value:99},bioAmount:water.bioAmount};
   const skin=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:skinFragment,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});
   const body=new T.Mesh(skinGeometry,skin);body.scale.set(.28,.47,.19);root.add(body);
   const lobes=[];
   // Two large oral lobes, four smaller auricles; no moon-jelly bell or long arms.
   for(const side of [-1,1]){
    const lobe=new T.Mesh(skinGeometry,skin);lobe.position.set(side*.19,-.20,0);lobe.scale.set(.16,.43,.17);lobe.rotation.z=side*.12;root.add(lobe);lobes.push(lobe);
    for(const z of [-1,1]){const auricle=new T.Mesh(skinGeometry,skin);auricle.position.set(side*.09,-.48,z*.11);auricle.scale.set(.035,.15,.036);auricle.rotation.z=-side*.2;root.add(auricle);}
   }
   const combs=new T.Mesh(combGeometry,new T.ShaderMaterial({uniforms,vertexShader:combVertex,fragmentShader:combFragment,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));combs.name='Eight moving comb rows';root.add(combs);
   animals.push({root,uniforms,lobes,position:root.position,velocity:new T.Vector3(),nextArrival:0,phase:Math.random()*Math.PI*2,lastFlash:-100,flashStrength:0});
  }
  let lastTime;const previousThreatPositions=new Map();
  function stimulate(index,strength,time){const a=animals[index];if(!a||time-a.lastFlash<3)return;a.lastFlash=time;a.flashStrength=Math.min(1,Math.max(0,strength));}
  function update(time,threats=[],scuba){
   const dt=lastTime===undefined?0:Math.max(0,Math.min(.25,time-lastTime));lastTime=time;if(!group.visible)return;
   const movingThreats=[];
   if(dt>0)for(const t of threats){const previous=previousThreatPositions.get(t.p);if(previous&&previous.distanceTo(t.p)/dt>.15)movingThreats.push(t);if(previous)previous.copy(t.p);else previousThreatPositions.set(t.p,t.p.clone());}
   for(let i=0;i<animals.length;i++){
    const a=animals[i],u=a.uniforms;
    if(dt>0){
     if(!a.root.visible){
      if(time<a.nextArrival)continue;
      a.position.set(-24,-6+Math.random()*13,8+Math.random()*6);
      a.lastFlash=-100;a.flashStrength=0;a.phase=Math.random()*Math.PI*2;u.phase.value=a.phase;
      a.root.visible=true;
     }
     environment.current(a.position,time,flow);
     // Advect with the water, without a spring back to a fixed home.
     a.velocity.copy(flow);a.velocity.y+=.012*Math.sin(time*.13+a.phase);
     a.velocity.y+=Math.max(0,-12-a.position.y)*.02-Math.max(0,a.position.y-10)*.02;
     a.position.addScaledVector(a.velocity,dt);
     if(a.position.x>24){a.root.visible=false;a.nextArrival=time+4+Math.random()*16;continue;}
     for(const t of movingThreats){const d=a.position.distanceTo(t.p);if(d<(t.radius||0)+1.15)stimulate(i,.65,time);}
    }
    a.root.rotation.set(.08*Math.sin(time*.12+a.phase),a.phase+time*.035,.12*Math.sin(time*.09+a.phase));
    a.lobes.forEach((lobe,j)=>{lobe.rotation.z=(j===0?-1:1)*(.12+.035*Math.sin(time*.45+a.phase));});
    let illumination=water.daylight.value*.95;
    if(scuba&&scuba.group.visible)for(const diver of scuba.divers){
     if(diver.torch.intensity<=0)continue;
     diver.torch.getWorldPosition(origin);forward.subVectors(diver.torchTarget.position,origin).normalize();direction.subVectors(a.position,origin);
     const distance=direction.length(),cosine=direction.normalize().dot(forward);
     if(distance<24&&cosine>Math.cos(diver.torch.angle))illumination+=Math.pow((cosine-Math.cos(diver.torch.angle))/(1-Math.cos(diver.torch.angle)),.5)/(1+distance*distance*.035);
    }
    // Deliberate soft display fill keeps these enlarged specimens readable at
    // night. It represents artificial viewing illumination, not rainbow emission.
    u.clock.value=time;u.illumination.value=Math.min(1.5,Math.max(.55,illumination));
    u.flashAge.value=time-a.lastFlash;u.flash.value=a.flashStrength*Math.exp(-Math.max(0,u.flashAge.value)*3);
   }
  }
  return {group,animals,update,stimulate,setVisible(value){group.visible=!!value;if(!value){previousThreatPositions.clear();for(const a of animals){a.lastFlash=-100;a.flashStrength=0;a.uniforms.flash.value=0;}}}};
 };
})();
