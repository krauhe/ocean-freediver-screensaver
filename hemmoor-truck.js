/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian Rauhe Harreby. See LICENSE for terms.
 * Photo-inspired Kreidesee truck; artistic dimensions, not a survey model.
 * References: P. Coors, tauchernest.de, Hemmoor/Ruettler photographs (2018).
 */
(() => {
  'use strict';
  window.createHemmoorTruck=function(T,scene,water){
    const group=new T.Group();group.name='Hemmoor truck lying on its side';
    // Offset beyond the ferry's stern: behind the boat, still visible beside it.
    // The final height is fitted to the sand after the truck has been rolled over.
    group.position.set(-22.5,0,-33);group.rotation.set(-.035,.35,1.61,'YXZ');group.scale.setScalar(1.3);scene.add(group);
    const batches=new Map(),dummy=new T.Object3D(),boxGeo=new T.BoxGeometry(1,1,1),tubeGeo=new T.CylinderGeometry(1,1,1,12);
    function part(geo,mat,pos,scale=[1,1,1],rotation=[0,0,0],matrix){
      dummy.position.set(...pos);dummy.scale.set(...scale);dummy.rotation.set(...rotation);dummy.updateMatrix();
      const g=geo.index?geo.toNonIndexed():geo.clone();g.applyMatrix4(dummy.matrix);if(matrix)g.applyMatrix4(matrix);
      if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);
    }
    const box=(mat,p,s,r=[0,0,0],matrix)=>part(boxGeo,mat,p,s,r,matrix);
    function bar(mat,a,b,r=.035){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());const e=new T.Euler().setFromQuaternion(q);part(tubeGeo,mat,av.add(bv).multiplyScalar(.5).toArray(),[r,v.length(),r],[e.x,e.y,e.z]);}
    function weathered(color,kind){
      const m=new T.MeshStandardMaterial({color,roughness:.91,metalness:kind==='paint'?.15:.03});
      m.onBeforeCompile=s=>{
        s.uniforms.truckDay=water.daylight;
        s.vertexShader='varying vec3 truckPosition;\n'+s.vertexShader;
        s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntruckPosition=position;');
        s.fragmentShader=`varying vec3 truckPosition;uniform float truckDay;
          float truckHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
          float truckNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(truckHash(i),truckHash(i+vec3(1,0,0)),f.x),mix(truckHash(i+vec3(0,1,0)),truckHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(truckHash(i+vec3(0,0,1)),truckHash(i+vec3(1,0,1)),f.x),mix(truckHash(i+vec3(0,1,1)),truckHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        `+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float dirt=truckNoise(truckPosition*3.4)*.65+truckNoise(truckPosition*13.)*.35;
          float streak=truckNoise(truckPosition*vec3(8.,.6,8.));
          diffuseColor.rgb*=.64+.42*dirt;
          ${kind==='paint'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.18,.10),smoothstep(.49,.7,dirt)*.85);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.16,.075),smoothstep(.64,.82,streak)*.52);':''}
        `);
        s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight*=mix(vec3(.18,.3,.4),vec3(.75,.91,.94),truckDay);#include <opaque_fragment>` .replace(';#include',';\n#include'));
      };m.customProgramCacheKey=()=> 'hemmoor-'+kind;return m;
    }
    const paint=weathered(0x90afb0,'paint'),blue=weathered(0x527b83,'paint'),rust=weathered(0x605241,'paint');
    const tyre=weathered(0x172326,'rubber'),steel=weathered(0x4f6667,'metal');
    const inside=weathered(0x182b2d,'rubber'),lamp=weathered(0xb1bcab,'metal');
    // Cab points toward +Z in model space. There is no platform beneath it.
    for(const x of [-.85,.85])box(steel,[x,4.13,-.7],[.16,.24,6.7]);
    for(const z of [1.75,-2.5]){
      bar(steel,[-1.38,3.72,z],[1.38,3.72,z],.12);
      for(const side of [-1,1]){
        const wheel=new T.CylinderGeometry(.62,.62,.42,28);part(wheel,tyre,[side*1.2,3.72,z],[1,1,1],[0,0,Math.PI/2]);wheel.dispose();
        const rim=new T.CylinderGeometry(.31,.31,.025,20);part(rim,steel,[side*1.425,3.72,z],[1,1,1],[0,0,Math.PI/2]);rim.dispose();
        for(let i=0;i<8;i++){const a=i*Math.PI/4;part(tubeGeo,rust,[side*1.445,3.72+Math.sin(a)*.22,z+Math.cos(a)*.22],[.035,.035,.035],[0,0,Math.PI/2]);}
        // Raised tyre shoulder ribs are geometry, not a flat black wheel decal.
        for(let i=0;i<24;i++){const a=i*Math.PI/12;box(tyre,[side*1.2,3.72+Math.cos(a)*.61,z+Math.sin(a)*.61],[.43,.035,.085],[a,0,0]);}
      }
    }
    box(paint,[0,4.48,2.12],[2.62,1.04,2.35]);
    box(inside,[0,5.35,2.0],[2.33,.12,1.95]);
    // Open, framed cabin, with seats visible through the damaged windscreen.
    box(paint,[0,6.55,2.03],[2.66,.19,2.36]);
    box(blue,[0,5.75,.94],[2.5,1.6,.13]);
    for(const x of [-1.23,1.23]){
      box(paint,[x,5.15,2.03],[.14,.52,2.15]);
      bar(paint,[x,5.36,3.22],[x*.96,6.48,3.08],.065);
      bar(paint,[x,5.35,1.08],[x,6.5,1.08],.065);
      bar(paint,[x,5.35,2.03],[x,6.48,2.03],.04);
      box(steel,[x*1.03,5.1,1.85],[.07,.06,.27]);
      box(steel,[x*1.05,4.12,2.58],[.36,.11,.54]);
    }
    box(steel,[0,5.34,3.21],[2.45,.10,.11]);
    box(steel,[0,6.46,3.10],[2.4,.09,.10]);
    for(const x of [-.58,.58]){box(inside,[x,5.25,1.7],[.72,.18,.68]);box(inside,[x,5.6,1.37],[.72,.75,.17],[-.1,0,0]);}
    box(inside,[0,5.35,2.88],[2.2,.20,.42]);
    const steering=new T.TorusGeometry(.24,.025,8,22);part(steering,steel,[-.62,5.57,2.78],[1,1,1],[-.6,0,0]);steering.dispose();
    // Dark windshield glazing and the characteristic branching impact cracks.
    const glass=new T.MeshStandardMaterial({color:0x397b80,roughness:.28,metalness:.16,transparent:true,opacity:.26,side:T.DoubleSide,depthWrite:false});
    const windshield=new T.Mesh(new T.PlaneGeometry(2.32,1.04),glass);windshield.position.set(0,5.91,3.17);windshield.rotation.x=-.105;group.add(windshield);
    const crackPositions=[];
    for(const [cx,cy,r]of [[-.12,5.97,.68],[.71,5.77,.23],[-.81,5.83,.15]]){
      for(let i=0;i<15;i++){
        const a=i*6.283/15+Math.sin(i*2.1)*.08,ex=T.MathUtils.clamp(cx+Math.cos(a)*r,-1.13,1.13),ey=T.MathUtils.clamp(cy+Math.sin(a)*r,5.42,6.41);
        crackPositions.push(cx,cy,3.195,ex,ey,3.195-(ey-5.91)*.105);
        if(i%3===0)crackPositions.push(cx+(ex-cx)*.6,cy+(ey-cy)*.6,3.2,ex-.12,ey+.05,3.2-(ey-5.91)*.105);
      }
    }
    const cracks=new T.BufferGeometry();cracks.setAttribute('position',new T.Float32BufferAttribute(crackPositions,3));group.add(new T.LineSegments(cracks,new T.LineBasicMaterial({color:0x9bbab1,transparent:true,opacity:.52})));
    for(const side of [-1,1]){
      // The mirror on the buried side has broken off under the truck's weight.
      if(side>0){
        bar(steel,[side*1.26,6.18,2.97],[side*1.63,6.18,2.86],.025);
        bar(steel,[side*1.63,6.18,2.86],[side*1.63,5.62,2.86],.025);
        box(steel,[side*1.66,5.95,2.86],[.25,.54,.1]);
      }
      box(lamp,[side*.95,4.12,3.34],[.43,.26,.055]);
    }
    box(blue,[0,4.8,3.32],[2.55,.42,.12]);
    box(steel,[0,4.41,3.34],[2.18,.31,.065]);
    for(let y=4.29;y<4.58;y+=.075)box(inside,[0,y,3.38],[2.06,.025,.035]);
    box(paint,[0,3.94,3.4],[2.7,.30,.25]);box(inside,[0,3.94,3.535],[.94,.13,.01]);
    const badge=new T.TorusGeometry(.18,.018,6,28);part(badge,lamp,[0,4.5,3.43]);badge.dispose();
    for(let i=0;i<3;i++){const a=i*6.283/3;bar(lamp,[0,4.5,3.44],[Math.sin(a)*.17,4.5+Math.cos(a)*.17,3.44],.014);}
    // Raised, open tipper bed: front rises above cab, rear hinge stays fixed.
    const tip=new T.Object3D();tip.position.set(0,4.34,-3.23);tip.rotation.x=-.48;tip.updateMatrix();
    box(blue,[0,0,2.05],[2.6,.13,4.1],[0,0,0],tip.matrix);
    for(const x of [-1.25,1.25]){
      box(paint,[x,.53,2.05],[.13,1.06,4.1],[0,0,0],tip.matrix);
      for(let z=.25;z<4.1;z+=.72)box(steel,[x*1.05,.52,z],[.055,1.13,.07],[0,0,0],tip.matrix);
      box(blue,[x,1.08,2.05],[.18,.08,4.15],[0,0,0],tip.matrix);
    }
    box(paint,[0,.55,4.08],[2.5,1.1,.12],[0,0,0],tip.matrix);
    box(paint,[0,.5,0],[2.5,1,.10],[-.12,0,0],tip.matrix);
    bar(steel,[0,4.15,-.6],[0,5.83,.15],.095);bar(lamp,[0,4.7,-.34],[0,5.83,.15],.06);
    // Faded lettering is generated locally; no photograph is a model texture.
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;
    const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#e1e1c9';ctx.font='bold 84px Arial';ctx.textAlign='center';ctx.fillText('KREIDESEE',256,79,490);
    const labelTexture=new T.CanvasTexture(labelCanvas);labelTexture.colorSpace=T.SRGBColorSpace;
    const labelMaterial=new T.MeshStandardMaterial({map:labelTexture,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const label=new T.Mesh(new T.PlaneGeometry(2.15,.40),labelMaterial);label.name='KREIDESEE cab lettering';label.position.set(0,4.92,3.391);group.add(label);
    for(const [mat,parts]of batches){const positions=[],normals=[];for(const g of parts){positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.computeBoundingSphere();group.add(new T.Mesh(g,mat));}
    boxGeo.dispose();tubeGeo.dispose();
    // Centre the old construction coordinates before tilting, then settle the
    // low side slightly into the sediment rather than balancing on a mirror.
    for(const child of group.children)child.position.y-=4.8;
    group.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(group,true),previous=new T.Vector3();
    const sandY=-24+.18*Math.sin(group.position.x*.23)*Math.sin(group.position.z*.17)+.09*Math.sin(group.position.x*.49+group.position.z*.28);
    group.position.y=sandY-bounds.min.y-.35;
    group.updateMatrixWorld(true);bounds.setFromObject(group,true);
    return {group,setVisible(v){group.visible=!!v;},constrain(position,radius,offset,velocity){
      if(!group.visible)return;
      if(position.x<bounds.min.x-radius||position.x>bounds.max.x+radius||position.z<bounds.min.z-radius||position.z>bounds.max.z+radius||position.y<bounds.min.y-radius||position.y>bounds.max.y+radius)return;
      previous.copy(position);
      const exits=[position.x-bounds.min.x+radius,bounds.max.x+radius-position.x,bounds.max.y+radius-position.y,position.z-bounds.min.z+radius,bounds.max.z+radius-position.z];let k=0;for(let i=1;i<5;i++)if(exits[i]<exits[k])k=i;
      if(k===0)position.x=bounds.min.x-radius;else if(k===1)position.x=bounds.max.x+radius;else if(k===2)position.y=bounds.max.y+radius;else if(k===3)position.z=bounds.min.z-radius;else position.z=bounds.max.z+radius;
      previous.subVectors(position,previous);offset.add(previous);previous.normalize();const v=velocity.dot(previous);if(v<0)velocity.addScaledVector(previous,-v);
    }};
  };
})();
