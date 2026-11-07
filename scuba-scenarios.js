/* SPDX-License-Identifier: GPL-3.0-only
 * Replayable visual dive stories. Stop time is compressed 6:1, not dive planning.
 */
(() => {
  'use strict';
  window.createScubaScenarios=function(T,group,stations,durations,routeSample,waterUniforms,routeInclination=()=>0){
    const sum=n=>durations.slice(0,n).reduce((a,b)=>a+b,0);
    const stories=[{name:'Wreck',first:0,last:1},{name:'Truck',first:2,last:6},{name:'Reef',first:11,last:14}];
    for(const s of stories){
      s.begin=sum(s.first);s.end=sum(s.last);s.explore=(s.end-s.begin)*1.4;
      s.start=new T.Vector3(...stations[s.first].p);s.entry=s.start.clone();
      // Separate the entry column laterally from the freedivers in the main view.
      s.entry.x=s.name==='Reef'?8:-27;s.entry.z=-12;s.finish=new T.Vector3(...stations[s.last].p);
      s.descent=(13.5-s.start.y)/.30;s.ascent=(10-s.finish.y)/.15;
      s.duration=30+10+s.descent+s.explore+18+s.ascent+30+42+18+35+10;
    }
    const total=stories.reduce((n,s)=>n+s.duration,0),v=new T.Vector3(),endpoint=new T.Vector3();
    let selected='auto',epoch=0,lastTime=0;
    const state={phase:'',story:'',remaining:0,stopSeconds:0,local:0,elapsed:0,storyIndex:0};
    const boat=new T.Group();boat.name='Scuba pickup RIB';group.add(boat);
    const rubber=new T.MeshStandardMaterial({color:0x33464c,roughness:.62});
    const white=new T.MeshStandardMaterial({color:0xd4d9cd,roughness:.52});
    const orange=new T.MeshStandardMaterial({color:0xff6926,roughness:.5});
    const metal=new T.MeshStandardMaterial({color:0x93a0a2,metalness:.5,roughness:.35});
    function box(parent,p,scale,mat){const m=new T.Mesh(new T.BoxGeometry(1,1,1),mat);m.position.set(...p);m.scale.set(...scale);parent.add(m);return m;}
    box(boat,[0,.05,0],[5.7,.25,2.1],white);
    const hull=new T.Mesh(new T.SphereGeometry(1,24,12),white);hull.position.y=-.3;hull.scale.set(3.1,.6,1.1);boat.add(hull);
    for(const z of [-1.1,1.1]){const tube=new T.Mesh(new T.CapsuleGeometry(.35,4.9,5,12),rubber);tube.rotation.z=Math.PI/2;tube.position.set(0,.24,z);boat.add(tube);}
    const bow=new T.Mesh(new T.SphereGeometry(1,16,10),rubber);bow.position.set(2.7,.24,0);bow.scale.set(.65,.35,1.4);boat.add(bow);
    box(boat,[.5,.65,0],[.8,1,.7],white);box(boat,[-2.9,-.2,0],[.45,1.4,.45],rubber);
    for(const x of [-2.3,-1.7])box(boat,[x,-.4,1.35],[.055,1.4,.055],metal);
    for(const y of [-.85,-.45,-.05])box(boat,[-2,y,1.35],[.65,.055,.055],metal);
    // A seated skipper gives the boat a visible scale and purpose.
    box(boat,[-.2,.8,0],[.4,.7,.45],orange);
    const skipper=new T.Mesh(new T.SphereGeometry(.18,12,8),white);skipper.position.set(-.15,1.3,0);boat.add(skipper);
    // Static parts share material and local transform; retain UVs and normals.
    const boatBatches=new Map();
    for(const mesh of [...boat.children]){
      if(!mesh.isMesh)continue;
      mesh.updateMatrix();const transformed=mesh.geometry.clone().applyMatrix4(mesh.matrix);
      const flat=transformed.index?transformed.toNonIndexed():transformed;
      if(!boatBatches.has(mesh.material))boatBatches.set(mesh.material,{position:[],normal:[],uv:[]});
      const batch=boatBatches.get(mesh.material);
      for(const key of ['position','normal','uv'])batch[key].push(...flat.attributes[key].array);
      boat.remove(mesh);mesh.geometry.dispose();if(flat!==transformed)flat.dispose();transformed.dispose();
    }
    for(const [material,attributes] of boatBatches){
      const geometry=new T.BufferGeometry();
      for(const key of ['position','normal','uv'])geometry.setAttribute(key,new T.Float32BufferAttribute(attributes[key],key==='uv'?2:3));
      boat.add(new T.Mesh(geometry,material));
    }
    const boatWater=window.createBoatWater(T,group,boat,waterUniforms);
    const buoy=new T.Group();buoy.name='Delayed surface marker buoy';group.add(buoy);
    const bag=new T.Mesh(new T.CapsuleGeometry(.12,1.25,4,10),orange);bag.position.y=.72;buoy.add(bag);
    box(buoy,[0,1.1,0],[.25,.12,.25],white);
    const lineGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
    const line=new T.Line(lineGeometry,new T.LineBasicMaterial({color:0xd3c48e,transparent:true,opacity:.65}));line.frustumCulled=false;group.add(line);
    const spool=new T.Mesh(new T.CylinderGeometry(.07,.07,.06,12),orange);group.add(spool);
    const entryRotation=[new T.Quaternion(),new T.Quaternion()],entryEuler=new T.Euler(),entryTurn=new T.Quaternion(),entrySwim=new T.Quaternion();
    const entryTarget=new T.Vector3(),entryOrigin=new T.Vector3();
    const splashed=[false,false],contact=new T.Vector3(),contactWave={};
    const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
    function timeline(time){
      let t=Math.max(0,time-epoch),i=selected==='auto'?0:Number(selected);
      if(selected==='auto'){t%=total;while(t>=stories[i].duration)t-=stories[i++].duration;}else t%=stories[i].duration;
      const s=stories[i],stages=[['Boat arrival',30],['Water entry',10],['Descend',s.descent],['Explore',s.explore],['Deploy buoy',18],['Ascend to stop',s.ascent],['Safety stop',30],['Surface',42],['Board boat',18],['Boat departure',35],['Next team',10]];
      state.local=t;state.story=s.name;state.storyIndex=i;
      for(const [name,duration] of stages){if(t<duration){state.phase=name;state.elapsed=t;state.remaining=duration-t;state.fraction=t/duration;state.stopSeconds=name==='Safety stop'?Math.ceil((duration-t)*6):0;break;}t-=duration;}
      return s;
    }
    function sample(time,index,out,aim){
      const s=timeline(time),f=state.fraction,t=state.elapsed,phase=state.phase;
      const beat=(t+index*6)%14,delay=beat<4?-beat:-4+(beat-4)*.4;
      const easeInOut=smooth(Math.min(t,s.explore-t)/8);
      const routeTime=phase==='Explore'?s.begin+(t+delay*easeInOut)/1.4:['Boat arrival','Water entry','Descend'].includes(phase)?s.begin:s.end;
      let heading=routeSample(routeTime,index,out);
      let entryWeight=0,orientation=null,upright=0;
      if(['Boat arrival','Water entry'].includes(phase)){out.x+=s.entry.x-s.start.x;out.z+=s.entry.z-s.start.z;}
      if(phase==='Descend'){const approach=smooth((f-.7)/.3);out.x+=(s.entry.x-s.start.x)*(1-approach);out.z+=(s.entry.z-s.start.z)*(1-approach);}
      let pitch=0,effort=.55,visible=true;
      if(phase!=='Explore')aim.set(...stations[s.last].aim);
      if(phase==='Explore'){
        // Each diver advances and dwells independently within the buddy envelope.
        effort=beat<4?.04:.55+.35*Math.abs(Math.sin(t*.12+index*1.9));
        // Large depth transfers use a head-up posture in either direction.
        upright=smooth((Math.abs(routeInclination())-.30)/.40)*easeInOut;
        pitch=upright*Math.PI/2;effort*=1-.7*upright;
       }else if(phase==='Next team'||phase==='Boat departure'){visible=false;}
      else if(phase==='Boat arrival'||phase==='Water entry'){
        const rollTime=phase==='Boat arrival'?-1:t-1-index*3.8;
        const roll=smooth(rollTime/1.15),recover=smooth((rollTime-1.15)/3.1);
        entryWeight=1-recover;visible=true;effort=.12*recover;
        entryTarget.copy(out);entryTarget.y=13.5;
        entryOrigin.set(-.85+index*1.7,.83,1.1).applyMatrix4(boat.matrixWorld);
        // The torso pivots backwards over the tube; the cylinder is on +local Y.
        out.copy(entryOrigin);out.z+=1.45*roll;out.y-=1.55*roll;
        out.lerp(entryTarget,recover);
        const angle=Math.PI/2+roll*Math.PI/2;
        orientation=entryRotation[index].copy(boat.quaternion)
          .multiply(entryTurn.setFromEuler(entryEuler.set(0,Math.PI/2,angle,'YXZ')));
        if(recover>0)orientation.slerp(entrySwim.setFromEuler(entryEuler.set(0,heading,0,'YXZ')),recover);
        pitch=0;
      }else if(phase==='Descend'){out.y=T.MathUtils.lerp(13.5,out.y,smooth(f));upright=smooth(t/(4+index*.5))*smooth(state.remaining/6);pitch=upright*Math.PI/2;effort=.12;aim.copy(out).add(new T.Vector3(1,-3,0));}
      else {
        // Keep the ascent column away from the wreck, while retaining buddy offset.
        const bottomY=out.y;
        out.x+=.12*Math.sin(time*.15+index*2);out.z+=.12*Math.cos(time*.12+index);
        if(phase==='Deploy buoy'){effort=.07;aim.copy(out).add(new T.Vector3(1,.8,0));}
        if(phase==='Ascend to stop'){out.y=T.MathUtils.lerp(bottomY,10,f);upright=smooth(t/(5+index*.6));pitch=upright*Math.PI/2;effort=.06;}
        if(phase==='Safety stop'){out.y=10+.07*Math.sin(time*.6+index);upright=1-.12*smooth(t/5);pitch=upright*Math.PI/2;effort=.04;}
        if(phase==='Surface'){out.y=10+4.3*f;upright=.88+.12*smooth(t/4);pitch=upright*Math.PI/2;effort=.05;}
        if(phase==='Board boat'){const climb=T.MathUtils.clamp((t-4-index*5)/6,0,1);out.x=T.MathUtils.lerp(out.x,s.finish.x-2,smooth(t/4));out.z=T.MathUtils.lerp(out.z,s.finish.z+1.65,smooth(t/4));out.y=14.3+1.8*climb;upright=1;pitch=Math.PI/2;visible=t<10+index*5;effort=.12;}
        if(phase!=='Deploy buoy')aim.copy(out).add(new T.Vector3(3,1,index?2:-2));
      }
      // Reserve a wide cylinder for the moving freediving rope and athletes.
      // Applies to both buddies throughout the submerged circuit, not just entry.
      if(!['Boat arrival','Water entry','Board boat','Boat departure','Next team'].includes(phase)){
        const dx=out.x+13.5,dz=out.z+20,d=Math.hypot(dx,dz),clearance=4.5;
        if(d<clearance){const ux=d>.001?dx/d:0,uz=d>.001?dz/d:1;out.x=-13.5+ux*clearance;out.z=-20+uz*clearance;}
      }
      return {heading,pitch,effort,visible,entryWeight,orientation,upright};
    }
    function update(time,divers){
      lastTime=time;const s=timeline(time),f=state.fraction,phase=state.phase;
      const outbound=['Boat arrival','Water entry','Descend','Explore','Deploy buoy'].includes(phase);
      boat.position.copy(outbound?s.entry:s.finish);boat.position.y=15;
      boat.visible=['Boat arrival','Water entry','Surface','Board boat','Boat departure'].includes(phase)||(phase==='Descend'&&state.elapsed<35);
      if(phase==='Descend')boat.position.x+=100*smooth(state.elapsed/35);
      if(phase==='Boat arrival')boat.position.x-=100*(1-smooth(f));
      if(phase==='Surface')boat.position.x-=100*(1-smooth(f));
      if(phase==='Boat departure')boat.position.x+=100*smooth(f);
      boatWater.update(time);
      return state;
    }
    // Called after diver posing: only attachments and contact-dependent splash.
    function updateAttachments(time,divers){
      const phase=state.phase;
      if(phase!=='Water entry')splashed.fill(false);
      else for(let index=0;index<2;index++){
        const rollTime=state.elapsed-1-index*3.8;
        if(!splashed[index]&&rollTime>.3&&rollTime<2.3&&divers[index]?.root.visible){
          contact.set(-.04,.4,0);divers[index].root.localToWorld(contact);
          window.sampleOceanWaves(contact.x,contact.z,time,contactWave);
          if(contact.y<15+contactWave.y+.12){
            splashed[index]=true;boatWater.splash(contact.x,15+contactWave.y,contact.z);
          }
        }
      }
      const deployed=['Deploy buoy','Ascend to stop','Safety stop','Surface','Board boat'].includes(phase);
      buoy.visible=line.visible=spool.visible=deployed;
      if(deployed){
        sample(time,0,endpoint,v);endpoint.y-=.3;
        const deploy=phase==='Deploy buoy'?smooth((state.elapsed-6)/12):1;
        buoy.position.copy(endpoint);buoy.position.x+=1;buoy.position.y=T.MathUtils.lerp(endpoint.y+.3,14.6,deploy);
        buoy.scale.set(1,phase==='Deploy buoy'?.15+.85*smooth(state.elapsed/6):1,1);
        spool.position.copy(endpoint);
        if(divers[0].arms){divers[0].root.updateMatrixWorld(true);divers[0].arms[0].hand.getWorldPosition(spool.position);}
        const a=line.geometry.attributes.position;a.setXYZ(0,spool.position.x,spool.position.y,spool.position.z);a.setXYZ(1,buoy.position.x,buoy.position.y,buoy.position.z);a.needsUpdate=true;
      }
      return state;
    }
    function finishDive(time=lastTime){
      const s=timeline(time);
      if(['Descend','Explore'].includes(state.phase))epoch-=40+s.descent+s.explore-state.local;
    }
    function restart(value=selected,start=lastTime){selected=value;epoch=start;}
    return {update,updateAttachments,sample,state,stories,boat,boatWater,buoy,line,spool,restart,finishDive,total};
  };
})();
