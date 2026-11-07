/* SPDX-License-Identifier: GPL-3.0-only
 * Bounded interaction forces. Safety timings are animation rules, not physiology.
 */
(() => {
  'use strict';
  window.createAnimalInteraction = function(T, camera, environment) {
    const entities = [], target = new T.Vector3(), desired = new T.Vector3();
    const force = new T.Vector3(), normal = new T.Vector3(), avoid = new T.Vector3();
    const up = new T.Vector3(0,1,0), rotation = new T.Quaternion();
    const torque=new T.Vector3(),axis=new T.Vector3(),turn=new T.Quaternion();
    let held = null, pulling = false;
    // Quadratic distance gain, capped for predictable distant grabs.
    function pullScale(distance) { return 1+Math.min(5,Math.pow(Math.max(0,distance-8)/20,2)); }
    function gripSpeed(distance){return 6*pullScale(distance);}
    function gripForce(error,velocity,distance,out){
      const gain=pullScale(distance);
      return out.copy(error).multiplyScalar(45).addScaledVector(velocity,-12).clampLength(0,80*gain);
    }
    function advanceGripDepth(depth,direction,dt){
      const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
      for(let i=0;i<steps;i++)depth=direction<0
        ?Math.max(Math.min(8,depth),depth-4*pullScale(depth)*h)
        :Math.min(Math.max(135,depth),depth+4*h);
      return depth;
    }
    function visible(root) { for(let p=root;p;p=p.parent)if(!p.visible)return false;return true; }
    const clearancePosition=new T.Vector3(),clearanceVelocity=new T.Vector3();
    function keepCameraClear(e){
      if(!visible(e.root))return;
      e.read(clearancePosition);normal.subVectors(clearancePosition,camera.position);
      const distance=normal.length(),limit=4+(e.cameraRadius||e.radius);
      if(distance>=limit)return;
      if(distance>1e-6)normal.divideScalar(distance);else camera.getWorldDirection(normal);
      clearancePosition.copy(camera.position).addScaledVector(normal,limit);
      if(e.active)clearanceVelocity.copy(e.velocity);
      else if(e.nativeVelocity)clearanceVelocity.copy(e.nativeVelocity);
      else clearanceVelocity.set(0,0,0);
      const inward=clearanceVelocity.dot(normal);if(inward<0)clearanceVelocity.addScaledVector(normal,-inward);
      if(e.active){e.position.copy(clearancePosition);e.velocity.copy(clearanceVelocity);}
      e.write(clearancePosition,clearanceVelocity);
    }
    function register(options) {
      const e = Object.assign({radius:.7,maxSpeed:2.2,cruiseSpeed:1.2,maxHold:20,
        kinematic:false,protected:false,active:false,age:0,airAge:0,recovery:0,last:null},options);
      e.position = new T.Vector3(); e.velocity = new T.Vector3();
      e.contact = new T.Vector3(); e.orientation = new T.Quaternion();
      e.contactLocal=new T.Vector3();e.angularVelocity=new T.Vector3();
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
      e.contactLocal.copy(e.contact).applyQuaternion(rotation.copy(e.orientation).invert());
      target.copy(point);if(e.onGrab)e.onGrab();return true;
    }
    function release(safety=false) {
      if(!held)return;
      const e=held;held=null;
      if(e.onRelease)e.onRelease(safety);
      if(safety){e.protected=true;if(e.onSafety)e.onSafety();}
      // Physics-driven actors already own the released position and momentum.
      // A second velocity servo would repeatedly damp their swimming controller.
      if(e.nativeRelease)e.active=false;
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
      if(!e.active)return;
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
      if(held!==e)force.copy(desired).sub(e.velocity).multiplyScalar(e.kind==='jelly'?1:2.5).clampLength(0,3);
      // Fixed substeps keep spring response consistent on slow phones.
      const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
      for(let i=0;i<steps;i++){
        if(held===e){
          if(e.rotatable)e.contact.copy(e.contactLocal).applyQuaternion(e.orientation);
          normal.copy(target).sub(e.contact).sub(e.position);
          gripForce(normal,e.velocity,e.position.distanceTo(camera.position),force);
        }
        if(e.rotatable){
          if(held===e){
            torque.crossVectors(e.contact,force).multiplyScalar(1/Math.max(.35,e.radius*e.radius*.4)).clampLength(0,5);
            e.angularVelocity.addScaledVector(torque,h);
          }
          e.angularVelocity.multiplyScalar(Math.exp(-h*(held===e?2.8:3.5))).clampLength(0,1.8);
          const spin=e.angularVelocity.length();
          if(spin>1e-6){axis.copy(e.angularVelocity).divideScalar(spin);turn.setFromAxisAngle(axis,spin*h);e.orientation.premultiply(turn).normalize();}
        }
        // Brake excess pull momentum smoothly when approaching or releasing.
        const speedLimit=held===e?Math.min(e.maxGripSpeed||Infinity,gripSpeed(e.position.distanceTo(camera.position)))
          :Math.max(e.maxSpeed,e.velocity.length());
        e.velocity.addScaledVector(force,h).clampLength(0,speedLimit);
        e.position.addScaledVector(e.velocity,h);
        if(environment && e.kind!=='crab')environment.constrain(e.position,e.radius,e.velocity,Infinity);
        e.position.y=Math.min(14.8,e.position.y);
        normal.subVectors(e.position,camera.position);const distance=normal.length(),limit=4+(e.cameraRadius||e.radius);
        if(distance<limit){normal.normalize();e.position.copy(camera.position).addScaledVector(normal,limit);
          const inward=e.velocity.dot(normal);if(inward<0)e.velocity.addScaledVector(normal,-inward);}
        if(e.kind==='crab')e.position.y=Math.max(e.ground(e.position.x,e.position.z)+.36,e.position.y);
        if(e.constrain)e.constrain(e.position,e.velocity,h,held===e);
      }
      e.write(e.position,e.velocity);
      // Preserve whole-body orientation; never rotate or stretch an individual limb.
      if(e.forceSurface&&(e.protected||waitForSurface)){rotation.setFromUnitVectors(e.forward||up,up);}
      else rotation.copy(e.root.quaternion);
      if(!e.rotatable||held!==e)e.orientation.rotateTowards(rotation,dt*.75);
      e.root.quaternion.copy(e.orientation);
      if(e.writeOrientation)e.writeOrientation(e.orientation,e.angularVelocity);
      if(e.react)e.react(e,held===e,dt,time);
      if(e.kinematic&&held!==e&&!e.protected&&!waitForSurface&&routeDistance<.05
        &&!(e.escort&&(e.escort===held||e.escort.protected)))e.active=false;
      if(held!==e&&!e.protected&&!e.kinematic&&e.velocity.distanceTo(desired)<.035
        &&(!e.rotatable||(e.orientation.angleTo(rotation)<.02&&e.angularVelocity.length()<.03))){
        if(e.kind!=='crab'||e.position.y<=e.ground(e.position.x,e.position.z)+.38){
          e.active=false;if(e.onSettled)e.onSettled();
        }
      }
    }
    function follow(e,other){if(!e.active){e.read(e.position);e.velocity.set(0,0,0);e.orientation.copy(e.root.quaternion);e.active=true;}e.escort=other;}
    return {entities,register,follow,grab,release,allowed,visible,step,target,pullScale,gripSpeed,gripForce,advanceGripDepth,keepCameraClear,
      get pulling(){return pulling;},set pulling(value){pulling=!!value;},get held(){return held;}};
  };
})();
