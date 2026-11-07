/* SPDX-License-Identifier: GPL-3.0-only
 * Painted comber (Serranus scriba) demersal predatory fish model.
 * Visual approximation for lower-habitat patrols, not a calibrated ecological simulation.
 */
(() => {
  'use strict';

  function pushOrientedTri(indices, positions, i0, i1, i2, ox, oy, oz) {
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3] - ax, by = positions[i1 * 3 + 1] - ay, bz = positions[i1 * 3 + 2] - az;
    const cx = positions[i2 * 3] - ax, cy = positions[i2 * 3 + 1] - ay, cz = positions[i2 * 3 + 2] - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    if (nx * ox + ny * oy + nz * oz >= 0) {
      indices.push(i0, i1, i2);
    } else {
      indices.push(i0, i2, i1);
    }
  }

  function addFinPrism(positions, colors, indices, spinePts, tipPts, halfThick, baseColor, tipColor) {
    const n = spinePts.length;
    const startIdx = positions.length / 3;
    for (let i = 0; i < n; i++) {
      const s = spinePts[i], t = tipPts[i];
      const mx = (s[0] + t[0]) * 0.5, my = (s[1] + t[1]) * 0.5, mz = (s[2] + t[2]) * 0.5;
      const w = halfThick * (1 - 0.35 * (i / Math.max(1, n - 1)));
      // 0: base+z, 1: base-z, 2: mid+z, 3: mid-z, 4: tip
      positions.push(s[0], s[1], s[2] + w);
      colors.push(baseColor[0], baseColor[1], baseColor[2]);
      positions.push(s[0], s[1], s[2] - w);
      colors.push(baseColor[0], baseColor[1], baseColor[2]);
      positions.push(mx, my, mz + w * 0.55);
      colors.push((baseColor[0] + tipColor[0]) * 0.5, (baseColor[1] + tipColor[1]) * 0.5, (baseColor[2] + tipColor[2]) * 0.5);
      positions.push(mx, my, mz - w * 0.55);
      colors.push((baseColor[0] + tipColor[0]) * 0.5, (baseColor[1] + tipColor[1]) * 0.5, (baseColor[2] + tipColor[2]) * 0.5);
      positions.push(t[0], t[1], t[2]);
      colors.push(tipColor[0], tipColor[1], tipColor[2]);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = startIdx + i * 5, b = a + 5;
      pushOrientedTri(indices, positions, a + 0, b + 0, b + 2, 0, 0, 1);
      pushOrientedTri(indices, positions, a + 0, b + 2, a + 2, 0, 0, 1);
      pushOrientedTri(indices, positions, a + 2, b + 2, b + 4, 0, 0, 1);
      pushOrientedTri(indices, positions, a + 2, b + 4, a + 4, 0, 0, 1);
      pushOrientedTri(indices, positions, a + 1, b + 3, b + 1, 0, 0, -1);
      pushOrientedTri(indices, positions, a + 1, a + 3, b + 3, 0, 0, -1);
      pushOrientedTri(indices, positions, a + 3, b + 4, b + 3, 0, 0, -1);
      pushOrientedTri(indices, positions, a + 3, a + 4, b + 4, 0, 0, -1);
    }
    // Front and back edge caps
    const f = startIdx, l = startIdx + (n - 1) * 5;
    pushOrientedTri(indices, positions, f + 0, f + 2, f + 1, 1, 0, 0);
    pushOrientedTri(indices, positions, f + 1, f + 2, f + 3, 1, 0, 0);
    pushOrientedTri(indices, positions, f + 2, f + 4, f + 3, 1, 0, 0);
    pushOrientedTri(indices, positions, l + 0, l + 1, l + 2, -1, 0, 0);
    pushOrientedTri(indices, positions, l + 1, l + 3, l + 2, -1, 0, 0);
    pushOrientedTri(indices, positions, l + 2, l + 3, l + 4, -1, 0, 0);
  }

  function sampleSerranusColor(x, y, z, h, w) {
    const ny = h > 1e-4 ? y / h : 0;
    const nz = w > 1e-4 ? Math.abs(z) / w : 0;
    // Warm rufous-amber serranid base
    let r = 0.72, g = 0.36, b = 0.21;
    if (ny > 0.25) {
      const d = Math.min(1, (ny - 0.25) / 0.75);
      r = 0.72 - 0.28 * d;
      g = 0.36 - 0.16 * d;
      b = 0.21 - 0.09 * d;
    } else if (ny < -0.15) {
      const v = Math.min(1, (-0.15 - ny) / 0.85);
      r = 0.72 + 0.14 * v;
      g = 0.36 + 0.34 * v;
      b = 0.21 + 0.42 * v;
    }
    // 6 dark vertical bars across the trunk flanks
    if (x > -0.34 && x < 0.28 && ny > -0.55) {
      const bandPhase = Math.sin((x + 0.32) * 61.5);
      if (bandPhase > 0.15) {
        const bar = Math.min(1, (bandPhase - 0.15) / 0.75) * (0.45 + 0.55 * Math.min(1, ny + 0.6));
        r *= 1 - 0.56 * bar;
        g *= 1 - 0.58 * bar;
        b *= 1 - 0.52 * bar;
      }
    }
    // Characteristic bright violet-blue painted belly patch of Serranus scriba
    if (x > -0.16 && x < 0.18 && ny < -0.12 && nz > 0.18) {
      const bx = 1 - Math.abs(x - 0.01) / 0.18;
      const by = Math.min(1, (-0.12 - ny) / 0.65);
      const patch = Math.max(0, bx * by);
      r = r * (1 - 0.65 * patch) + 0.38 * patch;
      g = g * (1 - 0.65 * patch) + 0.54 * patch;
      b = b * (1 - 0.65 * patch) + 0.92 * patch;
    }
    // Vermiculated warm orange-red head and snout markings
    if (x >= 0.22) {
      const headPattern = 0.5 + 0.5 * Math.sin(x * 42 + y * 36 + Math.abs(z) * 28);
      r = r * 0.82 + 0.18 * (0.85 + 0.12 * headPattern);
      g = g * 0.82 + 0.18 * (0.31 + 0.18 * headPattern);
      b = b * 0.82 + 0.18 * 0.16;
    }
    return [r, g, b];
  }

  function buildBodyGeometry(T) {
    // +X is snout forward, +Y is dorsal up, +Z is right/left lateral
    const profile = [
      { x: 0.58, h: 0.016, w: 0.014, y: -0.018 },
      { x: 0.51, h: 0.048, w: 0.040, y: -0.010 },
      { x: 0.40, h: 0.095, w: 0.068, y: 0.002 },
      { x: 0.26, h: 0.142, w: 0.096, y: 0.010 },
      { x: 0.10, h: 0.168, w: 0.112, y: 0.012 },
      { x: -0.06, h: 0.158, w: 0.104, y: 0.008 },
      { x: -0.22, h: 0.122, w: 0.080, y: 0.004 },
      { x: -0.35, h: 0.072, w: 0.046, y: 0.000 },
      { x: -0.44, h: 0.052, w: 0.026, y: 0.000 }
    ];
    const sections=[];
    for(let i=0;i<profile.length-1;i++)for(let j=0;j<6;j++){
      const a=profile[i],b=profile[i+1],t=j/6;
      sections.push({x:a.x+(b.x-a.x)*t,h:a.h+(b.h-a.h)*t,w:a.w+(b.w-a.w)*t,y:a.y+(b.y-a.y)*t});
    }
    sections.push(profile[profile.length-1]);
    const ringSegs = 20;
    const positions = [];
    const colors = [];
    const indices = [];

    // Nose tip vertex (index 0)
    positions.push(0.61, -0.016, 0);
    colors.push(0.62, 0.26, 0.16);

    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      for (let k = 0; k < ringSegs; k++) {
        const theta = (k / ringSegs) * Math.PI * 2;
        const cy = Math.cos(theta);
        const sz = Math.sin(theta);
        const localY = cy * sec.h * (cy < 0 ? 0.92 : 1.0);
        const localZ = sz * sec.w * (1 - 0.12 * cy);
        const px = sec.x;
        const py = sec.y + localY;
        const pz = localZ;
        positions.push(px, py, pz);
        const c = sampleSerranusColor(px, localY, localZ, sec.h, sec.w);
        colors.push(c[0], c[1], c[2]);
      }
    }

    const rearCapIdx = positions.length / 3;
    positions.push(-0.455, 0, 0);
    colors.push(0.64, 0.30, 0.18);

    // Nose fan
    for (let k = 0; k < ringSegs; k++) {
      const i1 = 1 + k;
      const i2 = 1 + ((k + 1) % ringSegs);
      const my = (positions[i1 * 3 + 1] + positions[i2 * 3 + 1]) * 0.5;
      const mz = (positions[i1 * 3 + 2] + positions[i2 * 3 + 2]) * 0.5;
      pushOrientedTri(indices, positions, 0, i1, i2, 0.5, my, mz);
    }

    // Lofted trunk rings
    for (let s = 0; s < sections.length - 1; s++) {
      const r0 = 1 + s * ringSegs;
      const r1 = r0 + ringSegs;
      const cy0 = sections[s].y, cy1 = sections[s + 1].y;
      for (let k = 0; k < ringSegs; k++) {
        const kn = (k + 1) % ringSegs;
        const a = r0 + k, b = r0 + kn, c = r1 + k, d = r1 + kn;
        const oy = ((positions[a * 3 + 1] - cy0) + (positions[d * 3 + 1] - cy1)) * 0.5;
        const oz = (positions[a * 3 + 2] + positions[d * 3 + 2]) * 0.5;
        pushOrientedTri(indices, positions, a, c, d, 0, oy, oz);
        pushOrientedTri(indices, positions, a, d, b, 0, oy, oz);
      }
    }

    // Rear peduncle cap
    const lastRing = 1 + (sections.length - 1) * ringSegs;
    for (let k = 0; k < ringSegs; k++) {
      const i1 = lastRing + k;
      const i2 = lastRing + ((k + 1) % ringSegs);
      const my = (positions[i1 * 3 + 1] + positions[i2 * 3 + 1]) * 0.5;
      const mz = (positions[i1 * 3 + 2] + positions[i2 * 3 + 2]) * 0.5;
      pushOrientedTri(indices, positions, rearCapIdx, i2, i1, -0.5, my, mz);
    }

    // Spiny + soft continuous dorsal fin (finite-volume 3D wedge)
    addFinPrism(
      positions,
      colors,
      indices,
      [
        [0.22, 0.13, 0],
        [0.08, 0.16, 0],
        [-0.06, 0.15, 0],
        [-0.20, 0.12, 0],
        [-0.31, 0.08, 0]
      ],
      [
        [0.19, 0.22, 0],
        [0.05, 0.255, 0],
        [-0.08, 0.235, 0],
        [-0.22, 0.245, 0],
        [-0.34, 0.15, 0]
      ],
      0.012,
      [0.62, 0.28, 0.16],
      [0.88, 0.44, 0.20]
    );

    // Anal fin (finite-volume 3D wedge)
    addFinPrism(
      positions,
      colors,
      indices,
      [
        [-0.08, -0.13, 0],
        [-0.20, -0.105, 0],
        [-0.31, -0.068, 0]
      ],
      [
        [-0.11, -0.205, 0],
        [-0.23, -0.21, 0],
        [-0.34, -0.13, 0]
      ],
      0.010,
      [0.54, 0.36, 0.48],
      [0.86, 0.42, 0.22]
    );

    // Pelvic fins (paired finite-volume ventral wedges)
    for (const sign of [-1, 1]) {
      addFinPrism(
        positions,
        colors,
        indices,
        [
          [0.16, -0.12, sign * 0.032],
          [0.06, -0.135, sign * 0.030]
        ],
        [
          [0.11, -0.215, sign * 0.065],
          [0.00, -0.205, sign * 0.058]
        ],
        0.008,
        [0.44, 0.50, 0.82],
        [0.82, 0.45, 0.24]
      );
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    return geom;
  }

  function buildTailGeometry(T) {
    const positions = [];
    const colors = [];
    const indices = [];
    // Peduncle + truncate-rounded orange-red caudal fin of Serranus scriba
    addFinPrism(
      positions,
      colors,
      indices,
      [
        [0.02, 0.048, 0],
        [0.02, 0.016, 0],
        [0.02, -0.016, 0],
        [0.02, -0.048, 0]
      ],
      [
        [-0.22, 0.125, 0],
        [-0.255, 0.045, 0],
        [-0.255, -0.045, 0],
        [-0.22, -0.125, 0]
      ],
      0.016,
      [0.68, 0.32, 0.18],
      [0.92, 0.44, 0.18]
    );
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    return geom;
  }

  function buildPectoralGeometry(T, side) {
    const positions = [];
    const colors = [];
    const indices = [];
    const zOut = side * 0.135;
    addFinPrism(
      positions,
      colors,
      indices,
      [
        [0.02, 0.022, 0],
        [-0.01, -0.022, 0]
      ],
      [
        [-0.10, 0.042, zOut],
        [-0.12, -0.048, zOut * 0.88]
      ],
      0.007,
      [0.76, 0.38, 0.20],
      [0.94, 0.58, 0.24]
    );
    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    return geom;
  }

  window.createPredatoryFish = function(T, scene, water, environment, schools) {
    const THREE_NS = T || window.THREE;
    const group = new THREE_NS.Group();
    group.name = 'predatoryFishGroup';
    if (scene && typeof scene.add === 'function') {
      scene.add(group);
    }

    const bodyGeom = buildBodyGeometry(THREE_NS);
    const tailGeom = buildTailGeometry(THREE_NS);
    const leftPecGeom = buildPectoralGeometry(THREE_NS, 1);
    const rightPecGeom = buildPectoralGeometry(THREE_NS, -1);
    const eyeOuterGeom = new THREE_NS.SphereGeometry(0.022, 8, 6);
    const eyePupilGeom = new THREE_NS.SphereGeometry(0.013, 8, 6);

    const bodyMat = new THREE_NS.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.54,
      metalness: 0.06
    });
    const eyeIrisMat = new THREE_NS.MeshStandardMaterial({
      color: 0xe89b28,
      roughness: 0.3,
      metalness: 0.1
    });
    const eyePupilMat = new THREE_NS.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.15,
      metalness: 0.2
    });

    const waypoints = [
      [
        [-7.5, -13.5],
        [-21.0, -14.0],
        [-29.0, -18.0],
        [-30.0, -27.0],
        [-21.0, -14.0],
        [-2.0, -9.5],
        [4.5, -5.0],
        [8.5, 1.5],
        [1.5, 5.5],
        [-8.5, -2.5],
        [-12.0, -10.5]
      ],
      [
        [5.5, -4.5],
        [-1.5, 3.5],
        [-10.5, 1.0],
        [-11.0, -11.5],
        [-4.0, -14.5],
        [6.5, -10.0],
        [9.5, -1.0]
      ]
    ];

    function getFloorY(x, z) {
      if (environment && typeof environment.floor === 'function') {
        return environment.floor(x, z);
      }
      return -24;
    }

    function hasHabitat() {
      if (environment && typeof environment.hasHabitat === 'function') {
        return !!environment.hasHabitat();
      }
      return true;
    }

    function getSchoolsList() {
      if (Array.isArray(schools)) return schools;
      if (schools && Array.isArray(schools.schools)) return schools.schools;
      return [];
    }

    function nextRandom(animal) {
      animal.seed = (1664525 * animal.seed + 1013904223) >>> 0;
      return animal.seed / 4294967296;
    }

    function createAnimal(index) {
      const root = new THREE_NS.Group();
      root.name = 'serranusScriba_' + index;
      root.rotation.order = 'YXZ';
      root.userData = { grabbed: false, species: 'Serranus scriba', index };

      // Visual model faces +X; orient mesh holder inside root or use yawDirectly
      const bodyMesh = new THREE_NS.Mesh(bodyGeom, bodyMat);
      bodyMesh.name = 'body';
      root.add(bodyMesh);

      const tailPivot = new THREE_NS.Group();
      tailPivot.name = 'tailPivot';
      tailPivot.position.set(-0.43, 0, 0);
      const tailMesh = new THREE_NS.Mesh(tailGeom, bodyMat);
      tailMesh.name = 'tailFin';
      tailPivot.add(tailMesh);
      root.add(tailPivot);

      const leftPecPivot = new THREE_NS.Group();
      leftPecPivot.name = 'leftPectoral';
      leftPecPivot.position.set(0.18, -0.035, 0.095);
      leftPecPivot.add(new THREE_NS.Mesh(leftPecGeom, bodyMat));
      root.add(leftPecPivot);

      const rightPecPivot = new THREE_NS.Group();
      rightPecPivot.name = 'rightPectoral';
      rightPecPivot.position.set(0.18, -0.035, -0.095);
      rightPecPivot.add(new THREE_NS.Mesh(rightPecGeom, bodyMat));
      root.add(rightPecPivot);

      for (const side of [-1, 1]) {
        const iris = new THREE_NS.Mesh(eyeOuterGeom, eyeIrisMat);
        iris.name = side > 0 ? 'leftEye' : 'rightEye';
        iris.position.set(0.39, 0.038, side * 0.058);
        root.add(iris);
        const pupil = new THREE_NS.Mesh(eyePupilGeom, eyePupilMat);
        pupil.name = side > 0 ? 'leftPupil' : 'rightPupil';
        pupil.position.set(0.402, 0.040, side * 0.069);
        root.add(pupil);
      }

      const route = waypoints[index % waypoints.length];
      const startWp = route[0];
      const nextWp = route[1];
      const floorY = getFloorY(startWp[0], startWp[1]);
      const startY = floorY + (index === 0 ? 2.4 : 3.1);
      root.position.set(startWp[0], startY, startWp[1]);

      const initialYaw = Math.atan2(nextWp[1] - startWp[1], nextWp[0] - startWp[0]);
      const initialSpeed = 0.82;
      const velocity = new THREE_NS.Vector3(
        Math.cos(initialYaw) * initialSpeed,
        0,
        Math.sin(initialYaw) * initialSpeed
      );

      root.rotation.set(0, -initialYaw, 0);
      group.add(root);

      const animal = {
        root,
        velocity,
        radius: 0.85,
        mode: 'patrol',
        state: 'patrol',
        species: 'Serranus scriba',
        index,
        seed: ((index + 1) * 747796405) >>> 0,
        route,
        waypointIndex: 1,
        target: new THREE_NS.Vector3(nextWp[0], floorY + 2.6, nextWp[1]),
        yaw: initialYaw,
        turnRate: 0,
        pitch: 0,
        roll: 0,
        speed: initialSpeed,
        tailPhase: index * 1.9,
        tailAngle: 0,
        pectoralPhase: index * 1.1,
        stateTimer: 8 + index * 3.5,
        approachCooldown: 6 + index * 5,
        hoverClearance: index === 0 ? 2.4 : 3.0,
        tailPivot,
        leftPecPivot,
        rightPecPivot
      };
      root.userData.animal = animal;
      return animal;
    }

    const pool = [createAnimal(0), createAnimal(1)];
    const animals = [pool[0]];
    let activeCount = 1;
    let userVisible = true;
    let lastGroupVisible = true;
    let lastTime = 0;

    const steerVec = new THREE_NS.Vector3();
    const flowVec = new THREE_NS.Vector3();
    const desiredDir = new THREE_NS.Vector3();
    const diffVec = new THREE_NS.Vector3();
    const collisionVel = new THREE_NS.Vector3();

    function syncVisibilityAndCount() {
      const hab = hasHabitat();
      const effectiveVisible = userVisible && hab;
      group.visible = effectiveVisible;
      lastGroupVisible = group.visible;
      animals.length = 0;
      for (let i = 0; i < pool.length; i++) {
        const active = i < activeCount;
        pool[i].root.visible = effectiveVisible && active;
        if (active) {
          animals.push(pool[i]);
        }
      }
    }

    syncVisibilityAndCount();

    function pickNextPatrolTarget(animal) {
      animal.waypointIndex = (animal.waypointIndex + 1) % animal.route.length;
      const wp = animal.route[animal.waypointIndex];
      const jx = (nextRandom(animal) - 0.5) * 2.4;
      const jz = (nextRandom(animal) - 0.5) * 2.4;
      const tx = THREE_NS.MathUtils.clamp(wp[0] + jx, -33.5, 11.5);
      const tz = THREE_NS.MathUtils.clamp(wp[1] + jz, -38.5, 7.5);
      const fy = getFloorY(tx, tz);
      animal.hoverClearance = 1.6 + nextRandom(animal) * 2.6;
      animal.target.set(tx, fy + animal.hoverClearance, tz);
    }

    function isSchoolInChaseBounds(s) {
      if (!s || !s.center) return false;
      if (typeof s.members === 'number' && s.members < 4) return false;
      const cx = s.center.x;
      const cy = s.center.y;
      const cz = s.center.z;
      if (cx < -34 || cx > 14 || cz < -39 || cz > 10) return false;
      if(cx>-19&&cx<15&&cz<-17&&cz>-32&&cy<-8)return false;
      const fy = getFloorY(cx, cz);
      return cy >= fy + 0.6 && cy <= fy + 12.0;
    }

    function canReachSchool(animal, s, isPrimary) {
      if (!isSchoolInChaseBounds(s)) return false;
      const p = animal.root.position;
      const dx = s.center.x - p.x;
      const dy = s.center.y - p.y;
      const dz = s.center.z - p.z;
      const horizDist = Math.hypot(dx, dz);
      if (horizDist > 23.5 || Math.abs(dy) > 8.2) return false;
      if (!isPrimary && dy > 3.2) {
        // High school (school0): require sufficient horizontal run for a smooth bounded-pitch climb
        if (dy > 7.6 || horizDist < Math.min(4.2, dy * 0.65)) return false;
      }
      return true;
    }

    function updateChaseTarget(animal, s, isBurst) {
      const p = animal.root.position;
      const cx = s.center.x;
      const cy = s.center.y;
      const cz = s.center.z;
      const vx = s.velocity ? s.velocity.x : 0;
      const vy = s.velocity ? s.velocity.y : 0;
      const vz = s.velocity ? s.velocity.z : 0;
      const dx = cx - p.x;
      const dz = cz - p.z;
      const horizDist = Math.hypot(dx, dz);

      let tx = cx + vx * 0.25;
      let tz = cz + vz * 0.25;

      if (isBurst) {
        // Drive smoothly through the live school center during the brief chase
        const dirX = horizDist > 0.6 ? dx / horizDist : Math.cos(animal.yaw);
        const dirZ = horizDist > 0.6 ? dz / horizDist : Math.sin(animal.yaw);
        const lead = horizDist < 1.6 ? 1.6 - horizDist * 0.5 : 0.45;
        tx += dirX * lead;
        tz += dirZ * lead;
      } else if (horizDist > 2.8) {
        // Slight flank curve while far, tightening directly to the live center within ~2m
        const baseAngle = Math.atan2(-dz, -dx) + (animal.index === 0 ? 0.35 : -0.35);
        const flank = Math.min(1.1, (horizDist - 2.0) * 0.16);
        tx += Math.cos(baseAngle) * flank;
        tz += Math.sin(baseAngle) * flank;
      }

      tx = THREE_NS.MathUtils.clamp(tx, -33.5, 13.5);
      tz = THREE_NS.MathUtils.clamp(tz, -38.5, 9.6);
      const fy = getFloorY(tx, tz);
      const ty = THREE_NS.MathUtils.clamp(cy + vy * 0.2, fy + 1.35, fy + 11.5);
      animal.hoverClearance = THREE_NS.MathUtils.clamp(ty - fy, 1.5, 4.4);
      animal.target.set(tx, ty, tz);
    }

    function pickRetreatTarget(animal, avoidSchool) {
      const list = getSchoolsList();
      const refSchool = (avoidSchool && avoidSchool.center) ? avoidSchool : (list[2] && list[2].center ? list[2] : (list[0] && list[0].center ? list[0] : null));
      if (!refSchool || !refSchool.center) {
        pickNextPatrolTarget(animal);
        return;
      }
      const sx = refSchool.center.x;
      const sz = refSchool.center.z;
      const p = animal.root.position;
      let awayX = p.x - sx;
      let awayZ = p.z - sz;
      if (Math.hypot(awayX, awayZ) < 0.5) {
        awayX = -1.5 - sx;
        awayZ = -4.0 - sz;
      }
      const baseAngle = Math.atan2(awayZ, awayX);
      let bestX = THREE_NS.MathUtils.clamp(sx + Math.cos(baseAngle) * 8.5, -14.5, 11.5);
      let bestZ = THREE_NS.MathUtils.clamp(sz + Math.sin(baseAngle) * 8.5, -15.5, 7.5);
      let bestDist = Math.hypot(bestX - sx, bestZ - sz);

      for (let k = 0; k < 6; k++) {
        const ang = baseAngle + (k - 2.5) * 0.55 + (nextRandom(animal) - 0.5) * 0.25;
        const dist = 7.5 + nextRandom(animal) * 4.5;
        const cx = THREE_NS.MathUtils.clamp(sx + Math.cos(ang) * dist, -14.5, 11.5);
        const cz = THREE_NS.MathUtils.clamp(sz + Math.sin(ang) * dist, -15.5, 7.5);
        const d = Math.hypot(cx - sx, cz - sz);
        if (d > bestDist) {
          bestDist = d;
          bestX = cx;
          bestZ = cz;
          if (d >= 7.2) break;
        }
      }

      if (bestDist < 6.0) {
        const cornersX = [-12.0, 9.0, -12.0, 9.0];
        const cornersZ = [-13.0, -13.0, 5.0, 5.0];
        for (let k = 0; k < 4; k++) {
          const cx = cornersX[k] + (nextRandom(animal) - 0.5) * 2.0;
          const cz = cornersZ[k] + (nextRandom(animal) - 0.5) * 2.0;
          const d = Math.hypot(cx - sx, cz - sz);
          if (d > bestDist) {
            bestDist = d;
            bestX = cx;
            bestZ = cz;
          }
        }
      }

      const fy = getFloorY(bestX, bestZ);
      const clearance = 1.6 + nextRandom(animal) * 2.6;
      animal.hoverClearance = clearance;
      animal.target.set(bestX, fy + clearance, bestZ);
    }

    function startRetreat(animal) {
      const prevSchool = animal.targetSchool || null;
      animal.mode = 'retreat';
      animal.state = 'retreat';
      const dur = 10 + nextRandom(animal) * 6;
      animal.stateTimer = dur;
      animal.approachCooldown = Math.max(animal.approachCooldown, dur);
      animal.targetSchool = null;
      pickRetreatTarget(animal, prevSchool);
    }

    function tryFindApproachTarget(animal) {
      const list = getSchoolsList();
      if (!list.length) return false;
      // School 2 is primary; school 0 is secondary and only chosen if reachable with a smooth climb
      const s2 = list[2];
      const s0 = list[0];
      let bestSchool = null;
      if (canReachSchool(animal, s2, true)) {
        bestSchool = s2;
      } else if (canReachSchool(animal, s0, false)) {
        bestSchool = s0;
      } else {
        for (let i = 0; i < list.length; i++) {
          if (i === 2 || i === 0) continue;
          if (canReachSchool(animal, list[i], false)) {
            bestSchool = list[i];
            break;
          }
        }
      }
      if (!bestSchool) return false;
      animal.targetSchool = bestSchool;
      updateChaseTarget(animal, bestSchool, false);
      return true;
    }

    function startApproach(animal) {
      animal.mode = 'approach';
      animal.state = 'approach';
      animal.stateTimer = 16 + nextRandom(animal) * 8;
      animal.approachCooldown = 12 + nextRandom(animal) * 6;
    }

    function updateAnimal(animal, dt, time, threats) {
      const root = animal.root;
      const p = root.position;

      if (root.userData && root.userData.grabbed) {
        animal.mode = 'held';
        animal.state = 'held';
        animal.targetSchool = null;
        animal.velocity.multiplyScalar(Math.exp(-dt * 6));
        animal.tailPhase = (animal.tailPhase + dt * 2.2) % (Math.PI * 2);
        animal.tailAngle = Math.sin(animal.tailPhase) * 0.08;
        animal.tailPivot.rotation.y = animal.tailAngle;
        if (typeof root.userData.applyInteraction === 'function') {
          root.userData.applyInteraction(time);
        }
        return;
      }

      if (animal.mode === 'held') {
        animal.mode = 'patrol';
        animal.state = 'patrol';
        animal.targetSchool = null;
        animal.speed = THREE_NS.MathUtils.clamp(animal.speed, 0.20, 1.15);
        pickNextPatrolTarget(animal);
        animal.stateTimer = 8 + nextRandom(animal) * 6;
      }

      animal.stateTimer -= dt;
      animal.approachCooldown = Math.max(0, animal.approachCooldown - dt);

      const distToTargetSq = (animal.target.x - p.x) * (animal.target.x - p.x) + (animal.target.z - p.z) * (animal.target.z - p.z);

      if (animal.mode === 'patrol') {
        if (distToTargetSq < 3.2 || animal.stateTimer <= 0) {
          if (animal.approachCooldown <= 0 && tryFindApproachTarget(animal)) {
            startApproach(animal);
          } else if (nextRandom(animal) < 0.42) {
            animal.mode = 'glide';
            animal.state = 'glide';
            animal.stateTimer = 1.6 + nextRandom(animal) * 1.6;
          } else {
            pickNextPatrolTarget(animal);
            animal.stateTimer = 8 + nextRandom(animal) * 6;
          }
        }
      } else if (animal.mode === 'glide') {
        if (animal.stateTimer <= 0) {
          if (animal.approachCooldown <= 0 && tryFindApproachTarget(animal)) {
            startApproach(animal);
          } else {
            animal.mode = 'patrol';
            animal.state = 'patrol';
            pickNextPatrolTarget(animal);
            animal.stateTimer = 8 + nextRandom(animal) * 6;
          }
        }
      } else if (animal.mode === 'approach') {
        if (!isSchoolInChaseBounds(animal.targetSchool)) {
          if (!tryFindApproachTarget(animal)) {
            startRetreat(animal);
          }
        }
        if (animal.mode === 'approach' && animal.targetSchool) {
          const s = animal.targetSchool;
          updateChaseTarget(animal, s, false);
          const distToSchool = p.distanceTo(s.center);
          if (distToSchool <= 2.15) {
            animal.mode = 'burst';
            animal.state = 'burst';
            animal.stateTimer = 2.0 + nextRandom(animal) * 1.0;
            animal.burstSpeed = 2.55 + nextRandom(animal) * 0.60;
            updateChaseTarget(animal, s, true);
          } else if (animal.stateTimer <= 0) {
            // Approach timed out without reaching prey: give up without bursting
            startRetreat(animal);
          }
        }
      } else if (animal.mode === 'burst') {
        if (animal.stateTimer <= 0 || !isSchoolInChaseBounds(animal.targetSchool)) {
          startRetreat(animal);
        } else {
          updateChaseTarget(animal, animal.targetSchool, true);
        }
      } else if (animal.mode === 'retreat') {
        if (animal.stateTimer <= 0) {
          animal.mode = 'patrol';
          animal.state = 'patrol';
          pickNextPatrolTarget(animal);
          animal.stateTimer = 7 + nextRandom(animal) * 5;
        } else if (distToTargetSq < 3.2) {
          pickRetreatTarget(animal, null);
        }
      } else {
        animal.mode = 'patrol';
        animal.state = 'patrol';
        pickNextPatrolTarget(animal);
        animal.stateTimer = 8 + nextRandom(animal) * 6;
      }

      const isChasing = animal.mode === 'approach' || animal.mode === 'burst';
      const floorY = getFloorY(p.x, p.z);
      const patrolY = floorY + THREE_NS.MathUtils.clamp(animal.hoverClearance + Math.sin(time * 0.45 + animal.index * 1.7) * 0.25, 1.35, 4.45);
      const desiredY = isChasing ? Math.max(floorY + 1.35, animal.target.y) : patrolY;
      let navX=animal.target.x,navZ=animal.target.z;
      // Travel through the open left/front corner rather than cutting through the wreck.
      if(p.y<-8&&desiredY<-8){
        if(navZ<-17&&navX<-19&&p.x>-19){navX=-21;navZ=-14;}
        else if(p.z<-17&&p.x<-19&&navX>-19){navX=-21;navZ=-14;}
      }
      desiredDir.set(navX - p.x, (desiredY - p.y) * (isChasing ? 1.55 : 1.35), navZ - p.z);
      const horizLen = Math.hypot(desiredDir.x, desiredDir.z);
      if (horizLen > 1e-4) {
        desiredDir.x /= horizLen;
        desiredDir.z /= horizLen;
      } else {
        desiredDir.x = Math.cos(animal.yaw);
        desiredDir.z = Math.sin(animal.yaw);
      }

      // Broad foreground/left corridor bounds; the wreck-corner detour above
      // keeps routes toward the reef and truck outside the ship.
      const minZ = -38.5;
      const maxZ = isChasing ? 9.6 : 7.2;
      const minX = -33.5;
      const maxX = isChasing ? 12.6 : 11.2;
      if (p.z < minZ) desiredDir.z += (minZ - p.z) * 0.75;
      if (p.z > maxZ) desiredDir.z -= (p.z - maxZ) * 0.65;
      if (p.x < minX) desiredDir.x += (minX - p.x) * 0.60;
      if (p.x > maxX) desiredDir.x -= (p.x - maxX) * 0.60;

      // Environment obstacle steering
      if (environment && typeof environment.steer === 'function') {
        environment.steer(p, animal.velocity, animal.radius, steerVec);
        desiredDir.addScaledVector(steerVec, 1.35);
      }

      // Personal space between predator instances
      for (let j = 0; j < activeCount; j++) {
        const other = pool[j];
        if (other === animal || !other.root.visible) continue;
        diffVec.subVectors(p, other.root.position);
        const d = diffVec.length();
        if (d < 4.5 && d > 1e-3) {
          desiredDir.addScaledVector(diffVec, (1 - d / 4.5) * 1.4 / d);
        }
      }

      // Avoid larger threats (sharks / divers)
      if (Array.isArray(threats)) {
        for (const t of threats) {
          if (!t || !t.p || t.p === p || t.kind === 'predator') continue;
          diffVec.subVectors(p, t.p);
          const d = diffVec.length();
          const range = (t.radius || 1.5) + 4.5;
          if (d < range && d > 1e-3) {
            desiredDir.addScaledVector(diffVec, (1 - d / range) * 1.8 / d);
          }
        }
      }

      // Maintain seabed clearance; allow rising above the 5m seabed band during approach/burst
      const minFloorY = floorY + 1.25;
      const maxFloorY = isChasing ? Math.max(floorY + 4.65, desiredY + 1.5) : floorY + 4.65;
      if (p.y < minFloorY) desiredDir.y += (minFloorY - p.y) * 1.8;
      if (p.y > maxFloorY) desiredDir.y -= (p.y - maxFloorY) * 1.8;

      const targetYaw = Math.atan2(desiredDir.z, desiredDir.x);
      const yawError = Math.atan2(Math.sin(targetYaw - animal.yaw), Math.cos(targetYaw - animal.yaw));
      const maxYawRate = animal.mode === 'glide' ? 0.75 : animal.mode === 'burst' ? 2.1 : animal.mode === 'approach' ? 1.85 : 1.35;
      const desiredTurn = THREE_NS.MathUtils.clamp(yawError * 1.55, -maxYawRate, maxYawRate);
      const maxTurnAccel = animal.mode === 'burst' ? 3.6 : 2.8;
      animal.turnRate += THREE_NS.MathUtils.clamp(desiredTurn - animal.turnRate, -maxTurnAccel * dt, maxTurnAccel * dt);
      animal.yaw += animal.turnRate * dt;

      const maxPitch = isChasing ? 0.36 : 0.26;
      const pitchRate = isChasing ? 1.25 : 0.85;
      const desiredPitch = THREE_NS.MathUtils.clamp(
        Math.atan2(desiredDir.y, Math.max(0.25, Math.hypot(desiredDir.x, desiredDir.z))),
        -maxPitch,
        maxPitch
      );
      animal.pitch += THREE_NS.MathUtils.clamp(desiredPitch - animal.pitch, -pitchRate * dt, pitchRate * dt);

      let baseTargetSpeed = 0.86;
      if (animal.mode === 'glide') {
        baseTargetSpeed = 0.28;
      } else if (animal.mode === 'approach') {
        baseTargetSpeed = 1.35;
      } else if (animal.mode === 'burst') {
        baseTargetSpeed = animal.burstSpeed || 2.85;
      } else if (animal.mode === 'retreat') {
        baseTargetSpeed = 0.96;
      }
      const slowdownFactor = animal.mode === 'burst' ? 0.06 : 0.22;
      const turnSlowdown = 1 - slowdownFactor * Math.min(1, Math.abs(yawError));
      const minTargetSpeed = animal.mode === 'burst' ? 2.5 : 0.22;
      const maxTargetSpeed = animal.mode === 'burst' ? 3.2 : 1.38;
      const targetSpeed = THREE_NS.MathUtils.clamp(baseTargetSpeed * turnSlowdown, minTargetSpeed, maxTargetSpeed);
      const maxAccel = animal.mode === 'glide' ? 0.65 : animal.mode === 'burst' ? 2.4 : animal.mode === 'retreat' ? 2.2 : 1.35;
      animal.speed += THREE_NS.MathUtils.clamp(targetSpeed - animal.speed, -maxAccel * dt, maxAccel * dt);
      const maxAllowedSpeed = (animal.mode === 'burst' || animal.mode === 'retreat') ? 3.2 : 1.38;
      animal.speed = THREE_NS.MathUtils.clamp(animal.speed, 0.20, maxAllowedSpeed);

      const cosPitch = Math.cos(animal.pitch);
      animal.velocity.set(
        Math.cos(animal.yaw) * cosPitch * animal.speed,
        Math.sin(animal.pitch) * animal.speed,
        Math.sin(animal.yaw) * cosPitch * animal.speed
      );

      flowVec.set(0, 0, 0);
      if (environment && typeof environment.current === 'function') {
        environment.current(p, time, flowVec);
      }
      p.addScaledVector(animal.velocity, dt).addScaledVector(flowVec, dt * 0.22);

      if (environment && typeof environment.constrain === 'function') {
        collisionVel.copy(animal.velocity);
        environment.constrain(p, animal.radius, collisionVel, Infinity);
      }

      // Return to patrol depth through steering, including after a user drag.
      // Clamping depth here would teleport a released fish back to the seabed.

      const actualSpeed = animal.velocity.length();
      animal.roll += (THREE_NS.MathUtils.clamp(-animal.turnRate * 0.22, -0.28, 0.28) - animal.roll) * (1 - Math.exp(-dt * 5));
      // Orient root (+X snout model rotated by -yaw around Y, pitch around Z, roll around X)
      root.rotation.set(animal.roll, -animal.yaw, animal.pitch);

      // Tail and pectoral fin animation strictly tied to actual speed
      const tailFreq = 2.0 + actualSpeed * 7.2;
      animal.tailPhase = (animal.tailPhase + dt * tailFreq) % (Math.PI * 2);
      const tailAmp = 0.06 + Math.min(0.28, actualSpeed * 0.19);
      animal.tailAngle = Math.sin(animal.tailPhase) * tailAmp;
      animal.tailPivot.rotation.y = animal.tailAngle;

      animal.pectoralPhase = (animal.pectoralPhase + dt * (3.2 + (1.4 - Math.min(1.2, actualSpeed)) * 2.5)) % (Math.PI * 2);
      const pecSweep = (animal.mode === 'glide' ? 0.26 : 0.14) * Math.sin(animal.pectoralPhase);
      animal.leftPecPivot.rotation.y = -0.18 + pecSweep;
      animal.rightPecPivot.rotation.y = 0.18 - pecSweep;

      if (root.userData && typeof root.userData.applyInteraction === 'function') {
        root.userData.applyInteraction(time);
      }
    }

    return {
      group,
      animals,
      pool,
      setVisible(bool) {
        userVisible = !!bool;
        syncVisibilityAndCount();
      },
      setDensity(value, quality = 1) {
        const q = typeof quality === 'number' && Number.isFinite(quality) && quality > 0 ? quality : 1;
        if (value === undefined || value === null) {
          activeCount = 1;
        } else {
          const v = Number(value);
          if (!Number.isFinite(v) || v <= 0) {
            activeCount = 0;
          } else if (v > .72 && q > .8) {
            activeCount = 2;
          } else {
            activeCount = 1;
          }
        }
        syncVisibilityAndCount();
      },
      update(time, threats = []) {
        if (group.visible !== lastGroupVisible) {
          userVisible = group.visible;
        }
        syncVisibilityAndCount();
        if (!Number.isFinite(time) || time <= 0) {
          lastTime = 0;
          return;
        }
        if (!group.visible || activeCount === 0) {
          lastTime = time;
          return;
        }
        const rawDt = time - lastTime;
        lastTime = time;
        if (rawDt <= 0) return;
        const dt = Math.min(0.1, rawDt);
        for (let i = 0; i < activeCount; i++) {
          updateAnimal(pool[i], dt, time, threats);
        }
      }
    };
  };
})();
