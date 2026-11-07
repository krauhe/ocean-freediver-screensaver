/* SPDX-License-Identifier: GPL-3.0-only
 * Bounded interaction forces. Safety timings are animation rules, not physiology.
 */
(() => {
  'use strict';
  window.createAnimalInteraction = function(T, camera, environment) {
    const entities = [], target = new T.Vector3(), desired = new T.Vector3();
    const force = new T.Vector3(), normal = new T.Vector3(), avoid = new T.Vector3();
    const up = new T.Vector3(0,1,0), rotation = new T.Quaternion();
    let held = null;
    function visible(root) { for(let p=root;p;p=p.parent)if(!p.visible)return false;return true; }
    function register(options) {
      const e = Object.assign({radius:.7,maxSpeed:2.2,cruiseSpeed:1.2,maxHold:20,
        kinematic:false,protected:false,active:false,age:0,airAge:0,recovery:0,last:null},options);
      e.position = new T.Vector3(); e.velocity = new T.Vector3();
      e.contact = new T.Vector3(); e.orientation = new T.Quaternion();
      e.read = e.read || (out=>out.copy(e.root.position));
      e.write = e.write || ((p,v)=>{e.root.position.copy(p);if(e.nativeVelocity)e.nativeVelocity.copy(v);});
      e.root.userData.applyInteraction = time=>step(e,time);
      entities.push(e);return e;
    }
    function allowed(e) {
      return visible(e.root) && !e.protected && (!e.canGrab || e.canGrab());
    }
    function grab(e,point) {
      if(held||!allowed(e))return false;
      e.read(e.position);e.contact.copy(point).sub(e.position);
      if(e.nativeVelocity)e.velocity.copy(e.nativeVelocity);
      else if(!e.active)e.velocity.set(0,0,0);
      e.velocity.clampLength(0,e.maxSpeed);
      e.orientation.copy(e.root.quaternion);e.age=0;e.safetyHandled=false;e.active=true;held=e;
      target.copy(point);if(e.onGrab)e.onGrab();return true;
    }
    function release(safety=false) {
      if(!held)return;
      const e=held;held=null;
      if(e.onRelease)e.onRelease(safety);
      if(safety){e.protected=true;if(e.onSafety)e.onSafety();}
    }
    function step(e,time) {
      const dt=e.last===null?0:Math.max(0,Math.min(.1,time-e.last));e.last=time;
      if(e.protected&&e.canRecover&&e.canRecover())e.protected=false;
      if(!e.active)return;
      if(!visible(e.root)){if(held===e)release();if(!e.protected)e.active=false;return;}
      if(dt===0){e.write(e.position,e.velocity);return;}
      e.age+=dt;
      if(e.breathes&&e.position.y<14.1)e.airAge+=dt;
      if(held===e && (e.age>=e.maxHold || (e.canGrab&&!e.canGrab()))) release(!!e.breathes);
      if(e.breathes && e.safetyNeeded && e.safetyNeeded(e)){
        if(held===e)release(true);e.protected=true;if(e.onSafety)e.onSafety();
      }
      e.read(desired);
      if(e.escort&&(e.escort===held||e.escort.protected)){desired.copy(e.escort.position);desired.x+=2.2;desired.z+=1.2;}
      // After an interrupted rope dive, rejoin at the surface on a later cycle.
      // Never chase a deep route sample immediately after the recovery breath.
      const waitForSurface=e.forceSurface&&e.safetyHandled&&desired.y<12;
      if(waitForSurface)desired.y=14.5;
      const routeDistance=desired.distanceTo(e.position);
      if(e.protected && e.forceSurface){
        desired.copy(e.position);desired.y=14.65;
        if(e.position.y>14.1){e.recovery+=dt;if(e.recovery>18){e.protected=false;e.recovery=0;e.airAge=0;e.safetyHandled=true;}}
      }
      if(e.kind==='crab' && held!==e){desired.copy(e.position);desired.y=e.ground(desired.x,desired.z)+.36;}
      if(e.kinematic || e.protected&&e.forceSurface || e.kind==='crab')desired.sub(e.position).multiplyScalar(.9).clampLength(0,e.cruiseSpeed);
      else desired.sub(e.position).divideScalar(dt).clampLength(0,e.cruiseSpeed);
      if(environment&&held!==e&&e.kind!=='crab'){
        environment.steer(e.position,e.velocity,e.radius,avoid);
        desired.addScaledVector(avoid,.6).clampLength(0,e.cruiseSpeed);
      }
      if(held===e){
        force.copy(target).sub(e.contact).sub(e.position).multiplyScalar(5)
          .addScaledVector(e.velocity,-3.8).addScaledVector(desired,.6).clampLength(0,4);
      }else force.copy(desired).sub(e.velocity).multiplyScalar(e.kind==='jelly'?1:2.5).clampLength(0,3);
      // Fixed substeps keep spring response consistent on slow phones.
      const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
      for(let i=0;i<steps;i++){
        e.velocity.addScaledVector(force,h).clampLength(0,e.maxSpeed);
        e.position.addScaledVector(e.velocity,h);
        if(environment && e.kind!=='crab')environment.constrain(e.position,e.radius,e.velocity,Infinity);
        e.position.y=Math.min(14.8,e.position.y);
        normal.subVectors(e.position,camera.position);const distance=normal.length(),limit=3+e.radius;
        if(distance<limit){normal.normalize();e.position.copy(camera.position).addScaledVector(normal,limit);
          const inward=e.velocity.dot(normal);if(inward<0)e.velocity.addScaledVector(normal,-inward);}
        if(e.kind==='crab')e.position.y=Math.max(e.ground(e.position.x,e.position.z)+.36,e.position.y);
      }
      e.write(e.position,e.velocity);
      // Preserve whole-body orientation; never rotate or stretch an individual limb.
      if(e.forceSurface&&(e.protected||waitForSurface)){rotation.setFromUnitVectors(e.forward||up,up);}
      else rotation.copy(e.root.quaternion);
      e.orientation.rotateTowards(rotation,dt*.75);e.root.quaternion.copy(e.orientation);
      if(e.react)e.react(e,held===e,dt,time);
      if(e.kinematic&&held!==e&&!e.protected&&!waitForSurface&&routeDistance<.05
        &&!(e.escort&&(e.escort===held||e.escort.protected)))e.active=false;
      if(held!==e&&!e.protected&&!e.kinematic&&e.velocity.distanceTo(desired)<.035){
        if(e.kind!=='crab'||e.position.y<=e.ground(e.position.x,e.position.z)+.38){
          e.active=false;if(e.onSettled)e.onSettled();
        }
      }
    }
    function follow(e,other){if(!e.active){e.read(e.position);e.velocity.set(0,0,0);e.orientation.copy(e.root.quaternion);e.active=true;}e.escort=other;}
    return {entities,register,follow,grab,release,allowed,visible,step,target,get held(){return held;}};
  };
})();
