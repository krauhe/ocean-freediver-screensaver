/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian R. Harreby. See LICENSE for terms.
 * A neutral-buoyancy buddy team: articulated frog kicks, a long glide phase,
 * independent breathing cycles and a bounded pool of rising gas bubbles.
 */
(() => {
  'use strict';

  window.createScubaDivers = function (T, scene, waterUniforms, oceanOptics, oceanBioluminescence, diveSite) {
    const group = new T.Group();
    group.name = 'Scuba buddy team';
    scene.add(group);
    const bio = oceanBioluminescence || window.oceanBioluminescence;
    const uniforms = waterUniforms || {};
    const daylight = uniforms.daylight || { value: 1 };
    const sphere = new T.SphereGeometry(1, 16, 12);
    const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const up = new T.Vector3(0, 1, 0);
    const delta = new T.Vector3();
    const worldPoint = new T.Vector3();
    const mouth = new T.Vector3();
    const localForward = new T.Vector3(1, 0, 0);
    const swimForward = new T.Vector3();
    const routePoint = new T.Vector3(), routeTangent = new T.Vector3();
    const beamOrigin = new T.Vector3();
    const wreckMatrix = diveSite ? diveSite.wreckMatrix : new T.Matrix4().makeTranslation(-2, -23, -24);
    // A continuous sightseeing circuit, with clearance for fins and the buddy.
    // Each station pairs a swimming position with the feature being inspected.
    const stations = [
      {name:'Wreck deck',p:[-6,-16,-15],aim:[-5,-19,-24]},
      {name:'Stern',p:[-20,-17,-20],aim:[-14,-20,-25]},
      {name:'Truck cab',p:[-26,-18,-26],aim:[-22,-22,-30]},
      {name:'Truck bed',p:[-30,-17,-36],aim:[-23,-21,-35]},
      {name:'Behind wreck',p:[-16,-14,-35],aim:[-10,-19,-25]},
      {name:'Wheelhouse',p:[3,-13,-34],aim:[1,-15,-24]},
      {name:'Bow',p:[13,-13,-28],aim:[10,-19,-23]},
      {name:'Cliff ledge',p:[13,-10,-17],aim:[21,-8,-17]},
      {name:'Cliff rocks',p:[13,-15,-5],aim:[21,-22,-5]},
      {name:'Bottom stones',p:[5,-20,-6],aim:[5,-23.7,-9]},
      {name:'Sand and bottom life',p:[-8,-20,-8],aim:[-7,-23.7,-13]}
    ];
    const route = new T.CatmullRomCurve3(stations.map(s=>new T.Vector3(...s.p)),true,'centripetal');
    const durations=stations.map((s,i)=>route.getPoint(i/stations.length).distanceTo(route.getPoint((i+1)/stations.length))/.32);
    const routeDuration=durations.reduce((a,b)=>a+b,0), routeAim=new T.Vector3();
    let routePitch=0;
    function sampleRoute(time, index, position) {
      let clock=((time%routeDuration)+routeDuration)%routeDuration,segment=0;
      while(segment<durations.length-1&&clock>=durations[segment])clock-=durations[segment++];
      const f=clock/durations[segment];
      // Slow inspection at a station, longer glides between subjects, no stop/start jumps.
      const eased=f-.65*Math.sin(f*Math.PI*2)/(Math.PI*2);
      const u=(segment+eased)/stations.length;
      route.getPoint(u,position);route.getTangent(u,routeTangent);
      const horizontal=Math.hypot(routeTangent.x,routeTangent.z);
      // Parallel lanes keep the pair together even while inspecting a feature.
      const lane=(index-.5)*2.15;
      position.x-=routeTangent.z/horizontal*lane;position.z+=routeTangent.x/horizontal*lane;
      position.y+=index*.30+.06*Math.sin(time*.11+index);
      routePitch=Math.atan2(routeTangent.y,horizontal)*.65;
      const next=stations[(segment+1)%stations.length],blend=eased*eased*(3-2*eased);
      routeAim.set(...stations[segment].aim).lerp(worldPoint.set(...next.aim),blend);
      return Math.atan2(-routeTangent.z, routeTangent.x);
    }
    const material = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.68, metalness: 0.05 }, extra));
    const suit = material(0x162e39);
    const rubber = material(0x091821);
    const skin = material(0xb4a38b, { roughness: 0.78 });
    const metal = material(0x98afb4, { metalness: 0.52, roughness: 0.29 });
    const glass = material(0x7bc8d7, { metalness: 0.36, roughness: 0.12, transparent: true, opacity: 0.75 });
    const white = material(0xd4e3df, { emissive: 0x254352, emissiveIntensity: 0.22 });
    const gold = material(0xc4ab4d, { emissive: 0x303a24, emissiveIntensity: 0.22 });

    function ellipsoid(parent, pos, scale, mat) {
      const mesh = new T.Mesh(sphere, mat);
      mesh.position.set(...pos); mesh.scale.set(...scale); parent.add(mesh);
      return mesh;
    }
    function box(parent, pos, scale, mat) {
      const mesh = new T.Mesh(unitBox, mat);
      mesh.position.set(...pos); mesh.scale.set(...scale); parent.add(mesh);
      return mesh;
    }
    function segment(parent, a, b, radius, mat) {
      const mesh = new T.Mesh(cylinder, mat);
      delta.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      mesh.scale.set(radius, delta.length(), radius);
      mesh.quaternion.setFromUnitVectors(up, delta.normalize());
      parent.add(mesh); return mesh;
    }
    function hose(parent, points, mat, radius = 0.025) {
      const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
      const mesh = new T.Mesh(new T.TubeGeometry(curve, 20, radius, 6, false), mat);
      parent.add(mesh); return mesh;
    }
    function ring(parent, pos, radius, thickness, mat, axis) {
      const mesh = new T.Mesh(new T.TorusGeometry(radius, thickness, 6, 18), mat);
      mesh.position.set(...pos);
      if (axis === 'x') mesh.rotation.y = Math.PI / 2;
      parent.add(mesh); return mesh;
    }

    // Blades have a real curved, tapered cross-section instead of flat rectangles.
    const bladeGeo = new T.BufferGeometry();
    const bladePositions = [], bladeIndices = [];
    for (let i = 0; i <= 7; i++) {
      const u = i / 7, width = 0.09 + Math.sin(u * Math.PI * 0.72) * 0.13;
      for (let j = 0; j <= 4; j++) {
        const across = j / 2 - 1;
        bladePositions.push(-u * 0.68, -0.06 * u * u + 0.018 * across * across, across * width);
      }
    }
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
      const n = i * 5 + j; bladeIndices.push(n, n + 5, n + 1, n + 1, n + 5, n + 6);
    }
    bladeGeo.setAttribute('position', new T.Float32BufferAttribute(bladePositions, 3));
    bladeGeo.setIndex(bladeIndices); bladeGeo.computeVertexNormals();
    const finMat = material(0x10232c, { side: T.DoubleSide });

    // A soft scattering cone makes each real spotlight visible in the water.
    // It ends at the inspected surface, fades at its edges and writes no depth.
    const beamGeo = new T.CylinderGeometry(.012, 1, 1, 32, 1, true);
    beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0, .5);
    function beamMaterial() {
      return new T.ShaderMaterial({
        uniforms: { strength: { value: 0 }, fogDensity: { value: scene.fog ? scene.fog.density || .014 : 0 } },
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `varying float along; varying vec3 viewNormal; varying vec3 viewPosition;
          void main(){ along=position.z; vec4 p=modelViewMatrix*vec4(position,1.);
            viewPosition=p.xyz; viewNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*p; }`,
        fragmentShader: `uniform float strength; uniform float fogDensity;
          varying float along; varying vec3 viewNormal; varying vec3 viewPosition;
          void main(){
            float edge=pow(abs(dot(normalize(viewNormal),normalize(-viewPosition))),.8);
            float fade=smoothstep(0.,.035,along)*(1.-smoothstep(.64,1.,along))*exp(-along*1.3);
            float fog=exp(-fogDensity*fogDensity*dot(viewPosition,viewPosition));
            gl_FragColor=vec4(vec3(.67,.86,1.),strength*.22*edge*fade*fog);
          }`
      });
    }

    function createDiver(index) {
      const root = new T.Group(); root.name = index ? 'Scuba buddy • ivory' : 'Scuba lead • ochre';
      root.scale.setScalar(1.28);
      group.add(root);
      const accent = index ? white : gold;
      ellipsoid(root, [0, 0, 0], [0.59, 0.235, 0.30], suit);
      ellipsoid(root, [-0.43, 0.015, 0], [0.25, 0.23, 0.255], suit);
      // BCD wing sits above the back; tank axis follows the spine.
      ellipsoid(root, [-0.04, 0.205, 0], [0.55, 0.18, 0.37], rubber);
      const tank = segment(root, [-0.56, 0.40, 0], [0.38, 0.40, 0], 0.177, metal);
      tank.name = 'Single backmount cylinder';
      ellipsoid(root, [-0.56, 0.40, 0], [0.16, 0.177, 0.177], metal);
      ellipsoid(root, [0.38, 0.40, 0], [0.12, 0.177, 0.177], metal);
      ring(root, [-0.30, 0.40, 0], 0.181, 0.030, rubber, 'x');
      ring(root, [0.18, 0.40, 0], 0.181, 0.030, rubber, 'x');
      segment(root, [0.44, 0.40, 0], [0.58, 0.40, 0], 0.050, metal);
      segment(root, [0.50, 0.40, 0], [0.50, 0.40, 0.13], 0.037, rubber);
      box(root, [-0.01, 0.575, 0], [0.18, 0.012, 0.14], accent);
      // Harness shoulder webbing, waist buckle and D-rings.
      for (const side of [-1, 1]) {
        hose(root, [[0.38, 0.26, side * 0.17], [0.50, -0.02, side * 0.23], [0.28, -0.23, side * 0.20], [-0.30, -0.20, side * 0.20]], rubber, 0.037);
        ring(root, [0.32, -0.19, side * 0.245], 0.043, 0.009, metal);
      }
      box(root, [-0.27, -0.215, 0], [0.09, 0.035, 0.22], metal);
      ellipsoid(root, [0.58, 0.025, 0], [0.15, 0.13, 0.15], skin);
      const head = new T.Group(); head.position.set(0.77, 0.015, 0); root.add(head);
      ellipsoid(head, [0, 0.02, 0], [0.235, 0.235, 0.205], rubber);
      ellipsoid(head, [0.145, -0.025, 0], [0.105, 0.16, 0.16], skin);
      // Twin mask lenses, a silicone skirt and a mouth-held second stage.
      for (const side of [-1, 1]) {
        ellipsoid(head, [0.22, 0.02, side * 0.083], [0.057, 0.105, 0.095], rubber);
        ellipsoid(head, [0.258, 0.025, side * 0.083], [0.018, 0.073, 0.072], glass);
      }
      hose(head, [[0.20, 0.04, -0.16], [-0.19, 0.08, -0.16], [-0.22, 0.08, 0.14], [0.20, 0.04, 0.16]], rubber, 0.025);
      ellipsoid(head, [0.235, -0.115, 0], [0.077, 0.065, 0.092], rubber);
      box(head, [0.295, -0.115, 0], [0.018, 0.068, 0.10], metal);
      hose(root, [[0.49, 0.43, 0.10], [0.65, 0.22, 0.38], [1.03, -0.07, 0.27], [1.02, -0.10, 0.02]], rubber);
      hose(root, [[0.46, 0.43, -0.10], [0.25, 0.32, -0.36], [0.18, -0.15, -0.38], [0.44, -0.23, -0.26]], rubber, 0.032);
      hose(root, [[0.49, 0.42, 0], [-0.18, -0.16, 0.37], [0.06, -0.28, 0.28]], accent, 0.018);
      ellipsoid(root, [0.06, -0.28, 0.28], [0.08, 0.065, 0.075], accent);
      // Relaxed arms, folded in front; bare hands remain visible against the suit.
      for (const side of [-1, 1]) {
        const shoulder = [0.35, -0.02, side * 0.26], elbow = [0.09, -0.39, side * 0.36], wrist = [0.64, -0.35, side * 0.21];
        ellipsoid(root, shoulder, [0.19, 0.15, 0.155], suit);
        segment(root, shoulder, elbow, 0.102, suit);
        ellipsoid(root, elbow, [0.11, 0.11, 0.11], rubber);
        segment(root, elbow, wrist, 0.080, suit);
        segment(root, [0.22, -0.36, side * 0.32], [0.34, -0.35, side * 0.29], 0.083, accent);
        ellipsoid(root, [0.69, -0.35, side * 0.20], [0.14, 0.06, 0.075], skin);
      }
      box(root, [0.54, -0.41, 0.24], [0.12, 0.04, 0.13], rubber);
      box(root, [0.54, -0.435, 0.24], [0.085, 0.009, 0.09], glass);
      // The hand-held torch pivots at the grip independently of the swim heading.
      const torchRig = new T.Group(); torchRig.position.set(.69, -.35, .20); root.add(torchRig);
      segment(torchRig, [0, 0, -.08], [0, 0, .22], .055, metal);
      segment(torchRig, [0, 0, .18], [0, 0, .28], .075, rubber);
      const lensMaterial = material(0xd4e9ed, { emissive: 0xb9eaff, emissiveIntensity: 0 });
      const torchLens = ellipsoid(torchRig, [0, 0, .285], [.062, .062, .012], lensMaterial);
      const torchTarget = new T.Object3D(); group.add(torchTarget);
      const torch = new T.SpotLight(0xc8e9ff, 0, 24, .25, .72, 1.1);
      torch.position.set(0, 0, .30); torch.target = torchTarget; torchRig.add(torch);
      const beam = new T.Mesh(beamGeo, beamMaterial()); beam.name = 'Night torch scattering';
      beam.position.z = .30; torchRig.add(beam);
      const legs = [];
      for (const side of [-1, 1]) {
        const hip = new T.Group(); hip.position.set(-0.45, 0, side * 0.18); root.add(hip);
        segment(hip, [0, 0, 0], [-0.52, 0.02, 0], 0.125, suit);
        ellipsoid(hip, [-0.48, 0.02, 0], [0.17, 0.12, 0.13], rubber);
        box(hip, [-0.39, -0.09, side * 0.05], [0.20, 0.024, 0.15], accent);
        const knee = new T.Group(); knee.position.set(-0.54, 0.02, 0); hip.add(knee);
        segment(knee, [0, 0, 0], [-0.16, 0.43, 0], 0.088, suit);
        segment(knee, [-0.14, 0.36, 0], [-0.16, 0.43, 0], 0.091, accent);
        ellipsoid(knee, [-0.19, 0.45, 0], [0.17, 0.075, 0.093], rubber);
        const fin = new T.Group(); fin.position.set(-0.27, 0.45, 0); knee.add(fin);
        fin.add(new T.Mesh(bladeGeo, finMat));
        segment(fin, [-0.10, 0, -0.11], [-0.58, -0.04, -0.19], 0.011, accent);
        segment(fin, [-0.10, 0, 0.11], [-0.58, -0.04, 0.19], 0.011, accent);
        legs.push({ hip, knee, fin, side, previousTip: new T.Vector3() });
      }
      return { root, head, legs, torch, torchLens, torchRig, torchTarget, beam, breath: 0, kick: 0, prevPosition: new T.Vector3(), hasPrevious: false };
    }
    const divers = [createDiver(0), createDiver(1)];

    // Identical optics and ascent law to the freedivers, with a regulator source.
    // Fixed pool, one draw call, fixed-step integration and bounded pair checks.
    const bubbleCount = 640;
    const positions = new Float32Array(bubbleCount * 3);
    const radii = new Float32Array(bubbleCount);
    const initialRadii = new Float32Array(bubbleCount);
    const spawnPressure = new Float32Array(bubbleCount);
    const ages = new Float32Array(bubbleCount);
    const velocity = new Float32Array(bubbleCount * 3);
    const seeds = new Float32Array(bubbleCount * 2);
    const activeIndices = new Uint16Array(bubbleCount);
    const bubbleVelocity = new Float64Array(3);
    for (let i = 0; i < bubbleCount; i++) {
      positions[i * 3 + 1] = -999;
      seeds[i * 2] = (i * 0.618033989) % 1;
      seeds[i * 2 + 1] = 0.55 + ((i * 0.381966011) % 1) * 0.65;
    }
    const bubbleGeo = new T.BufferGeometry();
    bubbleGeo.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    bubbleGeo.setAttribute('aRadius', new T.BufferAttribute(radii, 1).setUsage(T.DynamicDrawUsage));
    bubbleGeo.setAttribute('aSeed', new T.BufferAttribute(seeds, 2));
    const bubbleMat = window.createDiverBubbleMaterial(T, waterUniforms);
    const bubbles = new T.Points(bubbleGeo, bubbleMat); bubbles.name = 'Scuba exhalation bubbles';
    bubbles.frustumCulled = false; group.add(bubbles);
    let bubbleHead = 0, lastTime, bubbleAccumulator = 0, initialPlumePending = true;

    function emitBubble(origin, forward) {
      const i = bubbleHead; bubbleHead = (bubbleHead + 1) % bubbleCount;
      const p = i * 3;
      // Mostly tiny regulator bubbles, with only occasional larger gas caps.
      const r = Math.random() < .06 ? .025 + Math.random() * .014 : .007 + Math.random() * .011;
      radii[i] = r; initialRadii[i] = r; ages[i] = 0;
      const side = Math.random() < .5 ? -1 : 1;
      const spread = side * (.10 + Math.random() * .07);
      positions[p] = origin.x - forward.z * spread + (Math.random() - .5) * .07;
      positions[p + 1] = origin.y + 0.03;
      positions[p + 2] = origin.z + forward.x * spread + (Math.random() - .5) * .07;
      spawnPressure[i] = 1.0 + Math.max(0, 15.0 - positions[p + 1]) * 0.10;
      velocity[p] = forward.x * .10 - forward.z * side * .12;
      velocity[p + 1] = 0.70;
      velocity[p + 2] = forward.z * .10 + forward.x * side * .12;
      return i;
    }

    function seedPlume(time, index) {
      // Reconstruct a short breath already in progress at the actual start time,
      // including the regulator's earlier positions along the swimming route.
      for (let n = 0; n < 38; n++) {
        const age = n / 38 * 1.35;
        const heading = sampleRoute(time - age, index, routePoint);
        swimForward.set(Math.cos(heading), 0, -Math.sin(heading));
        mouth.copy(routePoint).addScaledVector(swimForward, 1.04 * 1.28); mouth.y -= .10 * 1.28;
        const i = emitBubble(mouth, swimForward), p = i * 3;
        for (let elapsed = 0; elapsed < age; elapsed += 1 / 60) {
          const dt = Math.min(1 / 60, age - elapsed);
          radii[i] = window.diverBubbleExpansion(initialRadii[i], spawnPressure[i], positions[p + 1]);
          window.stepDiverBubbleVelocity(bubbleVelocity, radii[i], velocity[p], velocity[p + 1], velocity[p + 2], time - age + elapsed, i, dt);
          for (let axis = 0; axis < 3; axis++) { velocity[p + axis] = bubbleVelocity[axis]; positions[p + axis] += bubbleVelocity[axis] * dt; }
        }
        ages[i] = age;
      }
    }

    function stepBubbles(time, dt) {
      let activeCount = 0;
      for (let i = 0; i < bubbleCount; i++) {
        if (radii[i] === 0) continue;
        const p = i * 3; ages[i] += dt;
        if (ages[i] > 42 || positions[p + 1] >= 14.96) {
          radii[i] = 0; positions[p + 1] = -999; continue;
        }
        // The exact shared Boyle / Davies–Taylor / cap-wobble model.
        radii[i] = window.diverBubbleExpansion(initialRadii[i], spawnPressure[i], positions[p + 1]);
        window.stepDiverBubbleVelocity(bubbleVelocity, radii[i], velocity[p], velocity[p + 1], velocity[p + 2], time, i, dt);
        for (let axis = 0; axis < 3; axis++) {
          velocity[p + axis] = bubbleVelocity[axis];
          positions[p + axis] += bubbleVelocity[axis] * dt;
        }
        activeIndices[activeCount++] = i;
      }
      // Sort by height so only nearby bubbles enter the shared drafting/merge law.
      // This bounds the extra work of a denser plume without changing its optics.
      activeIndices.subarray(0, activeCount).sort((a, b) => positions[a * 3 + 1] - positions[b * 3 + 1]);
      for (let a = 0; a < activeCount; a++) {
        const i = activeIndices[a], p = i * 3;
        if (radii[i] === 0) continue;
        for (let b = a + 1; b < activeCount; b++) {
          const j = activeIndices[b], q = j * 3;
          if (radii[j] === 0) continue;
          const dy = positions[p + 1] - positions[q + 1];
          if (dy < -.8) break;
          if (dy > .8) continue;
          const dx = positions[p] - positions[q], dz = positions[p + 2] - positions[q + 2];
          const horizontal2 = dx * dx + dz * dz, sumR = radii[i] + radii[j];
          const lead = dy > 0 ? i : j, trail = dy > 0 ? j : i;
          const lp = lead * 3, tp = trail * 3, gap = Math.abs(dy);
          if (gap > 0.04 && gap < 0.65 && horizontal2 < Math.pow(radii[lead] * 2.2 + 0.05, 2)) {
            const draft = 1.0 - gap / 0.65;
            velocity[tp + 1] += 0.65 * draft * dt * 4.0;
            positions[tp] += (positions[lp] - positions[tp]) * draft * dt * 2.0;
            positions[tp + 2] += (positions[lp + 2] - positions[tp + 2]) * draft * dt * 2.0;
          }
          if (horizontal2 < sumR * sumR * 1.65 && gap < sumR * 1.85) {
            const vi = radii[i] ** 3, vj = radii[j] ** 3, merged = vi + vj;
            positions[p] = (positions[p] * vi + positions[q] * vj) / merged;
            positions[p + 1] = Math.max(positions[p + 1], positions[q + 1]) + 0.02;
            positions[p + 2] = (positions[p + 2] * vi + positions[q + 2] * vj) / merged;
            // Preserve gas content as well as visible volume across unequal depths.
            const gas = initialRadii[i] ** 3 * spawnPressure[i] + initialRadii[j] ** 3 * spawnPressure[j];
            spawnPressure[i] = 1.0 + Math.max(0, 15.0 - positions[p + 1]) * 0.10;
            initialRadii[i] = Math.cbrt(gas / spawnPressure[i]);
            radii[i] = Math.cbrt(merged); velocity[p + 1] += 0.14;
            radii[j] = 0; positions[q + 1] = -999;
          }
        }
      }
    }

    function update(time, paused, speed) {
      // time is the scene's already speed-adjusted clock: never multiply it twice.
      const elapsed = lastTime === undefined ? 0 : Math.max(0, time - lastTime);
      const dt = paused || !group.visible ? 0 : Math.min(0.10, elapsed);
      lastTime = time;
      if (!group.visible) return;
      const torchPower = 1 - T.MathUtils.smoothstep(daylight.value, .08, .55);
      for (let index = 0; index < divers.length; index++) {
        const d = divers[index], heading = sampleRoute(time, index, d.root.position);
        d.root.rotation.set(0, heading, routePitch + Math.sin(time * 0.09 + index) * 0.018);
        // Recovery -> outward sweep -> squeeze -> long glide; buddies are out of phase.
        const phase = (time / 5.8 + index * 0.24) % 1;
        let kick;
        if (phase < 0.23) kick = Math.sin(phase / 0.23 * Math.PI / 2);
        else if (phase < 0.47) kick = Math.cos((phase - 0.23) / 0.24 * Math.PI / 2);
        else kick = 0;
        d.kick = kick;
        for (const leg of d.legs) {
          leg.hip.rotation.y = leg.side * (0.045 + kick * 0.28);
          leg.knee.rotation.y = leg.side * kick * 0.31;
          // Video reference: heels rise toward the seat during loading, then
          // extend aft into the glide. Keep blade pitch nearly level throughout.
          leg.knee.rotation.z = 0.58 - kick * 0.62;
          leg.fin.rotation.x = leg.side * kick * 0.62;
          leg.fin.rotation.y = leg.side * kick * 0.22;
          leg.fin.rotation.z = -leg.knee.rotation.z + 0.02 - kick * 0.08;
        }
        d.head.rotation.y = (index ? -1 : 1) * (0.07 + 0.06 * Math.sin(time * 0.16));
        d.root.updateMatrixWorld(true);
        // The light follows the actual subject at this part of the circuit.
        d.torchTarget.position.copy(routeAim);
        d.torchTarget.position.x+=.65*Math.sin(time*.19+index*2.1);
        d.torchTarget.position.y+=.35*Math.sin(time*.13+index);
        d.torchRig.lookAt(d.torchTarget.position);
        d.torchRig.updateMatrixWorld(true);
        d.torch.getWorldPosition(beamOrigin);
        const beamLength = Math.min(17, beamOrigin.distanceTo(d.torchTarget.position)) / d.root.scale.x;
        const beamRadius = Math.tan(d.torch.angle) * beamLength;
        d.beam.scale.set(beamRadius, beamRadius, beamLength);
        d.beam.visible = torchPower > .001;
        d.beam.material.uniforms.strength.value = torchPower;
        d.torch.intensity = 70 * torchPower;
        d.torchLens.material.emissiveIntensity = 2.5 * torchPower;
        swimForward.copy(localForward).applyQuaternion(d.root.quaternion);
        // Exhale during roughly half a 5.2-second breathing cycle, then a quiet inhale.
        const breathPhase = (time / 5.2 + index * 0.39) % 1;
        if (dt > 0 && breathPhase < 0.45) {
          d.breath += dt * (36 + 44 * Math.sin(breathPhase / 0.45 * Math.PI));
          mouth.set(1.04, -0.10, 0); d.root.localToWorld(mouth);
          while (d.breath >= 1) { emitBubble(mouth, swimForward); d.breath--; }
        } else if (breathPhase >= 0.45) d.breath = 0;
        const night = Math.max(0, Math.min(1, (.32 - daylight.value) / .30));
        if (dt > 0 && bio && d.hasPrevious && night > .01) {
          delta.subVectors(d.root.position, d.prevPosition).divideScalar(dt);
          const bodySpeed = delta.length();
          for (const side of [-1, 1]) {
            // Separation at the BCD's trailing shoulder edge; no timer-based aura.
            worldPoint.set(-0.35, 0.08, side * .33); d.root.localToWorld(worldPoint);
            bio.emitDisturbance(worldPoint.x, worldPoint.y, worldPoint.z,
              delta.x, delta.y, delta.z, Math.min(1, bodySpeed) * night, 2, .025);
          }
        }
        for (const leg of d.legs) {
          worldPoint.set(-0.63, -0.04, 0); leg.fin.localToWorld(worldPoint);
          if (dt > 0 && bio && d.hasPrevious && night > .01) {
            delta.subVectors(worldPoint, leg.previousTip).divideScalar(dt);
            const tipSpeed = delta.length();
            const strokeShear = Math.max(0, tipSpeed - .3);
            if (strokeShear > .05 && kick > .08) bio.emitBurst(
              worldPoint.x, worldPoint.y, worldPoint.z, delta.x, delta.y, delta.z,
              Math.min(1.4, strokeShear) * night, 3, .025);
          }
          leg.previousTip.copy(worldPoint);
        }
        d.prevPosition.copy(d.root.position); d.hasPrevious = true;
      }
      if (initialPlumePending) {
        divers.forEach((d, index) => seedPlume(time, index));
        initialPlumePending = false;
        bubbleGeo.attributes.position.needsUpdate = true;
        bubbleGeo.attributes.aRadius.needsUpdate = true;
      }
      if (dt > 0) {
        bubbleAccumulator += dt;
        while (bubbleAccumulator >= 1 / 60) {
          stepBubbles(time - bubbleAccumulator, 1 / 60);
          bubbleAccumulator -= 1 / 60;
        }
        for(let i=0;i<bubbleCount;i++)if(radii[i]>0){const p=i*3;
          window.emitDiverBubbleWake(bio,waterUniforms,positions[p],positions[p+1],positions[p+2],
            velocity[p],velocity[p+1],velocity[p+2],radii[i],i,time);
        }
        bubbleGeo.attributes.position.needsUpdate = true;
        bubbleGeo.attributes.aRadius.needsUpdate = true;
      }
    }

    function setVisible(visible) {
      const wasVisible = group.visible;
      group.visible = !!visible;
      if (visible && !wasVisible) initialPlumePending = true;
      if (!visible) {
        radii.fill(0); bubbleAccumulator = 0;
        for (let i = 0; i < bubbleCount; i++) positions[i * 3 + 1] = -999;
        bubbleGeo.attributes.position.needsUpdate = true; bubbleGeo.attributes.aRadius.needsUpdate = true;
        for (const d of divers) { d.breath = 0; d.hasPrevious = false; }
      }
    }
    function dispose() {
      const geometries = new Set(), materials = new Set();
      group.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); if (obj.material) materials.add(obj.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); scene.remove(group);
    }
    return { group, divers, bubbles, update, setVisible, dispose, routeDuration, stations };
  };
})();
