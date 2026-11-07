/* SPDX-License-Identifier: GPL-3.0-only */
(() => {
 window.createSeaTurtles=function(T,scene,water,environment){
  const group=new T.Group();group.name='Green sea turtles';scene.add(group);
  // Planar carapace atlas: central, lateral and marginal scutes, not a tiled grid.
  let seed=2917;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  function atlas(shell){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=shell?1024:512;
   const c=canvas.getContext('2d'),n=canvas.width;c.fillStyle=shell?'#766849':'#8d9171';c.fillRect(0,0,n,n);
   function scute(points,index){
    const cx=points.reduce((v,p)=>v+p[0],0)/points.length,cy=points.reduce((v,p)=>v+p[1],0)/points.length;
    c.save();c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0]*n,p[1]*n):c.moveTo(p[0]*n,p[1]*n));c.closePath();
    const gradient=c.createRadialGradient(cx*n,cy*n,0,cx*n,cy*n,n*.22);
    gradient.addColorStop(0,shell?'#9a8856':'#6b7553');gradient.addColorStop(1,shell?'#394533':'#374b3c');c.fillStyle=gradient;c.fill();c.clip();
    // Mottled keratin patches plus faint growth streaks; no uniform starburst.
    if(shell)for(let k=0;k<65;k++){
     c.fillStyle=random()<.5?'rgba(37,47,27,.13)':'rgba(197,166,91,.12)';
     c.beginPath();c.ellipse((cx+(random()-.5)*.34)*n,(cy+(random()-.5)*.34)*n,n*(.008+random()*.026),n*(.004+random()*.012),random()*Math.PI,0,Math.PI*2);c.fill();
    }
    for(let k=0;k<(shell?24:3);k++){
     const angle=random()*Math.PI*2,r=n*(shell?.23:.055),jitter=random()*(shell?.08:.02)*n;
     c.strokeStyle=random()<.5?'rgba(28,37,24,.13)':'rgba(204,185,117,.08)';c.lineWidth=.7+random()*(shell?4:1.3);
     c.beginPath();c.moveTo(cx*n+Math.cos(angle)*jitter,cy*n+Math.sin(angle)*jitter);
     c.quadraticCurveTo(cx*n+Math.cos(angle+.2)*r*.5,cy*n+Math.sin(angle+.2)*r*.5,cx*n+Math.cos(angle)*r,cy*n+Math.sin(angle)*r);c.stroke();
    }
    c.restore();c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0]*n,p[1]*n):c.moveTo(p[0]*n,p[1]*n));c.closePath();c.strokeStyle=shell?'#a29870':'#a9b38a';c.lineWidth=shell?2.5:1.5;c.stroke();
   }
   if(shell){
    for(let i=0;i<5;i++){
     const x=.08+i*.168,w=.18,half=.10+.025*Math.sin(i*.8);
     scute([[x,.5],[x+w*.26,.5-half],[x+w*.75,.5-half*.9],[x+w,.5],[x+w*.74,.5+half],[x+w*.25,.5+half]],i);
    }
    for(const side of [-1,1])for(let i=0;i<4;i++){
     const x=.12+i*.19,y=.5+side*.105,edge=.5+side*(.37-.09*Math.abs(i-1.5));
     scute([[x,y],[x+.17,y],[x+.235,edge],[x+.04,edge+side*.055],[x-.035,(y+edge)/2]],i);
    }
    for(let i=0;i<28;i++){
     const a=i/28*Math.PI*2,b=(i+1)/28*Math.PI*2;
     scute([[.5+.41*Math.cos(a),.5+.34*Math.sin(a)],[.5+.49*Math.cos(a),.5+.46*Math.sin(a)],[.5+.49*Math.cos(b),.5+.46*Math.sin(b)],[.5+.41*Math.cos(b),.5+.34*Math.sin(b)]],i);
    }
   }else for(let row=-1;row<12;row++)for(let col=-1;col<12;col++){
    const x=(col+(row%2)*.5)/10,y=row/10,points=[];
    for(let k=0;k<6;k++){const a=k*Math.PI/3,r=.051+random()*.012;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}scute(points,row*12+col);
   }
   for(let i=0;i<14000;i++){c.fillStyle=random()<.5?'rgba(25,30,20,.055)':'rgba(220,203,149,.065)';c.fillRect(random()*n,random()*n,1+random()*2,1+random()*2);}
   const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
  }
  const texture=atlas(true),skinTexture=atlas(false);
  const shellMat=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.012,roughness:.66}),skin=new T.MeshStandardMaterial({map:skinTexture,bumpMap:skinTexture,bumpScale:.005,roughness:.8}),belly=new T.MeshStandardMaterial({color:0xb8b18a,roughness:.8}),black=new T.MeshStandardMaterial({color:0x101510,roughness:.25});
  // Domed carapace with a distinct bevel and shallow scalloped marginal rim.
  const sp=[],su=[],si=[],shellSegments=72;
  function shellSection(profile){
   const start=sp.length/3;
   for(const [r,y] of profile)for(let j=0;j<=shellSegments;j++){
    const angle=j/shellSegments*Math.PI*2;
    const scallop=1-.014*Math.pow(r,8)*(1-Math.cos(angle*24));
    const x=.77*r*Math.cos(angle)*scallop,z=.57*r*Math.sin(angle)*scallop;
    sp.push(x,y,z);su.push(.5+x/.77*.49,.5+z/.57*.49);
   }
   for(let r=0;r<profile.length-1;r++)for(let j=0;j<shellSegments;j++){
    const a=start+r*(shellSegments+1)+j,b=a+shellSegments+1;si.push(a,a+1,b,b,a+1,b+1);
   }
  }
  const dome=[];for(let i=0;i<=16;i++){const r=i/16;dome.push([r,.018+.27*Math.pow(Math.max(0,1-r*r),.72)]);}
  shellSection(dome);
  // Separate rim vertices retain the crisp change of surface normal.
  shellSection([[1,.018],[1.005,-.025],[.96,-.075],[.68,-.12],[0,-.14]]);
  const shellGeometry=new T.BufferGeometry();shellGeometry.setAttribute('position',new T.Float32BufferAttribute(sp,3));shellGeometry.setAttribute('uv',new T.Float32BufferAttribute(su,2));shellGeometry.setIndex(si);shellGeometry.computeVertexNormals();
  // Cambered, thick shoulder narrowing into a swept, flexible distal blade.
  const fp=[],fn=[],fu=[],fi=[],rows=24,cols=12;
  for(let r=0;r<=rows;r++){
   const t=r/rows,chord=(.10+.19*Math.sin(Math.PI*Math.pow(t,.7)))*(1-.72*t)+.006;
   for(let j=0;j<=cols;j++){const a=j/cols*Math.PI*2;fp.push(-.38*t+Math.cos(a)*chord,Math.sin(a)*(.075*Math.pow(1-t,.8)+.009),t*1.05);fu.push(j/cols,t);}
  }
  for(let r=0;r<rows;r++)for(let j=0;j<cols;j++){const a=r*(cols+1)+j,b=a+cols+1;fi.push(a,a+1,b,b,a+1,b+1);}
  // Closed tips and shoulders: never show the inside of a paper-thin blade.
  for(const row of [0,rows]){
   const center=fp.length/3,t=row/rows;fp.push(-.38*t,0,t*1.05);fu.push(.5,t);
   for(let j=0;j<cols;j++){const a=row*(cols+1)+j;if(row===0)fi.push(center,a+1,a);else fi.push(center,a,a+1);}
  }
  const flipperGeometry=new T.BufferGeometry();flipperGeometry.setAttribute('position',new T.Float32BufferAttribute(fp,3));flipperGeometry.setAttribute('uv',new T.Float32BufferAttribute(fu,2));flipperGeometry.setIndex(fi);flipperGeometry.computeVertexNormals();
  function flexibleSkin(uniforms){
   const mat=skin.clone();mat.onBeforeCompile=shader=>{
    shader.uniforms.turtlePhase=uniforms.phase;shader.uniforms.turtleEffort=uniforms.effort;
    shader.vertexShader='uniform float turtlePhase; uniform float turtleEffort;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float span=uv.y;
      float twist=(sin(turtlePhase-span*.7)-sin(turtlePhase))*.32*span*turtleEffort;
      float c=cos(twist),s=sin(twist);
      transformed.xy=mat2(c,-s,s,c)*transformed.xy;
      transformed.y+=sin(turtlePhase-.7*span)*.07*span*span*turtleEffort;`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float nt=(sin(turtlePhase-uv.y*.7)-sin(turtlePhase))*.32*uv.y*turtleEffort;
      objectNormal.xy=mat2(cos(nt),-sin(nt),sin(nt),cos(nt))*objectNormal.xy;`);
   };mat.customProgramCacheKey=()=> 'turtle-flex-v1';return mat;
  }
  const sphere=new T.SphereGeometry(1,24,16),animals=[];
  function oval(parent,p,s,material){const m=new T.Mesh(sphere,material);m.position.set(...p);m.scale.set(...s);parent.add(m);return m;}
  for(let i=0;i<2;i++){
   const root=new T.Group();root.position.set(-32+Math.random()*42,1+Math.random()*9,-8-Math.random()*40);group.add(root);
   const shell=new T.Mesh(shellGeometry,shellMat);root.add(shell);oval(root,[.02,-.14,0],[.7,.10,.52],belly);
   oval(root,[.65,-.02,0],[.30,.14,.17],skin);
   const head=new T.Group();head.position.set(.94,.01,0);root.add(head);oval(head,[0,0,0],[.25,.17,.19],skin);
   for(const side of [-1,1]){oval(head,[.10,.065,side*.155],[.048,.045,.025],belly);oval(head,[.11,.068,side*.175],[.027,.029,.016],black);}
   const jaw=oval(head,[.16,-.085,0],[.09,.025,.13],belly);
   const flippers=[],rearFlippers=[],finUniforms={phase:{value:0},effort:{value:1}},finMaterial=flexibleSkin(finUniforms);
   for(const side of [-1,1]){
    const pivot=new T.Group();pivot.position.set(.38,-.08,side*.4);root.add(pivot);
    const blade=new T.Mesh(flipperGeometry,finMaterial);blade.scale.z=side;pivot.add(blade);
    flippers.push({pivot,side});const rear=oval(root,[-.66,-.10,side*.43],[.29,.065,.18],skin);rear.rotation.y=-side*.4;rearFlippers.push({mesh:rear,side});
   }
   oval(root,[-.8,-.1,0],[.19,.045,.055],skin);
   const heading=Math.random()*Math.PI*2;root.rotation.y=heading;
   animals.push({root,head,jaw,mode:"cruise",modeTime:0,feedBlend:0,clearance:.9,patch:null,nextFeed:15+Math.random()*65,grazes:0,nextBreath:75+Math.random()*100,breaths:0,airTime:0,breathBlend:0,flippers,rearFlippers,finUniforms,steering:new T.Vector3(Math.cos(heading),0,-Math.sin(heading)),turnRate:0,bank:0,elapsed:0,speed:.36,heading,pitch:0,velocity:new T.Vector3(.4,0,0),phase:Math.random()*Math.PI*2,waypoint:Math.floor(Math.random()*6),last:null});
  }
  const route=[[-4,-5,-12],[5,-8,-18],[-7,-15,-17],[-23,-9,-32],[-24,14.2,-13],[-10,4,-8]];
  const wave={},nose=new T.Vector3();
  const desired=new T.Vector3(),avoid=new T.Vector3(),flow=new T.Vector3(),delta=new T.Vector3();let count=1;
  function update(time,threats=[]){
   for(let i=0;i<animals.length;i++){
    const a=animals[i],dt=a.last===null?0:Math.max(0,Math.min(.1,time-a.last));a.last=time;
    a.root.visible=i<count;if(!group.visible||!a.root.visible)continue;
    if(dt===0)continue;
    a.elapsed+=dt;const localTime=a.elapsed;
    const p=a.root.position; a.modeTime+=dt;
    const habitat=environment.hasHabitat&&environment.hasHabitat(),patches=environment.grazingPatches||[];
    if(!habitat&&(a.mode==='grazing'||a.mode==='approach grass')){a.mode='cruise';a.patch=null;a.nextFeed=localTime+25;}
    if(localTime>a.nextBreath&&!['ascend','breathe','dive'].includes(a.mode)){a.mode='ascend';a.modeTime=0;a.airTime=0;}
    if(a.mode==='cruise'&&habitat&&patches.length&&localTime>a.nextFeed){
     // Prefer nearby real vegetation, with individual choice and repeat visits.
     a.patch=patches.reduce((best,q)=>!best||p.distanceTo(q)+Math.random()*8<p.distanceTo(best)?q:best,null).clone();
     a.mode='approach grass';a.modeTime=0;
    }
    let disturbed=false;
    for(const t of threats)if(p.distanceTo(t.p)<(t.radius||1)+3)disturbed=true;
    if(a.mode==='grazing'&&(a.modeTime>a.feedDuration||disturbed)){
     a.mode='cruise';a.modeTime=0;a.nextFeed=localTime+75+Math.random()*90;a.waypoint=4;
    }
    if(a.mode==='approach grass'&&a.modeTime>200){a.mode='cruise';a.nextFeed=localTime+40;}
    let surface=15;
    if(window.sampleOceanWaves){window.sampleOceanWaves(p.x,p.z,time,wave);surface+=wave.y;}
    if(a.mode==='ascend'&&p.y>surface-.65){a.mode='breathe';a.modeTime=0;a.breathDuration=2+Math.random()*2;}
    if(a.mode==='breathe'&&a.airTime>a.breathDuration){a.mode='dive';a.modeTime=0;a.breaths++;a.nextBreath=localTime+120+Math.random()*120;}
    if(a.mode==='dive'&&p.y<surface-5){a.mode='cruise';a.waypoint=Math.floor(Math.random()*4);a.nextFeed=localTime+12+Math.random()*25;}
    const breathing=a.mode==='breathe',ascending=a.mode==='ascend',diving=a.mode==='dive';
    if(breathing||ascending||diving){
     desired.set(Math.cos(a.heading)*.4,diving?-.7:breathing?0:Math.max(.1,surface-.25-p.y),-Math.sin(a.heading)*.4);
    }else if(a.mode==='cruise'){
     desired.set(...route[a.waypoint%route.length]).sub(p);
     if(desired.length()<2){a.waypoint++;desired.set(...route[a.waypoint%route.length]).sub(p);}
    }else{
     desired.copy(a.patch);desired.y+=.58;
     // Cross the reef edge above it, then descend onto the meadow.
     if(p.x<23)desired.y=Math.max(2,desired.y);
     desired.sub(p);
     if(a.mode==='approach grass'&&desired.length()<.8&&Math.abs(p.y-a.patch.y-.58)<.25){a.mode='grazing';a.modeTime=0;a.feedDuration=18+Math.random()*24;a.grazes++;}
     if(a.mode==='grazing')desired.set(Math.cos(a.heading),0,-Math.sin(a.heading));
    }
    const feeding=a.mode==='grazing',nearGrass=(a.mode==='grazing'||a.mode==='approach grass')&&p.distanceTo(a.patch)<4;
    a.breathBlend+=((breathing?1:0)-a.breathBlend)*(1-Math.exp(-dt*2));
    a.feedBlend+=((feeding?1:0)-a.feedBlend)*(1-Math.exp(-dt*1.4));
    a.clearance+=T.MathUtils.clamp((nearGrass?.25:.9)-a.clearance,-dt*.4,dt*.12);
    desired.normalize();environment.steer(p,a.velocity,a.clearance+.3,avoid);desired.addScaledVector(avoid,2.5);
    for(const t of threats){delta.subVectors(p,t.p);const d=delta.length(),range=(t.radius||1)+2.2;if(d<range&&d>.001)desired.addScaledVector(delta,(range-d)/range/d*1.6);}
    desired.normalize();a.steering.lerp(desired,1-Math.exp(-dt*1.8)).normalize();desired.copy(a.steering);const wanted=Math.atan2(-desired.z,desired.x),error=Math.atan2(Math.sin(wanted-a.heading),Math.cos(wanted-a.heading));
    const targetTurn=feeding?0:T.MathUtils.clamp(error*.4,-.18,.18);
    a.turnRate+=T.MathUtils.clamp(targetTurn-a.turnRate,-.12*dt,.12*dt);
    const turn=a.turnRate;a.heading+=turn*dt;
    const wantedPitch=feeding?-.10:breathing?.12:T.MathUtils.clamp(Math.atan2(desired.y,Math.hypot(desired.x,desired.z)),-.75,.75);
    a.pitch+=T.MathUtils.clamp(wantedPitch-a.pitch,-.12*dt,.12*dt);
    const glide=Math.pow(Math.max(0,Math.sin(localTime*.11+i*2)),8);
    // Downstroke supplies thrust; return and glide let speed settle gradually.
    const power=Math.max(0,Math.sin(a.phase));
    const pace=feeding?.015:breathing?.07:nearGrass?.16:ascending?Math.min(.9,.25+Math.max(0,surface-p.y)*.22):.68+.22*power*(1-glide)-.12*glide;
    a.speed+=(pace-a.speed)*(1-Math.exp(-dt*1.2));const speed=a.speed;
    a.velocity.set(Math.cos(a.heading)*Math.cos(a.pitch),Math.sin(a.pitch),-Math.sin(a.heading)*Math.cos(a.pitch)).multiplyScalar(speed);
    p.addScaledVector(a.velocity,dt);environment.current(p,time,flow);p.addScaledVector(flow,dt*.25*(1-a.feedBlend));
    if(feeding)p.y+=(a.patch.y+.58-p.y)*(1-Math.exp(-dt*1.5));
    if(breathing)p.y+=T.MathUtils.clamp((surface-.22-p.y)*3,-1.2,1.2)*dt;
    if(p.y<10)environment.constrain(p,a.clearance,flow);
    // Slow approach rather than a fixed height clamp below the waterline.
    if(!breathing&&p.y>surface-.25)p.y+=(surface-.25-p.y)*(1-Math.exp(-dt*4));
    a.bank+=(-turn*.6-a.bank)*(1-Math.exp(-dt*1.5));
    a.root.rotation.set(a.bank,a.heading,a.pitch,'YXZ');a.phase+=dt*(2.05-.55*glide)*(1-.65*a.breathBlend);
    a.finUniforms.phase.value=a.phase;a.finUniforms.effort.value=(1-glide*.85)*(1-a.feedBlend*.92)*(1-a.breathBlend*.9);
    for(const f of a.flippers){
     const effort=(1-glide*.85)*(1-a.feedBlend*.92)*(1-a.breathBlend*.9);
     f.pivot.rotation.x=f.side*(.18-.68*Math.cos(a.phase))*effort;
     // During positive-sine power phase, tips move DOWN and BACK (-X).
     f.pivot.rotation.y=f.side*(-.12+.38*Math.cos(a.phase))*effort;
     f.pivot.rotation.z=.10*Math.sin(a.phase-.5)*effort;
    }
    for(const f of a.rearFlippers){f.mesh.rotation.y=-f.side*.4+turn*1.2;f.mesh.rotation.x=f.side*(a.pitch*.3+.04*Math.sin(a.phase));}
    const bite=Math.max(0,Math.sin(localTime*2.6+a.phase))**3;
    a.head.rotation.z=.035*Math.sin(localTime*.3+i)-a.feedBlend*(.35+.09*bite)+a.breathBlend*.40;
    a.head.position.y=.01-a.feedBlend*(.22+.06*bite)+a.breathBlend*.22;
    a.jaw.position.y=-.085-a.feedBlend*.025*bite;
    if(a.root.userData.applyInteraction)a.root.userData.applyInteraction(time);
    if(breathing){
     a.root.updateMatrixWorld(true);nose.set(.21,.09,0);a.head.localToWorld(nose);
     let noseSurface=15;if(window.sampleOceanWaves){window.sampleOceanWaves(nose.x,nose.z,time,wave);noseSurface+=wave.y;}
     if(nose.y>noseSurface)a.airTime+=dt;
    }
   }
  }
  return {group,animals,update,setDensity(d,q=1){count=d>.75&&q>.8?2:1;},setVisible(value){group.visible=!!value;}};
 };
})();
