/* SPDX-License-Identifier: GPL-3.0-only
 * Reduced swimming dynamics, tuned for animation, not calibrated physiology.
 * Coordinates/metres: +Y along the diver towards the head; +X towards the chest.
 * The body root approximates its centre of mass. Caller supplies a fixed step
 * and handles contacts; this module never assigns a target position directly.
 */
(() => {
  'use strict';
  // Elastic blade state. Zero water load has a straight, not a bent, rest pose.
  window.stepFreediverBlade = function(blade, normalSpeed, dt) {
    if(!(dt>0))return;
    const load=Math.max(-.70,Math.min(.70,-.22*normalSpeed*Math.abs(normalSpeed)));
    // Her articulated feet drive ~1 Hz kicks. The old 6 rad/s spring was
    // slower than that stroke, leaving the tip bent into the next half-kick.
    // Faster elastic recovery retains a short lag and a small recoil.
    blade.v+=(196*(load-blade.x)-18*blade.v)*dt;
    blade.x+=blade.v*dt;
    if(Math.abs(blade.x)>.70){
      blade.x=Math.sign(blade.x)*.70;
      if(blade.x*blade.v>0)blade.v=0;
    }
    // A three-section reduced beam: each section receives the preceding
    // section's motion with its own inertia, so curvature travels to the tip.
    for(const [position,velocity,target] of [['mid','midV',blade.x],['tip','tipV',blade.mid??0]]){
      blade[position]??=0;blade[velocity]??=0;
      blade[velocity]+=(400*(target-blade[position])-28*blade[velocity])*dt;
      blade[position]+=blade[velocity]*dt;
    }
  };
  window.sampleFreediverBlade=function(blade,s=1){
    let x=0,y=0,angle=0;
    for(const [i,bend] of [blade.x,blade.mid||0,blade.tip||0].entries()){
      const part=Math.max(0,Math.min(1,s*3-i)),turn=bend*.55,end=angle+turn*part;
      if(Math.abs(turn)>.0001){x+=.2522*(Math.cos(angle)-Math.cos(end))/turn;y-=.2522*(Math.sin(end)-Math.sin(angle))/turn;}
      else{x+=.2522*part*Math.sin(angle);y-=.2522*part*Math.cos(angle);}
      angle=end;
    }
    return {x,y:y+.7566*s,angle};
  };
  window.createFreediverPhysics = function(T, options = {}) {
    const config = Object.assign({
      bodyMass: 61, beltMass: 3, addedMass: 16,
      waterDensity: 1000, gravity: 9.81, pressureDepth: 10.3,
      constantVolume: .0615, surfaceLungVolume: .005,
      // Bikini: no neoprene volume or wetsuit compression term.
      axialDragArea: .085, lateralDragArea: .38,
      maxThrust: 100, maxReverseThrust: 14, maxScullForce: 28,
      velocityResponse: 1.35, actuatorResponse: .32,
      rotationalInertia: 14, angularStiffness: 58, angularDamping: 43,
      maxTorque: 32, maxAngularSpeed: 1.15,
      bodyHalfLength: .95, bodyHalfWidth: .22
    }, options.config || {});
    const position = options.position ? options.position.clone() : new T.Vector3(0, 14.75, 0);
    const velocity = new T.Vector3(), quaternion = new T.Quaternion(), angularVelocity = new T.Vector3();
    const forward = new T.Vector3(), chest = new T.Vector3(), side = new T.Vector3();
    const heading = new T.Vector3(), relative = new T.Vector3(), lateral = new T.Vector3();
    const drag = new T.Vector3(), requested = new T.Vector3(), scull = new T.Vector3(), total = new T.Vector3();
    const rotationAxis = new T.Vector3(), torque = new T.Vector3(), zero = new T.Vector3();
    const basis = new T.Matrix4(), targetRotation = new T.Quaternion(), error = new T.Quaternion(), increment = new T.Quaternion();
    let forwardForce = 0;
    const state = {
      depth: 0, pressure: 1, immersion: 1, buoyancyForce: 0, netBuoyancy: 0,
      thrust: 0, scullForce: 0, dragForce: 0, effort: 0, kickEffort: 0,
      scullEffort: 0, kickPhase: 0, speed: 0, waterSpeed: 0, angularSpeed: 0
    };
    const mass = () => config.bodyMass + config.beltMass;
    const volume = depth => config.constantVolume + config.surfaceLungVolume / (1 + Math.max(0, depth) / config.pressureDepth);
    // Net vertical force in N when fully immersed; positive means floating.
    function buoyancy(depth) { return config.gravity * (config.waterDensity * volume(depth) - mass()); }
    function step(dt, command = {}) {
      if (!(dt > 0) || !Number.isFinite(dt)) return state;
      dt = Math.min(dt, .1);
      const current = command.current || zero, surfaceY = command.surfaceY === undefined ? 15 : command.surfaceY;
      const effectiveMass = mass() + config.addedMass;
      forward.set(0, 1, 0).applyQuaternion(quaternion);
      if (command.heading && command.heading.lengthSq() > 1e-8) {
        heading.copy(command.heading).normalize();
        // Face generally down while swimming horizontally. Close to vertical,
        // retain the previous chest direction to avoid a singular roll flip.
        chest.set(0, command.faceUp ? 1 : -1, 0);
        chest.addScaledVector(heading, -chest.dot(heading));
        if (chest.lengthSq() < .04) {
          chest.set(1, 0, 0).applyQuaternion(quaternion);
          chest.addScaledVector(heading, -chest.dot(heading));
        }
        if (chest.lengthSq() < 1e-8) {
          chest.set(1, 0, 0).addScaledVector(heading, -heading.x);
          if (chest.lengthSq() < 1e-8) chest.set(0, 0, 1).addScaledVector(heading, -heading.z);
        }
        chest.normalize(); side.crossVectors(chest, heading).normalize(); chest.crossVectors(heading, side).normalize();
        targetRotation.setFromRotationMatrix(basis.makeBasis(chest, heading, side));
        error.copy(targetRotation).multiply(increment.copy(quaternion).invert()).normalize();
        if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w);
        rotationAxis.set(error.x, error.y, error.z);
        const length = rotationAxis.length();
        if (length > 1e-8) rotationAxis.multiplyScalar(2 * Math.atan2(length, error.w) / length);
        else rotationAxis.set(0, 0, 0);
        torque.copy(rotationAxis).multiplyScalar(config.angularStiffness).addScaledVector(angularVelocity, -config.angularDamping);
      } else torque.copy(angularVelocity).multiplyScalar(-config.angularDamping);
      torque.clampLength(0, config.maxTorque);
      angularVelocity.addScaledVector(torque, dt / config.rotationalInertia).clampLength(0, config.maxAngularSpeed);
      const angularSpeed = angularVelocity.length();
      if (angularSpeed > 1e-8) {
        increment.setFromAxisAngle(rotationAxis.copy(angularVelocity).multiplyScalar(1 / angularSpeed), angularSpeed * dt);
        quaternion.premultiply(increment).normalize();
      }
      forward.set(0, 1, 0).applyQuaternion(quaternion);
      const depth = Math.max(0, surfaceY - position.y);
      // Ellipsoid immersion approximation, excluding the thin fins. Unlike a
      // surface clamp, this smoothly removes buoyancy as the body emerges.
      const halfHeight = Math.sqrt(config.bodyHalfWidth ** 2 * (1 - forward.y ** 2) + config.bodyHalfLength ** 2 * forward.y ** 2);
      const submerged = T.MathUtils.clamp((surfaceY - position.y) / halfHeight, -1, 1);
      const immersion = .5 + .75 * submerged - .25 * submerged ** 3;
      const buoyancyForce = config.waterDensity * config.gravity * volume(depth) * immersion;
      const netBuoyancy = buoyancyForce - mass() * config.gravity;
      relative.copy(velocity).sub(current);
      const axialSpeed = relative.dot(forward);
      lateral.copy(relative).addScaledVector(forward, -axialSpeed);
      drag.copy(forward).multiplyScalar(-.5 * config.waterDensity * config.axialDragArea * axialSpeed * Math.abs(axialSpeed));
      drag.addScaledVector(lateral, -.5 * config.waterDensity * config.lateralDragArea * lateral.length()).multiplyScalar(immersion);
      // A bounded velocity servo requests real actuator forces, with inertia,
      // drag and buoyancy feed-forward. desiredVelocity is in WORLD space.
      requested.copy(command.desiredVelocity || zero).sub(velocity).multiplyScalar(effectiveMass / config.velocityResponse);
      requested.sub(drag); requested.y -= netBuoyancy;
      let requestedForward = command.glide ? 0 : T.MathUtils.clamp(requested.dot(forward), -config.maxReverseThrust, config.maxThrust);
      // Freefall removes propulsive kicks, but preserves steering and braking.
      if(requestedForward>0 && command.finPowerScale!==undefined)requestedForward*=T.MathUtils.clamp(command.finPowerScale,0,1);
      lateral.copy(requested).addScaledVector(forward, -requested.dot(forward)).clampLength(0, config.maxScullForce);
      if(command.handPower!==undefined)lateral.multiplyScalar(.35+.65*T.MathUtils.clamp(command.handPower,0,1));
      if (command.glide) lateral.set(0, 0, 0);
      const response = 1 - Math.exp(-dt / config.actuatorResponse);
      forwardForce += (requestedForward - forwardForce) * response;
      scull.lerp(lateral, response);
      state.kickEffort = Math.max(0, forwardForce) / config.maxThrust;
      state.kickFrequency = state.kickEffort > .015 ? .4 + .85 * Math.sqrt(state.kickEffort) : 0;
      state.kickPhase = (state.kickPhase + dt * Math.PI * 2 * state.kickFrequency) % (Math.PI * 2);
      // Two alternating blades: strongest thrust at mid-sweep, weakest at
      // reversal. The animation consumes this SAME phase, rather than running
      // an independent, slow decorative kick over continuous propulsion.
      const pulse = command.strokeDriven ? .65 + .7 * Math.cos(state.kickPhase) ** 2 : 1;
      const appliedForward = forwardForce > 0 ? Math.min(config.maxThrust, forwardForce * pulse) : forwardForce;
      total.copy(drag).addScaledVector(forward, appliedForward * immersion).addScaledVector(scull, immersion);
      total.y += netBuoyancy;
      velocity.addScaledVector(total, dt / effectiveMass);
      position.addScaledVector(velocity, dt);
      state.depth = depth; state.pressure = 1 + depth / config.pressureDepth; state.immersion = immersion;
      state.buoyancyForce = buoyancyForce; state.netBuoyancy = netBuoyancy;
      state.thrust = appliedForward * immersion; state.scullForce = scull.length() * immersion; state.dragForce = drag.length();
      // Share existing forward propulsion between fins and the active arm pull;
      // do not invent additional thrust merely by animating an arm stroke.
      state.armThrust=Math.max(0,state.thrust)*.25*T.MathUtils.clamp(command.handPower||0,0,1);
      state.finThrust=state.thrust-state.armThrust;
      state.scullEffort = Math.max(scull.length() / config.maxScullForce, Math.max(0, -forwardForce) / config.maxReverseThrust);
      state.effort = T.MathUtils.clamp(Math.hypot(state.kickEffort, .4 * state.scullEffort), 0, 1);
      state.speed = velocity.length(); state.waterSpeed = relative.length(); state.angularSpeed = angularSpeed;
      return state;
    }
    return { position, velocity, quaternion, angularVelocity, state, step, buoyancy, config };
  };
})();
