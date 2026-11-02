/* SPDX-License-Identifier: GPL-3.0-only
 * Hull footprint buoyancy and a bounded world-space aerated wake.
 */
(() => {
  'use strict';
  window.createBoatWater=function(T,parent,boat,water={}){
    const sample=window.sampleOceanWaves,w={};
    const N=2400,positions=new Float32Array(N*3),data=new Float32Array(N*3);
    const particles=Array.from({length:N},()=>({age:99,life:0,x:0,y:0,z:0,vx:0,vz:0,foam:false,size:0}));
    positions.fill(-1000);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(positions,3));
    geometry.setAttribute('wakeData',new T.BufferAttribute(data,3));
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{daylight:water.daylight||{value:1},pixelRatio:{value:1}},
      vertexShader:`attribute vec3 wakeData; varying vec3 vData; uniform float pixelRatio;
        void main(){vData=wakeData;vec4 p=modelViewMatrix*vec4(position,1.);
          gl_PointSize=clamp(wakeData.y*650.*pixelRatio/max(2.,-p.z),1.,52.);
          gl_Position=projectionMatrix*p;}`,
      fragmentShader:`varying vec3 vData;uniform float daylight;
        void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);
          if(r>1.||vData.x<=0.)discard;
          float rim=exp(-pow((r-.72)*9.,2.));
          float foam=exp(-r*r*3.)*(1.-smoothstep(.7,1.,r));
          float a=mix(.12*(1.-r)+.75*rim,foam,vData.z)*vData.x;
          vec3 c=mix(vec3(.15,.28,.34),vec3(.76,.91,.94),clamp(daylight,0.,1.));
          gl_FragColor=vec4(c,a);}`});
    const wake=new T.Points(geometry,material);wake.name='World-space prop wash and spreading wake';wake.frustumCulled=false;parent.add(wake);
    // The outboard shaft ends below the waterline; blades turn about the x axis.
    const prop=new T.Group();prop.position.set(-3.15,-.8,0);boat.add(prop);
    const metal=new T.MeshStandardMaterial({color:0x7b8b90,metalness:.65,roughness:.3});
    const hub=new T.Mesh(new T.SphereGeometry(.13,10,6),metal);hub.scale.x=1.8;prop.add(hub);
    for(let i=0;i<3;i++){
      const arm=new T.Group();arm.rotation.x=i*Math.PI*2/3;
      const blade=new T.Mesh(new T.SphereGeometry(1,8,5),metal);blade.position.y=.18;
      blade.scale.set(.055,.22,.095);blade.rotation.y=.45;arm.add(blade);prop.add(arm);
    }
    let lastTime=null,lastX=0,lastZ=0,wasVisible=false,carry=0,cursor=0,detail=.7;
    const stern=new T.Vector3(),bow=new T.Vector3();
    const stats={speed:0,active:0,emitted:0,height:0,pitch:0,roll:0};
    function emit(origin,foam,side,speed){
      const p=particles[cursor];cursor=(cursor+1)%N;
      if(p.age<p.life)return; // Keep existing bubbles alive when the pool is full.
      p.splash=false;p.vy=0;p.age=0;p.life=foam?9+Math.random()*8:2.5+Math.random()*3.5;
      p.foam=foam;p.x=origin.x+(Math.random()-.5)*.45;
      p.y=origin.y+(Math.random()-.5)*.18;p.z=origin.z+(Math.random()-.5)*.35;
      p.vx=foam?-.12:-.7-speed*.25;p.vz=side*(.25+speed*.07)+(Math.random()-.5)*.2;
      p.size=foam?.12+Math.random()*.18:.025+Math.random()*.065;stats.emitted++;
    }
    function update(time){
      const raw=lastTime===null?0:time-lastTime;
      const discontinuity=raw<0||raw>.5||Math.hypot(boat.position.x-lastX,boat.position.z-lastZ)>8;
      const dt=discontinuity?0:Math.max(0,raw);
      const speed=dt>0&&boat.visible&&wasVisible?Math.min(8,Math.hypot(boat.position.x-lastX,boat.position.z-lastZ)/dt):0;
      lastX=boat.position.x;lastZ=boat.position.z;lastTime=time;wasVisible=boat.visible;
      if(discontinuity){particles.forEach(p=>p.age=p.life);carry=0;}
      // Fit a water plane to six buoyant supports, rather than a single point.
      let h=0,front=0,rear=0,left=0,right=0;
      for(const x of [-2.2,0,2.2])for(const z of [-.85,.85]){
        sample(boat.position.x+x,boat.position.z+z,time,w);h+=w.y/6;
        if(x===2.2)front+=w.y/2;if(x===-2.2)rear+=w.y/2;
        if(z<0)left+=w.y/3;else right+=w.y/3;
      }
      boat.position.y=15+h+.05;
      boat.rotation.set(-Math.atan2(right-left,1.7),0,Math.atan2(front-rear,4.4),'ZXY');
      stats.height=boat.position.y;stats.pitch=boat.rotation.z;stats.roll=boat.rotation.x;stats.speed=speed;
      boat.updateMatrixWorld(true);
      prop.getWorldPosition(stern);bow.set(1.8,-.12,0).applyMatrix4(boat.matrixWorld);
      if(dt>0&&boat.visible&&speed>.08){
        prop.rotation.x+=dt*(12+speed*9);
        carry+=dt*(28+speed*45)*detail;
        while(carry>=1){carry--;emit(stern,false,Math.random()-.5,speed);
          if(Math.random()<.5)for(const side of [-1,1]){
            bow.z=boat.position.z+side*1.15;emit(bow,true,side,speed);
          }
        }
      }
      let active=0;
      particles.forEach((p,i)=>{
        const k=i*3;p.age+=dt;
        if(p.age>=p.life){data[k]=0;return;}
        active++;p.x+=p.vx*dt;p.z+=p.vz*dt;
        const drag=Math.exp(-dt*(p.foam?.04:.6));p.vx*=drag;
        sample(p.x,p.z,time,w);const surface=15+w.y;
        if(p.splash){
          p.vy-=9.81*dt;p.y+=p.vy*dt;
          if(p.y<=surface&&p.vy<0){p.splash=false;p.foam=true;p.y=surface-.045;}
        }
        else if(p.foam)p.y=surface-.045;
        else {p.y+=dt*(.25+p.size*3);if(p.y>=surface-.05){p.foam=true;p.y=surface-.045;p.size*=1.6;}}
        positions[k]=p.x;positions[k+1]=p.y;positions[k+2]=p.z;
        data[k]=Math.min(1,p.age/.12)*Math.pow(1-p.age/p.life,1.2)*(p.foam?.65:.85);
        data[k+1]=p.size*(1+p.age*.035);data[k+2]=p.foam?1:0;
      });
      stats.active=active;wake.visible=active>0;
      material.uniforms.pixelRatio.value=Math.min(devicePixelRatio||1,1.5);
      geometry.attributes.position.needsUpdate=geometry.attributes.wakeData.needsUpdate=true;
    }
    function splash(x,y,z){
      for(let i=0;i<Math.round(180*detail);i++){
        const index=cursor,angle=Math.random()*Math.PI*2,r=Math.random()*.5;
        emit({x:x+Math.cos(angle)*r,y:y-.08,z:z+Math.sin(angle)*r},false,0,0);
        const p=particles[index];if(p.age!==0)continue;
        const outward=.5+Math.random()*1.3;p.vx=Math.cos(angle)*outward;p.vz=Math.sin(angle)*outward;
        if(i%3!==0){p.splash=true;p.vy=1.6+Math.random()*2.4;p.size=.025+Math.random()*.05;p.life=3+Math.random()*2;}
        else {p.y-=Math.random()*.6;p.life=2+Math.random()*2;}
      }
    }
    return {update,splash,stats,wake,prop,setDetail(value){detail=Math.max(.15,value);}};
  };
})();

