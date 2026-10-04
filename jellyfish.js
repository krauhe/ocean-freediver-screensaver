/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian R. Harreby. See LICENSE for terms.
 * Procedural moon-jelly-inspired animals: translucent bells, four folded oral
 * arms and fine trailing tentacles. Shared geometry and analytic motion keep
 * memory bounded. The ocean supplies animation time, including pause/speed.
 */
window.createJellyfish=function(T,scene,waterUniforms){
  'use strict';
  const group=new T.Group();group.name='Moon jellyfish';scene.add(group);
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
  const tentaclePoints=[],tentacleUvs=[];
  for(let strand=0;strand<56;strand++){
    const angle=strand/56*Math.PI*2,length=.85+.65*(.5+.5*Math.sin(strand*2.4));
    for(let segment=0;segment<18;segment++)for(let end=0;end<2;end++){
      const t=(segment+end)/18;
      const rootRadius=Math.sin(1.69)*(1+.017*Math.cos(angle*16));
      tentaclePoints.push(Math.cos(angle)*rootRadius,.65*Math.cos(1.69)-t*length,Math.sin(angle)*rootRadius);
      tentacleUvs.push(strand/56,t);
    }
  }
  const tentacles=new T.BufferGeometry();
  tentacles.setAttribute('position',new T.Float32BufferAttribute(tentaclePoints,3));
  tentacles.setAttribute('uv',new T.Float32BufferAttribute(tentacleUvs,2));
  const animals=[];
  const vertexShader=`
    uniform float time,phase,pulse,kind;
    uniform vec2 dragBend;
    varying vec3 localPoint,viewPoint,viewNormal;
    varying vec2 jellyUv;
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
      vec4 mv=modelViewMatrix*vec4(p,1.);
      viewPoint=mv.xyz;
      viewNormal=normalize(normalMatrix*(normal/vec3(width,1.+.24*pulse,width)));
      gl_Position=projectionMatrix*mv;
    }`;
  const fragmentShader=`
    uniform float kind,daylight;
    uniform vec3 fogColor,sunColor;
    varying vec3 localPoint,viewPoint,viewNormal;
    varying vec2 jellyUv;
    void main(){
      vec3 colour=vec3(.47,.76,.88);
      float alpha;
      if(kind<.5 || kind>3.5){
        float edge=pow(1.-abs(dot(normalize(viewNormal),normalize(-viewPoint))),2.2);
        float angle=atan(localPoint.z,localPoint.x);
        float canalDistance=abs(sin(angle*16.+.15*sin(jellyUv.y*18.)));
        float canal=1.-smoothstep(.025,.065+fwidth(canalDistance),canalDistance);
        canal*=smoothstep(.14,.4,jellyUv.y);
        float rim= smoothstep(.93,.995,jellyUv.y);
        colour+=vec3(.15,.19,.18)*(edge+rim*.5+canal*.3);
        alpha=.09+edge*.36+rim*.18+canal*.08;
        if(kind>3.5)alpha*=.38;
      }else if(kind<1.5){
        float fringe=pow(abs(jellyUv.x*2.-1.),2.);
        colour=vec3(.62,.73,.86);
        alpha=(.16+.17*fringe)*(1.-smoothstep(.78,1.,jellyUv.y));
      }else if(kind<2.5){
        colour=vec3(.60,.79,.89);
        alpha=.32*(1.-jellyUv.y*.75);
      }else{
        float facing=abs(dot(normalize(viewNormal),normalize(-viewPoint)));
        colour=vec3(.57,.39,.65)*(.75+.25*facing);
        alpha=.34;
      }
      // Readable starlit tissue, without treating jellyfish as light sources.
      colour*=mix(.27,1.,daylight);
      colour*=mix(vec3(.8,.9,1.),sunColor,daylight*.22);
      float fog=1.-exp(-.000441*dot(viewPoint,viewPoint));
      colour=mix(colour,fogColor,fog);alpha*=1.-fog*.7;
      gl_FragColor=vec4(colour,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // Near, middle and distant lanes widen with distance, so the outer animals
  // still occupy the sides of the view instead of collapsing into its centre.
  const paths=[
    {x:-16,y:-2,z:-7,rx:5,rz:8},{x:3,y:5,z:-9,rx:5,rz:8},{x:16,y:-6,z:-11,rx:5,rz:8},
    {x:-32,y:4,z:-32,rx:7,rz:11},{x:-3,y:-7,z:-35,rx:7,rz:11},{x:31,y:8,z:-38,rx:7,rz:11},
    {x:-49,y:-10,z:-58,rx:10,rz:14},{x:0,y:3,z:-63,rx:10,rz:14},{x:48,y:-3,z:-68,rx:10,rz:14}
  ];
  function setCount(count){
    // Build only when needed, then reuse hidden animals. All share five models.
    for(let i=animals.length;i<count;i++){
    const body=new T.Group();body.name='Jellyfish '+(i+1);group.add(body);
    const phase=i*2.39996;
    const uniforms={time:{value:0},phase:{value:phase},pulse:{value:0},dragBend:{value:new T.Vector2()},
      daylight:waterUniforms.daylight,sunColor:waterUniforms.sunColor,fogColor:{value:scene.fog.color}};
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
    const threads=new T.LineSegments(tentacles,material(2));body.add(threads);
    // Shader deformation extends beyond the static bounds, so these small
    // shared meshes do not use static frustum culling.
    body.children.forEach(child=>{child.frustumCulled=false;});
    body.scale.setScalar(.85+(i%3)*.19);
    animals.push({body,mesh:body,pickMesh:bellMesh,isJellyfish:true,scale:body.scale.x,uniforms,phase,
      offset:new T.Vector3(),velocity:new T.Vector3(),rotationOffset:new T.Quaternion(),angularVelocity:new T.Vector3(),
      ...paths[i%paths.length]});
    }
    animals.forEach((animal,index)=>{animal.body.visible=index<count;});
    group.visible=count>0;
  }
  const pulseDirection=new T.Vector3();
  const swimmingDirection=new T.Vector3(),bellAxis=new T.Vector3(0,1,0);
  function update(time){
    if(!group.visible)return;
    for(const animal of animals){
      if(!animal.body.visible)continue;
      const {body,uniforms,phase}=animal;
      const cycle=(time*(.22+.012*Math.sin(phase))+phase)%1;
      const pulse=T.MathUtils.smoothstep(cycle,0,.18)*(1-T.MathUtils.smoothstep(cycle,.18,1));
      uniforms.time.value=time;uniforms.pulse.value=pulse;
      // Follow a three-dimensional loop, pointing the bell along its tangent.
      // Different phases put animals on approaching and receding paths at once.
      const travel=time*(.052+.008*Math.sin(phase))+phase;
      swimmingDirection.set(animal.rx*Math.cos(travel),3.2*Math.cos(travel*.8+phase),-animal.rz*Math.sin(travel)).normalize();
      body.quaternion.setFromUnitVectors(bellAxis,swimmingDirection);
      body.rotateY(phase+time*.025);
      pulseDirection.set(0,pulse*.24,0).applyQuaternion(body.quaternion);
      // The pulse follows the tilted bell axis. Slow bounded currents avoid
      // wrapping or visible respawns, and pause still freezes all motion.
      body.position.set(animal.x+Math.sin(travel)*animal.rx,
        animal.y+Math.sin(travel*.8+phase)*4,
        animal.z+Math.cos(travel)*animal.rz).add(pulseDirection);
    }
  }
  return {group,animals,update,setCount};
};
