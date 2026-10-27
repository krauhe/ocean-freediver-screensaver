/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian R. Harreby. See LICENSE for terms.
 * Deep freediving competition rig with primary CWT monofin freediver and
 * bi-fin safety escort diver along a 36-metre competition dive rope.
 */
(() => {
  'use strict';

  // Helper smoothstep
  function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  }

  function fract(x) {
    return x - Math.floor(x);
  }

  function hash2(px, py) {
    return fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453123);
  }

  // Preallocated working array for noiseGradient
  const noiseGradOut = [0, 0, 0];
  function noiseGradient(px, py, out) {
    const cellX = Math.floor(px), cellY = Math.floor(py);
    const fx = px - cellX, fy = py - cellY;
    const ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
    const uy = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);
    const dux = 30.0 * fx * fx * (fx * (fx - 2.0) + 1.0);
    const duy = 30.0 * fy * fy * (fy * (fy - 2.0) + 1.0);
    const a = hash2(cellX, cellY);
    const b = hash2(cellX + 1.0, cellY);
    const c = hash2(cellX, cellY + 1.0);
    const d = hash2(cellX + 1.0, cellY + 1.0);
    const crossTerm = a - b - c + d;
    out[0] = a + (b - a) * ux + (c - a) * uy + crossTerm * ux * uy;
    out[1] = dux * ((b - a) + crossTerm * uy);
    out[2] = duy * ((c - a) + crossTerm * ux);
  }

  // Precomputed wave train constants matching ocean.js exactly
  const WAVE_TRAINS = [];
  for (let i = 0; i < 10; i++) {
    const seed = i;
    const angle = hash2(seed, 12.71) * 6.283185307179586;
    const hx = Math.cos(angle);
    const hz = Math.sin(angle);
    const freq = 0.38 * Math.pow(1.53, seed) * (1.0 + hash2(seed, 3.83) * 0.18);
    const amp = 0.76 * Math.pow(0.54, seed);
    const omega = Math.sqrt(9.81 * freq) * 0.18;
    const pOffset = hash2(seed, 5.19) * 6.283185307179586;
    WAVE_TRAINS.push({ hx, hz, freq, amp, omega, pOffset });
  }

  // Exact 10-wave field + Gerstner horizontal surge evaluator
  function evalWaveField(px, pz, t, out) {
    noiseGradient(px * 0.037 + t * 0.005, pz * 0.037 - t * 0.003, noiseGradOut);
    const envelope = 0.68 + noiseGradOut[0] * 0.32;
    const envGradX = noiseGradOut[1] * 0.037 * 0.32;
    const envGradZ = noiseGradOut[2] * 0.037 * 0.32;

    let fieldX = 0.0;
    let slopeX = 0.0, slopeZ = 0.0;
    let surgeX = 0.0, surgeZ = 0.0;

    for (let i = 0; i < 10; i++) {
      const w = WAVE_TRAINS[i];
      const phase = (px * w.hx + pz * w.hz) * w.freq - w.omega * t + w.pOffset;
      const sinP = Math.sin(phase);
      const cosP = Math.cos(phase);
      fieldX += w.amp * sinP;
      const slopeFact = w.amp * cosP * w.freq;
      slopeX += slopeFact * w.hx;
      slopeZ += slopeFact * w.hz;

      // Gerstner orbital horizontal surge
      surgeX -= w.hx * w.amp * cosP;
      surgeZ -= w.hz * w.amp * cosP;
    }

    out.y = fieldX * envelope;
    out.x = surgeX * envelope;
    out.z = surgeZ * envelope;
    out.slopeX = slopeX * envelope + fieldX * envGradX;
    out.slopeZ = slopeZ * envelope + fieldX * envGradZ;
  }

  // Cross-section stations along diver longitudinal axis (y in [-0.88, +0.85])
  const STATIONS = [
    { y: -0.88, rX: 0.055, rZ: 0.075, cX: -0.010 }, // Ankles
    { y: -0.68, rX: 0.072, rZ: 0.095, cX: -0.018 }, // Calves
    { y: -0.48, rX: 0.068, rZ: 0.092, cX:  0.005 }, // Knees
    { y: -0.26, rX: 0.095, rZ: 0.125, cX:  0.010 }, // Thighs
    { y: -0.06, rX: 0.112, rZ: 0.148, cX: -0.022 }, // Hips / buttocks
    { y:  0.14, rX: 0.092, rZ: 0.132, cX:  0.008 }, // Waist
    { y:  0.38, rX: 0.122, rZ: 0.168, cX:  0.024 }, // Chest
    { y:  0.54, rX: 0.105, rZ: 0.185, cX:  0.005 }, // Shoulders
    { y:  0.63, rX: 0.062, rZ: 0.065, cX:  0.012 }, // Neck
    { y:  0.75, rX: 0.102, rZ: 0.088, cX:  0.022 }, // Head & neoprene hood
    { y:  0.85, rX: 0.015, rZ: 0.015, cX:  0.015 }  // Crown
  ];

  function evalStation(y) {
    if (y <= STATIONS[0].y) return STATIONS[0];
    const last = STATIONS[STATIONS.length - 1];
    if (y >= last.y) return last;
    for (let i = 0; i < STATIONS.length - 1; i++) {
      const s0 = STATIONS[i], s1 = STATIONS[i + 1];
      if (y >= s0.y && y <= s1.y) {
        const u = (y - s0.y) / (s1.y - s0.y);
        const t = u * u * (3 - 2 * u);
        return {
          y: y,
          rX: s0.rX + (s1.rX - s0.rX) * t,
          rZ: s0.rZ + (s1.rZ - s0.rZ) * t,
          cX: s0.cX + (s1.cX - s0.cX) * t
        };
      }
    }
    return last;
  }

  // ---------------------------------------------------------------------------
  // Geometry Builder: Main Diver (Fused Legs + Monofin + Streamline Arms)
  // ---------------------------------------------------------------------------
  function buildMainDiverGeometry(T) {
    const positions = [];
    const uvs = [];
    const armWeights = [];
    const kickWeights = [];
    const bladeFlexes = [];
    const legSides = [];
    const indices = [];

    function addV(x, y, z, u, v, armW, kickW, flex, legS) {
      const idx = positions.length / 3;
      positions.push(x, y, z);
      uvs.push(u, v);
      armWeights.push(armW);
      kickWeights.push(kickW);
      bladeFlexes.push(flex);
      legSides.push(legS);
      return idx;
    }

    // 1. Torso, Head & Hood (44 longitudinal stations x 20 circumferential segments)
    const T_ROWS = 44, T_COLS = 20;
    const torsoGrid = [];
    for (let i = 0; i < T_ROWS; i++) {
      const row = [];
      const y = -0.88 + (i / (T_ROWS - 1)) * (0.85 - (-0.88));
      const st = evalStation(y);
      const vCoord = i / (T_ROWS - 1);
      const kickW = (y >= 0.25) ? 0.0 : Math.pow((0.25 - y) / (0.25 - (-0.88)), 1.4) * 0.65;

      for (let j = 0; j < T_COLS; j++) {
        const phi = (j / T_COLS) * Math.PI * 2;
        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        let px = st.cX + st.rX * cosP;
        let py = y;
        let pz = st.rZ * sinP;

        if (y >= 0.70 && y <= 0.77 && cosP > 0.2) {
          const m = Math.sin((y - 0.70) / 0.07 * Math.PI) * cosP * cosP;
          px += 0.025 * m;
          pz *= (1.0 + 0.15 * m);
        }

        row.push(addV(px, py, pz, j / T_COLS, vCoord, 0.0, kickW, 0.0, 0.0));
      }
      torsoGrid.push(row);
    }

    for (let i = 0; i < T_ROWS - 1; i++) {
      for (let j = 0; j < T_COLS; j++) {
        const nextJ = (j + 1) % T_COLS;
        const v0 = torsoGrid[i][j];
        const v1 = torsoGrid[i + 1][j];
        const v2 = torsoGrid[i + 1][nextJ];
        const v3 = torsoGrid[i][nextJ];
        indices.push(v0, v1, v2);
        indices.push(v0, v2, v3);
      }
    }

    // Crown apex cap
    const stCrown = evalStation(0.85);
    const crownApex = addV(stCrown.cX, 0.85, 0.0, 0.5, 1.0, 0.0, 0.0, 0.0, 0.0);
    for (let j = 0; j < T_COLS; j++) {
      const nextJ = (j + 1) % T_COLS;
      indices.push(torsoGrid[T_ROWS - 1][j], crownApex, torsoGrid[T_ROWS - 1][nextJ]);
    }

    // 2. Streamline Arms (Left: side = -1, Right: side = +1)
    const A_ROWS = 16, A_COLS = 8;
    for (let side = -1; side <= 1; side += 2) {
      const armGrid = [];
      for (let r = 0; r < A_ROWS; r++) {
        const armRow = [];
        const s = r / (A_ROWS - 1);
        const yArm = 0.52 + s * (1.28 - 0.52);
        const xArm = 0.005 + s * 0.025 + Math.sin(s * Math.PI) * 0.012;
        const zArm = side * (0.11 * (1.0 - s) + 0.018 * s);
        const rArm = 0.040 * (1.0 - s * 0.55);

        for (let c = 0; c < A_COLS; c++) {
          const a = (c / A_COLS) * Math.PI * 2;
          const px = xArm + rArm * Math.cos(a);
          const py = yArm;
          const pz = zArm + rArm * Math.sin(a);
          armRow.push(addV(px, py, pz, c / A_COLS, s, s, 0.0, 0.0, 0.0));
        }
        armGrid.push(armRow);
      }

      for (let r = 0; r < A_ROWS - 1; r++) {
        for (let c = 0; c < A_COLS; c++) {
          const nextC = (c + 1) % A_COLS;
          indices.push(armGrid[r][c], armGrid[r + 1][c], armGrid[r + 1][nextC]);
          indices.push(armGrid[r][c], armGrid[r + 1][nextC], armGrid[r][nextC]);
        }
      }

      const handApex = addV(0.03, 1.285, side * 0.018, 0.5, 1.0, 1.0, 0.0, 0.0, 0.0);
      for (let c = 0; c < A_COLS; c++) {
        const nextC = (c + 1) % A_COLS;
        indices.push(armGrid[A_ROWS - 1][c], handApex, armGrid[A_ROWS - 1][nextC]);
      }
    }

    // 3. Monofin Blade (y in [-0.88, -1.68])
    const M_ROWS = 24, M_COLS = 14;
    const topGrid = [], botGrid = [];
    for (let r = 0; r < M_ROWS; r++) {
      const topRow = [], botRow = [];
      const tBlade = r / (M_ROWS - 1);
      const yBase = -0.88 - tBlade * (1.68 - 0.88);
      // Aligned straight backward along extended leg streamline (no forward cant)
      const xCenter = -0.01 + tBlade * 0.010;
      const zHalf = 0.11 + Math.pow(tBlade, 0.82) * 0.27;
      const thick = 0.050 * (1.0 - tBlade) + 0.006;
      const kickW = 0.65 + tBlade * 0.35;
      const bladeFlex = Math.max(0.0, (tBlade - 0.04) / 0.96);

      for (let c = 0; c < M_COLS; c++) {
        const uSpan = (c / (M_COLS - 1)) * 2.0 - 1.0;
        const yBlade = yBase + 0.07 * (1.0 - Math.pow(Math.abs(uSpan), 1.8)) * tBlade;
        const zBlade = uSpan * zHalf;
        const halfT = (thick * (1.0 - 0.75 * Math.pow(uSpan, 4.0))) * 0.5;

        topRow.push(addV(xCenter + halfT, yBlade, zBlade, c / (M_COLS - 1), tBlade, 0.0, kickW, bladeFlex, 0.0));
        botRow.push(addV(xCenter - halfT, yBlade, zBlade, c / (M_COLS - 1), tBlade, 0.0, kickW, bladeFlex, 0.0));
      }
      topGrid.push(topRow);
      botGrid.push(botRow);
    }

    for (let r = 0; r < M_ROWS - 1; r++) {
      for (let c = 0; c < M_COLS - 1; c++) {
        indices.push(topGrid[r][c], topGrid[r + 1][c], topGrid[r + 1][c + 1]);
        indices.push(topGrid[r][c], topGrid[r + 1][c + 1], topGrid[r][c + 1]);

        indices.push(botGrid[r][c], botGrid[r + 1][c], botGrid[r + 1][c + 1]);
        indices.push(botGrid[r][c], botGrid[r + 1][c + 1], botGrid[r][c + 1]);
      }
      // Lateral edge stitching
      indices.push(topGrid[r][0], botGrid[r][0], botGrid[r + 1][0]);
      indices.push(topGrid[r][0], botGrid[r + 1][0], topGrid[r + 1][0]);

      indices.push(topGrid[r][M_COLS - 1], topGrid[r + 1][M_COLS - 1], botGrid[r + 1][M_COLS - 1]);
      indices.push(topGrid[r][M_COLS - 1], botGrid[r + 1][M_COLS - 1], botGrid[r][M_COLS - 1]);
    }

    // Trailing edge stitching
    for (let c = 0; c < M_COLS - 1; c++) {
      indices.push(topGrid[M_ROWS - 1][c], botGrid[M_ROWS - 1][c], botGrid[M_ROWS - 1][c + 1]);
      indices.push(topGrid[M_ROWS - 1][c], botGrid[M_ROWS - 1][c + 1], topGrid[M_ROWS - 1][c + 1]);
    }

    // Root edge stitching
    for (let c = 0; c < M_COLS - 1; c++) {
      indices.push(topGrid[0][c], topGrid[0][c + 1], botGrid[0][c + 1]);
      indices.push(topGrid[0][c], botGrid[0][c + 1], botGrid[0][c]);
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geom.setAttribute('armWeight', new T.Float32BufferAttribute(armWeights, 1));
    geom.setAttribute('kickWeight', new T.Float32BufferAttribute(kickWeights, 1));
    geom.setAttribute('bladeFlex', new T.Float32BufferAttribute(bladeFlexes, 1));
    geom.setAttribute('legSide', new T.Float32BufferAttribute(legSides, 1));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  // ---------------------------------------------------------------------------
  // Geometry Builder: Safety Diver (Separate Legs + Long Bi-Fins)
  // ---------------------------------------------------------------------------
  function buildSafetyDiverGeometry(T) {
    const positions = [];
    const uvs = [];
    const armWeights = [];
    const kickWeights = [];
    const bladeFlexes = [];
    const legSides = [];
    const indices = [];

    function addV(x, y, z, u, v, armW, kickW, flex, legS) {
      const idx = positions.length / 3;
      positions.push(x, y, z);
      uvs.push(u, v);
      armWeights.push(armW);
      kickWeights.push(kickW);
      bladeFlexes.push(flex);
      legSides.push(legS);
      return idx;
    }

    // 1. Torso & Hood (y in [-0.08, 0.85], 28 rows x 20 cols)
    const T_ROWS = 28, T_COLS = 20;
    const torsoGrid = [];
    for (let i = 0; i < T_ROWS; i++) {
      const row = [];
      const y = -0.08 + (i / (T_ROWS - 1)) * (0.85 - (-0.08));
      const st = evalStation(y);
      const vCoord = i / (T_ROWS - 1);

      for (let j = 0; j < T_COLS; j++) {
        const phi = (j / T_COLS) * Math.PI * 2;
        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        let px = st.cX + st.rX * cosP;
        let py = y;
        let pz = st.rZ * sinP;

        if (y >= 0.70 && y <= 0.77 && cosP > 0.2) {
          const m = Math.sin((y - 0.70) / 0.07 * Math.PI) * cosP * cosP;
          px += 0.025 * m;
          pz *= (1.0 + 0.15 * m);
        }

        row.push(addV(px, py, pz, j / T_COLS, vCoord, 0.0, 0.0, 0.0, 0.0));
      }
      torsoGrid.push(row);
    }

    for (let i = 0; i < T_ROWS - 1; i++) {
      for (let j = 0; j < T_COLS; j++) {
        const nextJ = (j + 1) % T_COLS;
        indices.push(torsoGrid[i][j], torsoGrid[i + 1][j], torsoGrid[i + 1][nextJ]);
        indices.push(torsoGrid[i][j], torsoGrid[i + 1][nextJ], torsoGrid[i][nextJ]);
      }
    }

    // Crown apex
    const stCrown = evalStation(0.85);
    const crownApex = addV(stCrown.cX, 0.85, 0.0, 0.5, 1.0, 0.0, 0.0, 0.0, 0.0);
    for (let j = 0; j < T_COLS; j++) {
      const nextJ = (j + 1) % T_COLS;
      indices.push(torsoGrid[T_ROWS - 1][j], crownApex, torsoGrid[T_ROWS - 1][nextJ]);
    }

    // 2. Attentive Escort Arms (Left & Right)
    const A_ROWS = 12, A_COLS = 8;
    for (let side = -1; side <= 1; side += 2) {
      const armGrid = [];
      const p0 = { x: 0.005, y: 0.52, z: side * 0.11 };
      const p1 = { x: 0.080, y: 0.35, z: side * 0.12 };
      const p2 = { x: 0.120, y: 0.20, z: side * 0.06 };

      for (let r = 0; r < A_ROWS; r++) {
        const armRow = [];
        const s = r / (A_ROWS - 1);
        const invS = 1.0 - s;
        const cx = invS * invS * p0.x + 2 * invS * s * p1.x + s * s * p2.x;
        const cy = invS * invS * p0.y + 2 * invS * s * p1.y + s * s * p2.y;
        const cz = invS * invS * p0.z + 2 * invS * s * p1.z + s * s * p2.z;
        const rArm = 0.038 * (1.0 - s * 0.50);

        for (let c = 0; c < A_COLS; c++) {
          const a = (c / A_COLS) * Math.PI * 2;
          const px = cx + rArm * Math.cos(a);
          const py = cy;
          const pz = cz + rArm * Math.sin(a);
          armRow.push(addV(px, py, pz, c / A_COLS, s, 0.0, 0.0, 0.0, 0.0));
        }
        armGrid.push(armRow);
      }

      for (let r = 0; r < A_ROWS - 1; r++) {
        for (let c = 0; c < A_COLS; c++) {
          const nextC = (c + 1) % A_COLS;
          indices.push(armGrid[r][c], armGrid[r + 1][c], armGrid[r + 1][nextC]);
          indices.push(armGrid[r][c], armGrid[r + 1][nextC], armGrid[r][nextC]);
        }
      }

      // Hand tip cap
      const handTip = addV(p2.x, p2.y - 0.02, p2.z, 0.5, 1.0, 0.0, 0.0, 0.0, 0.0);
      for (let c = 0; c < A_COLS; c++) {
        const nextC = (c + 1) % A_COLS;
        indices.push(armGrid[A_ROWS - 1][c], handTip, armGrid[A_ROWS - 1][nextC]);
      }
    }

    // 3. Separate Left & Right Legs (y in [-0.08, -0.88])
    const L_ROWS = 20, L_COLS = 10;
    for (let side = -1; side <= 1; side += 2) {
      const legGrid = [];
      const zCenter = side * 0.085;

      for (let r = 0; r < L_ROWS; r++) {
        const legRow = [];
        const tLeg = r / (L_ROWS - 1);
        const yLeg = -0.08 - tLeg * 0.80;
        const st = evalStation(yLeg);
        const rLeg = 0.065 * (1.0 - tLeg * 0.42);
        const kickW = tLeg * 0.65;

        for (let c = 0; c < L_COLS; c++) {
          const phi = (c / L_COLS) * Math.PI * 2;
          const px = st.cX + rLeg * Math.cos(phi);
          const py = yLeg;
          const pz = zCenter + rLeg * Math.sin(phi);
          legRow.push(addV(px, py, pz, c / L_COLS, tLeg, 0.0, kickW, 0.0, side));
        }
        legGrid.push(legRow);
      }

      for (let r = 0; r < L_ROWS - 1; r++) {
        for (let c = 0; c < L_COLS; c++) {
          const nextC = (c + 1) % L_COLS;
          indices.push(legGrid[r][c], legGrid[r + 1][c], legGrid[r + 1][nextC]);
          indices.push(legGrid[r][c], legGrid[r + 1][nextC], legGrid[r][nextC]);
        }
      }

      // 4. Long Bi-Fin Blade at each ankle (y in [-0.88, -1.70], length = 0.82)
      const F_ROWS = 16, F_COLS = 8;
      const topFinGrid = [], botFinGrid = [];
      const cXAnkle = evalStation(-0.88).cX;

      for (let r = 0; r < F_ROWS; r++) {
        const topFinRow = [], botFinRow = [];
        const tFin = r / (F_ROWS - 1);
        const yFin = -0.88 - tFin * (1.70 - 0.88);
        // Aligned straight backward along extended leg streamline with pointed toes (no forward tilt)
        const xFin = cXAnkle + tFin * 0.008;
        const zHalf = 0.0525;
        const thick = 0.024 * (1.0 - tFin * 0.78);
        const kickW = 0.65 + tFin * 0.35;
        const bladeFlex = Math.max(0.0, (tFin - 0.04) / 0.96);

        for (let c = 0; c < F_COLS; c++) {
          const uSpan = (c / (F_COLS - 1)) * 2.0 - 1.0;
          const zFin = zCenter + uSpan * zHalf;
          const halfT = thick * 0.5 * (1.0 - 0.5 * uSpan * uSpan);

          topFinRow.push(addV(xFin + halfT, yFin, zFin, c / (F_COLS - 1), tFin, 0.0, kickW, bladeFlex, side));
          botFinRow.push(addV(xFin - halfT, yFin, zFin, c / (F_COLS - 1), tFin, 0.0, kickW, bladeFlex, side));
        }
        topFinGrid.push(topFinRow);
        botFinGrid.push(botFinRow);
      }

      for (let r = 0; r < F_ROWS - 1; r++) {
        for (let c = 0; c < F_COLS - 1; c++) {
          indices.push(topFinGrid[r][c], topFinGrid[r + 1][c], topFinGrid[r + 1][c + 1]);
          indices.push(topFinGrid[r][c], topFinGrid[r + 1][c + 1], topFinGrid[r][c + 1]);

          indices.push(botFinGrid[r][c], botFinGrid[r + 1][c + 1], botFinGrid[r + 1][c]);
          indices.push(botFinGrid[r][c], botFinGrid[r + 1][c], botFinGrid[r + 1][c + 1]);
        }
        // Lateral edges
        indices.push(topFinGrid[r][0], botFinGrid[r][0], botFinGrid[r + 1][0]);
        indices.push(topFinGrid[r][0], botFinGrid[r + 1][0], topFinGrid[r + 1][0]);

        indices.push(topFinGrid[r][F_COLS - 1], topFinGrid[r + 1][F_COLS - 1], botFinGrid[r + 1][F_COLS - 1]);
        indices.push(topFinGrid[r][F_COLS - 1], botFinGrid[r + 1][F_COLS - 1], botFinGrid[r][F_COLS - 1]);
      }

      // Trailing edge
      for (let c = 0; c < F_COLS - 1; c++) {
        indices.push(topFinGrid[F_ROWS - 1][c], botFinGrid[F_ROWS - 1][c], botFinGrid[F_ROWS - 1][c + 1]);
        indices.push(topFinGrid[F_ROWS - 1][c], botFinGrid[F_ROWS - 1][c + 1], topFinGrid[F_ROWS - 1][c + 1]);
      }

      // Root edge
      for (let c = 0; c < F_COLS - 1; c++) {
        indices.push(topFinGrid[0][c], topFinGrid[0][c + 1], botFinGrid[0][c + 1]);
        indices.push(topFinGrid[0][c], botFinGrid[0][c + 1], botFinGrid[0][c]);
      }
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geom.setAttribute('armWeight', new T.Float32BufferAttribute(armWeights, 1));
    geom.setAttribute('kickWeight', new T.Float32BufferAttribute(kickWeights, 1));
    geom.setAttribute('bladeFlex', new T.Float32BufferAttribute(bladeFlexes, 1));
    geom.setAttribute('legSide', new T.Float32BufferAttribute(legSides, 1));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  // ---------------------------------------------------------------------------
  // Diver Wetsuit Shader Material (With uPikeAngle & uHeadYaw Biomechanics)
  // ---------------------------------------------------------------------------
  function createDiverMaterial(T, uniforms) {
    const mat = new T.MeshStandardMaterial({
      color: 0x101922,
      roughness: 0.38,
      metalness: 0.08
    });
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `
        attribute float armWeight;
        attribute float kickWeight;
        attribute float bladeFlex;
        attribute float legSide;
        uniform float uKickPhase;
        uniform float uKickAmp;
        uniform float uArmRelax;
        uniform float uPikeAngle;
        uniform float uHeadYaw;
        uniform float uDepthCompression;
        uniform float uMonoBladeFlex;
        uniform float uBiBladeFlexL;
        uniform float uBiBladeFlexR;
        uniform float uTime;
        varying vec3 vDiverWorldPos;
        varying float vBladeFlex;
        varying float vKickWeight;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // 0. Boyle's Law chest & wetsuit compression under hydrostatic water pressure
        if (position.y > -0.06 && position.y < 0.60 && uDepthCompression > 0.001) {
          float wChest = smoothstep(-0.06, 0.22, position.y) * (1.0 - smoothstep(0.42, 0.60, position.y));
          float compressFactor = 1.0 - uDepthCompression * (0.11 * wChest + 0.04);
          transformed.xz *= compressFactor;
        }

        // 1. Arm streamline reach & relax rotation + active hover/level-holding scull towards rope
        if (armWeight > 0.0) {
          float scull = (uArmRelax > 0.35) ? sin(uTime * 2.4 + sign(position.z) * 1.2) * 0.06 * uArmRelax : 0.0;
          float armAngle = (uArmRelax * 1.35 + scull) * armWeight;
          vec3 shoulderPivot = vec3(0.0, 0.52, sign(position.z) * 0.11);
          vec3 relArm = transformed - shoulderPivot;
          float sA = sin(armAngle);
          float cA = cos(armAngle);
          // Angle forearms slightly inward toward the dive rope line:
          float ropeInward = (uArmRelax > 0.35) ? smoothstep(0.0, 1.0, armWeight) * 0.030 * sign(position.z) : 0.0;
          vec3 rotatedArm = vec3(relArm.x * cA + relArm.y * sA, -relArm.x * sA + relArm.y * cA, relArm.z - ropeInward);
          transformed = mix(transformed, shoulderPivot + rotatedArm, armWeight);
        }

        // 2. Biomechanical Hip Flexion (uPikeAngle)
        if (position.y < -0.04 && uPikeAngle > 0.001) {
          float wPike = smoothstep(-0.04, -0.32, position.y);
          float kneeTuck = smoothstep(-0.48, -0.80, position.y) * 0.22 * uPikeAngle;
          float pikeA = uPikeAngle * wPike - kneeTuck;
          vec3 hipPivot = vec3(0.0, -0.06, 0.0);
          vec3 relLeg = transformed - hipPivot;
          float sP = sin(pikeA);
          float cP = cos(pikeA);
          vec3 rotatedLeg = vec3(
            relLeg.x * cP - relLeg.y * sP,
            relLeg.x * sP + relLeg.y * cP,
            relLeg.z
          );
          transformed = mix(transformed, hipPivot + rotatedLeg, wPike);
        }

        // 3. Head Yaw Glancing (uHeadYaw)
        if (position.y > 0.62 && abs(uHeadYaw) > 0.001) {
          float wHead = smoothstep(0.62, 0.74, position.y);
          float sH = sin(uHeadYaw * wHead);
          float cH = cos(uHeadYaw * wHead);
          vec3 neckPivot = vec3(0.012, 0.62, 0.0);
          vec3 relHead = transformed - neckPivot;
          vec3 turnedHead = vec3(
            relHead.x * cH - relHead.z * sH,
            relHead.y,
            relHead.x * sH + relHead.z * cH
          );
          transformed = mix(transformed, neckPivot + turnedHead, wHead);
        }

        // 4. Undulation & compliant kicks (along local X)
        // High elastohydrodynamic compliance with physical elastodynamic blade flex
        if (abs(legSide) > 0.5) {
          // Bi-fin scissor kick with physical elastodynamic blade flex
          float legScissor = legSide * sin(uKickPhase) * uKickAmp * pow(kickWeight, 1.15) * 0.28;
          float dynBladeFlex = (legSide > 0.0) ? uBiBladeFlexR : uBiBladeFlexL;
          float bladeDisplacement = dynBladeFlex * pow(bladeFlex, 1.7) * 0.52;
          transformed.x += legScissor + bladeDisplacement;
        } else {
          // Monofin travelling dolphin wave with physical elastodynamic blade flex
          float bodyWave = sin(uKickPhase - kickWeight * 3.6) * uKickAmp * pow(kickWeight, 1.45) * 0.26;
          float wingDisplacement = uMonoBladeFlex * pow(bladeFlex, 1.8) * 0.58;
          transformed.x += bodyWave + wingDisplacement;
        }

        vec4 dWPos = modelMatrix * vec4(transformed, 1.0);
        vDiverWorldPos = dWPos.xyz;
        vBladeFlex = bladeFlex;
        vKickWeight = kickWeight;
        `
      );
      shader.fragmentShader = `
        uniform float uBioShimmer;
        uniform float uTime;
        varying vec3 vDiverWorldPos;
        varying float vBladeFlex;
        varying float vKickWeight;
        ${shader.fragmentShader}
      `;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        float waterDepth = max(0.0, 15.0 - vDiverWorldPos.y);
        float viewDist = length(vViewPosition);
        vec3 verticalAbsorption = exp(-vec3(0.022, 0.008, 0.002) * max(0.0, waterDepth - 10.0));
        vec3 pathAbsorption = exp(-vec3(0.015, 0.005, 0.001) * viewDist);
        outgoingLight *= mix(vec3(1.0), verticalAbsorption * pathAbsorption, 0.82);
        if (vBladeFlex > 0.05) {
          float carbonRim = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vViewPosition))), 3.0);
          outgoingLight += vec3(0.08, 0.15, 0.22) * carbonRim * vBladeFlex;
        }
        if (uBioShimmer > 0.001) {
          float finEdge = smoothstep(0.40, 0.95, vKickWeight);
          float bioPulse = sin(uTime * 8.5 - vBladeFlex * 5.5) * 0.5 + 0.5;
          float bioEmission = finEdge * uBioShimmer * (0.55 + 0.45 * bioPulse);
          vec3 bioColor = mix(vec3(0.08, 0.76, 1.0), vec3(0.34, 1.0, 0.88), 0.35);
          outgoingLight += bioColor * bioEmission * 0.75;
        }
        #include <opaque_fragment>
        `
      );
    };
    return mat;
  }

  // ---------------------------------------------------------------------------
  // Volumetric Headlamp & Bottom Beacon Materials (Beer-Lambert Water Attenuation)
  // ---------------------------------------------------------------------------
  function createTorchBeamMaterial(T, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      toneMapped: false,
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vLocalPos = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTorchPower;
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          if (uTorchPower <= 0.001) discard;
          float axial = clamp(vLocalPos.y / 1.60, 0.0, 1.0);
          float dist = length(vLocalPos);
          // Beer-Lambert exponential absorption in seawater (extinction ~ 2.6 m^-1)
          float waterExtinction = exp(-dist * 2.6);
          float coneRadius = axial * 0.42 + 0.025;
          float radialDist = length(vLocalPos.xz);
          float radial = clamp(radialDist / max(0.01, coneRadius), 0.0, 1.0);
          float core = exp(-radial * radial * 3.2);
          // Continuous, seamless boundary fade with ZERO planar cutoff
          float softFade = smoothstep(0.0, 0.12, axial) * smoothstep(1.0, 0.55, axial);
          float viewAlignment = pow(clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 1.6);
          float beam = waterExtinction * core * softFade * (0.35 + 0.65 * viewAlignment);
          vec3 beamCol = vec3(0.68, 0.88, 1.0);
          gl_FragColor = vec4(beamCol, beam * uTorchPower * 0.065);
        }
      `
    });
  }

  function createTorchGlintMaterial(T, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      toneMapped: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mvCenter.xy += position.xy;
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: `
        uniform float uGlintIntensity;
        varying vec2 vUv;
        void main() {
          if (uGlintIntensity <= 0.001) discard;
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float core = exp(-r * r * 16.0);
          float halo = exp(-r * 3.2) * 0.45;
          float spikeX = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 3.5);
          float spikeY = exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 3.5);
          float glint = (core + halo + (spikeX + spikeY) * 0.55) * uGlintIntensity;
          vec3 glintColor = vec3(0.85, 0.96, 1.0);
          gl_FragColor = vec4(glintColor, glint);
        }
      `
    });
  }

  function createLampConeMaterial(T, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      toneMapped: false,
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vLocalPos = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uLampPower;
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          if (uLampPower <= 0.001) discard;
          float axial = clamp(vLocalPos.y / 3.0, 0.0, 1.0);
          float dist = length(vLocalPos);
          // Pure Beer-Lambert exponential attenuation in ocean water:
          float waterExtinction = exp(-dist * 1.85);
          float coneRadius = axial * 1.90 + 0.08;
          float radialDist = length(vLocalPos.xz);
          float radial = clamp(radialDist / max(0.01, coneRadius), 0.0, 1.0);
          float core = exp(-radial * radial * 2.8);
          // Continuous, smooth fade so light NEVER hits a wall or sharp boundary
          float softFade = smoothstep(0.0, 0.08, axial) * smoothstep(1.0, 0.45, axial);
          float viewAlignment = pow(clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 1.6);
          float beam = waterExtinction * core * softFade * (0.35 + 0.65 * viewAlignment);
          vec3 lightCol = vec3(0.55, 0.88, 1.0);
          gl_FragColor = vec4(lightCol, beam * uLampPower * 0.22);
        }
      `
    });
  }

  function createLampGlowMaterial(T, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.BackSide,
      toneMapped: false,
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uLampPower;
        varying vec3 vLocalPos;
        void main() {
          if (uLampPower <= 0.001) discard;
          float dist = length(vLocalPos);
          float glow = exp(-dist * 2.8) * smoothstep(1.2, 0.1, dist) * uLampPower * 0.35;
          vec3 glowCol = vec3(0.58, 0.90, 1.0);
          gl_FragColor = vec4(glowCol, glow);
        }
      `
    });
  }

  // ---------------------------------------------------------------------------
  // Primary Module Factory
  // ---------------------------------------------------------------------------
  window.createFreedivers = function(T, scene, waterUniforms, oceanOptics) {
    const RIG_X = -13.5;
    const RIG_Z = -20.0;
    const ROPE_TOP_Y = 15.0;
    const ROPE_BOTTOM_Y = -21.0;
    const PLATE_Y = -17.5;
    const BALLAST_Y = -21.0;
    const DIVER_SCALE = 1.35;
    const CYCLE_PERIOD = 50.0;

    const group = new T.Group();
    group.name = 'Freediver Competition Rig';
    scene.add(group);

    // 1. Surface Buoy at (RIG_X, 15.0, RIG_Z)
    const buoyGroup = new T.Group();
    buoyGroup.position.set(RIG_X, ROPE_TOP_Y, RIG_Z);

    const torusGeom = new T.TorusGeometry(0.92, 0.28, 16, 36);
    torusGeom.rotateX(Math.PI / 2);
    const torusMat = new T.MeshStandardMaterial({
      color: 0xc84b31,
      roughness: 0.45,
      metalness: 0.05
    });
    const torusMesh = new T.Mesh(torusGeom, torusMat);
    buoyGroup.add(torusMesh);

    const hubGeom = new T.CylinderGeometry(0.66, 0.66, 0.10, 24);
    const hubMat = new T.MeshStandardMaterial({
      color: 0x1a2228,
      roughness: 0.6,
      metalness: 0.1
    });
    const hubMesh = new T.Mesh(hubGeom, hubMat);
    buoyGroup.add(hubMesh);

    const ringGeom = new T.CylinderGeometry(0.08, 0.08, 0.35, 10);
    ringGeom.translate(0, -0.22, 0);
    const ringMat = new T.MeshStandardMaterial({
      color: 0x4a5d6e,
      roughness: 0.3,
      metalness: 0.7
    });
    const ringMesh = new T.Mesh(ringGeom, ringMat);
    buoyGroup.add(ringMesh);

    group.add(buoyGroup);

    // 2. Vertical Dive Rope (Dynamic 49-ring mesh spanning y = +15.0 down to -21.0)
    const ropeGeom = new T.CylinderGeometry(0.024, 0.024, 36.0, 8, 48, true);
    const ropePosAttr = ropeGeom.attributes.position;
    const ropeUniforms = {
      uLampPower: { value: 1.0 }
    };
    const ropeMat = new T.MeshStandardMaterial({
      color: 0xc8d6de,
      roughness: 0.75
    });
    ropeMat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, ropeUniforms);
      shader.vertexShader = `
        varying float vRopeWorldY;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRopeWorldY = position.y;
        `
      );
      shader.fragmentShader = `
        uniform float uLampPower;
        varying float vRopeWorldY;
        ${shader.fragmentShader}
      `;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        float depth = max(0.0, 15.0 - vRopeWorldY);
        vec3 absorption = exp(-vec3(0.035, 0.012, 0.003) * depth);
        float distToLamp = abs(vRopeWorldY - (-17.5));
        float lampLight = exp(-distToLamp * 1.3) * uLampPower * 0.65;
        gl_FragColor.rgb = gl_FragColor.rgb * absorption + vec3(0.5, 0.85, 1.0) * lampLight;
        #include <opaque_fragment>
        `
      );
    };
    const ropeMesh = new T.Mesh(ropeGeom, ropeMat);
    ropeMesh.frustumCulled = false;
    group.add(ropeMesh);

    // 3. Bottom Plate at (RIG_X, -17.5, RIG_Z)
    const plateGroup = new T.Group();
    plateGroup.position.set(RIG_X, PLATE_Y, RIG_Z);

    const discGeom = new T.CylinderGeometry(0.55, 0.55, 0.05, 28);
    const discMat = new T.MeshStandardMaterial({
      color: 0xdbe7ee,
      roughness: 0.35,
      emissive: 0x183848,
      emissiveIntensity: 0.35
    });
    const discMesh = new T.Mesh(discGeom, discMat);
    plateGroup.add(discMesh);

    const collarGeom = new T.CylinderGeometry(0.09, 0.09, 0.22, 14);
    const collarMat = new T.MeshStandardMaterial({
      color: 0x26323a,
      roughness: 0.5,
      metalness: 0.6
    });
    const collarMesh = new T.Mesh(collarGeom, collarMat);
    plateGroup.add(collarMesh);

    group.add(plateGroup);

    // 4. Ballast Weight at (RIG_X, -21.0, RIG_Z)
    const ballastGroup = new T.Group();
    ballastGroup.position.set(RIG_X, BALLAST_Y, RIG_Z);

    const ballastGeom = new T.CylinderGeometry(0.24, 0.26, 0.52, 20);
    const ballastMat = new T.MeshStandardMaterial({
      color: 0x1d2730,
      roughness: 0.6,
      metalness: 0.3
    });
    const ballastMesh = new T.Mesh(ballastGeom, ballastMat);
    ballastGroup.add(ballastMesh);

    const eyeGeom = new T.TorusGeometry(0.09, 0.025, 8, 16);
    eyeGeom.rotateX(Math.PI / 2);
    eyeGeom.translate(0, 0.28, 0);
    const eyeMesh = new T.Mesh(eyeGeom, collarMat);
    ballastGroup.add(eyeMesh);

    group.add(ballastGroup);

    // 5. Bottom Plate Lamp at (RIG_X, -17.40, RIG_Z)
    const plateLampGroup = new T.Group();
    plateLampGroup.position.set(RIG_X, -17.40, RIG_Z);

    const lampDomeGeom = new T.SphereGeometry(0.075, 14, 12);
    const lampDomeMat = new T.MeshBasicMaterial({
      color: 0xdffbff,
      toneMapped: false
    });
    const lampDomeMesh = new T.Mesh(lampDomeGeom, lampDomeMat);
    plateLampGroup.add(lampDomeMesh);

    const bottomLampUniforms = {
      uLampPower: { value: 0.0 }
    };

    const lampConeGeom = new T.CylinderGeometry(0.08, 2.0, 3.0, 24, 16, true);
    lampConeGeom.translate(0, 1.5, 0);
    const lampConeMat = createLampConeMaterial(T, bottomLampUniforms);
    const lampConeMesh = new T.Mesh(lampConeGeom, lampConeMat);
    plateLampGroup.add(lampConeMesh);

    const lampGlowGeom = new T.SphereGeometry(1.1, 16, 14);
    const lampGlowMat = createLampGlowMaterial(T, bottomLampUniforms);
    const lampGlowMesh = new T.Mesh(lampGlowGeom, lampGlowMat);
    plateLampGroup.add(lampGlowMesh);

    group.add(plateLampGroup);

    // -------------------------------------------------------------------------
    // Procedural Divers & Forehead Torches
    // -------------------------------------------------------------------------
    // Monofin Diver (Left side of rope: RIG_X - 0.78)
    const mainUniforms = {
      uKickPhase: { value: 0 },
      uKickAmp: { value: 1.0 },
      uArmRelax: { value: 0 },
      uPikeAngle: { value: 0 },
      uHeadYaw: { value: 0 },
      uDepthCompression: { value: 0 },
      uBioShimmer: { value: 0 },
      uMonoBladeFlex: { value: 0 },
      uBiBladeFlexL: { value: 0 },
      uBiBladeFlexR: { value: 0 },
      uTime: { value: 0 }
    };
    const mainMaterial = createDiverMaterial(T, mainUniforms);
    const mainGeometry = buildMainDiverGeometry(T);
    const mainDiverMesh = new T.Mesh(mainGeometry, mainMaterial);
    mainDiverMesh.scale.set(DIVER_SCALE, DIVER_SCALE, DIVER_SCALE);

    const mainTorchGroup = new T.Group();
    mainTorchGroup.position.set(0.115, 0.785, 0.0);

    const torchHousingMat = new T.MeshStandardMaterial({
      color: 0x1b2832,
      roughness: 0.3,
      metalness: 0.85
    });
    const torchEmitterMat = new T.MeshBasicMaterial({
      color: 0xe8fcff,
      toneMapped: false
    });

    const mainTorchHousingGeom = new T.CylinderGeometry(0.020, 0.020, 0.12, 12);
    mainTorchHousingGeom.rotateZ(-1.170);
    const mainTorchHousingMesh = new T.Mesh(mainTorchHousingGeom, torchHousingMat);
    mainTorchGroup.add(mainTorchHousingMesh);

    const mainTorchEmitterGeom = new T.SphereGeometry(0.022, 10, 8);
    const mainTorchEmitterMesh = new T.Mesh(mainTorchEmitterGeom, torchEmitterMat);
    mainTorchEmitterMesh.position.set(0.055, 0.023, 0.0);
    mainTorchGroup.add(mainTorchEmitterMesh);

    const mainTorchUniforms = {
      uTorchPower: { value: 0.0 }
    };
    const mainTorchBeamGeom = new T.CylinderGeometry(0.025, 0.45, 1.60, 24, 14, true);
    mainTorchBeamGeom.translate(0, 0.80, 0);
    mainTorchBeamGeom.rotateZ(-1.180);
    const mainTorchBeamMat = createTorchBeamMaterial(T, mainTorchUniforms);
    const mainTorchBeamMesh = new T.Mesh(mainTorchBeamGeom, mainTorchBeamMat);
    mainTorchBeamMesh.position.set(0.055, 0.023, 0.0);
    mainTorchGroup.add(mainTorchBeamMesh);

    const mainGlintUniforms = {
      uGlintIntensity: { value: 0.0 }
    };
    const glintGeom = new T.PlaneGeometry(0.95, 0.95);
    const mainGlintMat = createTorchGlintMaterial(T, mainGlintUniforms);
    const mainGlintMesh = new T.Mesh(glintGeom, mainGlintMat);
    mainGlintMesh.position.set(0.055, 0.023, 0.0);
    mainTorchGroup.add(mainGlintMesh);

    function createSnorkel(T) {
      const snorkelMat = new T.MeshStandardMaterial({
        color: 0x181a1d,
        roughness: 0.55,
        metalness: 0.15
      });
      const snorkelGroup = new T.Group();
      snorkelGroup.position.set(-0.02, 0.72, 0.10);

      // Curved lower J-tube
      const lowerGeom = new T.CylinderGeometry(0.010, 0.010, 0.09, 10);
      lowerGeom.rotateX(0.70);
      snorkelGroup.add(new T.Mesh(lowerGeom, snorkelMat));

      // Main vertical barrel rising up along the head
      const barrelGeom = new T.CylinderGeometry(0.011, 0.011, 0.28, 10);
      barrelGeom.translate(0, 0.14, 0);
      barrelGeom.rotateZ(-0.06);
      barrelGeom.rotateX(-0.10);
      snorkelGroup.add(new T.Mesh(barrelGeom, snorkelMat));

      // Orange hi-vis safety tip at top
      const tipMat = new T.MeshStandardMaterial({
        color: 0xff6600,
        roughness: 0.4,
        metalness: 0.1
      });
      const tipGeom = new T.CylinderGeometry(0.0115, 0.0115, 0.045, 10);
      tipGeom.translate(0, 0.26, 0);
      tipGeom.rotateZ(-0.06);
      tipGeom.rotateX(-0.10);
      snorkelGroup.add(new T.Mesh(tipGeom, tipMat));

      return snorkelGroup;
    }

    mainDiverMesh.add(createSnorkel(T));
    mainDiverMesh.add(mainTorchGroup);
    group.add(mainDiverMesh);

    // Bi-fin Diver (Right side of rope: RIG_X + 0.82)
    const safeUniforms = {
      uKickPhase: { value: 0 },
      uKickAmp: { value: 1.0 },
      uArmRelax: { value: 0 },
      uPikeAngle: { value: 0 },
      uHeadYaw: { value: 0 },
      uDepthCompression: { value: 0 },
      uBioShimmer: { value: 0 },
      uMonoBladeFlex: { value: 0 },
      uBiBladeFlexL: { value: 0 },
      uBiBladeFlexR: { value: 0 },
      uTime: { value: 0 }
    };
    const safeMaterial = createDiverMaterial(T, safeUniforms);
    const safeGeometry = buildSafetyDiverGeometry(T);
    const safetyDiverMesh = new T.Mesh(safeGeometry, safeMaterial);
    safetyDiverMesh.scale.set(DIVER_SCALE, DIVER_SCALE, DIVER_SCALE);

    const safeTorchGroup = new T.Group();
    safeTorchGroup.position.set(0.115, 0.785, 0.0);

    const safeTorchHousingGeom = new T.CylinderGeometry(0.020, 0.020, 0.12, 12);
    safeTorchHousingGeom.rotateZ(-1.170);
    const safeTorchHousingMesh = new T.Mesh(safeTorchHousingGeom, torchHousingMat);
    safeTorchGroup.add(safeTorchHousingMesh);

    const safeTorchEmitterGeom = new T.SphereGeometry(0.022, 10, 8);
    const safeTorchEmitterMesh = new T.Mesh(safeTorchEmitterGeom, torchEmitterMat);
    safeTorchEmitterMesh.position.set(0.055, 0.023, 0.0);
    safeTorchGroup.add(safeTorchEmitterMesh);

    const safeTorchUniforms = {
      uTorchPower: { value: 0.0 }
    };
    const safeTorchBeamGeom = new T.CylinderGeometry(0.025, 0.45, 1.60, 24, 14, true);
    safeTorchBeamGeom.translate(0, 0.80, 0);
    safeTorchBeamGeom.rotateZ(-1.180);
    const safeTorchBeamMat = createTorchBeamMaterial(T, safeTorchUniforms);
    const safeTorchBeamMesh = new T.Mesh(safeTorchBeamGeom, safeTorchBeamMat);
    safeTorchBeamMesh.position.set(0.055, 0.023, 0.0);
    safeTorchGroup.add(safeTorchBeamMesh);

    const safeGlintUniforms = {
      uGlintIntensity: { value: 0.0 }
    };
    const safeGlintMat = createTorchGlintMaterial(T, safeGlintUniforms);
    const safeGlintMesh = new T.Mesh(glintGeom, safeGlintMat);
    safeGlintMesh.position.set(0.055, 0.023, 0.0);
    safeTorchGroup.add(safeGlintMesh);

    safetyDiverMesh.add(createSnorkel(T));
    safetyDiverMesh.add(safeTorchGroup);
    group.add(safetyDiverMesh);

    // -------------------------------------------------------------------------
    // Lanyard (Safety Line from Active Deep Diver to Dive Rope)
    // -------------------------------------------------------------------------
    const lanyardPositions = new Float32Array(6);
    const lanyardGeom = new T.BufferGeometry();
    lanyardGeom.setAttribute('position', new T.BufferAttribute(lanyardPositions, 3));
    const lanyardMat = new T.LineBasicMaterial({
      color: 0x8fb4c9,
      transparent: true,
      opacity: 0.65
    });
    const lanyardLine = new T.Line(lanyardGeom, lanyardMat);
    group.add(lanyardLine);

    // -------------------------------------------------------------------------
    // Surface Splash & Expanding Mask/Goggle Air Bubbles (160 points)
    // -------------------------------------------------------------------------
    const bubblePositions = new Float32Array(160 * 3);
    const bubbleSeed = new Float32Array(160 * 2);
    const bubbleRadii = new Float32Array(160);
    for (let k = 0; k < 160; k++) {
      bubblePositions[k * 3 + 1] = -999.0;
      bubbleSeed[k * 2] = fract(Math.sin(k * 13.71 + 5.13) * 43758.5453);
      bubbleSeed[k * 2 + 1] = 0.55 + 0.65 * fract(Math.sin(k * 29.83 + 11.27) * 43758.5453);
      bubbleRadii[k] = 0.035;
    }
    const bubbleGeom = new T.BufferGeometry();
    bubbleGeom.setAttribute('position', new T.BufferAttribute(bubblePositions, 3));
    bubbleGeom.setAttribute('aSeed', new T.BufferAttribute(bubbleSeed, 2));
    bubbleGeom.setAttribute('aRadius', new T.BufferAttribute(bubbleRadii, 1));

    // Individual mask bubble simulation state pool (104 individual bubble entities)
    const MASK_BUBBLE_COUNT = 104;
    const mbActive = new Uint8Array(MASK_BUBBLE_COUNT);
    const mbX = new Float32Array(MASK_BUBBLE_COUNT);
    const mbY = new Float32Array(MASK_BUBBLE_COUNT);
    const mbZ = new Float32Array(MASK_BUBBLE_COUNT);
    const mbVx = new Float32Array(MASK_BUBBLE_COUNT);
    const mbVy = new Float32Array(MASK_BUBBLE_COUNT);
    const mbVz = new Float32Array(MASK_BUBBLE_COUNT);
    const mbVol = new Float32Array(MASK_BUBBLE_COUNT);
    const mbRad = new Float32Array(MASK_BUBBLE_COUNT);
    const mbInitVol = new Float32Array(MASK_BUBBLE_COUNT);
    const mbInitRad = new Float32Array(MASK_BUBBLE_COUNT);
    const mbSpawnP = new Float32Array(MASK_BUBBLE_COUNT);
    const mbDiverId = new Uint8Array(MASK_BUBBLE_COUNT);
    // Burst-emission & clinging mask air pocket state
    let deepBurstTimer = 0.0;
    let deepBurstInterval = 0.65;
    let safeBurstTimer = 0.0;
    let safeBurstInterval = 0.75;
    let deepDuckTimer = 0.0;
    let safeDuckTimer = 0.0;
    let deepPocketRad = 0.024;
    let safePocketRad = 0.022;
    let lastSimTime = undefined;

    const bubbleUniforms = {
      lightDirection: (waterUniforms && waterUniforms.lightDirection) || { value: new T.Vector3(0, 1, 0) },
      sunColor: (waterUniforms && waterUniforms.sunColor) || { value: new T.Color(1, 1, 1) },
      sunPower: (waterUniforms && waterUniforms.sunPower) || { value: 1.0 },
      daylight: (waterUniforms && waterUniforms.daylight) || { value: 1.0 }
    };

    const bubbleMat = new T.ShaderMaterial({
      uniforms: bubbleUniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `
        uniform vec3 lightDirection;
        attribute vec2 aSeed;
        attribute float aRadius;
        varying float vAlpha;
        varying float vDepthRatio;
        varying vec3 vLightDirView;
        varying vec3 vViewDir;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = -mvPosition.z;

          float depth = max(0.0, 15.0 - position.y);
          float basePx = (position.y > 14.5 ? 12.0 : (aRadius > 0.001 ? aRadius * 250.0 : 8.5 * aSeed.y));
          gl_PointSize = clamp(basePx * (26.0 / max(6.0, dist)), 2.5, 78.0);

          vAlpha = position.y < -900.0 ? 0.0 : (position.y > 14.5 ? 0.65 : 0.52);
          vDepthRatio = clamp(depth / 35.0, 0.0, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          vLightDirView = normalize((viewMatrix * vec4(lightDirection, 0.0)).xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sunColor;
        uniform float sunPower;
        uniform float daylight;
        varying float vAlpha;
        varying float vDepthRatio;
        varying vec3 vLightDirView;
        varying vec3 vViewDir;

        void main() {
          if (vAlpha <= 0.01) discard;

          // Remap coordinates so (0,0) is center, +Y is UP (top dome), -Y is DOWN (flat base)
          vec2 p = vec2(gl_PointCoord.x * 2.0 - 1.0, 1.0 - gl_PointCoord.y * 2.0);

          // 1. Fluid Dynamics Shape: Spherical Cap / Medusa-Gople (Round convex top dome, flattened bottom with indented vortex base)
          float yScaled = p.y < 0.0 ? p.y * 2.45 : p.y * 1.06;
          float capDist2 = p.x * p.x + yScaled * yScaled;
          if (capDist2 > 1.0) discard;

          // Reconstruct 3D surface normal of the spherical cap
          float nz = sqrt(max(0.0, 1.0 - capDist2));
          vec3 normalLocal = normalize(vec3(p.x, yScaled, nz * 1.15));

          // 2. Air-water Total Internal Reflection (TIR) & Silvery Mirror Rim:
          // Water (n=1.333) to Air (n=1.0) has critical angle theta_c = 48.6 deg.
          // Grazing rays reflect 100%, producing a brilliant chrome-silver boundary rim!
          float fresnelRim = pow(1.0 - normalLocal.z, 2.4);
          float tirMirror = smoothstep(0.68, 0.98, 1.0 - normalLocal.z) * 0.95;

          // 3. Internal Water-Mirror Interface ("Vandspejl inden i goplen"):
          // Large spherical cap bubbles have a flat/slightly concave horizontal liquid interface at the bottom
          // with strong internal reflection and a meniscus rim line:
          float baseMirror = smoothstep(0.08, -0.02, p.y) * (1.0 - p.x * p.x * 1.25) * 0.45;
          float meniscusLine = smoothstep(0.035, 0.0, abs(p.y - (-0.14))) * (1.0 - p.x * p.x * 1.2) * 0.70;

          float core = exp(-capDist2 * 2.8) * 0.15;

          // 4. Specular Sun Reflection & Glint (when sun aligns with observer)
          vec3 halfVector = normalize(vLightDirView + vViewDir);
          float nDotH = max(0.0, dot(normalLocal, halfVector));
          float specGlint = pow(nDotH, 28.0) * (0.35 + 0.65 * smoothstep(-0.1, 0.5, p.y));
          float broadSheen = pow(max(0.0, dot(normalLocal, vLightDirView)), 5.0) * 0.35 * smoothstep(-0.2, 0.4, p.y);
          float solarHighlight = (specGlint * 2.4 + broadSheen) * sunPower * daylight;

          // Edge anti-aliasing
          float edgeAntialias = 1.0 - smoothstep(0.90, 1.0, capDist2);
          float alpha = (fresnelRim * 0.75 + tirMirror * 0.60 + baseMirror + meniscusLine + core + solarHighlight * 0.90) * edgeAntialias * vAlpha;

          // Color composition: silvery reflective rim + internal water-mirror + sun glint
          vec3 shallowColor = vec3(0.92, 0.97, 1.0);
          vec3 deepColor = vec3(0.68, 0.88, 0.98);
          vec3 baseColor = mix(shallowColor, deepColor, vDepthRatio);
          vec3 silverRim = vec3(0.95, 0.98, 1.0);
          vec3 glintColor = mix(vec3(1.0), sunColor, 0.35);

          vec3 finalColor = baseColor * (fresnelRim * 0.85 + core * 0.5 + baseMirror)
                          + silverRim * (tirMirror * 0.90 + meniscusLine * 0.85)
                          + glintColor * solarHighlight;

          gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
        }
      `
    });
    const bubblePoints = new T.Points(bubbleGeom, bubbleMat);
    bubblePoints.frustumCulled = false;
    group.add(bubblePoints);

    // -------------------------------------------------------------------------
    // Active Divers State for Wakes / Optical Integration
    // -------------------------------------------------------------------------
    const mainDiverState = {
      visible: true,
      position: new T.Vector3(RIG_X - 0.78, 14.3, RIG_Z),
      velocity: new T.Vector3(0, 0, 0),
      heading: new T.Vector3(0, 1, 0),
      scale: DIVER_SCALE,
      active: true
    };
    const safetyDiverState = {
      visible: true,
      position: new T.Vector3(RIG_X + 0.82, 14.2, RIG_Z),
      velocity: new T.Vector3(0, 0, 0),
      heading: new T.Vector3(0, 1, 0),
      scale: DIVER_SCALE,
      active: true
    };
    const activeDivers = [mainDiverState, safetyDiverState];

    // -------------------------------------------------------------------------
    // Preallocated Working Objects for Zero-Allocation Frame Updates
    // -------------------------------------------------------------------------
    const waveBuoy = { x: 0, y: 0, z: 0, slopeX: 0, slopeZ: 0 };
    const ropeWaveDelayed = { x: 0, y: 0, z: 0, slopeX: 0, slopeZ: 0 };
    const ropeWaveHeave = { x: 0, y: 0, z: 0, slopeX: 0, slopeZ: 0 };

    const ropeRingCenter = new T.Vector3();
    const tangentAbove = new T.Vector3();
    const tangentBelow = new T.Vector3();
    const tangentVec = new T.Vector3();
    const unitY = new T.Vector3(0, 1, 0);

    const buoyPos = new T.Vector3();
    const platePos = new T.Vector3();
    const ballastPos = new T.Vector3();

    const vU = new T.Vector3();
    const vR = new T.Vector3();
    const vF = new T.Vector3();
    const vS = new T.Vector3();
    const basisMatrix = new T.Matrix4();

    const torchWorldDir = new T.Vector3();
    const torchWorldPos = new T.Vector3();
    const toCameraDir = new T.Vector3();
    const eyePos = (waterUniforms && waterUniforms.eyePosition && waterUniforms.eyePosition.value)
      ? waterUniforms.eyePosition.value : new T.Vector3(0, 3.5, 27);

    const diverLanyardPoint = new T.Vector3();
    const ropeCarabinerPoint = new T.Vector3();
    const prevMainPos = new T.Vector3(RIG_X - 0.78, 14.3, RIG_Z);
    const prevSafePos = new T.Vector3(RIG_X + 0.82, 14.2, RIG_Z);
    let lastUpdateTime = undefined;
    let monoKickPhase = 0.0;
    let biKickPhase = 0.0;

    // Preallocated 2nd-Order Inertial Tracking States
    const mainInertial = {
      y: { pos: 14.3, vel: 0 },
      x: { pos: RIG_X - 0.78, vel: 0 },
      theta: { pos: 0.08, vel: 0 },
      pike: { pos: 0, vel: 0 },
      arm: { pos: 0.85, vel: 0 },
      yaw: { pos: 0, vel: 0 },
      pitch: { pos: -0.05, vel: 0 }
    };
    const safeInertial = {
      y: { pos: 14.2, vel: 0 },
      x: { pos: RIG_X + 0.82, vel: 0 },
      theta: { pos: 0.06, vel: 0 },
      pike: { pos: 0, vel: 0 },
      arm: { pos: 0.0, vel: 0 },
      yaw: { pos: 0, vel: 0 },
      pitch: { pos: -0.05, vel: 0 }
    };

    // Preallocated Elastodynamic Fin States
    const monoFinState = { pos: 0, vel: 0 };
    const biFinLState = { pos: 0, vel: 0 };
    const biFinRState = { pos: 0, vel: 0 };

    function stepInertial(state, targetPos, omegaN, zeta, dt) {
      if (dt <= 0.0) return state.pos;
      if (!Number.isFinite(state.pos) || !Number.isFinite(state.vel)) {
        state.pos = targetPos;
        state.vel = 0.0;
        return state.pos;
      }
      const clampedDt = Math.min(dt, 0.05);
      const oo = omegaN * omegaN;
      const denom = 1.0 + 2.0 * clampedDt * zeta * omegaN + clampedDt * clampedDt * oo;
      state.vel = (state.vel + clampedDt * oo * (targetPos - state.pos)) / denom;
      state.pos += clampedDt * state.vel;
      return state.pos;
    }

    function stepFinOscillator(state, targetFoot, dt) {
      if (dt <= 0.0) return;
      if (!Number.isFinite(state.pos) || !Number.isFinite(state.vel)) {
        state.pos = targetFoot;
        state.vel = 0.0;
        return;
      }
      const clampedDt = Math.min(dt, 0.05);
      const substeps = Math.ceil(clampedDt / 0.016);
      const subDt = clampedDt / substeps;
      const kStiff = 36.0;
      const cDamp = 8.5;
      for (let s = 0; s < substeps; s++) {
        const spring = -kStiff * (state.pos - targetFoot);
        const damp = -cDamp * state.vel;
        const drag = -Math.sign(state.vel) * Math.min(12.0, state.vel * state.vel * 1.8);
        const acc = spring + damp + drag;
        state.vel += acc * subDt;
        state.pos += state.vel * subDt;
        if (state.pos < -1.2) {
          state.pos = -1.2;
          if (state.vel < 0.0) state.vel = 0.0;
        } else if (state.pos > 1.2) {
          state.pos = 1.2;
          if (state.vel > 0.0) state.vel = 0.0;
        }
      }
    }

    // Preallocated Trajectory Results
    const deepTraj = {
      y: 0, theta: 0, kickAmp: 0, kickPhaseRate: 0,
      armRelax: 0, pikeAngle: 0, gazeYaw: 0, gazePitch: 0
    };
    const safeTraj = {
      y: 0, theta: 0, kickAmp: 0, kickPhaseRate: 0,
      armRelax: 0, pikeAngle: 0, gazeYaw: 0, gazePitch: 0
    };

    // Helper: Evaluates coupled wave propagation and diver rope tug at nominal rope Y
    function evalRopePoint(nominalY, time, tugAmount, outVec) {
      const u = Math.max(0.0, Math.min(1.0, (15.0 - nominalY) / 36.0));
      const tDelayed = time - u * 2.4;
      const tHeave = time - u * 0.45;

      evalWaveField(RIG_X, RIG_Z, tDelayed, ropeWaveDelayed);
      evalWaveField(RIG_X, RIG_Z, tHeave, ropeWaveHeave);

      const horizX = ropeWaveDelayed.x * (1.0 - 0.38 * u) + 0.18 * Math.sin(u * 4.5 - time * 1.5) * u;
      const horizZ = ropeWaveDelayed.z * (1.0 - 0.38 * u) + 0.12 * Math.cos(u * 3.8 - time * 1.3) * u;
      const whipX = Math.sin(u * Math.PI * 2.0) * tugAmount * 0.35;

      const vertHeave = ropeWaveHeave.y * (1.0 - 0.12 * u);
      // Surface buoy does NOT sink into the water (high buoyancy volume).
      // Only the rope down below absorbs the tension dip:
      const ropeTugDip = tugAmount * (u * 0.45 + 0.02);
      const vertY = nominalY + vertHeave - ropeTugDip;

      outVec.x = RIG_X + horizX + whipX;
      outVec.y = vertY;
      outVec.z = RIG_Z + horizZ;
    }

    // Helper: Singularity-free orientation in sagittal X-Y plane toward the rope
    function orientDiver(mesh, pitch, toRopeSign) {
      vU.set(toRopeSign * Math.sin(pitch), Math.cos(pitch), 0.0).normalize();
      vR.set(toRopeSign * Math.cos(pitch), -Math.sin(pitch), 0.18).normalize();
      const d = vR.dot(vU);
      vF.copy(vR).addScaledVector(vU, -d).normalize();
      vS.crossVectors(vF, vU).normalize();
      basisMatrix.makeBasis(vF, vU, vS);
      mesh.quaternion.setFromRotationMatrix(basisMatrix);
    }

    // Helper: Deep Diver Trajectory (50s Cycle)
    function evalDeepTrajectory(cycle, waveY, time) {
      if (cycle < 2.0) {
        // Surface breathe-up at buoy
        deepTraj.y = 14.3 + waveY * 0.8;
        deepTraj.theta = 0.08;
        deepTraj.kickAmp = 0.18;
        deepTraj.kickPhaseRate = 2.2;
        deepTraj.armRelax = 0.85;
        deepTraj.pikeAngle = 0.0;
        deepTraj.gazeYaw = 0.04 * Math.sin(time * 0.9);
        deepTraj.gazePitch = -0.05;
      } else if (cycle < 4.2) {
        // Biomechanical Duck-Dive (gliding, uninterrupted continuous descent:
        // forward streamline -> hip pike -> vertical leg lift -> kick entry with zero stalling)
        const s = (cycle - 2.0) / 2.2;
        const y0 = 14.3 + waveY * 0.8;
        // Uninterrupted, accelerating downward glide (no plateau, no floating up)
        deepTraj.y = y0 - (y0 - 11.4) * Math.pow(s, 1.25);
        // Clean sagittal rotation from surface float to vertical head-down
        deepTraj.theta = 0.08 + smoothstep(0.0, 0.65, s) * (Math.PI - 0.08);
        // Arms immediately glide into overhead streamline piercing the water
        deepTraj.armRelax = 0.85 * (1.0 - smoothstep(0.0, 0.35, s));
        // Hip pike and leg lift: fold hips while torso dives, then lift legs straight up into the air
        if (s <= 0.38) {
          const u = s / 0.38;
          deepTraj.pikeAngle = smoothstep(0, 1, u) * 1.40;
        } else {
          const u = Math.min(1.0, (s - 0.38) / 0.42);
          deepTraj.pikeAngle = 1.40 * (1.0 - smoothstep(0, 1, u));
        }
        // Legs stay straight and still during lift; first kick engages seamlessly as fins submerge
        if (s <= 0.65) {
          deepTraj.kickAmp = 0.05;
        } else {
          deepTraj.kickAmp = 0.05 + smoothstep(0.65, 1.0, s) * 0.95;
        }
        deepTraj.kickPhaseRate = 5.2;
        deepTraj.gazeYaw = 0.0; // Calm, steady forward focus down the line (no head-wobble)
        deepTraj.gazePitch = -0.15;
      } else if (cycle < 10.0) {
        // Active descent: Accelerating and fighting positive buoyancy down to 10m depth (y: 11.4 -> 4.8)
        const t = (cycle - 4.2) / 5.8;
        deepTraj.y = 11.4 + t * (4.8 - 11.4);
        deepTraj.theta = Math.PI;
        deepTraj.pikeAngle = 0.0;
        deepTraj.armRelax = 0.0;
        // Powerful, deep kicks at realistic cadence (3.8 rad/s), smoothly easing approaching 10m
        const wNeutral = smoothstep(0.65, 1.0, t);
        deepTraj.kickAmp = 1.20 * (1.0 - wNeutral);
        deepTraj.kickPhaseRate = 3.8 * (1.0 - wNeutral) + 1.8 * wNeutral;
        deepTraj.gazeYaw = 0.0;
        deepTraj.gazePitch = -0.15;
      } else if (cycle < 22.5) {
        // Hydrodynamic Freefall: Neutral/negative buoyancy from 10m depth down to bottom plate (y: 4.8 -> -15.8)
        // Diver coasts effortlessly on gravity with zero kicking!
        const u = (cycle - 10.0) / 12.5;
        deepTraj.y = 4.8 - (4.8 - (-15.8)) * (0.65 * u + 0.35 * Math.pow(u, 1.35));
        deepTraj.theta = Math.PI;
        deepTraj.pikeAngle = 0.0;
        deepTraj.armRelax = 0.0;
        deepTraj.kickAmp = 0.0; // Completely motionless, straight fins in pure streamline glide!
        deepTraj.kickPhaseRate = 0.0;
        if (cycle >= 17.0 && cycle <= 19.5) {
          deepTraj.gazeYaw = Math.sin((cycle - 17.0) / 2.5 * Math.PI) * 0.45;
          deepTraj.gazePitch = -0.15;
        } else {
          deepTraj.gazeYaw = 0.0;
          deepTraj.gazePitch = -0.15;
        }
      } else if (cycle < 28.2) {
        // Continuous Bottom Turn holding the rope at bottom plate (y = -16.8)
        if (cycle < 24.0) {
          // Approach & deceleration into bottom plate (y: -15.8 -> -16.8)
          const t = (cycle - 22.5) / 1.5;
          deepTraj.y = -15.8 + smoothstep(0, 1, t) * (-16.8 - (-15.8));
          deepTraj.theta = Math.PI;
          deepTraj.armRelax = smoothstep(0, 1, t) * 0.85; // Reaching arm out to grip the rope!
          deepTraj.pikeAngle = 0.0;
          deepTraj.kickAmp = 0.0;
          deepTraj.kickPhaseRate = 0.0;
          deepTraj.gazeYaw = 0.0;
          deepTraj.gazePitch = -0.15 + t * 0.15;
        } else if (cycle < 26.2) {
          // Diver holds the rope at the bottom plate and pivots 180 deg around this fixed point (u: 0 -> 1)
          const u = (cycle - 24.0) / 2.2;
          deepTraj.y = -16.8 - 0.12 * Math.sin(u * Math.PI);
          deepTraj.theta = Math.PI * (1.0 - smoothstep(0, 1, u));
          deepTraj.pikeAngle = Math.sin(u * Math.PI) * 1.25;
          deepTraj.armRelax = 0.85 * (1.0 - smoothstep(0.40, 1.0, u)); // Hand holding the rope
          deepTraj.kickAmp = 0.04;
          deepTraj.kickPhaseRate = 1.8;
          deepTraj.gazeYaw = Math.sin(u * Math.PI) * 0.40;
          deepTraj.gazePitch = 0.12 * Math.sin(u * Math.PI);
        } else {
          // Launch pull & kick acceleration off the plate (s: 0 -> 1, zero velocity jerk)
          const s = (cycle - 26.2) / 2.0;
          deepTraj.y = -16.8 + 2.026 * (s * s);
          deepTraj.theta = 0.0;
          deepTraj.pikeAngle = 0.0;
          deepTraj.armRelax = 0.0;
          deepTraj.kickAmp = 0.04 + smoothstep(0, 1, s) * 1.26;
          deepTraj.kickPhaseRate = 2.6 + smoothstep(0, 1, s) * 1.6; // 2.6 -> 4.2 rad/s peak
          deepTraj.gazeYaw = 0.0;
          deepTraj.gazePitch = 0.12 * smoothstep(0, 1, s);
        }
      } else if (cycle < 42.5) {
        // Deep ascent to surface with matching C1 velocity (y: -14.774 -> +14.2)
        const t = (cycle - 28.2) / 14.3;
        deepTraj.y = -14.774 + t * (14.2 - (-14.774));
        deepTraj.theta = 0.0;
        deepTraj.pikeAngle = 0.0;
        deepTraj.armRelax = 0.0;

        // Depth-dependent buoyancy & ascent kinetics (Boyle's Law):
        // 1. Deep struggle (depth > 19m, y < -4.5m): diver is maximally compressed & heaviest (-3 to -4 kg).
        //    Highest kick amplitude and cadence, but physically grounded (~0.67 Hz / 4.2 rad/s).
        // 2. Transition zone (depth 19m -> 10m, y in [-4.5, +4.5m]): lungs & wetsuit expand,
        //    buoyancy transitions through neutral. Strong, steep decline in frequency and amplitude.
        // 3. Effortless glide (depth < 10m, y >= +4.5m to surface): positive buoyancy (+2 to +3 kg)
        //    carries the diver effortlessly. Diver completely stops kicking (kickAmp = 0) and glides!
        if (deepTraj.y < -4.5) {
          deepTraj.kickAmp = 1.30;
          deepTraj.kickPhaseRate = 4.2; // Peak cadence at bottom
        } else if (deepTraj.y < 4.5) {
          const w = (deepTraj.y - (-4.5)) / (4.5 - (-4.5));
          const wEase = smoothstep(0.0, 1.0, w);
          deepTraj.kickAmp = 1.30 * (1.0 - wEase);
          deepTraj.kickPhaseRate = 4.2 * (1.0 - wEase) + 1.8 * wEase; // Steeper drop approaching 10m
        } else {
          deepTraj.kickAmp = 0.0;
          deepTraj.kickPhaseRate = 0.0;
        }

        if (cycle >= 35.0 && cycle <= 37.5) {
          deepTraj.gazeYaw = Math.sin((cycle - 35.0) / 2.5 * Math.PI) * 0.48;
        } else {
          deepTraj.gazeYaw = 0.0;
        }
        deepTraj.gazePitch = 0.12;
      } else {
        // Surface recovery & protocol at buoy (42.5 - 50.0s)
        const t = (cycle - 42.5) / 7.5;
        const tSurf = smoothstep(42.5, 44.5, cycle);
        deepTraj.y = 14.2 + (14.3 - 14.2) * t + waveY * 0.8 * tSurf;
        deepTraj.theta = 0.05 + 0.03 * t;
        deepTraj.pikeAngle = 0.0;
        deepTraj.armRelax = 0.85;
        deepTraj.kickAmp = 0.20 * tSurf;
        deepTraj.kickPhaseRate = 2.0;
        deepTraj.gazeYaw = 0.04 * Math.sin(time * 0.9);
        deepTraj.gazePitch = -0.05;
      }
    }

    // Helper: Safety Diver Trajectory (50s Cycle)
    // Procedure: Lying prone on surface with snorkel, watching down the line until the deep diver
    // tugs on the rope at the bottom turn (cycle 24.8s). Then duck-dives, descends to ~10m depth,
    // turns and escorts the diver face-to-face up to the surface.
    function evalSafetyTrajectory(cycle, deepY, waveY, time) {
      if (cycle < 24.8) {
        // 1. Surface Watch with Snorkel (0.0 - 24.8s):
        // Floating prone beside the buoy with head in water, breathing through snorkel,
        // gaze locked straight DOWN the vertical rope watching for the deep diver.
        safeTraj.y = 14.2 + waveY * 0.8;
        safeTraj.theta = 0.04; // Prone surface posture (face down)
        safeTraj.pikeAngle = 0.0;
        safeTraj.kickAmp = 0.04; // Gentle idle surface sculling to hold station beside buoy
        safeTraj.kickPhaseRate = 1.4;
        safeTraj.armRelax = 0.75; // Relaxed arms resting beside buoy
        safeTraj.gazeYaw = 0.04 * Math.sin(time * 0.75); // Alert scanning down the line
        safeTraj.gazePitch = -0.38; // Looking straight down the vertical rope!
      } else if (cycle < 27.2) {
        // 2. Alert & Athletic Duck-Dive on Bottom Rope Tug (24.8 - 27.2s):
        // Deep diver grabs rope plate at bottom (cycle 24.0 - 26.0s), shaking the buoy.
        // Safety diver reacts immediately to the tug, removes snorkel, pikes hips and plunges!
        const s = (cycle - 24.8) / 2.4;
        const y0 = 14.2 + waveY * 0.8;
        safeTraj.y = y0 - (y0 - 11.4) * Math.pow(s, 1.25);
        safeTraj.theta = 0.04 + smoothstep(0.0, 0.65, s) * (Math.PI - 0.04);
        if (s <= 0.38) {
          const u = s / 0.38;
          safeTraj.pikeAngle = smoothstep(0, 1, u) * 1.35;
        } else {
          const u = Math.min(1.0, (s - 0.38) / 0.42);
          safeTraj.pikeAngle = 1.35 * (1.0 - smoothstep(0, 1, u));
        }
        if (s <= 0.65) {
          safeTraj.kickAmp = 0.05;
        } else {
          safeTraj.kickAmp = 0.05 + smoothstep(0.65, 1.0, s) * 0.90;
        }
        safeTraj.kickPhaseRate = 3.8;
        safeTraj.armRelax = 0.0;
        safeTraj.gazeYaw = 0.0;
        safeTraj.gazePitch = -0.15;
      } else if (cycle < 34.5) {
        // 3. High-Speed Bi-fin Safety Descent to 10m depth (27.2 - 34.5s):
        // Descends rapidly down the rope from y = 11.4 to y = 4.2m (depth ~10.8m)
        const t = (cycle - 27.2) / 7.3;
        safeTraj.y = 11.4 + t * (4.2 - 11.4);
        safeTraj.theta = Math.PI;
        safeTraj.pikeAngle = 0.0;
        safeTraj.kickAmp = 0.95;
        safeTraj.kickPhaseRate = 3.8;
        // As safety diver approaches 10m meeting depth (after cycle 32.5), arms break out of streamline
        // and reach forward towards the rope to stabilize depth level and maintain visual orientation!
        const wReach = smoothstep(32.5, 34.0, cycle);
        safeTraj.armRelax = wReach * 0.90;
        safeTraj.gazeYaw = 0.0;
        safeTraj.gazePitch = -0.15; // Eyes fixed down the line watching deep diver approach
      } else if (cycle < 36.8) {
        // 4. Turn & Rendezvous Intercept (34.5 - 36.8s):
        // Sweeping 180° turn around y ≈ 4.0m to meet ascending deep diver.
        // Arms are actively forward towards the rope holding level in the water column (no stiff arrow/pileform)!
        const t = (cycle - 34.5) / 2.3;
        safeTraj.pikeAngle = Math.sin(t * Math.PI) * 1.15;
        safeTraj.theta = Math.PI * (1.0 - smoothstep(0, 1, t)); // Smooth 180° pivot from down to up!
        const hoverY = 4.2 - 0.25 * Math.sin(t * Math.PI);
        const targetEscortY = deepY - 0.55;
        safeTraj.y = hoverY * (1.0 - t) + targetEscortY * t;
        safeTraj.kickAmp = 0.45;
        safeTraj.kickPhaseRate = 3.0;
        safeTraj.armRelax = 0.90; // Active arms forward holding level and rope orientation!
        safeTraj.gazeYaw = 0.0;
        safeTraj.gazePitch = -0.15 * (1.0 - t) + 0.22 * t; // Eyes transition up to meet diver
      } else if (cycle < 42.5) {
        // 5. Escorted Ascent Side-by-Side (36.8 - 42.5s):
        // Positioned slightly below deep diver, face-to-face, hands relaxed & attentive (ready to assist)
        safeTraj.y = deepY - 0.55;
        safeTraj.theta = 0.0;
        safeTraj.pikeAngle = 0.0;
        const wGlide = smoothstep(37.4, 40.5, cycle);
        safeTraj.kickAmp = 0.40 * (1.0 - wGlide) + 0.08 * wGlide;
        safeTraj.kickPhaseRate = 3.2 * (1.0 - wGlide) + 2.0 * wGlide;
        safeTraj.armRelax = 0.70; // Attentive escort posture with hands in front ready to assist, NOT overhead arrow!
        safeTraj.gazeYaw = 0.0;
        safeTraj.gazePitch = 0.22; // Direct visual contact on deep diver's eyes and mask
      } else {
        // 6. Surface Recovery & Protocol at Buoy (42.5 - 50.0s)
        const tSurf = smoothstep(42.5, 44.5, cycle);
        safeTraj.y = (14.2 - 0.55) * (1.0 - tSurf) + (14.2 + waveY * 0.8) * tSurf;
        safeTraj.theta = 0.04;
        safeTraj.pikeAngle = 0.0;
        safeTraj.kickAmp = 0.08 * (1.0 - tSurf) + 0.04 * tSurf;
        safeTraj.kickPhaseRate = 1.4;
        safeTraj.armRelax = 0.75 * tSurf;
        safeTraj.gazeYaw = 0.0;
        safeTraj.gazePitch = 0.22 * (1.0 - tSurf) - 0.38 * tSurf; // Returns gaze down line
      }
    }

    // -------------------------------------------------------------------------
    // Update Loop
    // -------------------------------------------------------------------------
    function update(time, paused, speed) {
      if (!group.visible) return;

      const cycle = ((time % CYCLE_PERIOD) + CYCLE_PERIOD) % CYCLE_PERIOD;
      const diveIndex = Math.floor((time + 8.0) / CYCLE_PERIOD);
      const isMonofinDeep = (diveIndex % 2 === 0);

      // 1. Bottom-Turn Rope Tug Impulse (Diver gripping and pulling down on rope at cycle 24.0 - 31.0s)
      let tugAmount = 0.0;
      if (cycle >= 24.0 && cycle < 26.0) {
        // Braking & swing pull as diver grips rope
        const p = (cycle - 24.0) / 2.0;
        tugAmount = Math.sin(p * Math.PI) * 0.48;
      } else if (cycle >= 26.0 && cycle < 28.0) {
        // Powerful upward launch pull (pulling down on rope with arm)
        const p = (cycle - 26.0) / 2.0;
        tugAmount = Math.sin(p * Math.PI) * 0.85;
      } else if (cycle >= 28.0 && cycle < 31.0) {
        // Elastic recoil & heave bounce of buoy and rope
        const p = (cycle - 28.0) / 3.0;
        tugAmount = -0.35 * Math.sin(p * Math.PI * 3.0) * Math.exp(-p * 3.2);
      }

      // 2. Coupled Buoy, Rope, Bottom Plate & Ballast Motion
      evalWaveField(RIG_X, RIG_Z, time, waveBuoy);

      evalRopePoint(ROPE_TOP_Y, time, tugAmount, buoyPos);
      buoyGroup.position.copy(buoyPos);
      const tugTilt = isMonofinDeep ? -tugAmount * 0.10 : tugAmount * 0.10;
      buoyGroup.rotation.set(waveBuoy.slopeZ * 0.35 + tugAmount * 0.10, 0, -waveBuoy.slopeX * 0.35 + tugTilt);

      // Update 49 height-rings of the rope geometry directly
      for (let iy = 0; iy <= 48; iy++) {
        const nominalY = 15.0 - (iy / 48.0) * 36.0;
        evalRopePoint(nominalY, time, tugAmount, ropeRingCenter);
        for (let ix = 0; ix <= 8; ix++) {
          const index = iy * 9 + ix;
          const a = (ix / 8.0) * Math.PI * 2.0;
          const dx = 0.024 * Math.cos(a);
          const dz = 0.024 * Math.sin(a);
          ropePosAttr.setXYZ(index, ropeRingCenter.x + dx, ropeRingCenter.y, ropeRingCenter.z + dz);
        }
      }
      ropePosAttr.needsUpdate = true;

      // Bottom Plate at y = -17.5 m
      evalRopePoint(PLATE_Y, time, tugAmount, platePos);
      plateGroup.position.copy(platePos);
      plateLampGroup.position.copy(platePos);

      evalRopePoint(PLATE_Y + 0.25, time, tugAmount, tangentAbove);
      evalRopePoint(PLATE_Y - 0.25, time, tugAmount, tangentBelow);
      tangentVec.subVectors(tangentAbove, tangentBelow).normalize();
      plateGroup.quaternion.setFromUnitVectors(unitY, tangentVec);
      plateLampGroup.quaternion.copy(plateGroup.quaternion);

      // Ballast Weight at y = -21.0 m
      evalRopePoint(BALLAST_Y, time, tugAmount, ballastPos);
      ballastGroup.position.copy(ballastPos);
      evalRopePoint(BALLAST_Y + 0.25, time, tugAmount, tangentAbove);
      evalRopePoint(BALLAST_Y, time, tugAmount, tangentBelow);
      tangentVec.subVectors(tangentAbove, tangentBelow).normalize();
      ballastGroup.quaternion.setFromUnitVectors(unitY, tangentVec);

      // Optical power updates: NIGHT ONLY!
      const daylightVal = (waterUniforms && waterUniforms.daylight && typeof waterUniforms.daylight.value === 'number')
        ? waterUniforms.daylight.value : 1.0;
      const nightFactor = smoothstep(0.35, 0.04, daylightVal);
      const lampPower = nightFactor * 0.70;
      bottomLampUniforms.uLampPower.value = lampPower;
      ropeUniforms.uLampPower.value = lampPower;
      discMat.emissiveIntensity = 0.35 * lampPower;
      lampDomeMat.color.setRGB(0.75 * lampPower, 0.92 * lampPower, 1.0 * lampPower);

      // 3. Diver Role Alternation every 50-second cycle
      evalDeepTrajectory(cycle, waveBuoy.y, time);
      evalSafetyTrajectory(cycle, deepTraj.y, waveBuoy.y, time);

      const monoTraj = isMonofinDeep ? deepTraj : safeTraj;
      const biTraj = isMonofinDeep ? safeTraj : deepTraj;

      let monoX = RIG_X - 0.78;
      let biX = RIG_X + 0.82;
      if (cycle >= 23.5 && cycle <= 26.8) {
        const uTurn = smoothstep(23.5, 24.8, cycle) * (1.0 - smoothstep(25.8, 26.8, cycle));
        if (isMonofinDeep) {
          monoX = (RIG_X - 0.78) + uTurn * 0.40;
        } else {
          biX = (RIG_X + 0.82) - uTurn * 0.40;
        }
      }

      let dtPhase = 0.0;
      if (lastUpdateTime === undefined) {
        dtPhase = 0.016;
      } else if (time > lastUpdateTime) {
        dtPhase = Math.min(time - lastUpdateTime, 0.05);
      }
      if (paused) dtPhase = 0.0;

      // 2nd-Order Inertial Tracking for Monofin Diver
      stepInertial(mainInertial.theta, monoTraj.theta, 9.0, 1.1, dtPhase);
      stepInertial(mainInertial.y, monoTraj.y, 14.0, 1.05, dtPhase);
      stepInertial(mainInertial.x, monoX, 8.0, 1.15, dtPhase);
      stepInertial(mainInertial.pike, monoTraj.pikeAngle, 10.0, 1.1, dtPhase);
      stepInertial(mainInertial.arm, monoTraj.armRelax, 8.5, 1.1, dtPhase);
      stepInertial(mainInertial.yaw, monoTraj.gazeYaw, 7.5, 1.1, dtPhase);
      stepInertial(mainInertial.pitch, monoTraj.gazePitch, 7.5, 1.1, dtPhase);

      // 2nd-Order Inertial Tracking for Bi-Fin Diver
      stepInertial(safeInertial.theta, biTraj.theta, 9.0, 1.1, dtPhase);
      stepInertial(safeInertial.y, biTraj.y, 14.0, 1.05, dtPhase);
      stepInertial(safeInertial.x, biX, 8.0, 1.15, dtPhase);
      stepInertial(safeInertial.pike, biTraj.pikeAngle, 10.0, 1.1, dtPhase);
      stepInertial(safeInertial.arm, biTraj.armRelax, 8.5, 1.1, dtPhase);
      stepInertial(safeInertial.yaw, biTraj.gazeYaw, 7.5, 1.1, dtPhase);
      stepInertial(safeInertial.pitch, biTraj.gazePitch, 7.5, 1.1, dtPhase);

      // Position & Orient Monofin Diver (Left side, facing +X toward rope)
      mainDiverMesh.position.set(mainInertial.x.pos, mainInertial.y.pos, RIG_Z);
      orientDiver(mainDiverMesh, mainInertial.theta.pos, 1.0);

      // Bioluminescent fin shear shimmer at night
      const nightBioFactor = smoothstep(0.35, 0.02, daylightVal);
      mainUniforms.uBioShimmer.value = nightBioFactor * Math.min(1.0, monoTraj.kickAmp * 1.35);
      safeUniforms.uBioShimmer.value = nightBioFactor * Math.min(1.0, biTraj.kickAmp * 1.35);

      // Boyle's Law hydrostatic compression: 0 at surface (y = 14.3), 1 at bottom plate (y = -16.8)
      const monoDepthComp = Math.max(0.0, Math.min(1.0, (14.3 - mainInertial.y.pos) / 31.1));
      const biDepthComp = Math.max(0.0, Math.min(1.0, (14.3 - safeInertial.y.pos) / 31.1));
      mainUniforms.uDepthCompression.value = monoDepthComp;
      safeUniforms.uDepthCompression.value = biDepthComp;

      monoKickPhase += monoTraj.kickPhaseRate * dtPhase;
      biKickPhase += biTraj.kickPhaseRate * dtPhase;

      // Elastodynamic Fin Dynamics (Spring-Damper-Mass Oscillators)
      const targetFootMono = Math.sin(monoKickPhase - 1.2) * monoTraj.kickAmp * 0.55;
      const targetFootBiL = -Math.sin(biKickPhase) * biTraj.kickAmp * 0.48;
      const targetFootBiR = Math.sin(biKickPhase) * biTraj.kickAmp * 0.48;

      stepFinOscillator(monoFinState, targetFootMono, dtPhase);
      stepFinOscillator(biFinLState, targetFootBiL, dtPhase);
      stepFinOscillator(biFinRState, targetFootBiR, dtPhase);

      mainUniforms.uMonoBladeFlex.value = monoFinState.pos;
      mainUniforms.uBiBladeFlexL.value = 0.0;
      mainUniforms.uBiBladeFlexR.value = 0.0;

      safeUniforms.uMonoBladeFlex.value = 0.0;
      safeUniforms.uBiBladeFlexL.value = biFinLState.pos;
      safeUniforms.uBiBladeFlexR.value = biFinRState.pos;

      mainUniforms.uKickPhase.value = monoKickPhase;
      mainUniforms.uKickAmp.value = monoTraj.kickAmp;
      mainUniforms.uArmRelax.value = mainInertial.arm.pos;
      mainUniforms.uPikeAngle.value = mainInertial.pike.pos;
      mainUniforms.uHeadYaw.value = mainInertial.yaw.pos;
      mainUniforms.uTime.value = time;

      // Position & Orient Bi-fin Diver (Right side, facing -X toward rope)
      safetyDiverMesh.position.set(safeInertial.x.pos, safeInertial.y.pos, RIG_Z);
      orientDiver(safetyDiverMesh, safeInertial.theta.pos, -1.0);

      safeUniforms.uKickPhase.value = biKickPhase;
      safeUniforms.uKickAmp.value = biTraj.kickAmp;
      safeUniforms.uArmRelax.value = safeInertial.arm.pos;
      safeUniforms.uPikeAngle.value = safeInertial.pike.pos;
      safeUniforms.uHeadYaw.value = safeInertial.yaw.pos;
      safeUniforms.uTime.value = time;

      // 4. Forehead Torch & Camera Glint (Active ONLY on current Deep Diver at NIGHT)
      // Weak intimate beam illuminating face and in toward the dive rope
      const torchBasePower = nightFactor * 0.30;

      if (isMonofinDeep) {
        // Monofin is Deep Diver: Torch ON
        mainTorchGroup.rotation.y = mainInertial.yaw.pos;
        mainTorchGroup.rotation.z = mainInertial.pitch.pos;
        let fade = 1.0;
        if (mainInertial.y.pos > 13.5) {
          fade = 1.0 - Math.min(1.0, (mainInertial.y.pos - 13.5) / 1.5) * 0.85;
        }
        mainTorchUniforms.uTorchPower.value = torchBasePower * fade;

        mainTorchGroup.updateMatrixWorld();
        torchWorldDir.set(0.92, 0.39, 0.0).transformDirection(mainTorchGroup.matrixWorld).normalize();
        torchWorldPos.setFromMatrixPosition(mainTorchGroup.matrixWorld);
        toCameraDir.subVectors(eyePos, torchWorldPos).normalize();
        const align = Math.max(0.0, torchWorldDir.dot(toCameraDir));
        mainGlintUniforms.uGlintIntensity.value = (nightFactor > 0.01 && align > 0.75) ? Math.pow((align - 0.75) / 0.25, 2.2) * nightFactor : 0.0;

        // Bi-fin is Safety: Torch OFF
        safeTorchUniforms.uTorchPower.value = 0.0;
        safeGlintUniforms.uGlintIntensity.value = 0.0;
      } else {
        // Bi-fin is Deep Diver: Torch ON
        safeTorchGroup.rotation.y = safeInertial.yaw.pos;
        safeTorchGroup.rotation.z = safeInertial.pitch.pos;
        let fade = 1.0;
        if (safeInertial.y.pos > 13.5) {
          fade = 1.0 - Math.min(1.0, (safeInertial.y.pos - 13.5) / 1.5) * 0.85;
        }
        safeTorchUniforms.uTorchPower.value = torchBasePower * fade;

        safeTorchGroup.updateMatrixWorld();
        torchWorldDir.set(0.92, 0.39, 0.0).transformDirection(safeTorchGroup.matrixWorld).normalize();
        torchWorldPos.setFromMatrixPosition(safeTorchGroup.matrixWorld);
        toCameraDir.subVectors(eyePos, torchWorldPos).normalize();
        const align = Math.max(0.0, torchWorldDir.dot(toCameraDir));
        safeGlintUniforms.uGlintIntensity.value = (nightFactor > 0.01 && align > 0.75) ? Math.pow((align - 0.75) / 0.25, 2.2) * nightFactor : 0.0;

        // Monofin is Safety: Torch OFF
        mainTorchUniforms.uTorchPower.value = 0.0;
        mainGlintUniforms.uGlintIntensity.value = 0.0;
      }

      // 5. Surface Splash & Expanding Mask/Goggle Air Bubbles (140 points)
      // Part A: Surface splash droplets at buoy (points 0..23)
      let activeSplash = false;
      let splashProgress = 0.0;
      let splashCenterX = isMonofinDeep ? mainInertial.x.pos : safeInertial.x.pos;

      if (cycle >= 2.0 && cycle <= 4.4) {
        // Deep diver duck-dive
        activeSplash = true;
        splashProgress = (cycle - 2.0) / 2.4;
        splashCenterX = isMonofinDeep ? mainInertial.x.pos : safeInertial.x.pos;
      } else if (cycle >= 17.5 && cycle <= 19.9) {
        // Safety diver duck-dive
        activeSplash = true;
        splashProgress = (cycle - 17.5) / 2.4;
        splashCenterX = isMonofinDeep ? safeInertial.x.pos : mainInertial.x.pos;
      } else if (cycle >= 41.5 && cycle <= 45.0) {
        // Divers surfacing
        activeSplash = true;
        splashProgress = (cycle - 41.5) / 3.5;
        splashCenterX = isMonofinDeep ? mainInertial.x.pos : safeInertial.x.pos;
      }

      for (let k = 0; k < 24; k++) {
        if (activeSplash) {
          const a = (k / 24.0) * Math.PI * 2.0 + bubbleSeed[k * 2];
          const rad = 0.20 + splashProgress * 0.90 + bubbleSeed[k * 2 + 1] * 0.35;
          const dropY = 15.0 + waveBuoy.y + Math.sin(splashProgress * Math.PI) * 0.40 * (1.0 - k / 24.0) - splashProgress * 0.12;
          bubblePositions[k * 3] = splashCenterX + Math.cos(a) * rad;
          bubblePositions[k * 3 + 1] = dropY;
          bubblePositions[k * 3 + 2] = RIG_Z + Math.sin(a) * rad;
        } else {
          bubblePositions[k * 3 + 1] = -999.0;
        }
      }

      // Part B: Entrained wake bubbles (Old fake static points are deactivated - real bubbles use Eulerian mbActive pool)
      for (let k = 24; k < 54; k++) {
        bubblePositions[k * 3 + 1] = -999.0;
        bubbleRadii[k] = 0.0;
      }

      // Part C & D: Individual Mask Bubbles Simulation (104 individual bubble entities + 2 Clinging Mask Pockets)
      // Clinging air pocket on mask skirt, stochastic burst emission, Davies-Taylor buoyant velocity (v ~ sqrt(R)),
      // low-pressure wake drafting, Boyle's law expansion, and coalescence into large, fast-rising spherical caps!
      let dt = (lastSimTime !== undefined && time > lastSimTime) ? Math.min(time - lastSimTime, 0.05) : 0.016;
      if (paused) dt = 0.0;
      lastSimTime = time;

      // Cycle boundary reset: only clear any stray lingering bubbles at surface breathe-up (cycle < 0.5)
      if (cycle < 0.5) {
        for (let i = 0; i < MASK_BUBBLE_COUNT; i++) {
          if (mbActive[i] && mbY[i] >= 14.8) {
            mbActive[i] = 0;
            bubblePositions[(56 + i) * 3 + 1] = -999.0;
            bubbleRadii[56 + i] = 0.0;
          }
        }
        deepBurstTimer = 0.0;
        deepBurstInterval = 0.65;
        safeBurstTimer = 0.0;
        safeBurstInterval = 0.75;
        deepDuckTimer = 0.0;
        safeDuckTimer = 0.0;
      }

      const isDeepAscending = (cycle >= 26.2 && cycle <= 42.0);
      const deepFaceX = isMonofinDeep ? mainInertial.x.pos : safeInertial.x.pos;
      const deepFaceY = (isMonofinDeep ? mainInertial.y.pos : safeInertial.y.pos) + 0.65;
      const deepFaceZ = RIG_Z + 0.10;
      const deepDepth = Math.max(0.0, 15.0 - (isMonofinDeep ? mainInertial.y.pos : safeInertial.y.pos));
      const deepP = 1.0 + deepDepth * 0.10;

      const isSafeAscending = (cycle >= 35.2 && cycle <= 42.0);
      const safeFaceX = isMonofinDeep ? safeInertial.x.pos : mainInertial.x.pos;
      const safeFaceY = (isMonofinDeep ? safeInertial.y.pos : mainInertial.y.pos) + 0.65;
      const safeFaceZ = RIG_Z + 0.10;
      const safeDepth = Math.max(0.0, 15.0 - (isMonofinDeep ? safeInertial.y.pos : mainInertial.y.pos));
      const safeP = 1.0 + safeDepth * 0.10;

      // 1. Clinging Mask Air Pockets (Points 54 & 55)
      // Persistent silvery air pocket trapped on the mask skirt / temple, expanding with Boyle's law
      if (isDeepAscending) {
        const pocketVolRatio = Math.max(1.0, 4.25 / deepP);
        deepPocketRad = 0.024 * Math.pow(pocketVolRatio, 0.3333333);
        bubblePositions[54 * 3] = deepFaceX + (isMonofinDeep ? 0.045 : -0.045);
        bubblePositions[54 * 3 + 1] = deepFaceY + 0.035 + Math.sin(time * 9.0) * 0.003;
        bubblePositions[54 * 3 + 2] = deepFaceZ + 0.025 + Math.cos(time * 7.5) * 0.003;
        bubbleRadii[54] = deepPocketRad;
      } else {
        bubblePositions[54 * 3 + 1] = -999.0;
        bubbleRadii[54] = 0.0;
      }

      if (isSafeAscending) {
        const safePocketVolRatio = Math.max(1.0, 2.50 / safeP);
        safePocketRad = 0.022 * Math.pow(safePocketVolRatio, 0.3333333);
        bubblePositions[55 * 3] = safeFaceX + (isMonofinDeep ? -0.045 : 0.045);
        bubblePositions[55 * 3 + 1] = safeFaceY + 0.035 + Math.sin(time * 8.5) * 0.003;
        bubblePositions[55 * 3 + 2] = safeFaceZ + 0.025 + Math.cos(time * 6.5) * 0.003;
        bubbleRadii[55] = safePocketRad;
      } else {
        bubblePositions[55 * 3 + 1] = -999.0;
        bubbleRadii[55] = 0.0;
      }

      if (dt > 0.0) {
        // 2a. Duck-Dive Surface Air Shedding (depth 0 - 2.5m, y: 14.8 -> 12.2m)
        // Trapped surface air sheds as the diver submerges headfirst, then floats UP towards the surface waves
        const isDeepDuck = (cycle >= 2.0 && cycle <= 4.8 && deepFaceY > 12.2);
        const isSafeDuck = (cycle >= 24.8 && cycle <= 27.5 && safeFaceY > 12.2);

        if (isDeepDuck) {
          deepDuckTimer += dt;
          if (deepDuckTimer >= 0.22) {
            deepDuckTimer = 0.0;
            const seed = fract(Math.sin(time * 43.19 + deepDepth * 11.23) * 43758.5453);
            const burstCount = 2 + Math.floor(seed * 2.8);
            let spawned = 0;
            for (let i = 0; i < MASK_BUBBLE_COUNT && spawned < burstCount; i++) {
              if (!mbActive[i]) {
                mbActive[i] = 1;
                const bSeed1 = fract(Math.sin(i * 19.31 + time * 7.81 + spawned * 3.41) * 43758.5453);
                const bSeed2 = fract(Math.sin(i * 29.17 + time * 5.67 + spawned * 6.83) * 43758.5453);
                const initR = 0.016 + 0.022 * bSeed1;
                const initV = (4.0 / 3.0) * Math.PI * Math.pow(initR * 100.0, 3.0);
                mbInitVol[i] = initV;
                mbInitRad[i] = initR;
                mbVol[i] = initV;
                mbRad[i] = initR;
                mbSpawnP[i] = deepP;
                mbDiverId[i] = 0;

                mbX[i] = deepFaceX + (isMonofinDeep ? 0.045 : -0.045) + (bSeed1 - 0.5) * 0.08;
                mbY[i] = deepFaceY + 0.04 - spawned * 0.03;
                mbZ[i] = deepFaceZ + (bSeed2 - 0.5) * 0.08;

                // Positive upward Archimedes buoyancy (rising away from diving body!)
                mbVy[i] = 0.42 + bSeed1 * 0.25;
                mbVx[i] = (bSeed1 - 0.5) * 0.06;
                mbVz[i] = (bSeed2 - 0.5) * 0.06;
                spawned++;
              }
            }
          }
        }
        if (isSafeDuck) {
          safeDuckTimer += dt;
          if (safeDuckTimer >= 0.22) {
            safeDuckTimer = 0.0;
            const seed = fract(Math.sin(time * 31.47 + safeDepth * 13.51) * 43758.5453);
            const burstCount = 2 + Math.floor(seed * 2.8);
            let spawned = 0;
            for (let i = 0; i < MASK_BUBBLE_COUNT && spawned < burstCount; i++) {
              if (!mbActive[i]) {
                mbActive[i] = 1;
                const bSeed1 = fract(Math.sin(i * 23.41 + time * 8.19 + spawned * 4.13) * 43758.5453);
                const bSeed2 = fract(Math.sin(i * 37.89 + time * 6.43 + spawned * 5.71) * 43758.5453);
                const initR = 0.016 + 0.022 * bSeed1;
                const initV = (4.0 / 3.0) * Math.PI * Math.pow(initR * 100.0, 3.0);
                mbInitVol[i] = initV;
                mbInitRad[i] = initR;
                mbVol[i] = initV;
                mbRad[i] = initR;
                mbSpawnP[i] = safeP;
                mbDiverId[i] = 1;

                mbX[i] = safeFaceX + (isMonofinDeep ? -0.045 : 0.045) + (bSeed1 - 0.5) * 0.08;
                mbY[i] = safeFaceY + 0.04 - spawned * 0.03;
                mbZ[i] = safeFaceZ + (bSeed2 - 0.5) * 0.08;

                mbVy[i] = 0.42 + bSeed1 * 0.25;
                mbVx[i] = (bSeed1 - 0.5) * 0.06;
                mbVz[i] = (bSeed2 - 0.5) * 0.06;
                spawned++;
              }
            }
          }
        }

        // 2b. Irregular Burst Emission from Deep Diver Mask (Ascent)
        // Gas accumulates under the flexible skirt and releases in stochastic bursts (2-5 bubbles of diverse sizes)
        if (isDeepAscending) {
          deepBurstTimer += dt;
          if (deepBurstTimer >= deepBurstInterval) {
            deepBurstTimer = 0.0;
            const seed = fract(Math.sin(time * 37.13 + deepDepth * 9.27) * 43758.5453);
            const baseInterval = 0.28 + 1.25 * (deepP / 4.25);
            deepBurstInterval = baseInterval * (0.45 + 1.10 * seed);

            const burstCount = 2 + Math.floor(seed * 3.8); // Cluster of 2 to 5 bubbles
            let spawned = 0;
            for (let i = 0; i < MASK_BUBBLE_COUNT && spawned < burstCount; i++) {
              if (!mbActive[i]) {
                mbActive[i] = 1;
                const bSeed1 = fract(Math.sin(i * 17.13 + time * 6.31 + spawned * 5.17) * 43758.5453);
                const bSeed2 = fract(Math.sin(i * 31.79 + time * 9.17 + spawned * 7.39) * 43758.5453);
                const isLead = (spawned === 0);
                const initR = isLead ? (0.038 + 0.024 * bSeed1) : (0.016 + 0.016 * bSeed1);
                const initV = (4.0 / 3.0) * Math.PI * Math.pow(initR * 100.0, 3.0);
                mbInitVol[i] = initV;
                mbInitRad[i] = initR;
                mbVol[i] = initV;
                mbRad[i] = initR;
                mbSpawnP[i] = deepP;
                mbDiverId[i] = 0;

                mbX[i] = deepFaceX + (isMonofinDeep ? 0.045 : -0.045) + (bSeed1 - 0.5) * 0.06;
                mbY[i] = deepFaceY + 0.02 - spawned * 0.025;
                mbZ[i] = deepFaceZ + (bSeed2 - 0.5) * 0.06;

                mbVy[i] = 0.75 + mainDiverState.velocity.y * 0.45 + spawned * 0.08;
                mbVx[i] = mainDiverState.velocity.x * 0.20 + (bSeed1 - 0.5) * 0.08;
                mbVz[i] = mainDiverState.velocity.z * 0.20 + (bSeed2 - 0.5) * 0.08;
                spawned++;
              }
            }
          }
        }

        // 3. Irregular Burst Emission from Safety Diver Mask
        if (isSafeAscending) {
          safeBurstTimer += dt;
          if (safeBurstTimer >= safeBurstInterval) {
            safeBurstTimer = 0.0;
            const seed = fract(Math.sin(time * 29.41 + safeDepth * 8.13) * 43758.5453);
            const baseInterval = 0.35 + 1.10 * (safeP / 2.50);
            safeBurstInterval = baseInterval * (0.50 + 1.15 * seed);

            const burstCount = 2 + Math.floor(seed * 3.0);
            let spawned = 0;
            for (let i = 0; i < MASK_BUBBLE_COUNT && spawned < burstCount; i++) {
              if (!mbActive[i]) {
                mbActive[i] = 1;
                const bSeed1 = fract(Math.sin(i * 23.41 + time * 5.17 + spawned * 4.31) * 43758.5453);
                const bSeed2 = fract(Math.sin(i * 41.27 + time * 8.39 + spawned * 6.19) * 43758.5453);
                const isLead = (spawned === 0);
                const initR = isLead ? (0.035 + 0.020 * bSeed1) : (0.015 + 0.015 * bSeed1);
                const initV = (4.0 / 3.0) * Math.PI * Math.pow(initR * 100.0, 3.0);
                mbInitVol[i] = initV;
                mbInitRad[i] = initR;
                mbVol[i] = initV;
                mbRad[i] = initR;
                mbSpawnP[i] = safeP;
                mbDiverId[i] = 1;

                mbX[i] = safeFaceX + (isMonofinDeep ? -0.045 : 0.045) + (bSeed1 - 0.5) * 0.06;
                mbY[i] = safeFaceY + 0.02 - spawned * 0.025;
                mbZ[i] = safeFaceZ + (bSeed2 - 0.5) * 0.06;

                mbVy[i] = 0.70 + safetyDiverState.velocity.y * 0.45 + spawned * 0.08;
                mbVx[i] = safetyDiverState.velocity.x * 0.20 + (bSeed1 - 0.5) * 0.08;
                mbVz[i] = safetyDiverState.velocity.z * 0.20 + (bSeed2 - 0.5) * 0.08;
                spawned++;
              }
            }
          }
        }

        // 4. Physics Integration: Davies-Taylor Buoyancy (v ~ sqrt(R)), Wake Lift & Boyle's Law
        for (let i = 0; i < MASK_BUBBLE_COUNT; i++) {
          if (!mbActive[i]) continue;

          // Boyle's law: V = V_spawn * (P_spawn / P_current)
          const curDepth = Math.max(0.0, 15.0 - mbY[i]);
          const curP = 1.0 + curDepth * 0.10;
          const pRatio = Math.max(0.15, mbSpawnP[i] / curP);
          mbVol[i] = mbInitVol[i] * pRatio;
          mbRad[i] = mbInitRad[i] * Math.pow(pRatio, 0.3333333);

          // Davies-Taylor buoyant terminal velocity: v_buoy increases with sqrt(Radius)
          // Larger bubbles have more buoyancy relative to frontal area and rise significantly faster!
          const normR = Math.min(1.0, mbRad[i] / 0.08);
          const buoySpeed = 0.65 + 1.15 * Math.sqrt(normR);

          // Upward wake slipstream entrainment from the ascending diver
          const dFaceY = (mbDiverId[i] === 0) ? deepFaceY : safeFaceY;
          const dFaceX = (mbDiverId[i] === 0) ? deepFaceX : safeFaceX;
          const dVelY = (mbDiverId[i] === 0) ? mainDiverState.velocity.y : safetyDiverState.velocity.y;
          const distY = dFaceY - mbY[i];
          const distX = dFaceX - mbX[i];
          const distZ = RIG_Z + 0.10 - mbZ[i];
          const horizDist = Math.sqrt(distX * distX + distZ * distZ);

          let wakeLift = 0.0;
          if (distY >= -0.3 && distY <= 2.5 && horizDist < 0.55 && dVelY > 0.0) {
            wakeLift = dVelY * 0.65 * Math.exp(-Math.max(0.0, distY) / 0.95) * (1.0 - horizDist / 0.55);
          }

          const targetVy = buoySpeed + wakeLift;
          mbVy[i] += (targetVy - mbVy[i]) * Math.min(1.0, dt * 5.0);
          mbVx[i] = Math.sin(time * 6.8 + i * 1.5) * 0.07;
          mbVz[i] = Math.cos(time * 6.2 + i * 1.8) * 0.07;

          mbX[i] += mbVx[i] * dt;
          mbY[i] += mbVy[i] * dt;
          mbZ[i] += mbVz[i] * dt;

          // Burst at ocean surface waves
          if (mbY[i] >= 15.0 + waveBuoy.y - 0.04) {
            mbActive[i] = 0;
            bubblePositions[(56 + i) * 3 + 1] = -999.0;
            bubbleRadii[56 + i] = 0.0;
          }
        }

        // 5. Wake Drafting & Coalescence (merging into larger, faster spherical caps)
        for (let i = 0; i < MASK_BUBBLE_COUNT; i++) {
          if (!mbActive[i]) continue;
          for (let j = 0; j < MASK_BUBBLE_COUNT; j++) {
            if (i === j || !mbActive[j]) continue;

            const dy = mbY[i] - mbY[j]; // Positive if bubble i is ABOVE bubble j
            const dx = mbX[i] - mbX[j];
            const dz = mbZ[i] - mbZ[j];
            const hDist2 = dx * dx + dz * dz;
            const rSum = mbRad[i] + mbRad[j];

            // 5a. Drafting: trailing bubble j drafts into the wake suction of leading bubble i
            if (dy > 0.04 && dy < 0.65 && hDist2 < (mbRad[i] * 2.2 + 0.05) * (mbRad[i] * 2.2 + 0.05)) {
              const draftFactor = 1.0 - dy / 0.65;
              // Accelerate trailing bubble upward into the lead bubble's base
              mbVy[j] += 0.65 * draftFactor * dt * 4.0;
              mbX[j] += dx * draftFactor * dt * 2.0;
              mbZ[j] += dz * draftFactor * dt * 2.0;
            }

            // 5b. Collision & Coalescence: merge into a single larger bubble!
            if (i < j && hDist2 < (rSum * rSum * 1.65) && Math.abs(dy) < (rSum * 1.85)) {
              const mergedVol = mbVol[i] + mbVol[j];
              const mergedInitVol = mbInitVol[i] + mbInitVol[j];
              mbVol[i] = mergedVol;
              mbInitVol[i] = mergedInitVol;
              // Analytical radius from conservation of volume (4/3 * pi * R^3)
              mbRad[i] = Math.pow(mergedVol / ((4.0 / 3.0) * Math.PI), 1.0 / 3.0) * 0.01;
              mbInitRad[i] = Math.pow(mergedInitVol / ((4.0 / 3.0) * Math.PI), 1.0 / 3.0) * 0.01;

              // Mass-weighted center of position and upward momentum surge
              mbX[i] = (mbX[i] * mbVol[i] + mbX[j] * mbVol[j]) / mergedVol;
              mbY[i] = Math.max(mbY[i], mbY[j]) + 0.02;
              mbZ[i] = (mbZ[i] * mbVol[i] + mbZ[j] * mbVol[j]) / mergedVol;
              mbVy[i] += 0.14;

              // Deactivate absorbed bubble j
              mbActive[j] = 0;
              bubblePositions[(56 + j) * 3 + 1] = -999.0;
              bubbleRadii[56 + j] = 0.0;
            }
          }
        }
      }

      // Write active bubbles to GPU attributes
      for (let i = 0; i < MASK_BUBBLE_COUNT; i++) {
        const k = 56 + i;
        if (mbActive[i]) {
          bubblePositions[k * 3] = mbX[i];
          bubblePositions[k * 3 + 1] = mbY[i];
          bubblePositions[k * 3 + 2] = mbZ[i];
          bubbleRadii[k] = mbRad[i];
        } else {
          bubblePositions[k * 3 + 1] = -999.0;
          bubbleRadii[k] = 0.0;
        }
      }
      bubbleGeom.attributes.position.needsUpdate = true;
      bubbleGeom.attributes.aRadius.needsUpdate = true;

      // 6. Lanyard Line (Follows active Deep Diver)
      const activeDeepMesh = isMonofinDeep ? mainDiverMesh : safetyDiverMesh;
      activeDeepMesh.updateMatrix();
      activeDeepMesh.matrixWorld.copy(activeDeepMesh.matrix);
      diverLanyardPoint.set(0.10, 0.08, 0.0).applyMatrix4(activeDeepMesh.matrixWorld);

      const activeDeepY = isMonofinDeep ? mainInertial.y.pos : safeInertial.y.pos;
      evalRopePoint(activeDeepY, time, tugAmount, ropeCarabinerPoint);

      lanyardPositions[0] = diverLanyardPoint.x;
      lanyardPositions[1] = diverLanyardPoint.y;
      lanyardPositions[2] = diverLanyardPoint.z;
      lanyardPositions[3] = ropeCarabinerPoint.x;
      lanyardPositions[4] = ropeCarabinerPoint.y;
      lanyardPositions[5] = ropeCarabinerPoint.z;
      lanyardGeom.attributes.position.needsUpdate = true;

      // 7. Active Divers State for wakes / bioluminescence
      const velDt = (dtPhase > 0.0001) ? dtPhase : 0.016;

      mainDiverState.velocity.set(
        (mainDiverMesh.position.x - prevMainPos.x) / velDt,
        (mainDiverMesh.position.y - prevMainPos.y) / velDt,
        (mainDiverMesh.position.z - prevMainPos.z) / velDt
      );
      prevMainPos.copy(mainDiverMesh.position);
      mainDiverState.position.copy(mainDiverMesh.position);
      mainDiverState.heading.set(Math.sin(mainInertial.theta.pos), Math.cos(mainInertial.theta.pos), 0.0).normalize();
      mainDiverState.kickAmp = monoTraj.kickAmp;
      mainDiverState.visible = group.visible;

      safetyDiverState.velocity.set(
        (safetyDiverMesh.position.x - prevSafePos.x) / velDt,
        (safetyDiverMesh.position.y - prevSafePos.y) / velDt,
        (safetyDiverMesh.position.z - prevSafePos.z) / velDt
      );
      prevSafePos.copy(safetyDiverMesh.position);
      safetyDiverState.position.copy(safetyDiverMesh.position);
      safetyDiverState.heading.set(-Math.sin(safeInertial.theta.pos), Math.cos(safeInertial.theta.pos), 0.0).normalize();
      safetyDiverState.kickAmp = biTraj.kickAmp;
      safetyDiverState.visible = group.visible;

      lastUpdateTime = time;
    }

    return {
      group: group,
      rigX: RIG_X,
      rigZ: RIG_Z,
      ropeTopY: ROPE_TOP_Y,
      ropeBottomY: ROPE_BOTTOM_Y,
      plateY: PLATE_Y,
      activeDivers: activeDivers,
      setVisible: function(v) {
        group.visible = Boolean(v);
        mainDiverState.visible = group.visible;
        safetyDiverState.visible = group.visible;
      },
      update: update
    };
  };

  window.FreediverModule = {
    createCompetitionRig: window.createFreedivers,
    createFreedivers: window.createFreedivers
  };
})();
