/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian Rauhe Harreby. See LICENSE for terms.
 * Procedural moon-jelly-inspired animals: translucent bells, four folded oral
 * arms and fine trailing tentacles. Shared geometry and analytic motion keep
 * memory bounded. The ocean supplies animation time, including pause/speed.
 */
window.createJellyfish=function(T,scene,waterUniforms,oceanOptics){
  'use strict';
  oceanOptics=oceanOptics||{};
  const group=new T.Group();group.name='Moon jellyfish';scene.add(group);
  const fallbackCausticTex=!oceanOptics.causticMap?new T.DataTexture(new Uint8Array([0,0,0,0]),1,1):null;
  if(fallbackCausticTex)fallbackCausticTex.needsUpdate=true;
  const wrap=(u,fallback)=>(u!==undefined && u!==null)?(u.value!==undefined?u:{value:u}):{value:fallback};
  const causticMap=wrap(oceanOptics.causticMap,fallbackCausticTex);
  const causticOrigin=wrap(oceanOptics.causticOrigin,new T.Vector2(0,-32));
  const causticSpan=wrap(oceanOptics.causticSpan,128);
  const causticDepths=wrap(oceanOptics.causticDepths,new T.Vector3(5,15,30));
  const activeSharkCount=wrap(oceanOptics.activeSharkCount,24);
  const animalStates=wrap(oceanOptics.animalStates,Array.from({length:24},()=>new T.Vector4()));
  const animalHeadings=wrap(oceanOptics.animalHeadings,Array.from({length:24},()=>new T.Vector4()));
  const lightDirection=wrap(waterUniforms&&waterUniforms.lightDirection,new T.Vector3(0,1,0));
  const sunPower=wrap(waterUniforms&&waterUniforms.sunPower,1);
  const eyePosition=wrap(waterUniforms&&waterUniforms.eyePosition,new T.Vector3(0,3.5,27));
  const daylight=(waterUniforms&&waterUniforms.daylight)||{value:1};
  const sunColor=(waterUniforms&&waterUniforms.sunColor)||{value:new T.Color(1,1,1)};
  const fogColor=(waterUniforms&&waterUniforms.fogColor)||{value:(scene.fog&&scene.fog.color)?scene.fog.color:new T.Color(0x073653)};

  function surface(rows,columns,point){
    const positions=[],uvs=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
      positions.push(...point(x/columns,y/rows));uvs.push(x/columns,y/rows);
    }
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const a=y*(columns+1)+x,b=a+columns+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  const bell=surface(32,96,(u,v)=>{
    const angle=u*Math.PI*2,theta=v*1.69;
    const radius=Math.sin(theta)*(1+.017*Math.cos(angle*16)*v*v*v);
    return [radius*Math.cos(angle),.65*Math.cos(theta),radius*Math.sin(angle)];
  });
  // A second curved surface gives the underside depth. The two surfaces meet
  // at the rim instead of presenting a single sheet from below.
  const underside=surface(24,64,(u,v)=>{
    const angle=u*Math.PI*2,theta=v*1.69;
    const radius=Math.sin(theta)*(1+.017*Math.cos(angle*16)*v*v*v);
    return [radius*Math.cos(angle),.65*Math.cos(theta)-.12*(1-v*v),radius*Math.sin(angle)];
  });
  const arm=surface(36,16,(u,v)=>{
    const width=(.15+.11*Math.sin(v*Math.PI))*(1-.8*v);
    // A folded oval cross-section remains visible edge-on; a flat ribbon did not.
    const angle=u*Math.PI*2,twist=v*2.4;
    const x=Math.cos(angle)*width,z=Math.sin(angle)*.048*(1-.8*v)
      +.028*Math.sin(v*37+angle*3)*Math.sin(Math.PI*v);
    return [x*Math.cos(twist)-z*Math.sin(twist),-.08-v*1.9,x*Math.sin(twist)+z*Math.cos(twist)];
  });
  // Four thick horseshoes sit inside the bell, not painted onto its exterior.
  // Combine their triangles into one shared draw geometry for all animals.
  const organPositions=[],organNormals=[],organUvs=[];
  for(let i=0;i<4;i++){
    const rotation=i*Math.PI/2+Math.PI/4;
    const part=surface(10,40,(u,v)=>{
      const arc=(.25+u*1.5)*Math.PI,tube=v*Math.PI*2;
      const x=.30+(.145+.026*Math.cos(tube))*Math.cos(arc);
      const z=(.145+.026*Math.cos(tube))*Math.sin(arc);
      return [x*Math.cos(rotation)-z*Math.sin(rotation),.27+.027*Math.sin(tube),
        x*Math.sin(rotation)+z*Math.cos(rotation)];
    });
    const triangles=part.toNonIndexed();
    organPositions.push(...triangles.attributes.position.array);
    organNormals.push(...triangles.attributes.normal.array);
    organUvs.push(...triangles.attributes.uv.array);
    part.dispose();triangles.dispose();
  }
  const organs=new T.BufferGeometry();
  organs.setAttribute('position',new T.Float32BufferAttribute(organPositions,3));
  organs.setAttribute('normal',new T.Float32BufferAttribute(organNormals,3));
  organs.setAttribute('uv',new T.Float32BufferAttribute(organUvs,2));
  const tentacleLevels=[[14,6],[28,10],[42,14],[56,18]].map(([strands,segments])=>{
  const tentaclePoints=[],tentacleNormals=[],tentacleUvs=[];
  for(let strand=0;strand<strands;strand++){
    const angle=strand/strands*Math.PI*2,length=.85+.65*(.5+.5*Math.sin(strand*2.4));
    const nx=Math.cos(angle),nz=Math.sin(angle);
    for(let segment=0;segment<segments;segment++)for(let end=0;end<2;end++){
      const t=(segment+end)/segments;
      const rootRadius=Math.sin(1.69)*(1+.017*Math.cos(angle*16));
      tentaclePoints.push(nx*rootRadius,.65*Math.cos(1.69)-t*length,nz*rootRadius);
      tentacleNormals.push(nx,0,nz);
      tentacleUvs.push(strand/strands,t);
    }
  }
  const tentacles=new T.BufferGeometry();
  tentacles.setAttribute('position',new T.Float32BufferAttribute(tentaclePoints,3));
  tentacles.setAttribute('normal',new T.Float32BufferAttribute(tentacleNormals,3));
  tentacles.setAttribute('uv',new T.Float32BufferAttribute(tentacleUvs,2));
  return tentacles;
  });
  let detailLevel=1;
  const animals=[];
  const vertexShader=`
    uniform float time,phase,pulse,kind;
    uniform vec2 dragBend;
    uniform vec3 lightDirection;
    uniform float sunPower;
    uniform int activeSharkCount;
    uniform vec4 animalStates[24];
    uniform vec4 animalHeadings[24];
    varying vec3 localPoint,viewPoint,viewNormal;
    varying vec2 jellyUv;
    varying vec3 worldPoint,worldNormal;
    varying float solarShadow;
    void main(){
      vec3 p=position; jellyUv=uv; localPoint=position;
      float width=1.-.23*pulse;
      if(kind<.5 || kind>2.5){
        // Internal organs contract together rather than along their tube UVs.
        float radial=kind>2.5 && kind<3.5 ? length(position.xz) : uv.y;
        p.xz*=1.-.23*pulse*smoothstep(0.,1.,radial);
        p.y*=1.+.24*pulse;
      }else{
        // Roots contract with the bell; lower tissue lags behind each pulse.
        float trail=uv.y;
        p.xz*=mix(width,1.,trail);
        p.x+=trail*trail*(.16*sin(time*1.3-trail*4.+phase)+.10*sin(time*.57+phase));
        p.z+=trail*trail*.16*cos(time*1.1-trail*5.+phase);
        p.xz+=dragBend*trail*trail;
        p.y-=.0186*pulse*(1.-trail);
      }
      vec4 worldPos=modelMatrix*vec4(p,1.);
      worldPoint=worldPos.xyz;
      vec3 safeNormal=dot(normal,normal)>.0001?normal:vec3(0.,1.,0.);
      vec3 deformedLocalNormal=normalize(safeNormal/vec3(width,1.+.24*pulse,width));
      worldNormal=normalize(mat3(modelMatrix)*deformedLocalNormal);
      float occlusion=1.;
      if(sunPower>.001){
        vec3 selfOrigin=modelMatrix[3].xyz;
        for(int k=0;k<24;k++){
          if(k>=activeSharkCount)break;
          vec4 st=animalStates[k];
          vec4 hd=animalHeadings[k];
          if(st.w<=.01 || hd.w<=.01) continue; // hd.w > 0 only for sharks
          if(distance(st.xyz,selfOrigin)<.5) continue;
          vec3 toCaster=st.xyz-worldPoint;
          float tRay=dot(toCaster,lightDirection);
          if(tRay>.8 && tRay<38.){
            vec3 rayPoint=worldPoint+lightDirection*tRay;
            vec3 rel=rayPoint-st.xyz;
            float along=clamp(dot(rel,hd.xyz),-hd.w,hd.w);
            float distToSpine=length(rel-hd.xyz*along);
            float coreR=st.w*.38;
            float penumbraR=st.w*(.68+.035*tRay);
            float block=1.-smoothstep(coreR,penumbraR,distToSpine);
            occlusion*=1.-.68*block*exp(-tRay*.045);
          }
        }
      }
      solarShadow=occlusion;
      vec4 mv=viewMatrix*worldPos;
      viewPoint=mv.xyz;
      viewNormal=normalize(normalMatrix*deformedLocalNormal);
      gl_Position=projectionMatrix*mv;
    }`;
  const fragmentShader=`
    uniform float kind,daylight,sunPower,phase,pulse,bioExcite;
    uniform vec3 fogColor,sunColor,lightDirection,eyePosition;
    uniform sampler2D causticMap;
    uniform vec2 causticOrigin;
    uniform float causticSpan;
    uniform vec3 causticDepths;
    varying vec3 localPoint,viewPoint,viewNormal;
    varying vec2 jellyUv;
    varying vec3 worldPoint,worldNormal;
    varying float solarShadow;
    void main(){
      vec3 colour=vec3(.47,.76,.88);
      float alpha;
      float bioPattern=0.;
      float bioWave=.55+.45*sin(jellyUv.y*9.-pulse*5.2+phase);
      if(kind<.5 || kind>3.5){
        float edge=pow(1.-abs(dot(normalize(viewNormal),normalize(-viewPoint))),2.2);
        float angle=atan(localPoint.z,localPoint.x);
        float canalDistance=abs(sin(angle*16.+.15*sin(jellyUv.y*18.)));
        float canal=1.-smoothstep(.025,.065+fwidth(canalDistance),canalDistance);
        canal*=smoothstep(.14,.4,jellyUv.y);
        float rim=smoothstep(.93,.995,jellyUv.y);
        colour+=vec3(.15,.19,.18)*(edge+rim*.5+canal*.3);
        alpha=.09+edge*.36+rim*.18+canal*.08;
        if(kind>3.5)alpha*=.38;
        bioPattern=(canal*.65+rim*.85+edge*.20)*bioWave;
      }else if(kind<1.5){
        float fringe=pow(abs(jellyUv.x*2.-1.),2.);
        colour=vec3(.62,.73,.86);
        alpha=(.16+.17*fringe)*(1.-smoothstep(.78,1.,jellyUv.y));
        bioPattern=fringe*.28*bioWave;
      }else if(kind<2.5){
        colour=vec3(.60,.79,.89);
        alpha=.32*(1.-jellyUv.y*.75);
        bioPattern=(.35+.65*pow(.5+.5*sin(jellyUv.y*28.-pulse*4.+jellyUv.x*37.),3.))*(1.-jellyUv.y*.65)*.42;
      }else{
        float facing=abs(dot(normalize(viewNormal),normalize(-viewPoint)));
        colour=vec3(.57,.39,.65)*(.75+.25*facing);
        alpha=.34;
        bioPattern=.22*(.7+.3*pulse);
      }
      float waterDepth=max(0.,15.-worldPoint.y);
      if(sunPower>.001){
        vec2 surfaceCoord=worldPoint.xz+lightDirection.xz*waterDepth/max(.2,lightDirection.y);
        vec2 causticUV=(surfaceCoord-causticOrigin)/causticSpan+.5;
        float spread=.003+waterDepth*.00018;
        vec3 layers=texture2D(causticMap,causticUV).rgb*.40
          +(texture2D(causticMap,causticUV+vec2(spread,0.)).rgb
          + texture2D(causticMap,causticUV-vec2(spread,0.)).rgb
          + texture2D(causticMap,causticUV+vec2(0.,spread)).rgb
          + texture2D(causticMap,causticUV-vec2(0.,spread)).rgb)*.15;
        layers*=16.;
        float focus=waterDepth<causticDepths.y
          ? mix(layers.r,layers.g,clamp((waterDepth-causticDepths.x)/(causticDepths.y-causticDepths.x),0.,1.))
          : mix(layers.g,layers.b,clamp((waterDepth-causticDepths.y)/(causticDepths.z-causticDepths.y),0.,1.));
        vec2 cEdge=min(causticUV,1.-causticUV);
        float mapFade=smoothstep(0.,.06,min(cEdge.x,cEdge.y));
        float depthFade=exp(-waterDepth*.035)*smoothstep(0.,2.5,waterDepth);
        float distFilter=1.-smoothstep(.2,1.1,max(length(dFdx(surfaceCoord)),length(dFdy(surfaceCoord))));
        float kindWeight=(kind>1.5 && kind<2.5) ? .55 : (kind>.5 && kind<1.5 ? .82 : 1.);
        float causticWeight=mapFade*depthFade*distFilter*(.35+.65*max(dot(normalize(worldNormal),lightDirection),0.))*solarShadow*kindWeight;
        colour+=colour*sunColor*sunPower*clamp(focus-.85,-.35,2.2)*causticWeight*.48;
        vec3 worldView=normalize(eyePosition-worldPoint);
        float backScatter=pow(max(dot(-worldView,lightDirection),0.),3.0)*sunPower*solarShadow;
        float rimGlow=pow(1.-abs(dot(normalize(worldNormal),worldView)),2.0);
        colour+=sunColor*backScatter*(.22+.38*rimGlow)*exp(-waterDepth*.025);
      }
      colour*=mix(.27,1.,daylight);
      colour*=mix(vec3(.8,.9,1.),sunColor,daylight*.22);
      vec3 depthTint=exp(-vec3(.018,.006,.0015)*max(0.,waterDepth-10.));
      colour*=mix(vec3(1.),depthTint,.72);
      if(daylight<.32){
        float nightAmount=smoothstep(.32,.02,daylight);
        float bioGlowStrength=bioPattern*nightAmount*(1.+1.65*bioExcite);
        vec3 bioColor=mix(vec3(.12,.76,.98),vec3(.28,.96,.84),jellyUv.y);
        colour+=bioColor*bioGlowStrength;
        alpha=min(1.,alpha+bioGlowStrength*.14);
      }
      float fog=1.-exp(-.000441*dot(viewPoint,viewPoint));
      colour=mix(colour,fogColor,fog);
      alpha*=1.-fog*.7;
      gl_FragColor=vec4(colour,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // Near, middle and distant lanes widen with distance, so the outer animals
  // still occupy the sides of the view instead of collapsing into its centre.
  const paths=[
    {x:-23,y:-2,z:-7,rx:5,rz:8},{x:3,y:5,z:-9,rx:5,rz:8},{x:26,y:7,z:-11,rx:5,rz:8},
    {x:-41,y:4,z:-32,rx:7,rz:11},{x:-3,y:-7,z:-35,rx:7,rz:11},{x:44,y:8,z:-38,rx:7,rz:11},
    {x:-59,y:-10,z:-58,rx:10,rz:14},{x:0,y:3,z:-63,rx:10,rz:14},{x:64,y:7,z:-68,rx:10,rz:14}
  ];
  function setCount(count){
    // Build only when needed, then reuse hidden animals. All share five models.
    for(let i=animals.length;i<count;i++){
      const body=new T.Group();body.name='Jellyfish '+(i+1);group.add(body);
      const phase=i*2.39996;
      const uniforms={
        time:{value:0},phase:{value:phase},pulse:{value:0},dragBend:{value:new T.Vector2()},
        bioExcite:{value:0},
        daylight,sunColor,fogColor,
        lightDirection,sunPower,eyePosition,
        causticMap,causticOrigin,causticSpan,causticDepths,
        animalStates,animalHeadings,activeSharkCount
      };
      function material(kind){return new T.ShaderMaterial({
        uniforms:{...uniforms,kind:{value:kind}},vertexShader,fragmentShader,
        transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true
      });}
      const bellMesh=new T.Mesh(bell,material(0));body.add(bellMesh);
      // Picking follows the pulsing surface exactly, rather than its rest shape.
      bellMesh.getVertexPosition=function(index,target){
        target.fromBufferAttribute(bell.attributes.position,index);
        const v=bell.attributes.uv.getY(index),pulse=uniforms.pulse.value;
        const width=1-.23*pulse*T.MathUtils.smoothstep(v,0,1);
        target.x*=width;target.z*=width;target.y*=1+.24*pulse;
        return target;
      };
      bell.computeBoundingSphere();bell.boundingSphere.radius*=1.3;
      const innerBell=new T.Mesh(underside,material(4));innerBell.name='Bell underside';body.add(innerBell);
      const innerOrgans=new T.Mesh(organs,material(3));innerOrgans.name='Internal horseshoes';body.add(innerOrgans);
      const armMaterial=material(1);
      for(let n=0;n<4;n++){
        const mesh=new T.Mesh(arm,armMaterial),angle=n*Math.PI/2;
        mesh.position.set(Math.cos(angle)*.21,-.04,Math.sin(angle)*.21);
        mesh.rotation.y=-angle;body.add(mesh);
      }
      const threads=new T.LineSegments(tentacleLevels[detailLevel],material(2));body.add(threads);
      // Shader deformation extends beyond the static bounds, so these small
      // shared meshes do not use static frustum culling.
      body.children.forEach(child=>{child.frustumCulled=false;});
      body.scale.setScalar(.85+(i%3)*.19);
      animals.push({orientation:window.createJellyOrientation(T),threads,body,mesh:body,pickMesh:bellMesh,isJellyfish:true,scale:body.scale.x,uniforms,phase,
        bioExcite:0,lastTime:undefined,
        offset:new T.Vector3(),velocity:new T.Vector3(),rotationOffset:new T.Quaternion(),angularVelocity:new T.Vector3(),
        ...paths[i%paths.length]});
    }
    animals.forEach((animal,index)=>{animal.body.visible=index<count;});
    group.visible=count>0;
  }
  function update(time,held){
    if(!group.visible)return;
    for(const animal of animals){
      if(!animal.body.visible)continue;
      const {body,uniforms,phase}=animal;
      const cycle=(time*(.22+.012*Math.sin(phase))+phase)%1;
      const pulse=T.MathUtils.smoothstep(cycle,0,.18)*(1-T.MathUtils.smoothstep(cycle,.18,1));
      uniforms.time.value=time;uniforms.pulse.value=pulse;
      // Weak swimmers: current advection and individually oriented bell thrust, no flocking
      // or visual predator detection. Each animal retains its own pulse phase.
      const environment=window.marineEnvironment;
      if(!animal.drift){animal.drift=new T.Vector3(animal.x+(Math.random()-.5)*animal.rx*2,animal.y+(Math.random()-.5)*4,animal.z+Math.cos(phase)*animal.rz);animal.driftVelocity=new T.Vector3();animal.driftTime=time;}
      const driftDt=Math.max(0,Math.min(.5,time-animal.driftTime));animal.driftTime=time;
      animal.orientation.update(time,animal.drift,environment,pulse);
      if(environment){
        environment.current(animal.drift,time,animal.driftVelocity);
        // A bounded vertical balance models ascent pulses and passive sinking.
        animal.driftVelocity.addScaledVector(animal.orientation.axis,pulse*.10);
        animal.driftVelocity.y+=(-.035)-Math.max(0,animal.drift.y-9)*.03+Math.max(0,-18-animal.drift.y)*.02;

        animal.driftVelocity.z-=Math.max(0,animal.drift.z-10)*.02;
        if(animal!==held&&driftDt>0){animal.drift.add(animal.offset);animal.offset.set(0,0,0);animal.drift.addScaledVector(animal.driftVelocity,driftDt);
          // Re-enter upstream outside the widest camera view; the extra distance
          // creates a variable absence before the next individual drifts in.
          const edge=Math.max(35,(27-animal.drift.z)*1.8);
          if(animal.drift.x>edge){animal.drift.x=-edge-2-Math.random()*8;animal.drift.y=-12+Math.random()*22;animal.velocity.set(0,0,0);}
        }
      }
      body.quaternion.copy(animal.orientation.quaternion);
      body.position.copy(animal.drift);

      // Measure mechanical disturbance and bioluminescent excitation
      let sharkDisturbance=0;
      const states=animalStates.value,headings=animalHeadings.value;
      if(states&&headings){
        const posX=body.position.x+animal.offset.x;
        const posY=body.position.y+animal.offset.y;
        const posZ=body.position.z+animal.offset.z;
        const activeCount=typeof activeSharkCount.value==='number'?activeSharkCount.value:24;
        const count=Math.min(activeCount,24,states.length,headings.length);
        for(let k=0;k<count;k++){
          const st=states[k],hd=headings[k];
          if(!st || !hd || st.w<=.01 || hd.w<=.01) continue;
          const threshold=st.w+2.4*animal.scale;
          const dx=posX-st.x,dy=posY-st.y,dz=posZ-st.z;
          const distSq=dx*dx+dy*dy+dz*dz;
          if(distSq<threshold*threshold){
            const dist=Math.sqrt(distSq);
            const prox=1-dist/threshold;
            if(prox>sharkDisturbance) sharkDisturbance=prox;
          }
        }
      }
      const motionDisturbance=animal.velocity.length()*.18+uniforms.dragBend.value.length()*.8;
      const disturbance=Math.max(motionDisturbance,sharkDisturbance);
      const dt=(animal.lastTime!==undefined && time>animal.lastTime)?Math.min(time-animal.lastTime,.1):0;
      if(dt>0){
        if(disturbance>animal.bioExcite){
          animal.bioExcite+=(disturbance-animal.bioExcite)*Math.min(1,dt*8.5);
        }else{
          animal.bioExcite+=(disturbance-animal.bioExcite)*(1-Math.exp(-dt*2.2));
        }
      }else{
        animal.bioExcite=disturbance;
      }
      if(motionDisturbance<1e-5 && sharkDisturbance<1e-5 && animal.bioExcite<1e-4){
        animal.bioExcite=0;
      }
      const excite=T.MathUtils.clamp(animal.bioExcite,0,1.2);
      animal.bioExcite=excite;
      uniforms.bioExcite.value=excite;
      animal.lastTime=time;
    }
  }
  return {group,animals,update,setCount,setDetail(level){detailLevel=level;animals.forEach(a=>a.threads.geometry=tentacleLevels[level]);}};
};
