/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian Rauhe Harreby. See LICENSE for terms.
 * Shared freediver/scuba air-water optics and spherical-cap ascent model.
 * Material extracted unchanged from the original freediver bubbles.
 */
(() => {
  'use strict';
  window.createDiverBubbleMaterial = function(T, waterUniforms) {
    const bubbleUniforms = {
      lightDirection: (waterUniforms && waterUniforms.lightDirection) || { value: new T.Vector3(0, 1, 0) },
      sunColor: (waterUniforms && waterUniforms.sunColor) || { value: new T.Color(1, 1, 1) },
      sunPower: (waterUniforms && waterUniforms.sunPower) || { value: 1.0 },
      daylight: (waterUniforms && waterUniforms.daylight) || { value: 1.0 }
    };

    return new T.ShaderMaterial({
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

          // 1. Fluid Dynamics Shape: Oblate Spherical Cap (Clift-Grace-Weber E ≈ 0.38 - 0.42)
          // Hydrodynamic stagnation pressure flattens the dome, while the toroidal wake indents the rear base:
          float indent = (p.y < 0.0) ? (1.0 - p.x * p.x) * 0.08 : 0.0;
          float effY = p.y - indent;
          float yScaled = effY < 0.0 ? effY * 3.40 : effY * 1.85;
          float capDist2 = p.x * p.x + yScaled * yScaled;
          if (capDist2 > 1.0) discard;

          // Reconstruct 3D surface normal of the flattened cap
          float nz = sqrt(max(0.0, 1.0 - capDist2));
          vec3 normalLocal = normalize(vec3(p.x, yScaled * 1.30, nz * 0.90));

          // 2. Air-water Total Internal Reflection (TIR) & Silvery Mirror Rim:
          // Water (n=1.333) to Air (n=1.0) critical angle theta_c = 48.6 deg produces total reflection on grazing rays:
          float fresnelRim = pow(1.0 - normalLocal.z, 2.2);
          float tirMirror = smoothstep(0.60, 0.96, 1.0 - normalLocal.z) * 0.95;

          // 3. Internal Water-Mirror Interface ("Vandspejl inden i goplen"):
          // Flat horizontal liquid interface at the bottom with intense reflection & crisp meniscus line:
          float baseMirror = smoothstep(0.04, -0.06, p.y) * (1.0 - p.x * p.x * 1.25) * 0.50;
          float meniscusLine = smoothstep(0.025, 0.0, abs(p.y - (-0.08))) * (1.0 - p.x * p.x * 1.2) * 0.75;

          float core = exp(-capDist2 * 2.8) * 0.15;

          // 4. Specular Sun Reflection & Glint (when sun aligns with observer)
          vec3 halfVector = normalize(vLightDirView + vViewDir);
          float nDotH = max(0.0, dot(normalLocal, halfVector));
          float specGlint = pow(nDotH, 28.0) * (0.35 + 0.65 * smoothstep(-0.06, 0.35, p.y));
          float broadSheen = pow(max(0.0, dot(normalLocal, vLightDirView)), 5.0) * 0.35 * smoothstep(-0.1, 0.3, p.y);
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
  };
  window.stepDiverBubbleVelocity = function(out, radius, vx, vy, vz, time, id, dt, wakeLift = 0) {
    const normR = Math.min(1.0, radius / 0.08);
    const targetVy = 0.65 + 1.15 * Math.sqrt(normR) + wakeLift;
    out[1] = vy + (targetVy - vy) * Math.min(1.0, dt * 5.0);
    // Preserve the original 30 fps wobble while making drag independent of fps.
    const damping = Math.pow(0.95, dt * 30.0);
    const forcing = (1.0 - damping) / 0.05;
    out[0] = vx * damping + Math.sin(time * 5.2 + id * 1.8) * 0.012 * forcing;
    out[2] = vz * damping + Math.cos(time * 4.8 + id * 2.1) * 0.012 * forcing;
    return out;
  };
  window.diverBubbleExpansion = function(initialRadius, spawnPressure, y) {
    return initialRadius * Math.pow(Math.max(0.15, spawnPressure / (1.0 + Math.max(0.0, 15.0 - y) * 0.10)), 1.0 / 3.0);
  };
  // Sparse plankton activation in the sheared water just behind a rising gas
  // bubble. Called once per rendered simulation frame, never per physics substep:
  // the shared emitter already scales its rate by frame duration and the slider.
  // The emitted points stay in the water; the bubble material is not emissive.
  window.emitDiverBubbleWake = function(bio,water,x,y,z,vx,vy,vz,radius,id,time) {
    if(!bio||!bio.emitDisturbance||radius<=0||y>=14.96||y<-100||vy<.18)return false;
    if(bio.getAmount&&bio.getAmount()<=0)return false;
    const day=water.daylight.value,t=Math.max(0,Math.min(1,(day-.02)/.30));
    const night=1-t*t*(3-2*t);if(night<=.01)return false;
    const size=Math.min(2,Math.max(.2,radius/.018));
    const phase=id*2.399963+time*2.1,edge=radius*1.12+.008;
    // Keep activation below the bright silver bubble rim, in its narrow wake,
    // so the tiny cyan flashes are not visually buried underneath the bubble.
    bio.emitDisturbance(x+Math.cos(phase)*edge,y-radius*.8-.10,z+Math.sin(phase)*edge,
      vx,vy,vz,night*Math.min(1.2,.70*size),.22*size,.018);
    return true;
  };
})();
