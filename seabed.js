/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian Rauhe Harreby. See LICENSE for terms.
 * Procedural Gozo-inspired limestone shelf and upright passenger-ferry wreck.
 * Stylised scene dimensions, not a navigational reconstruction of Karwela.
 */
(() => {
  'use strict';
  window.createDiveSite = function (T, scene, water) {
    const group = new T.Group(); group.name = 'Gozo dive site'; scene.add(group);
    const FLOOR = -24;
    let seed = 8243;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    // Merge static parts by material: the railings and rocks do not cost a draw per part.
    const batches = new Map(), transform = new T.Object3D();
    function add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], parentMatrix) {
      transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...rotation);
      transform.updateMatrix();
      let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      g.applyMatrix4(transform.matrix); if (parentMatrix) g.applyMatrix4(parentMatrix);
      if(material.userData.rockTint){
        const v=Math.sin(position[0]*19.7+position[1]*5.1+position[2]*13.3)*43758.5,t=v-Math.floor(v);
        const palette=[[1.12,1.03,.84],[.72,.77,.73],[.96,.81,.62],[.88,.96,.85],[1.06,1.09,1.04]],tint=palette[Math.min(4,Math.floor(t*5))];
        const colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(...tint);
        g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      }
      if (!batches.has(material)) batches.set(material, []); batches.get(material).push(g);
    }
    function material(color, kind) {
      const mat = new T.MeshStandardMaterial({ color, roughness: .94, metalness: kind === 'steel' ? .22 : .02 });
      mat.onBeforeCompile = shader => {
        shader.uniforms.siteTime = water.time; shader.uniforms.siteDay = water.daylight;
        shader.vertexShader = 'varying vec3 siteWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nsiteWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader = `varying vec3 siteWorld; uniform float siteTime; uniform float siteDay;
          float siteHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
          float siteNoise(vec3 p){
            vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(mix(siteHash(i),siteHash(i+vec3(1,0,0)),f.x),mix(siteHash(i+vec3(0,1,0)),siteHash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(siteHash(i+vec3(0,0,1)),siteHash(i+vec3(1,0,1)),f.x),mix(siteHash(i+vec3(0,1,1)),siteHash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }
          float siteFbm(vec3 p){return siteNoise(p)*.57+siteNoise(p*2.07+3.1)*.28+siteNoise(p*4.13+7.7)*.15;}
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float siteBroad=siteFbm(siteWorld*.23);
          float siteMottle=siteFbm(siteWorld*1.8);
          float siteGrain=siteNoise(siteWorld*18.);
          float siteDetail=1.-smoothstep(.02,.09,length(fwidth(siteWorld)));
          float siteRelief=0.;
          ${kind === 'sand' ? `
            float silt=smoothstep(.44,.7,siteBroad);
            float gravel=smoothstep(.51,.68,siteFbm(siteWorld*.68+17.));
            float phase=siteWorld.x*6.7+siteWorld.z*.85+siteFbm(siteWorld*.33)*9.;
            float ripple=sin(phase)*.5+.5;
            float rippleStrength=.22*(1.-silt)*(1.-gravel*.65);
            vec3 sediment=mix(vec3(.70,.65,.49),vec3(.34,.39,.33),silt*.72);
            sediment=mix(sediment,vec3(.46,.49,.42),gravel*.6);
            diffuseColor.rgb=sediment*(.82+.26*siteMottle+rippleStrength*ripple);
            diffuseColor.rgb*=1.+(siteGrain-.5)*.33*siteDetail;
            siteRelief=ripple*.025*(1.-silt)+(siteGrain-.5)*.008*siteDetail;
          ` : ''}
          ${kind === 'rock' ? `
            float bedding=siteNoise(vec3(siteWorld.x*.12,siteWorld.y*.52+siteBroad*.65,siteWorld.z*.12));
            float seam=(1.-smoothstep(.018,.065,abs(bedding-.47)))*smoothstep(.25,.58,siteMottle);
            float joints=siteNoise(vec3(siteWorld.x*.2,siteWorld.y*.035,siteWorld.z*.8));
            float fissure=(1.-smoothstep(.012,.045,abs(joints-.51)))*smoothstep(.44,.66,siteMottle);
            float pits=smoothstep(.68,.83,siteNoise(siteWorld*7.))*siteDetail;
            vec3 chalk=mix(vec3(.36,.39,.32),vec3(.72,.68,.54),smoothstep(.18,.82,siteBroad*.55+siteMottle*.45));
            float mineral=siteFbm(siteWorld*.42+vec3(35.,7.,12.));
            chalk=mix(chalk,vec3(.57,.39,.22),smoothstep(.56,.76,mineral)*.55);
            #ifdef USE_COLOR
              chalk*=vColor;
            #endif
            diffuseColor.rgb=chalk*(1.-seam*.22-fissure*.34-pits*.12);
            float encrust=smoothstep(.58,.76,siteFbm(siteWorld*.65+21.));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.30,.20),encrust*.35);
            float basalSilt=(1.-smoothstep(-23.7,-21.,siteWorld.y))*(.45+.3*siteBroad);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.52,.52,.40),basalSilt);
            siteRelief=siteMottle*.025-seam*.006-fissure*.012-pits*.003;
          ` : ''}
          ${kind === 'steel' ? `
            float flakes=smoothstep(.42,.59,siteFbm(siteWorld*3.4));
            float streak=siteNoise(vec3(siteWorld.x*7.,siteWorld.y*.42,siteWorld.z*7.));
            float corrosion=smoothstep(.34,.65,siteMottle*.6+streak*.4);
            vec3 rust=mix(vec3(.16,.12,.075),vec3(.48,.25,.105),corrosion);
            diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.84,.91,.84),rust,flakes*.86+corrosion*.12);
            float algae=smoothstep(.52,.7,siteBroad);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.23,.12),algae*.7);
            diffuseColor.rgb*=.7+.38*siteNoise(siteWorld*18.);
            siteRelief=flakes*.018+siteGrain*.012*siteDetail;
          ` : ''}
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          vec3 siteDx=dFdx(-vViewPosition),siteDy=dFdy(-vViewPosition);
          vec3 siteR1=cross(siteDy,normal),siteR2=cross(normal,siteDx);
          float siteDet=dot(siteDx,siteR1);
          normal=normalize(abs(siteDet)*normal-sign(siteDet)*(dFdx(siteRelief)*siteR1+dFdy(siteRelief)*siteR2));
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float wave=sin(siteWorld.x*1.2+siteWorld.z*.7+siteTime*.38)+sin(siteWorld.z*1.7-siteTime*.29);
          float caustic=pow(max(0.,1.-abs(wave)*1.8),5.);
          outgoingLight*=mix(vec3(.16,.29,.42),vec3(.61,.83,.9),siteDay);
          outgoingLight+=diffuseColor.rgb*(.018+.075*caustic*siteDay);
          #include <opaque_fragment>
          ${kind === 'sand' ? 'gl_FragColor.a*=1.-smoothstep(70.,135.,length(vViewPosition));' : ''}`);
      };
      mat.customProgramCacheKey = () => 'dive-site-weathered-v3-' + kind;
      return mat;
    }
    const sand = material(0x9eaa99, 'sand'), limestone = material(0x718980, 'rock');
    const blockStone=material(0x718980,'rock');blockStone.vertexColors=true;blockStone.userData.rockTint=true;
    const cliffBlocks=[];
    sand.transparent=true; sand.depthWrite=false;
    const steel = material(0x697a70, 'steel'), edge = material(0x8b9180, 'steel');
    const dark = material(0x263e40, 'steel');
    const rust = material(0x805538, 'steel');
    const box = new T.BoxGeometry(1, 1, 1), cylinder = new T.CylinderGeometry(1, 1, 1, 8);
    const sandHeight=(x,z)=>FLOOR+.18*Math.sin(x*.23)*Math.sin(z*.17)+.09*Math.sin(x*.49+z*.28);
    const floor = new T.PlaneGeometry(230, 190, 96, 96); floor.rotateX(-Math.PI / 2);
    const fp = floor.attributes.position;
    for (let i=0;i<fp.count;i++) { const x=fp.getX(i),z=fp.getZ(i); fp.setY(i,sandHeight(x,z-32)-FLOOR); }
    floor.computeVertexNormals(); add(floor,sand,[0,FLOOR,-32]); floor.dispose();
    // Coherent, non-repeating erosion at several scales. Shared by rendering
    // and collision so animals follow the visible face rather than the old wall.
    function rockNoise(x,y){
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
      const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};
      return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
    }
    function fracturedNoise(x,y){
      const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
      const a=rockNoise(i,j),b=rockNoise(i+1,j),c=rockNoise(i,j+1),d=rockNoise(i+1,j+1);
      return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
    }
    const lipHeight=z=>-3.4+.8*(fracturedNoise(z*.24,8)-.5)+.8*(fracturedNoise(z*.92,6)-.5);
    const edgePosition=z=>21.6+2.4*(fracturedNoise(z*.19,3)-.5)+1.3*(fracturedNoise(z*.73,9)-.5);
    function wallPosition(f,z){
      const facets=(fracturedNoise(z*.28,f*6.3)-.5)*3.4+(fracturedNoise(z*.8,f*18)-.5)*.8;
      return edgePosition(z)-6.3*Math.pow(1-f,2.4)+facets*Math.sin(Math.PI*f);
    }
    const verts=[], indices=[], rows=56, cols=128,zStep=108.8/cols;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++) {
      const z=-75+i*zStep, f=j/rows;
      const lip=lipHeight(z),x=wallPosition(f,z);
      verts.push(x,FLOOR+(lip-FLOOR)*f,z);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const cliff=new T.BufferGeometry();cliff.setAttribute('position',new T.Float32BufferAttribute(verts,3));cliff.setIndex(indices);cliff.computeVertexNormals();
    limestone.side=T.DoubleSide;add(cliff,limestone,[0,0,0]);cliff.dispose();
    // Uneven weathered shelf with sediment pockets instead of a flat lid.
    const shelfVertices=[],shelfIndices=[],shelfCols=24;
    for(let i=0;i<=cols;i++)for(let j=0;j<=shelfCols;j++){
      const z=-75+i*zStep,u=j/shelfCols,x=T.MathUtils.lerp(edgePosition(z),65,u);
      const y=lipHeight(z)-u*.2+(fracturedNoise(x*.55,z*.48)-.5)*1.15*Math.min(1,u*10);
      shelfVertices.push(x,y,z);
    }
    for(let i=0;i<cols;i++)for(let j=0;j<shelfCols;j++){const a=i*(shelfCols+1)+j,b=a+shelfCols+1;shelfIndices.push(a,b,a+1,a+1,b,b+1);}
    function shelfHeight(x,z){
      const row=T.MathUtils.clamp((z+75)/zStep,0,cols-.00001),i=Math.floor(row),v=row-i;
      const edge=T.MathUtils.lerp(shelfVertices[i*(shelfCols+1)*3],shelfVertices[(i+1)*(shelfCols+1)*3],v);
      const col=T.MathUtils.clamp((x-edge)/(65-edge)*shelfCols,0,shelfCols-.00001),j=Math.floor(col),u=col-j;
      const a=(i*(shelfCols+1)+j)*3,b=a+(shelfCols+1)*3;
      return T.MathUtils.lerp(T.MathUtils.lerp(shelfVertices[a+1],shelfVertices[a+4],u),T.MathUtils.lerp(shelfVertices[b+1],shelfVertices[b+4],u),v);
    }
    const shelf=new T.BufferGeometry();shelf.setAttribute('position',new T.Float32BufferAttribute(shelfVertices,3));shelf.setIndex(shelfIndices);shelf.computeVertexNormals();add(shelf,limestone,[0,0,0]);shelf.dispose();
    // Broken, bevelled slabs give real silhouettes and dark recesses between
    // faces. Irregular sizes/tilts and missing blocks avoid a masonry grid.
    const outlineRock=new T.Shape();outlineRock.moveTo(-.5,-.34);outlineRock.lineTo(-.32,-.5);outlineRock.lineTo(.35,-.46);outlineRock.lineTo(.5,-.24);outlineRock.lineTo(.46,.36);outlineRock.lineTo(.24,.5);outlineRock.lineTo(-.4,.43);outlineRock.closePath();
    const slab=new T.ExtrudeGeometry(outlineRock,{depth:.75,bevelEnabled:true,bevelThickness:.12,bevelSize:.1,bevelSegments:1,steps:1});
    slab.translate(0,0,-.375);slab.rotateY(Math.PI/2);slab.computeBoundingBox();
    function placeSlab(x,y,z,sx,sy,sz){
      const rotation=[(random()-.5)*.28,(random()-.5)*.35,(random()-.5)*.24];
      const fragment=slab.clone(),p=fragment.attributes.position,seed= random()*100;
      for(let i=0;i<p.count;i++){
        const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
        p.setXYZ(i,px+.09*Math.sin(py*7+pz*5+seed),py+.065*Math.sin(pz*8+seed),pz+.055*Math.sin(py*9+seed*2));
      }
      fragment.computeVertexNormals();fragment.computeBoundingBox();
      add(fragment,blockStone,[x,y,z],[sx,sy,sz],rotation);
      const bounds=fragment.boundingBox.clone().applyMatrix4(transform.matrix);fragment.dispose();
      cliffBlocks.push({lo:bounds.min.toArray(),hi:bounds.max.toArray()});
    }
    for(let i=0;i<155;i++){
      const z=-73+random()*105,f=.12+random()*.8,y=FLOOR+(lipHeight(z)-FLOOR)*f;
      if(rockNoise(z*.34,f*8)<.25)continue;
      const sx=1+random()*1.2,sy=1.1+random()*2.8,sz=2.3+random()*4.8;
      let backing=wallPosition(f,z);
      for(const dy of [-sy*.4,sy*.4])for(const dz of [-sz*.4,sz*.4]){
        const zz=z+dz,ff=T.MathUtils.clamp((y+dy-FLOOR)/(lipHeight(zz)-FLOOR),0,1);
        backing=Math.max(backing,wallPosition(ff,zz));
      }
      placeSlab(backing+.12,y,z,sx,sy,sz);
    }
    for(let i=0;i<100;i++){
      const z=-74+random()*107,x=edgePosition(z)+.2+random()*1.8;
      placeSlab(x,shelfHeight(x,z)-.12,z,1+random()*1.4,.45+random()*1.05,.7+random()*2.1);
    }
    const reefBlocks=[];
    let reefSeed=4917;
    const reefRandom=()=>{reefSeed=(1664525*reefSeed+1013904223)>>>0;return reefSeed/4294967296;};
    function placeReefSlab(mat,x,y,z,sx,sy,sz,rx,ry,rz){
      const fragment=new T.IcosahedronGeometry(1,1),p=fragment.attributes.position,s=reefRandom()*97;
      for(let i=0;i<p.count;i++){
        const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),step=Math.sin(py*9+s)*.05;
        p.setXYZ(i,px*.57+.09*Math.sin(py*6+pz*5+s),py*.52+step+.05*Math.cos(px*7+s),pz*.57+.08*Math.sin(py*8+px*5+s*1.7));
      }
      fragment.computeVertexNormals();
      add(fragment,mat,[x,y,z],[sx,sy,sz],[rx,ry,rz]);fragment.dispose();
      const list=batches.get(mat),g=list[list.length-1];
      g.computeBoundingBox();
      reefBlocks.push({lo:g.boundingBox.min.toArray(),hi:g.boundingBox.max.toArray()});
    }
    [
      [blockStone,-25.8,-23.4,-17.4,3.4,2.2,3.8,.06,.55,-.05],
      [blockStone,-25.1,-22.5,-17.0,2.5,2.3,2.8,-.08,1.15,.07],
      [blockStone,-25.6,-21.9,-17.5,1.9,2.6,2.1,.1,-.4,.08],
      [blockStone,-21.5,-23.4,-16.4,3.1,2.1,3.3,-.05,-.65,.06],
      [limestone,-21.2,-22.6,-16.8,2.1,2.3,2.4,.09,.85,-.07],
      [blockStone,-23.8,-23.5,-19.0,3.1,2.0,2.3,.07,.25,-.06],
      [limestone,-24.3,-22.8,-18.7,2.0,2.1,1.8,-.08,-1.1,.05],
      [blockStone,-23.5,-23.6,-14.9,2.9,1.8,2.2,-.06,1.35,.05],
      [limestone,-27.5,-23.6,-16.8,2.1,1.9,2.3,.08,-.9,-.09],
      [blockStone,-19.9,-23.7,-17.2,1.8,1.7,2.1,-.07,.45,.08]
    ].forEach(c=>placeReefSlab(...c));
    for(let i=0;i<14;i++){
      const rock=new T.IcosahedronGeometry(1,1),p=rock.attributes.position,s=reefRandom()*63;
      for(let k=0;k<p.count;k++){
        const x=p.getX(k),y=p.getY(k),z=p.getZ(k),d=1+.14*Math.sin(x*7+z*5+y*4+s);
        p.setXYZ(k,x*d,(y<0?y*.65:y)*d,z*d);
      }
      rock.computeVertexNormals();
      const a=i*2.39996+reefRandom()*.35,dist=1.4+reefRandom()*3.3;
      const rx=-24+Math.cos(a)*dist*1.35,rz=-17+Math.sin(a)*dist*.95;
      const r=.32+reefRandom()*.52,ry=sandHeight(rx,rz)+r*.24,mat=i%2?blockStone:limestone;
      add(rock,mat,[rx,ry,rz],[r*1.18,r*.7,r*.94],[reefRandom()*.3,reefRandom()*6.28,reefRandom()*.3]);rock.dispose();
      const list=batches.get(mat),g=list[list.length-1];
      g.computeBoundingBox();
      reefBlocks.push({lo:g.boundingBox.min.toArray(),hi:g.boundingBox.max.toArray()});
    }
    slab.dispose();
    const apronVertices=[],apronIndices=[],apronCols=8;
    for(let i=0;i<=cols;i++)for(let j=0;j<=apronCols;j++){
      const z=-75+i*zStep,u=j/apronCols,x=wallPosition(0,z)-4.8*(1-u);
      const y=sandHeight(x,z)+.025+Math.sin(Math.PI*u)*(.22+.22*rockNoise(z*.4,4));
      apronVertices.push(x,y,z);
    }
    for(let i=0;i<cols;i++)for(let j=0;j<apronCols;j++){const a=i*(apronCols+1)+j,b=a+apronCols+1;apronIndices.push(a,b,a+1,a+1,b,b+1);}
    const apron=new T.BufferGeometry();apron.setAttribute('position',new T.Float32BufferAttribute(apronVertices,3));apron.setIndex(apronIndices);apron.computeVertexNormals();add(apron,sand,[0,0,0]);apron.dispose();
    for(let i=0;i<85;i++){
      const rock=new T.IcosahedronGeometry(1,1), p=rock.attributes.position;
      for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k),z=p.getZ(k),d=1+.12*Math.sin(x*8+z*5+y*4);p.setXYZ(k,x*d,y*d,z*d);}rock.computeVertexNormals();
      const nearCliff=i<60,z=-65+random()*75,x=nearCliff?wallPosition(0,z)-random()*4:-29+random()*47;
      const r=nearCliff?.35+Math.pow(random(),2)*1.7:.2+random()*.7;
      add(rock,limestone,[x,FLOOR+r*.38,z],[r,r*.65,r*.83],[random(),random()*6,random()]);rock.dispose();
    }
    // Vessel coordinates: X bow direction, Y height above keel, Z across beam.
    const vessel=new T.Object3D();vessel.position.set(-2,-23,-24);vessel.rotation.y=-.14;vessel.updateMatrix();
    const ship=(g,m,p,s,r)=>add(g,m,p,s,r,vessel.matrix);
    const stations=[[-14,1.2],[-12,2.2],[-8,2.5],[5,2.5],[10,1.85],[13,.7],[14,0]];
    const hp=[],hi=[];
    const hullWidth=x=>{let i=0;while(i<stations.length-2&&x>stations[i+1][0])i++;const [a,wa]=stations[i],[b,wb]=stations[i+1];return wa+(wb-wa)*(x-a)/(b-a);};
    // Dense side plating allows jagged, genuinely open corrosion breaches.
    for(const side of [-1,1]){
      const base=hp.length/3, nx=112,ny=24;
      for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
        const x=-14+i*28/nx,y=j*3.7/ny,w=hullWidth(x)*(.52+.48*Math.min(1,y/2.1));
        hp.push(x,y,side*w);
      }
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
        const x=-14+(i+.5)*28/nx,y=(j+.5)*3.7/ny;
        const tear1=((x+8)/1.35)**2+((y-2.2)/.86)**2;
        const tear2=((x-7)/1.1)**2+((y-1.6)/.8)**2;
        const tearBack=((x-2)/.9)**2+((y-2.5)/.7)**2;
        const ragged=1+.2*Math.sin(x*19+y*13);
        if(side>0?(Math.min(tear1,tear2)<ragged):(tearBack<ragged))continue;
        const a=base+i*(ny+1)+j,b=a+ny+1;
        hi.push(a,b,a+1,b,b+1,a+1);
      }
    }
    const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(hp,3));hull.setIndex(hi);hull.computeVertexNormals();steel.side=T.DoubleSide;ship(hull,steel,[0,0,0]);hull.dispose();
    const outline=new T.Shape();outline.moveTo(-14,-1.2);for(const [x,w]of stations.slice(1))outline.lineTo(x,-w);for(const [x,w]of [...stations].reverse())outline.lineTo(x,w);outline.closePath();
    const deckHole=new T.Path();
    for(let i=0;i<11;i++){const a=i/10*Math.PI*2,r=1+.16*Math.sin(i*4.3),x=-9.5+Math.cos(a)*r,z=Math.sin(a)*r*.7;i?deckHole.lineTo(x,z):deckHole.moveTo(x,z);}deckHole.closePath();outline.holes.push(deckHole);
    const deck=new T.ShapeGeometry(outline);deck.rotateX(-Math.PI/2);ship(deck,edge,[0,3.72,0]);deck.dispose();
    ship(box,dark,[-9.5,1.3,0],[3.2,.15,2.5]);
    // Passenger cabin: real empty window bays between structural mullions.
    ship(box,dark,[-1,3.78,0],[12,.15,4.3]);
    for(const z of [-2.05,2.05]) {
      ship(box,steel,[-1,4.25,z],[12,.8,.18]);
      ship(box,steel,[-1,6.12,z],[12,.25,.18]);
      for(let x=-7;x<=5;x+=1.5)ship(box,edge,[x,5.15,z],[.14,2.3,.18]);
    }
    for(let i=0;i<8;i++)for(const side of [-1,1]){
      if((i===1&&side===1)||(i===5&&side===-1))continue;
      ship(box,i===2?rust:steel,[-6.45+i*1.57,6.35+(i===2?-.1:0),side*1.16],[1.53,.13,2.3],[i===2?.12:0,0,i===2?-.09:0]);
    }
    ship(box,rust,[-4.95,5.75,1.2],[1.35,.08,2.2],[.46,0,-.42]);
    for(const x of [-7,5]){
      for(const z of [-1.5,0,1.5])ship(box,edge,[x,5.15,z],[.16,2.3,.15]);
      ship(box,steel,[x,4.25,0],[.16,.8,4.2]);
    }
    // Raised wheelhouse to aft, with open black window recesses and a sun canopy.
    ship(box,dark,[2.8,6.55,0],[3.8,.25,3.5]);
    for(const z of [-1.65,1.65]){
      ship(box,steel,[2.8,6.95,z],[3.8,.7,.14]);
      for(const x of [1,2.2,3.4,4.6])ship(box,edge,[x,7.65,z],[.12,1.8,.14]);
    }
    ship(box,edge,[2.8,8.5,0],[4.3,.18,3.85]);
    // Exposed companion stair on the camera-facing side; tread risers + twin rails.
    for(let i=0;i<12;i++)ship(box,edge,[-6.8+i*.32,3.9+i*.21,3.0],[.36,.1,1.35]);
    function beam(a,b,r=.035,m=edge){const va=new T.Vector3(...a),vb=new T.Vector3(...b),dir=vb.clone().sub(va);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize());const e=new T.Euler().setFromQuaternion(q);ship(cylinder,m,va.add(vb).multiplyScalar(.5).toArray(),[r,dir.length(),r],[e.x,e.y,e.z]);}
    for(const z of [2.36,3.64]){
      beam([-7,4.8,z],[-3.15,7.3,z],.045);
      for(let i=0;i<4;i++)beam([-6.8+i*1.15,4+i*.75,z],[-6.8+i*1.15,5+i*.75,z]);
    }
    // Deck perimeter rails follow the hull taper and leave weathered gaps.
    for(const sign of [-1,1])for(let s=0;s<stations.length-1;s++){
      const [a,wa]=stations[s],[b,wb]=stations[s+1];
      const broken=(sign===1&&s===1)||(sign===-1&&s===4);
      if(!broken){beam([a,4.65,wa*sign],[b,4.65,wb*sign]);beam([a,4.18,wa*sign],[b,4.18,wb*sign],.025);}
      else beam([a,4.55,wa*sign],[a+(b-a)*.55,3.9,wa*sign+sign*.45],.035,rust);
      for(let x=a;x<b;x+=1.4){const w=wa+(wb-wa)*(x-a)/(b-a);beam([x,3.7,w*sign],[x+(broken?.22:0),broken?4.12:4.68,w*sign+(broken?sign*.3:0)]);}
    }
    for(const x of [-6,-3,0,3])for(const z of [-2.42,2.42]){
      const ring=new T.TorusGeometry(.22,.055,6,14);ship(ring,edge,[x,2.7,z]);ring.dispose();
      const port=new T.CircleGeometry(.18,14);ship(port,dark,[x,2.7,z+(z>0?.012:-.012)],[1,1,1],z<0?[0,Math.PI,0]:[0,0,0]);port.dispose();
    }
    beam([2.5,8.5,0],[2.5,12.6,0],.07);beam([2.5,11.3,-1.1],[2.5,11.3,1.1],.035);
    beam([-10,3.7,0],[-10,8.2,0],.055);beam([-10,7.4,-1],[-10,7.4,1]);
    for(const x of [-11,10])for(const z of [-1,1]) {ship(cylinder,dark,[x,4,z],[.17,.45,.17]);ship(box,edge,[x,4.24,z],[.55,.12,.22]);}
    // Small attached encrustations break the clean silhouette without floating debris.
    const growth=new T.IcosahedronGeometry(1,0);
    for(let i=0;i<115;i++){const x=-12+random()*23,z=(random()>.5?1:-1)*(1.5+random()*.6);ship(growth,limestone,[x,3.78,z],[.08+random()*.16,.04+random()*.18,.1+random()*.15]);}
    growth.dispose();
    // Fallen sheets and fragments rest in the sediment along the exposed side.
    for(let i=0;i<12;i++){
      const x=-14+random()*25,z=-17.5+random()*3;
      add(box,rust,[x,sandHeight(x,z)+.10,z],[.35+random()*1.2,.055,.3+random()*.8],[random()*.12,random()*6,random()*.09]);
    }
    const pebble=new T.IcosahedronGeometry(1,0);
    for(let i=0;i<440;i++){
      const x=-38+random()*62,z=-65+random()*73;
      // Clusters, with open sand between them; no uniform confetti layer.
      if(Math.sin(x*.31+Math.cos(z*.28))*Math.cos(z*.21)<.18)continue;
      const r=.035+random()*.13;
      add(pebble,limestone,[x,sandHeight(x,z)+r*.3,z],[r,r*.5,r*.8],[0,random()*6,random()]);
    }
    pebble.dispose();
    for(const [mat,geometries] of batches){
      const positions=[],normals=[],colors=[];
      for(const g of geometries){for(const n of g.attributes.position.array)positions.push(n);for(const n of g.attributes.normal.array)normals.push(n);if(g.attributes.color)for(const n of g.attributes.color.array)colors.push(n);g.dispose();}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));if(colors.length)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingSphere();
      const mesh=new T.Mesh(g,mat);mesh.name='Dive site '+mat.uuid;group.add(mesh);
    }
    // Rooted ribbon leaves share one draw call. Only their free tips bend with
    // the current; the same scene clock freezes their motion when paused.
    const leafPositions=[],leafColors=[],leafWeights=[],leafIndices=[];
    const green=new T.Color(),leafRoot=new T.Vector3();
    function leaf(x,y,z,height,angle,shade,algae=false){
      const first=leafPositions.length/3,segments=7;
      const lean=.22+random()*.35,width=algae?.035+random()*.025:.04+random()*.03;
      const bend=angle+.7*(random()-.5);
      for(let j=0;j<=segments;j++){
        const t=j/segments,spread=width*Math.sin(Math.PI*(.12+.88*t));
        const cx=x+Math.cos(bend)*lean*height*t*t,cz=z+Math.sin(bend)*lean*height*t*t;
        for(const side of [-1,1]){
          leafPositions.push(cx+Math.cos(angle)*spread*side,y+height*t,cz+Math.sin(angle)*spread*side);
          green.setRGB(.18+shade*.13,.32+shade*.22,.075+shade*.08).multiplyScalar(.65+.35*t);
          leafColors.push(green.r,green.g,green.b);leafWeights.push(t*t);
        }
      }
      for(let j=0;j<segments;j++){const a=first+j*2;leafIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const grazingPatches=[];
    for(let patch=0;patch<95;patch++){
      const px=-33+random()*51,pz=-58+random()*46;
      if(px>-18&&px<14&&pz>-30&&pz<-17)continue;
      const radius=.5+random()*1.3,shade=random();
      for(let n=0;n<22;n++){
        const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r;
        const height=.55+random()*1.25,angle=random()*6.28;
        if(reefBlocks.some(b=>x>b.lo[0]-.12&&x<b.hi[0]+.12&&z>b.lo[2]-.12&&z<b.hi[2]+.12))continue;
        leaf(x,sandHeight(x,z)-.03,z,height,angle,shade);
      }
    }
    // Separate pockets on the submerged shelf, rooted on its actual triangles.
    // The shelf remains well below the surface; bare gaps keep the rock readable.
    for(let patch=0;patch<90;patch++){
      const pz=-47+random()*53,px=22.8+random()*9,shade=random();
      for(let n=0;n<18;n++){
        const x=px+(random()-.5)*1.8,z=pz+(random()-.5)*1.8;
        const edgeX=edgePosition(z);
        if(x<edgeX+.18)continue;
        const y=shelfHeight(x,z);
        if(cliffBlocks.some(b=>x>b.lo[0]&&x<b.hi[0]&&z>b.lo[2]&&z<b.hi[2]&&y<b.hi[1]))continue;
        leaf(x,y-.025,z,.35+random()*1.05,random()*6.28,shade);
        if(n===0&&x>edgeX+2.5)grazingPatches.push(new T.Vector3(x,y,z));
      }
    }
    for(let patch=0;patch<44;patch++){
      const x=-12+random()*23,z=(random()>.5?1:-1)*(1.55+random()*.48);
      leafRoot.set(x,3.73,z).applyMatrix4(vessel.matrix);
      for(let n=0;n<7;n++)leaf(leafRoot.x+(random()-.5)*.22,leafRoot.y,leafRoot.z+(random()-.5)*.18,.12+random()*.33,random()*6.28,.2+random()*.4,true);
    }
    // Shuffle complete leaves once so every density retains all habitats.
    const leafCount=leafIndices.length/42,order=Array.from({length:leafCount},(_,i)=>i);
    let detailSeed=719;
    for(let i=order.length-1;i>0;i--){detailSeed=(detailSeed*16807)%2147483647;
      const j=detailSeed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const originalIndices=leafIndices.slice();
    order.forEach((source,i)=>{for(let n=0;n<42;n++)leafIndices[i*42+n]=originalIndices[source*42+n];});
    const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.Float32BufferAttribute(leafPositions,3));leaves.setAttribute('color',new T.Float32BufferAttribute(leafColors,3));leaves.setAttribute('growthWeight',new T.Float32BufferAttribute(leafWeights,1));leaves.setIndex(leafIndices);leaves.computeVertexNormals();leaves.computeBoundingSphere();leaves.boundingSphere.radius+=.4;
    const plantMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82,metalness:0});
    plantMaterial.onBeforeCompile=shader=>{
      shader.uniforms.plantTime=water.time;shader.uniforms.plantDay=water.daylight;
      shader.vertexShader='uniform float plantTime; attribute float growthWeight;\n'+window.OceanCurrent.glsl+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float sway=sin(plantTime*.65+position.x*.44+position.z*.28);
        vec3 flow=marineCurrent(position,plantTime);
        transformed.x+=(flow.x*1.6+sway*.045)*growthWeight;
        transformed.z+=(flow.z*1.6+sin(plantTime*.51+position.z*.37)*.025)*growthWeight;
      `);
      shader.fragmentShader='uniform float plantDay;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight*=mix(vec3(.14,.25,.34),vec3(.65,.85,.86),plantDay);
        #include <opaque_fragment>`);
    };
    plantMaterial.customProgramCacheKey=()=> 'rooted-seagrass-v1';
    const plants=new T.Mesh(leaves,plantMaterial);plants.name='Rooted seagrass and wreck algae';group.add(plants);
    box.dispose();cylinder.dispose();
    // Conservative collision envelopes keep roaming or dragged animals out of solid scenery.
    const collisionPoint=new T.Vector3(), before=new T.Vector3();
    const inverseVessel=vessel.matrix.clone().invert();
    function pushBox(p,lo,hi,r) {
      if(p.x<=lo[0]-r||p.x>=hi[0]+r||p.y<=lo[1]-r||p.y>=hi[1]+r||p.z<=lo[2]-r||p.z>=hi[2]+r)return;
      const distances=[p.x-lo[0]+r,hi[0]+r-p.x,hi[1]+r-p.y,p.z-lo[2]+r,hi[2]+r-p.z];
      let best=0;for(let i=1;i<5;i++)if(distances[i]<distances[best])best=i;
      if(best===0)p.x=lo[0]-r;else if(best===1)p.x=hi[0]+r;else if(best===2)p.y=hi[1]+r;else if(best===3)p.z=lo[2]-r;else p.z=hi[2]+r;
    }
    function constrain(position,radius,offset,velocity) {
      if(!group.visible)return;
      before.copy(position);
      position.y=Math.max(position.y,FLOOR+.35+radius);
      // Match the submerged wall profile instead of an oversized box that
      // kept swimmers several metres away from the visible limestone.
      if(position.z>-78-radius&&position.z<34+radius){
        const z=position.z,lip=lipHeight(z);
        const f=T.MathUtils.clamp((position.y-FLOOR)/(lip-FLOOR),0,1);
        const wallX=wallPosition(f,z);
        if(position.y<lip+radius&&position.x>wallX-radius-.25){
          if(position.y>lip)position.y=lip+radius;
          else position.x=wallX-radius-.25;
        }
      }
      // Exposed slabs are attached to the cliff: push toward open water rather
      // than choosing a box face that could send an actor into the backing rock.
      for(const block of cliffBlocks){
        const lo=block.lo,hi=block.hi;
        if(position.x>lo[0]-radius&&position.x<hi[0]+radius&&position.y>lo[1]-radius&&position.y<hi[1]+radius&&position.z>lo[2]-radius&&position.z<hi[2]+radius)
          position.x=lo[0]-radius;
      }
      // Resolve overlapping layers as a union instead of re-entering an earlier slab.
      for(const block of reefBlocks)pushBox(position,block.lo,block.hi,radius);
      let trapped=false,roof=position.y;
      for(const b of reefBlocks)if(position.x>b.lo[0]-radius&&position.x<b.hi[0]+radius&&position.z>b.lo[2]-radius&&position.z<b.hi[2]+radius){
        if(position.y>b.lo[1]-radius&&position.y<b.hi[1]+radius)trapped=true;
        roof=Math.max(roof,b.hi[1]+radius);
      }
      if(trapped)position.y=roof;
      collisionPoint.copy(position).applyMatrix4(inverseVessel);
      pushBox(collisionPoint,[-14,0,-2.6],[14,4.1,2.6],radius);
      pushBox(collisionPoint,[-7.3,3.7,-2.5],[5.3,6.6,2.5],radius);
      pushBox(collisionPoint,[.6,6.5,-2],[5,8.7,2],radius);
      pushBox(collisionPoint,[2.35,8.5,-.2],[2.65,12.7,.2],radius);
      position.copy(collisionPoint.applyMatrix4(vessel.matrix));
      before.subVectors(position,before);
      if(before.lengthSq()>1e-10){offset.add(before);before.normalize();const inward=velocity.dot(before);if(inward<0)velocity.addScaledVector(before,-inward);}
    }
    return {group,grazingPatches,terrain:{wallPosition,lipHeight,shelfHeight,cliffBlocks,reefBlocks},setDetail(amount){leaves.setDrawRange(0,Math.max(1,Math.round(leafCount*amount))*42);},floorY:FLOOR,wreckMatrix:vessel.matrix.clone(),constrain,setVisible(value){group.visible=!!value;}};
  };
})();

