/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Kristian R. Harreby. See LICENSE for terms.
 *
 * The Blue Deep: a standalone, continuous WebGL scene with modelled hammerheads.
 * Three.js is local. No images, network requests, server or installation are needed.
 * Shark geometry is reused. Water and swimming are calculated on the GPU,
 * keeping memory use stable even when the page stays open for hours.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const errorBox = document.getElementById('error');
  const loading = document.getElementById('loading');
  function showError(message) {
    loading.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
    document.body.classList.remove('immersed');
  }
  if (!window.THREE) {
    showError('The 3D library is missing. Keep three.min.js in the same folder as index.html.');
    return;
  }
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    showError('The browser could not start 3D. Open index.html in Chrome or Edge with graphics acceleration enabled.');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.autoClear = false;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x073653, 0.021);
  const camera = new T.PerspectiveCamera(49, 1, 0.1, 190);
  camera.position.set(0, 3.5, 27);
  const lookAt = new T.Vector3(0, 0.4, -9);
  const ambient = new T.HemisphereLight(0xa1d2e1, 0x102b42, 1.75);
  scene.add(ambient);
  const sun = new T.DirectionalLight(0xffe6b2, 3.5);
  sun.position.set(4, 82, -57);
  scene.add(sun);
  const rim = new T.DirectionalLight(0x62b5dc, 1.65);
  rim.position.set(-7, 16, -30);
  scene.add(rim);
  // A broad overhead fill represents combined starlight. Its brightness is
  // intentionally boosted for visibility rather than astronomical accuracy.
  const starlight=new T.DirectionalLight(0x9bbcff,0);
  starlight.position.set(-12,60,-20);
  scene.add(starlight);
  const timeMode=document.getElementById('time-mode');
  const lightTime=document.getElementById('light-time');
  const lightTimeValue=document.getElementById('light-time-value');
  let customHour=12;
  // The slider uses minutes; formatting is always 24-hour, regardless of locale.
  function displayLightTime(hour){
    const minutes=T.MathUtils.clamp(Math.floor(hour*60+.00001),0,1439);
    const label=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
    lightTime.value=String(minutes);lightTimeValue.value=label;
    lightTime.setAttribute('aria-valuetext',label);
  }

  // The surface is a wavy 3D mesh at Y = 15. The depth buffer selects
  // the wave closest to the camera, avoiding jumps between multiple
  // possible intersections when viewing almost horizontally along the surface.
  const waterUniforms = {
    time: { value: 0 },
    resolution: { value: new T.Vector2(1,1) }, surfacePass: { value: 0 },
    inverseProjection: { value: camera.projectionMatrixInverse },
    cameraWorld: { value: camera.matrixWorld },
    eyePosition: { value: camera.position },
    solarDirection: { value: new T.Vector3() },
    lightDirection: { value: new T.Vector3() },
    sunColor: { value: new T.Color() },
    sunPower: { value: 1 }, daylight: { value: 1 }, twilight: { value: 0 }
  };

  // A gentle visual day cycle follows the computer's local clock. Sunrise
  // is at 06:00 and sunset at 18:00, with a peak elevation of 65 degrees at noon.
  // This is a fixed artistic cycle, not a location- or season-based calculation.
  // The clock is independent of the swimming speed slider.
  const sunriseColor = new T.Color(0xff633b);
  const middayColor = new T.Color(0xfff1d8);
  const dayFogColor = new T.Color(0x073653);
  const nightFogColor = new T.Color(0x082340);
  function updateDaylight(date) {
    const customTime=timeMode.value==='custom';
    const hour = customTime ? customHour : date.getHours() + date.getMinutes()/60
      + date.getSeconds()/3600 + date.getMilliseconds()/3600000;
    displayLightTime(hour);
    const phase = (hour-6)*Math.PI/12;
    const elevation = T.MathUtils.degToRad(65)*Math.sin(phase);
    const azimuth = T.MathUtils.degToRad(-75)*Math.cos(phase);
    const daylight = T.MathUtils.smoothstep(elevation, -.14, .25);
    const sunPower = T.MathUtils.smoothstep(elevation, -.025, .09)
      * (.42 + .58*T.MathUtils.smoothstep(elevation, 0, .95));
    const warmth = 1-T.MathUtils.smoothstep(elevation, .03, .65);
    waterUniforms.daylight.value = daylight;
    waterUniforms.sunPower.value = sunPower;
    waterUniforms.twilight.value = warmth*daylight;
    waterUniforms.sunColor.value.copy(middayColor).lerp(sunriseColor, warmth);
    waterUniforms.solarDirection.value.set(Math.cos(elevation)*Math.sin(azimuth),
      Math.sin(elevation), -Math.cos(elevation)*Math.cos(azimuth));

    // Snell's law bends rays from the air towards the normal as they enter
    // the water. This mean direction illuminates sharks; individual shafts
    // below use the local wave normal at their own surface entry points.
    const air = waterUniforms.solarDirection.value;
    const eta = 1.00029/1.333;
    waterUniforms.lightDirection.value.set(air.x*eta,
      Math.sqrt(1-eta*eta*(air.x*air.x+air.z*air.z)), air.z*eta);
    sun.position.copy(waterUniforms.lightDirection.value).multiplyScalar(100);
    sun.color.copy(waterUniforms.sunColor.value);
    sun.intensity = 3.5*sunPower;
    ambient.intensity = 1.35+.40*daylight;
    rim.intensity = .95+.70*daylight;
    starlight.intensity = 1.65*(1-daylight);
    scene.fog.color.copy(nightFogColor).lerp(dayFogColor, daylight);
  }
  const waterMaterial = new T.ShaderMaterial({
    uniforms: waterUniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec3 surfaceWorldPosition;
      void main(){surfaceWorldPosition=vec3(0.);gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      precision highp float;
      varying vec3 surfaceWorldPosition;
      uniform float time;
      uniform vec2 resolution;
      uniform float surfacePass;
      uniform mat4 inverseProjection;
      uniform mat4 cameraWorld;
      uniform vec3 eyePosition;
      uniform vec3 solarDirection;
      uniform vec3 lightDirection;
      uniform vec3 sunColor;
      uniform float sunPower;
      uniform float daylight;
      uniform float twilight;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      // Quintic interpolated noise with analytical derivatives. Both the value
      // and slope remain continuous when a wave crosses a noise cell.
      vec3 noiseGradient(vec2 p){
        vec2 cell=floor(p),f=fract(p);
        vec2 u=f*f*f*(f*(f*6.-15.)+10.);
        vec2 du=30.*f*f*(f*(f-2.)+1.);
        float a=hash(cell),b=hash(cell+vec2(1,0));
        float c=hash(cell+vec2(0,1)),d=hash(cell+vec2(1,1));
        float crossTerm=a-b-c+d;
        return vec3(a+(b-a)*u.x+(c-a)*u.y+crossTerm*u.x*u.y,
          du.x*((b-a)+crossTerm*u.y),du.y*((c-a)+crossTerm*u.x));
      }
      float noise(vec2 p){return noiseGradient(p).x;}

      // Ten wave trains with different directions, wavelengths and phases have
      // no shared short repetition period. A slowly varying amplitude also
      // makes wave groups uneven. Dispersion follows omega = sqrt(g*k).
      // Gradients come from exactly the same height field as the geometry.
      vec3 waveField(vec2 p,float footprint){
        vec3 weather=noiseGradient(p*.037+vec2(time*.005,-time*.003));
        float envelope=.68+weather.x*.32;
        vec2 envelopeGradient=weather.yz*.037*.32;
        vec3 field=vec3(0.);
        for(int i=0;i<10;i++){
          float seed=float(i);
          float angle=hash(vec2(seed,12.71))*6.283185;
          vec2 heading=vec2(cos(angle),sin(angle));
          float frequency=.38*pow(1.53,seed)*(1.+hash(vec2(seed,3.83))*.18);
          float filtered=1.-smoothstep(.65,2.0,footprint*frequency);
          if(filtered<=.001)break;
          float amplitude=.76*pow(.54,seed);
          float phase=dot(p,heading)*frequency-sqrt(9.81*frequency)*time*.18
            +hash(vec2(seed,5.19))*6.283185;
          field.x+=amplitude*filtered*sin(phase);
          field.yz+=amplitude*filtered*cos(phase)*heading*frequency;
        }
        return vec3(field.x*envelope,field.yz*envelope+field.x*envelopeGradient);
      }

      // Exact unpolarised Fresnel for light viewed FROM water TOWARDS air.
      // Snell's law determines total internal reflection. Normal incidence gives R around 2%;
      // above the critical angle of about 48.6 degrees, all light is reflected.
      // The reference and limitations of the environment model are in GUIDE.md.
      float fresnelWaterToAir(float cosineIncident){
        const float waterIOR=1.333;
        const float airIOR=1.00029;
        const float eta=waterIOR/airIOR;
        float cosine=clamp(cosineIncident,0.,1.);
        float sineSquaredTransmitted=eta*eta*max(0.,1.-cosine*cosine);
        if(sineSquaredTransmitted>=1.)return 1.;
        float cosineTransmitted=sqrt(1.-sineSquaredTransmitted);
        float s=(waterIOR*cosine-airIOR*cosineTransmitted)/(waterIOR*cosine+airIOR*cosineTransmitted);
        float p=(airIOR*cosine-waterIOR*cosineTransmitted)/(airIOR*cosine+waterIOR*cosineTransmitted);
        return .5*(s*s+p*p);
      }

      vec3 oceanRadiance(vec3 direction){
        float elevation=pow(clamp(direction.y*.85+.54,0.,1.),2.);
        vec3 deepAbyss=vec3(.0003,.0022,.0145);
        vec3 shallowScatter=vec3(.010,.080,.175);
        vec3 radiance=mix(deepAbyss,shallowScatter,elevation);
        float downAbsorption=clamp(-direction.y,0.,1.);
        radiance*=mix(vec3(1.),vec3(.70,.88,1.08),downAbsorption);
        return radiance*(.50+.50*daylight);
      }
      vec3 skyRadiance(vec3 direction){
        float elevation=clamp(direction.y,0.,1.);
        vec3 horizon=mix(vec3(.23,.32,.38),vec3(.58,.16,.065),twilight);
        vec3 zenith=mix(vec3(.10,.25,.43),vec3(.10,.10,.22),twilight*.65);
        vec3 sky=mix(horizon,zenith,sqrt(elevation))*daylight;
        sky+=vec3(.013,.026,.061)*(1.-daylight);
        vec2 cloudPosition=direction.xz/max(.20,direction.y)*1.35;
        float clouds=noise(cloudPosition+vec2(time*.002,0.))*.65
          +noise(cloudPosition*2.23+vec2(7.3,time*.003))*.35;
        vec3 cloudLight=mix(vec3(.54,.59,.61),sunColor*.48,twilight)*daylight;
        float cloudCover=smoothstep(.49,.77,clouds);
        sky=mix(sky,cloudLight+vec3(.010,.021,.045)*(1.-daylight),cloudCover*.55);
        // Fixed stars live in sky directions, so wave refraction makes their
        // highlights shimmer naturally. Pixel derivatives soften tiny stars.
        vec2 starCoordinates=vec2(atan(direction.z,direction.x),asin(clamp(direction.y,-1.,1.)))*40.;
        vec2 starCell=floor(starCoordinates);
        vec2 starCentre=vec2(hash(starCell+13.7),hash(starCell+81.2))*.6+.2;
        float starDistance=length(fract(starCoordinates)-starCentre);
        float starPixel=clamp(length(fwidth(starCoordinates)),.025,.3);
        float star=1.-smoothstep(.07,.14+starPixel,starDistance);
        star*=step(.97,hash(starCell))*smoothstep(0.,.15,direction.y);
        sky+=vec3(.72,.83,1.)*star*2.5*(1.-daylight)*(1.-cloudCover*.8);
        float alignment=max(dot(direction,solarDirection),0.);
        sky+=sunColor*sunPower*(pow(alignment,28.)*.40+pow(alignment,1300.)*4.);
        return sky;
      }

      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        vec4 view=inverseProjection*vec4(uv*2.-1.,1.,1.);
        vec3 direction=normalize((cameraWorld*vec4(view.xyz/view.w,0.)).xyz);
        vec3 color=oceanRadiance(direction);

        float depthFade=pow(clamp(uv.y+.04,0.,1.),1.35);
        color+=vec3(.003,.012,.024)*depthFade*daylight;

        // The same shader renders the background and the actual water surface.
        // The height field moves mesh vertices; the analytical normal retains
        // fine detail. The pixel footprint attenuates waves smaller than one pixel.
        float footprint=max(length(dFdx(surfaceWorldPosition.xz)),length(dFdy(surfaceWorldPosition.xz)));
        if(surfacePass>.5){
          float distanceToSurface=length(surfaceWorldPosition-eyePosition);
          vec3 wave=waveField(surfaceWorldPosition.xz,footprint);
          vec3 surfaceNormal=normalize(vec3(-wave.y,1.,-wave.z));
          float cosineIncident=max(dot(direction,surfaceNormal),0.);
          float reflectance=fresnelWaterToAir(cosineIncident);
          vec3 reflectedDirection=reflect(direction,surfaceNormal);
          // Total internal reflection shows the water environment, not an arbitrary silver colour.
          vec3 reflectedLight=oceanRadiance(reflectedDirection)*1.25;
          vec3 transmittedLight=vec3(0.);
          if(reflectance<1.){
            vec3 transmittedDirection=refract(direction,-surfaceNormal,1.333/1.00029);
            transmittedLight=skyRadiance(transmittedDirection);
          }
          vec3 surfaceLight=reflectance*reflectedLight+(1.-reflectance)*transmittedLight;
          vec3 transmission=exp(-vec3(.027,.014,.009)*distanceToSurface);
          vec3 waterPath=oceanRadiance(direction);
          vec3 ceiling=surfaceLight*transmission+waterPath*(1.-transmission);

          // Layer 1: Hydrodynamic wave-crest shear bioluminescence
          float nightBio=smoothstep(.32,.02,daylight);
          if(nightBio>.001){
            float waveSteepness=length(wave.yz);
            float waveHeight=wave.x;
            if(waveSteepness>.32 && waveHeight>.18){
              float waveShear=smoothstep(.32,.62,waveSteepness)*smoothstep(.18,.55,waveHeight);
              float foamNoise=noise(surfaceWorldPosition.xz*2.8+vec2(time*.35,-time*.22));
              float microFoam=.52+.48*foamNoise;
              float waveGlow=waveShear*nightBio*microFoam*3.4;
              vec3 waveBioCore=vec3(.04,.78,1.00);
              vec3 waveBioPeak=vec3(.50,.96,1.00);
              vec3 waveBioColor=mix(waveBioCore,waveBioPeak,clamp(waveShear*1.6-.25,0.,1.));
              ceiling+=waveBioColor*waveGlow*transmission;
            }
          }

          float visibility=1.-smoothstep(105.,165.,distanceToSurface);
          color=mix(color,ceiling,visibility);
        }
        // Colours are mixed as light above and converted to display colours only here.
        color=pow(max(vec3(0.),1.-exp(-color*1.3)),vec3(1./2.2));
        float grain=(hash(gl_FragCoord.xy)-.5)/255.;
        gl_FragColor=vec4(color+grain,1.);
      }`
  });
  const background = new T.Scene();
  background.add(new T.Mesh(new T.PlaneGeometry(2, 2), waterMaterial));
  const backgroundCamera = new T.Camera();

  // Wave mathematics is reused verbatim in the vertex shader so heights and
  // the normal used for lighting cannot drift out of sync.
  const waveFunctions=waterMaterial.fragmentShader.slice(
    waterMaterial.fragmentShader.indexOf('float hash('),
    waterMaterial.fragmentShader.indexOf('float fresnelWaterToAir(')
  );
  const surfaceMaterial=new T.ShaderMaterial({
    uniforms:{...waterUniforms,surfacePass:{value:1}},
    side:T.DoubleSide,depthWrite:true,depthTest:true,toneMapped:false,
    vertexShader:`uniform float time;varying vec3 surfaceWorldPosition;
      ${waveFunctions}
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        world.y+=waveField(world.xz,0.).x;
        surfaceWorldPosition=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:waterMaterial.fragmentShader
  });
  const surfaceGeometry=new T.PlaneGeometry(300,260,220,190);
  surfaceGeometry.rotateX(-Math.PI/2);
  const waterSurface=new T.Mesh(surfaceGeometry,surfaceMaterial);
  waterSurface.position.set(0,15,-65);
  waterSurface.frustumCulled=false;
  scene.add(waterSurface);

  // Project a sheet of sunlight through the actual wave field. Folded triangles
  // add together where rays converge; expanded triangles receive less light.
  // Three receiver depths share the RGB channels of one fixed-size texture.
  // This avoids tracing waves for every shark pixel or allocating per shark.
  const causticSpan=128;
  const causticOrigin=new T.Vector2(0,-32);
  const causticDepths=new T.Vector3(5,15,30);
  const causticTarget=new T.WebGLRenderTarget(512,512,{
    type:T.UnsignedByteType,minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter,
    depthBuffer:false,stencilBuffer:false,generateMipmaps:true
  });
  causticTarget.texture.name='Wave-focused sunlight at three depths';

  const causticGeometries=[80,112,144,168].map(seg=>new T.PlaneGeometry(causticSpan,causticSpan,seg,seg));
  const qualityPresets = [
    { label: 'Eco · 24 fps', aria: 'Eco, 24 fps', fps: 24, maxDpr: 1.0, causticSize: 512, causticGridIndex: 0, causticGrid: 80, causticEvery: 2, multiTap: 0, shafts: 72, fish: 60, maxOptical: 10, lodDist: 34 },
    { label: 'Balanced · 30 fps', aria: 'Balanced, 30 fps', fps: 30, maxDpr: 1.35, causticSize: 512, causticGridIndex: 1, causticGrid: 112, causticEvery: 1, multiTap: 1, shafts: 108, fish: 95, maxOptical: 16, lodDist: 48 },
    { label: 'High · 40 fps', aria: 'High, 40 fps', fps: 40, maxDpr: 1.6, causticSize: 512, causticGridIndex: 2, causticGrid: 144, causticEvery: 1, multiTap: 1, shafts: 132, fish: 110, maxOptical: 24, lodDist: 64 },
    { label: 'Ultra · 60 fps', aria: 'Ultra, 60 fps', fps: 60, maxDpr: 2.0, causticSize: 1024, causticGridIndex: 3, causticGrid: 168, causticEvery: 1, multiTap: 1, shafts: 132, fish: 110, maxOptical: 24, lodDist: 999 }
  ];
  let currentQuality = qualityPresets[1]; // Default: Balanced · 30 fps

  // Shared 24-animal optical field across sharks, jellyfish, light shafts and particles.
  const animalFieldCount=24;
  const animalStates=Array.from({length:animalFieldCount},()=>new T.Vector4(0,0,0,0));
  const animalMotions=Array.from({length:animalFieldCount},()=>new T.Vector4(0,0,0,0));
  const animalHeadings=Array.from({length:animalFieldCount},()=>new T.Vector4(1,0,0,0));
  const oceanOptics={
    causticMap:{value:causticTarget.texture},
    causticOrigin:{value:causticOrigin},
    causticSpan:{value:causticSpan},
    causticDepths:{value:causticDepths},
    causticMultiTap:{value:currentQuality.multiTap},
    activeSharkCount:{value:0},
    activeAnimalCount:{value:0},
    animalStates:{value:animalStates},
    animalMotions:{value:animalMotions},
    animalHeadings:{value:animalHeadings}
  };

  const solarOcclusionGLSL=`
    uniform int activeSharkCount;
    uniform vec4 animalStates[24];
    uniform vec4 animalHeadings[24];
    float sharkSolarOcclusion(vec3 worldPos,vec3 sunRayDir,vec3 selfOrigin){
      float occlusion=1.;
      for(int k=0;k<24;k++){
        if(k>=activeSharkCount)break;
        vec4 st=animalStates[k];
        vec4 hd=animalHeadings[k];
        if(st.w<=.01||hd.w<=.01)continue;
        if(distance(st.xyz,selfOrigin)<1.4)continue;
        vec3 toCaster=st.xyz-worldPos;
        float tRay=dot(toCaster,sunRayDir);
        if(tRay>.8&&tRay<42.){
          vec3 rayPoint=worldPos+sunRayDir*tRay;
          vec3 rel=rayPoint-st.xyz;
          float along=clamp(dot(rel,hd.xyz),-hd.w,hd.w);
          float distToSpine=length(rel-hd.xyz*along);
          float coreR=st.w*.36;
          float penumbraR=st.w*(.66+.035*tRay);
          float block=1.-smoothstep(coreR,penumbraR,distToSpine);
          occlusion*=1.-.70*block*exp(-tRay*.042);
        }
      }
      return occlusion;
    }
    float shaftBodyClearance(vec3 worldPos){
      float clearFactor=1.;
      for(int k=0;k<24;k++){
        if(k>=activeSharkCount)break;
        vec4 st=animalStates[k];
        vec4 hd=animalHeadings[k];
        if(st.w<=.01||hd.w<=.01)continue;
        vec3 rel=worldPos-st.xyz;
        float maxR=hd.w+st.w*2.4;
        if(dot(rel,rel)>maxR*maxR)continue;
        float along=clamp(dot(rel,hd.xyz),-hd.w,hd.w);
        float distToSpine=length(rel-hd.xyz*along);
        clearFactor*=smoothstep(st.w*.75,st.w*2.15,distToSpine);
      }
      return clearFactor;
    }
  `;

  // Soft shafts occupy the water itself, including the first few metres in
  // front of the camera. Every entry point samples the same wave field as the
  // surface, so Snell refraction gives each shaft its own changing direction.
  // Camera-facing strips approximate scattering without a full volume march.
  // Depth testing hides strips behind sharks; strips in front add a light veil.
  const shaftCount=132;
  const shaftGeometry=new T.InstancedBufferGeometry();
  const shaftStrip=new T.PlaneGeometry(2,1,1,24);
  shaftStrip.translate(0,.5,0);
  shaftGeometry.index=shaftStrip.index;
  shaftGeometry.attributes=shaftStrip.attributes;
  const shaftEntries=new Float32Array(shaftCount*3);
  function shaftRandom(seed){const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);}
  for(let i=0;i<shaftCount;i++){
    // Jittered cells avoid a regular curtain while preserving near/far coverage.
    const x=-66+(i%12+shaftRandom(i+1)*.8)*11;
    const z=-108+(Math.floor(i/12)+shaftRandom(i+201)*.85)*13;
    shaftEntries.set([x,z,.35+shaftRandom(i+401)*.85],i*3);
  }
  shaftGeometry.setAttribute('entry',new T.InstancedBufferAttribute(shaftEntries,3));
  shaftGeometry.instanceCount=currentQuality.shafts;
  const shaftMaterial=new T.ShaderMaterial({
    uniforms:{time:waterUniforms.time,solarDirection:waterUniforms.solarDirection,
      lightDirection:waterUniforms.lightDirection,
      sunColor:waterUniforms.sunColor,sunPower:waterUniforms.sunPower,
      eyePosition:waterUniforms.eyePosition,
      activeSharkCount:oceanOptics.activeSharkCount,
      animalStates:oceanOptics.animalStates,
      animalHeadings:oceanOptics.animalHeadings},
    transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,
    blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:`
      uniform float time;uniform vec3 solarDirection;uniform vec3 lightDirection;uniform vec3 eyePosition;
      attribute vec3 entry;
      varying vec2 shaftUV;varying float shaftEnergy;varying vec3 shaftWorld;
      varying float shaftOcclusion;
      ${solarOcclusionGLSL}
      ${waveFunctions}
      void main(){
        vec3 wave=waveField(entry.xy,.32);
        vec3 normal=normalize(vec3(-wave.y,1.,-wave.z));
        vec3 ray=refract(-solarDirection,normal,1.00029/1.333);
        vec3 origin=vec3(entry.x,15.+wave.x,entry.y);
        vec3 across=normalize(cross(ray,eyePosition-origin)+vec3(.00001,0.,0.));
        // Neighbouring wave slopes determine whether this ray bundle narrows
        // or spreads. A finite width and capped energy soften caustic folds.
        vec3 neighbour=waveField(entry.xy+across.xz*.65,.32);
        vec3 adjacentRay=refract(-solarDirection,normalize(vec3(-neighbour.y,1.,-neighbour.z)),1.00029/1.333);
        float divergence=dot(adjacentRay-ray,across)/.65;
        float travel=position.y*48.;
        float radius=clamp(entry.z*(1.+travel*divergence),entry.z*.45,entry.z*3.5);
        shaftEnergy=clamp(entry.z/radius,.3,1.8)*max(dot(normal,solarDirection),0.);
        shaftWorld=origin+ray*travel+across*position.x*radius*2.5;
        shaftUV=vec2(position.x,position.y);
        shaftOcclusion=sharkSolarOcclusion(shaftWorld,lightDirection,vec3(9999.))*shaftBodyClearance(shaftWorld);
        gl_Position=projectionMatrix*viewMatrix*vec4(shaftWorld,1.);
      }`,
    fragmentShader:`
      uniform vec3 sunColor;uniform float sunPower;uniform vec3 eyePosition;
      varying vec2 shaftUV;varying float shaftEnergy;varying vec3 shaftWorld;
      varying float shaftOcclusion;
      void main(){
        float distanceToEye=length(shaftWorld-eyePosition);
        float edge=exp(-shaftUV.x*shaftUV.x*5.)*(1.-smoothstep(.8,1.,abs(shaftUV.x)));
        float ends=smoothstep(0.,.035,shaftUV.y)*(1.-smoothstep(.58,1.,shaftUV.y));
        float transmission=exp(-distanceToEye*.012-shaftUV.y*.7);
        // Fade before the camera crosses a strip, avoiding near-plane flashes.
        float nearFade=smoothstep(.8,3.,distanceToEye);
        float alpha=edge*ends*transmission*nearFade*shaftEnergy*sunPower*.038*shaftOcclusion;
        gl_FragColor=vec4(sunColor,alpha);
      }`
  });
  const lightShafts=new T.Mesh(shaftGeometry,shaftMaterial);
  lightShafts.name='Refracted light shafts';lightShafts.frustumCulled=false;
  lightShafts.renderOrder=1;scene.add(lightShafts);
  const causticUniforms={
    time:waterUniforms.time,solarDirection:waterUniforms.solarDirection,
    lightDirection:waterUniforms.lightDirection,
    mapOrigin:{value:causticOrigin},mapSpan:{value:causticSpan},
    waveFootprint:{value:causticSpan/currentQuality.causticGrid},
    receiverDepth:{value:5},layerColor:{value:new T.Vector3(1,0,0)}
  };
  const causticMaterial=new T.ShaderMaterial({
    uniforms:causticUniforms,side:T.DoubleSide,transparent:true,
    depthTest:false,depthWrite:false,toneMapped:false,
    blending:T.CustomBlending,blendEquation:T.AddEquation,
    blendSrc:T.OneFactor,blendDst:T.OneFactor,
    vertexShader:`
      uniform float time;
      uniform vec3 solarDirection;
      uniform vec3 lightDirection;
      uniform float receiverDepth;
      uniform vec2 mapOrigin;
      uniform float mapSpan;
      uniform float waveFootprint;
      varying float vIrradiance;
      ${waveFunctions}
      vec3 causticWaves(vec2 p,float fp){
        vec3 weather=noiseGradient(p*.037+vec2(time*.005,-time*.003));
        float envelope=.68+weather.x*.32;
        vec2 envelopeGradient=weather.yz*.037*.32;
        vec3 field=vec3(0.);
        for(int i=0;i<6;i++){
          float seed=float(i);
          float angle=hash(vec2(seed,12.71))*6.283185;
          vec2 heading=vec2(cos(angle),sin(angle));
          float frequency=.38*pow(1.53,seed)*(1.+hash(vec2(seed,3.83))*.18);
          float filtered=1.-smoothstep(.26,.82,fp*frequency);
          if(filtered<=.001)break;
          float amplitude=.76*pow(.54,seed);
          float phase=dot(p,heading)*frequency-sqrt(9.81*frequency)*time*.18
            +hash(vec2(seed,5.19))*6.283185;
          field.x+=amplitude*filtered*sin(phase);
          field.yz+=amplitude*filtered*cos(phase)*heading*frequency;
        }
        return vec3(field.x*envelope,field.yz*envelope+field.x*envelopeGradient);
      }
      vec2 projectCausticRay(vec2 src){
        vec2 entry=src+mapOrigin;
        vec3 w=causticWaves(entry,waveFootprint);
        vec3 n=normalize(vec3(-w.y,1.,-w.z));
        vec3 ray=refract(-solarDirection,n,1.00029/1.333);
        float dist=(receiverDepth+w.x)/max(.15,-ray.y);
        return src+ray.xz*dist+lightDirection.xz*receiverDepth/max(.2,lightDirection.y);
      }
      void main(){
        float stepSize=max(waveFootprint*1.15,.95);
        vec2 r0=projectCausticRay(position.xy);
        vec2 rx=projectCausticRay(position.xy+vec2(stepSize,0.));
        vec2 ry=projectCausticRay(position.xy+vec2(0.,stepSize));
        vec2 drx=(rx-r0)/stepSize;
        vec2 dry=(ry-r0)/stepSize;
        float receiverArea=max(abs(drx.x*dry.y-drx.y*dry.x),.12);
        float rawFocus=1./receiverArea;
        // Soft-knee compression prevents harsh blinking spikes at wave cusps
        float smoothFocus=rawFocus/(1.+rawFocus*.10);
        vec3 w0=causticWaves(position.xy+mapOrigin,waveFootprint);
        vec3 n0=normalize(vec3(-w0.y,1.,-w0.z));
        float surfaceExposure=clamp(dot(n0,solarDirection)/max(.15,n0.y*solarDirection.y),0.,2.6);
        vIrradiance=smoothFocus*surfaceExposure;
        gl_Position=vec4(r0/(mapSpan*.5),0.,1.);
      }`,
    fragmentShader:`
      uniform vec3 layerColor;
      varying float vIrradiance;
      void main(){
        gl_FragColor=vec4(layerColor*(vIrradiance/16.),0.);
      }`
  });
  const causticScene=new T.Scene();
  const causticMesh=new T.Mesh(causticGeometries[currentQuality.causticGridIndex],causticMaterial);
  causticMesh.frustumCulled=false;causticScene.add(causticMesh);
  const causticCamera=new T.Camera();
  const savedClearColor=new T.Color();
  const previousCausticSun=new T.Vector3();
  let previousCausticTime=NaN;
  let causticFrameCounter=0;
  function updateCaustics(){
    // Particles also sample the light map, including with the shark slider at 0.
    if(waterUniforms.sunPower.value<=0)return;
    const sunUnchanged=previousCausticSun.equals(waterUniforms.solarDirection.value);
    if(previousCausticTime===waterUniforms.time.value && sunUnchanged)return;
    if(!isNaN(previousCausticTime) && !redrawNeeded && (++causticFrameCounter % currentQuality.causticEvery !== 0) && sunUnchanged)return;
    const previousTarget=renderer.getRenderTarget();
    const savedClearAlpha=renderer.getClearAlpha();
    renderer.getClearColor(savedClearColor);
    renderer.setRenderTarget(causticTarget);
    renderer.setClearColor(0x000000,0);renderer.clear();
    for(let layer=0;layer<3;layer++){
      causticUniforms.receiverDepth.value=causticDepths.getComponent(layer);
      causticUniforms.layerColor.value.set(0,0,0).setComponent(layer,1);
      renderer.render(causticScene,causticCamera);
    }
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(savedClearColor,savedClearAlpha);
    previousCausticTime=waterUniforms.time.value;
    previousCausticSun.copy(waterUniforms.solarDirection.value);
  }

  // The model points along +X. Cross-sections form a smooth body with a narrow tail base.
  // Belly and back colours make the three-dimensional shape readable in blue light.
  let bodyProfile;
  let activeAnatomy;
  // Species own their proportions and articulation. New head builders can be
  // registered here without changing swimming, picking or the species controls.
  const sharkAnatomies = {
    hammerhead: {
      head: 'hammer', jaw: null,
      profile: [
        [-3.52,.035,.06],[-3.18,.09,.13],[-2.8,.15,.22],
        [-2.3,.235,.30],[-1.7,.36,.41],[-.85,.51,.55],
        [-.05,.59,.60],[.65,.575,.555],[1.20,.46,.40],
        [1.7,.35,.28],[2.10,.30,.21],[2.29,.16,.11]
      ]
    },
    greatwhite: {
      head: 'pointed',
      centerRise: { start: 1, end: 2.96, height: .10 },
      eye: { x: 2.04, angle: 1.36, radii: [.060,.040,.022] },
      nostril: { x: 2.57, angle: 2.00, radii: [.038,.010,.024] },
      jaw: { pivot: [1.40,-.14,0], rear: 1.40, front: 2.60,
        restAngle:.065,idleAmplitude:.012,maximumAngle:.36 },
      // The front teeth are relatively upright; replacement teeth fold inward.
      // Three modelled rows suggest the dentition without simulating replacement.
      dentition: { teethPerSide:12, rows:[
        {inset:.050,tilt:.14,size:1},
        {inset:.098,tilt:.55,size:.87},
        {inset:.145,tilt:1.02,size:.72}
      ] },
      profile: [
        [-3.52,.035,.06],[-3.18,.10,.15],[-2.8,.18,.26],
        [-2.3,.29,.39],[-1.7,.44,.54],[-.85,.62,.72],
        [-.05,.71,.78],[.65,.72,.73],[1.20,.65,.63],
        [1.65,.59,.54],[2.05,.53,.45],[2.38,.41,.34],
        [2.65,.33,.235],[2.81,.26,.16],[2.91,.17,.10],[2.96,.09,.055],[2.98,0,0]
      ]
    }
  };
  const backColor = new T.Color(0x5c6a70);
  const bellyColor = new T.Color(0xe0ddd0);

  function processPart(geometry, solidColor, jawWeight=0, surfaceRoughness=.64) {
    const g = geometry;
    const positions = g.getAttribute('position');
    if (!g.index) {
      const seq = new Uint16Array(positions.count);
      for (let i = 0; i < positions.count; i++) seq[i] = i;
      g.setIndex(new T.BufferAttribute(seq, 1));
    }
    const normals = g.getAttribute('normal');
    const colors = new Float32Array(positions.count * 3);
    const color = new T.Color();
    for (let i = 0; i < positions.count; i++) {
      if (solidColor !== undefined) color.setHex(solidColor);
      else {
        const edge = Math.sin(positions.getX(i)*11+positions.getZ(i)*8)*.047
          +Math.sin(positions.getX(i)*24-positions.getZ(i)*13)*.022;
        const underside = T.MathUtils.smoothstep(-normals.getY(i)+edge, .14, .36)
          *(1-T.MathUtils.smoothstep(positions.getY(i),.06,.30));
        color.copy(backColor).lerp(bellyColor, underside);
        const variation = .97 + .025 * Math.sin(positions.getX(i) * 8 + positions.getZ(i) * 11);
        color.multiplyScalar(variation);
      }
      colors.set([color.r, color.g, color.b], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.setAttribute('skinDetail', new T.BufferAttribute(new Float32Array(positions.count).fill(solidColor === undefined ? 1 : 0), 1));
    g.setAttribute('surfaceRoughness',new T.BufferAttribute(new Float32Array(positions.count).fill(surfaceRoughness),1));
    g.setAttribute('gillMask',new T.BufferAttribute(new Float32Array(positions.count),1));
    g.setAttribute('mouthRegion',new T.BufferAttribute(new Float32Array(positions.count),1));
    g.setAttribute('oralDetail',new T.BufferAttribute(new Float32Array(positions.count),1));
    if (!g.hasAttribute('finThinness')) g.setAttribute('finThinness', new T.BufferAttribute(new Float32Array(positions.count), 1));
    if (!g.hasAttribute('finFlex')) g.setAttribute('finFlex', new T.BufferAttribute(new Float32Array(positions.count), 1));
    // Keep articulation with the vertices when parts are merged. Only the lower
    // jaw and its teeth move; the head, eyes and upper teeth remain attached.
    if (!g.hasAttribute('jawWeight')) {
      const weights=new Float32Array(positions.count);
      const slopes=new Float32Array(positions.count);
      for(let i=0;i<weights.length;i++){
        const x=positions.getX(i);
        weights[i]=typeof jawWeight==='function'?jawWeight(x):jawWeight;
        // Teeth receive one constant root weight and therefore zero gradient.
        // Only soft tissue has a spatially varying hinge rotation.
        if(typeof jawWeight==='function')slopes[i]=(jawWeight(x+.0001)-jawWeight(x-.0001))/.0002;
      }
      g.setAttribute('jawWeight',new T.BufferAttribute(weights,1));
      g.setAttribute('jawSlope',new T.BufferAttribute(slopes,1));
    }
    return g;
  }

  function bodyGeometry(anatomy, lowDetail = false) {
    activeAnatomy=anatomy;
    const sections = anatomy.profile;
    const curve = new T.CatmullRomCurve3(sections.map(s => new T.Vector3(s[0],s[1],s[2])));
    bodyProfile=curve;
    if(anatomy.jaw)return markBodySkin(pointedBodyGeometry(anatomy, lowDetail));
    const vertices = [], indices = [];
    const rings = lowDetail ? 44 : 112, sides = lowDetail ? 20 : 48;
    for (let i = 0; i <= rings; i++) {
      const cross = curve.getPoint(i / rings);
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        vertices.push(cross.x, Math.cos(angle)*cross.z, Math.sin(angle)*cross.y);
      }
    }
    for (let i=0;i<rings;i++) for(let j=0;j<sides;j++) {
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const skin=markBodySkin(processPart(geometry));
    skin.attributes.mouthRegion.array.fill(1);
    return skin;
  }

  function markBodySkin(geometry){
    geometry.attributes.gillMask.array.fill(1);
    return geometry;
  }

  function bodySurface(x,angle,side,offset=.006){
    const section=bodySection(x);
    return new T.Vector3(x,bodyCenter(x)+(section.z+offset)*Math.cos(angle),side*(section.y+offset)*Math.sin(angle));
  }

  function bodyCenter(x){
    const rise=activeAnatomy.centerRise;
    return rise ? rise.height*T.MathUtils.smoothstep(x,rise.start,rise.end) : 0;
  }

  function bodySection(x){
    let low=0,high=1;
    for(let i=0;i<16;i++){
      const middle=(low+high)/2;
      if(bodyProfile.getPoint(middle).x<x)low=middle;else high=middle;
    }
    return bodyProfile.getPoint((low+high)/2);
  }

  function hammerGeometry(lowDetail = false) {
    const vertices=[],indices=[],rings=lowDetail ? 40 : 96,sides=lowDetail ? 18 : 40;
    for(let i=0;i<=rings;i++) {
      const z=(i/rings*2-1)*1.78;
      const lateral=Math.abs(z)/1.78;
      const cap=Math.sqrt(Math.max(.003,1-Math.pow(lateral,24)));
      const front=2.55-.075*Math.exp(-z*z/.035)-.065*Math.exp(-Math.pow(Math.abs(z)-.93,2)/.022)-.18*Math.pow(lateral,4);
      const rear=1.95-.36*Math.exp(-lateral*4)+.045*lateral;
      const centerX=(front+rear)/2;
      const radiusX=(front-rear)/2*cap;
      const radiusY=(.11+.115*Math.exp(-lateral*3.8))*cap;
      for(let j=0;j<=sides;j++) {
        const angle=j/sides*Math.PI*2;
        vertices.push(centerX+Math.cos(angle)*radiusX,Math.sin(angle)*radiusY-.005,z);
      }
    }
    for(let i=0;i<rings;i++) for(let j=0;j<sides;j++) {
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const skin=processPart(geometry);
    skin.attributes.mouthRegion.array.fill(1);
    return skin;
  }

  // A mouth is a cut in the skin, not a dark line drawn over a sealed snout.
  // Two skin patches share exactly the same lip curve in the resting pose.
  // The lower patch continues into the belly, with a short soft hinge region.
  function mouthCut(x,jaw){
    const t=T.MathUtils.clamp((x-jaw.rear)/(jaw.front-jaw.rear),0,1);
    if(t===0)return 1.82;
    if(t===1)return Math.PI;
    // Specify the lip height instead of an arbitrary angular sweep. This
    // avoids a double arch ("moustache") across the front of the closed mouth.
    const rearY=bodyCenter(jaw.rear)+bodySection(jaw.rear).z*Math.cos(1.82);
    const frontY=bodyCenter(jaw.front)-bodySection(jaw.front).z;
    const lipY=T.MathUtils.lerp(rearY,frontY,t);
    return Math.acos(T.MathUtils.clamp((lipY-bodyCenter(x))/bodySection(x).z,-1,1));
  }
  function jawInfluence(x,jaw){return T.MathUtils.smoothstep(x,jaw.rear,jaw.rear+.45);}
  function mouthRim(t,side,jaw,inset=0){
    const x=T.MathUtils.lerp(jaw.rear,jaw.front,t);
    const p=bodySurface(x,mouthCut(x,jaw),side,0);
    p.z-=side*inset;
    return p;
  }
  function gridGeometry(rows,columns,point,reverse=false){
    const vertices=[],indices=[];
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
      const p=point(i/rows,j/columns);vertices.push(p.x,p.y,p.z);
    }
    for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
      const a=i*(columns+1)+j,b=a+columns+1;
      if(reverse)indices.push(a,b,a+1,b,b+1,a+1);
      else indices.push(a,a+1,b,b,a+1,b+1);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function pointedBodyGeometry(anatomy, lowDetail = false){
    const jaw=anatomy.jaw,tail=anatomy.profile[0][0],nose=anatomy.profile.at(-1)[0];
    const patches=[];
    const nBody = lowDetail ? 28 : 80;
    const nJaw = lowDetail ? 14 : 40;
    const nNose = lowDetail ? 7 : 17;
    for(const lower of [false,true]){
      // Include the hinge and mouth tip as exact stations. A triangle spanning
      // across the tip would bridge the opening and leave a small triangular gap.
      const stations=Array.from({length:nBody},(_,i)=>T.MathUtils.lerp(tail,jaw.rear,i/nBody))
        .concat(Array.from({length:nJaw},(_,i)=>T.MathUtils.lerp(jaw.rear,jaw.front,i/nJaw)))
        .concat(lower?[jaw.front]:Array.from({length:nNose},(_,i)=>T.MathUtils.lerp(jaw.front,nose,i/(nNose-1))));
      const rows=stations.length-1,columns=lower?(lowDetail ? 12 : 24):(lowDetail ? 24 : 48);
      const g=gridGeometry(rows,columns,(u,v)=>{
        const x=stations[Math.round(u*rows)],cut=mouthCut(x,jaw);
        const angle=lower?T.MathUtils.lerp(cut,2*Math.PI-cut,v):T.MathUtils.lerp(-cut,cut,v);
        const p=bodySurface(x,angle,1,0);
        // The chin retains thickness at the front of the mandible. A simple
        // split ellipse collapses to a paper-thin edge and exposes tooth tips.
        if(lower){
          const chin=.085*T.MathUtils.smoothstep(x,jaw.rear,jaw.front-.3)
            *(1-T.MathUtils.smoothstep(x,jaw.front-.24,jaw.front));
          p.y-=chin*Math.sin(Math.PI*v);
        }
        return p;
      });
      // Use derivatives of the same continuous body surface on both sides of
      // each seam. Computing each patch's edge normals independently creates
      // a false ridge, especially along the grey/white colour boundary.
      const n=g.attributes.normal;
      for(let i=0;i<=rows;i++){
        const x=stations[i],cut=mouthCut(x,jaw);
        const s=bodySection(x),prev=bodySection(x-.002),next=bodySection(x+.002);
        const widthSlope=(next.y-prev.y)/.004,heightSlope=(next.z-prev.z)/.004;
        const centerSlope=(bodyCenter(x+.002)-bodyCenter(x-.002))/.004;
        for(let j=0;j<=columns;j++){
          if(lower && x>jaw.rear)continue;
          // Every triangle at the rounded nose shares the forward cap normal.
          // The radius is zero here, so the derivative formula below would
          // otherwise collapse and leave a conspicuous star-shaped highlight.
          if(!lower&&i===rows){n.setXYZ(i*(columns+1)+j,1,0,0);continue;}
          const angle=lower?T.MathUtils.lerp(cut,2*Math.PI-cut,j/columns):T.MathUtils.lerp(-cut,cut,j/columns);
          const sine=Math.sin(angle),cosine=Math.cos(angle);
          const normal=new T.Vector3(
            -s.z*widthSlope*sine*sine-s.y*cosine*(centerSlope+heightSlope*cosine),
            s.y*cosine,s.z*sine).normalize();
          n.setXYZ(i*(columns+1)+j,normal.x,normal.y,normal.z);
        }
      }
      patches.push(processPart(g,undefined,lower?x=>jawInfluence(x,jaw):0));
    }
    return mergeParts(patches);
  }

  function pointedHeadDetails(parts,anatomy,lowDetail=false){
    const jaw=anatomy.jaw,weight=x=>jawInfluence(x,jaw);
    // One continuous lining is shared by the roof/floor, gums and tooth roots.
    // This keeps inner rows attached instead of floating above an unrelated bowl.
    function liningPoint(u,lateral,lower){
      const rim=mouthRim(u,1,jaw),middle=Math.max(0.,1-lateral*lateral);
      rim.z*=lateral;
      const folds=.009*Math.sin(u*23.+lateral*lateral*4.)*middle*Math.sin(Math.PI*u);
      rim.y+=(lower?-1:1)*((lower?.085:.14)*middle*Math.sin(Math.PI*u)+folds);
      return rim;
    }
    function liningPart(geometry,colour,lower){
      const part=processPart(geometry,colour,lower?weight:0,.67);
      part.attributes.oralDetail.array.fill(1);return part;
    }
    // A concave roof and floor close the mouth internally. The last cross-strip
    // joins them at the throat; no background can show through an open jaw.
    for(const lower of [false,true]){
      const g=gridGeometry(lowDetail ? 20 : 50, lowDetail ? 14 : 32,(u,v)=>{
        return liningPoint(u,v*2-1,lower);
      },!lower);
      parts.push(liningPart(g,lower?0x665853:0x514849,lower));
      // Rounded gum pads merge into the lining at both edges, with a muted
      // fleshy colour. They are not a separate bright ring around the lips.
      for(const side of [-1,1]){
        const gum=gridGeometry(lowDetail ? 24 : 64, lowDetail ? 6 : 12,(u,v)=>{
          const station=.025+u*.95,lateral=side*(.67+v*.32);
          const point=liningPoint(station,lateral,lower);
          point.y+=(lower?1:-1)*.025*Math.sin(v*Math.PI)*Math.sin(station*Math.PI);
          return point;
        },(side===1)===lower);
        parts.push(liningPart(gum,0x80675f,lower));
      }
    }
    // Lips and teeth follow one shared horseshoe, rather than independent
    // circles whose edges would float outside the cheeks.
    const rimPoints=[];
    for(let i=0;i<=64;i++){
      const u=i/64,side=u<=.5?-1:1,t=u<=.5?u*2:(1-u)*2;
      rimPoints.push(mouthRim(t,side,jaw));
    }
    const lipCurve=new T.CatmullRomCurve3(rimPoints);
    parts.push(processPart(new T.TubeGeometry(lipCurve,lowDetail ? 36 : 100,.009,lowDetail ? 5 : 8,false),0x656a67,0,.76));
    parts.push(processPart(new T.TubeGeometry(lipCurve,lowDetail ? 36 : 100,.012,lowDetail ? 5 : 8,false),0x999e94,weight,.76));
    const dentitionRows = lowDetail ? anatomy.dentition.rows.slice(0, 1) : anatomy.dentition.rows;
    const toothSubdiv = lowDetail ? 3 : 10;
    for(const lower of [false,true])for(const side of [-1,1]){
      const arc=new T.CatmullRomCurve3(Array.from({length:49},(_,i)=>mouthRim(i/48,side,jaw)));
      // Teeth are broad triangular blades above, narrower below. Their roots
      // sit inside the skin; they appear as the mouth opens, not as an outer grin.
      for(const [rowIndex,row] of dentitionRows.entries())for(let i=0;i<anatomy.dentition.teethPerSide;i++){
        const t=.14+i*.064+(lower?.019:0)+rowIndex*.009;
        const root=arc.getPointAt(t),tangent=arc.getTangentAt(t);
        const wear=.88+.12*Math.sin(i*2.41+side*1.7+(lower?.9:0)+rowIndex);
        const size=(.67+.33*Math.sin(t*Math.PI))*wear*row.size;
        const width=(lower?.077:.110)*size,height=(lower?.105:.130)*size;
        const outward=new T.Vector3(-tangent.z,0,tangent.x).normalize();
        if(outward.z*side<0)outward.negate();
        root.addScaledVector(outward,-row.inset);
        const u=T.MathUtils.clamp((root.x-jaw.rear)/(jaw.front-jaw.rear),.001,.999);
        const halfWidth=Math.max(.001,mouthRim(u,1,jaw).z);
        const lateral=T.MathUtils.clamp(root.z/halfWidth,-.99,.99);
        root.y=liningPoint(u,lateral,lower).y+(lower?-.004:.004);
        const tip=root.clone().addScaledVector(outward,-height*Math.sin(row.tilt))
          .add(new T.Vector3(.006*Math.sin(i*3.1+side), (lower?1:-1)*height*Math.cos(row.tilt),0));
        const a=root.clone().addScaledVector(tangent,-width/2);
        const b=root.clone().addScaledVector(tangent,width/2);
        const ridge=root.clone().lerp(tip,.35).addScaledVector(outward,.012);
        const back=root.clone().addScaledVector(outward,-.009);
        // Small edge notches break the perfect triangular silhouette. Their
        // size is restrained so serrations do not turn into distant white noise.
        const outline=[a,b];
        for(let j=1;j<=toothSubdiv;j++){
          const f=j/toothSubdiv,p=b.clone().lerp(tip,f);
          p.addScaledVector(tangent,j%2?-.0025*size:0);outline.push(p);
        }
        for(let j=1;j<toothSubdiv;j++){
          const f=j/toothSubdiv,p=tip.clone().lerp(a,f);
          p.addScaledVector(tangent,j%2?.0025*size:0);outline.push(p);
        }
        const vertices=[];
        for(let j=0;j<outline.length;j++){
          const next=outline[(j+1)%outline.length];
          for(const p of [outline[j],next,ridge,next,outline[j],back])vertices.push(...p.toArray());
        }
        const tooth=new T.BufferGeometry();
        tooth.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
        tooth.computeVertexNormals();
        parts.push(processPart(tooth,rowIndex===0?0xc4c1aa:0xaaa793,lower?weight(root.x):0,.59));
      }
    }
    for(const side of [-1,1]){
      // Small, dark lateral eyes are embedded in the skull. A flattened
      // ellipsoid and skin fold replace the previous protruding eye sockets.
      const center=bodySurface(anatomy.eye.x,anatomy.eye.angle,side,.003);
      const across=bodySurface(anatomy.eye.x,anatomy.eye.angle+.002,side,0)
        .sub(bodySurface(anatomy.eye.x,anatomy.eye.angle-.002,side,0));
      const along=bodySurface(anatomy.eye.x+.002,anatomy.eye.angle,side,0)
        .sub(bodySurface(anatomy.eye.x-.002,anatomy.eye.angle,side,0));
      const normal=across.cross(along).multiplyScalar(side).normalize();
      const orientation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),normal);
      const eye=new T.SphereGeometry(1,lowDetail ? 12 : 28,lowDetail ? 8 : 18);
      eye.scale(...anatomy.eye.radii);eye.applyQuaternion(orientation);eye.translate(...center.toArray());
      parts.push(processPart(eye,0x0c1417,0,.28));
      // A shallow skin fold covers the upper eye instead of a bright circular
      // ring. It follows the socket surface and keeps the eye recessed.
      const lid=gridGeometry(lowDetail ? 14 : 28,lowDetail ? 4 : 8,(u,v)=>{
        const angle=.10+u*(Math.PI-.20),radius=T.MathUtils.lerp(.91,1.36,v);
        const local=new T.Vector3(Math.cos(angle)*anatomy.eye.radii[0]*radius,
          Math.sin(angle)*anatomy.eye.radii[1]*radius,
          .013*(1-v)+.009*Math.sin(Math.PI*v));
        return local.applyQuaternion(orientation).add(center);
      },true);
      // The fold belongs to the grey skull even where its local normal faces
      // downwards; the general belly-colour rule would paint a white eye ring.
      parts.push(processPart(lid,0x5c6a70,0,.70));
      const nostril=new T.SphereGeometry(1,lowDetail ? 12 : 18,lowDetail ? 8 : 10);
      const nostrilCenter=bodySurface(anatomy.nostril.x,anatomy.nostril.angle,side,.003);
      nostril.scale(...anatomy.nostril.radii);nostril.translate(...nostrilCenter.toArray());
      parts.push(processPart(nostril,0x384348));
    }
  }

  function sweptFin(sections, horizontal=false, side=1, thickness=.09, flexScale=1, lowDetail=false) {
    const curve=new T.CatmullRomCurve3(sections.map(s=>new T.Vector3(...s)));
    const vertices=[],indices=[],centers=[];
    const thinness=[],flexibility=[];
    const rings=lowDetail ? 16 : 38,sides=lowDetail ? 10 : 20;
    for(let i=0;i<=rings;i++) {
      const u=i/rings;
      const section=curve.getPoint(u);
      const span=section.x,mid=(section.y+section.z)*.5;
      const halfChord=Math.max(.003,(section.y-section.z)*.5);
      const droop=horizontal?-.17-.15*Math.pow(Math.abs(span),1.25):0;
      centers.push(horizontal?new T.Vector3(mid,droop,span*side):new T.Vector3(mid,span,0));
      const flex=u*u*flexScale;
      for(let j=0;j<=sides;j++) {
        const angle=j/sides*Math.PI*2;
        const x=mid+Math.cos(angle)*halfChord;
        const cross=Math.sin(angle)*halfChord*thickness;
        if(horizontal)vertices.push(x,droop+cross,span*side);
        else vertices.push(x,span,cross);
        const thin=Math.min(1, Math.pow(u, 1.15) * .62 + Math.pow(.5 - .5 * Math.cos(angle), 1.6) * (.28 + .55 * u));
        thinness.push(thin);
        flexibility.push(flex);
      }
    }
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
      const a=i*(sides+1)+j,b=a+sides+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('finThinness',new T.Float32BufferAttribute(thinness,1));
    geometry.setAttribute('finFlex',new T.Float32BufferAttribute(flexibility,1));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    let outward=0;
    for(let i=1;i<rings;i++){
      const index=i*(sides+1)+5,c=centers[i];
      outward+=(p.getX(index)-c.x)*n.getX(index)+(p.getY(index)-c.y)*n.getY(index)+(p.getZ(index)-c.z)*n.getZ(index);
    }
    if(outward<0){
      for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      geometry.setIndex(indices);geometry.computeVertexNormals();
    }
    return processPart(geometry);
  }

  function mergeParts(geometries) {
    const merged=new T.BufferGeometry();
    const totalVertices=geometries.reduce((sum,g)=>sum+g.getAttribute('position').count,0);
    const totalIndices=geometries.reduce((sum,g)=>sum+g.index.count,0);
    for(const attribute of ['position','normal','color','skinDetail','jawWeight','jawSlope','surfaceRoughness','gillMask','mouthRegion','oralDetail','finThinness','finFlex']) {
      const length=geometries.reduce((sum,g)=>sum+g.getAttribute(attribute).array.length,0);
      const values=new Float32Array(length); let offset=0;
      for(const geometry of geometries) {
        const array=geometry.getAttribute(attribute).array;
        values.set(array,offset); offset+=array.length;
      }
      merged.setAttribute(attribute,new T.BufferAttribute(values,['position','normal','color'].includes(attribute)?3:1));
    }
    const mergedIndices=totalVertices>65535?new Uint32Array(totalIndices):new Uint16Array(totalIndices);
    let indexOffset=0,vertexOffset=0;
    for(const geometry of geometries){
      const idxArr=geometry.index.array,count=geometry.index.count;
      for(let m=0;m<count;m++){
        mergedIndices[indexOffset+m]=idxArr[m]+vertexOffset;
      }
      indexOffset+=count;
      vertexOffset+=geometry.getAttribute('position').count;
    }
    merged.setIndex(new T.BufferAttribute(mergedIndices,1));
    merged.computeBoundingSphere();
    merged.boundingSphere.radius+=1.4;
    geometries.forEach(g=>g.dispose());
    return merged;
  }

  function buildSharkGeometry(species, lowDetail = false) {
    const anatomy=sharkAnatomies[species];
    const parts = [bodyGeometry(anatomy, lowDetail)];
    if (anatomy.head === 'hammer') {
      parts.push(hammerGeometry(lowDetail));
    } else {
      pointedHeadDetails(parts,anatomy,lowDetail);
    }
    parts.push(sweptFin([[.46,.45,-1.22],[.80,.21,-.71],[1.22,-.04,-.55],[1.75,-.27,-.48],[2.15,-.42,-.435]],false,1,.20, 1.0, lowDetail));
    for(const side of [-1,1]){
      parts.push(sweptFin([[.36,.90,-.52],[.72,.60,-.70],[1.20,.05,-.95],[1.75,-.64,-1.20],[2.18,-1.27,-1.28]],true,side,.15, 1.0, lowDetail));
      parts.push(sweptFin([[.23,-1.64,-2.34],[.51,-1.86,-2.38],[.79,-2.31,-2.40],[.85,-2.42,-2.425]],true,side,.15, 0.45, lowDetail));
    }
    parts.push(sweptFin([[.22,-2.17,-2.80],[.45,-2.33,-2.64],[.66,-2.49,-2.50]],false,1,.15, 0.45, lowDetail));
    parts.push(sweptFin([[-.15,-2.53,-3.0],[-.38,-2.73,-2.96],[-.54,-2.96,-2.97]],false,1,.15, 0.45, lowDetail));
    parts.push(sweptFin([[.00,-3.30,-4.08],[.40,-3.53,-4.11],[.88,-3.83,-4.31],[1.36,-4.15,-4.48],[1.95,-4.68,-4.69]],false,1,.15, 0.35, lowDetail));
    parts.push(sweptFin([[.02,-3.31,-4.08],[-.36,-3.57,-4.12],[-.70,-3.90,-4.30],[-1.10,-4.35,-4.36]],false,1,.15, 0.35, lowDetail));

    for(const side of [-1,1]) {
      if (anatomy.head === 'hammer') {
        const socket=new T.SphereGeometry(.139,lowDetail ? 12 : 24,lowDetail ? 8 : 16);
        socket.scale(1.2,.75,.8);socket.translate(2.21,.035,side*1.72);parts.push(processPart(socket));
        const eye=new T.SphereGeometry(.089,lowDetail ? 12 : 24,lowDetail ? 8 : 16);
        eye.scale(1,.88,.7); eye.translate(2.23,.041,side*1.81); parts.push(processPart(eye,0x09141a,0,.28));
        const iris=new T.TorusGeometry(.079,.009,lowDetail ? 4 : 8,lowDetail ? 12 : 24);
        iris.translate(2.23,.041,side*1.85);parts.push(processPart(iris,0x344748,0,.38));
        const glint=new T.SphereGeometry(.018,lowDetail ? 6 : 10,lowDetail ? 4 : 8);
        glint.translate(2.255,.074,side*1.865); parts.push(processPart(glint,0x718b90,0,.34));
      }

      if (anatomy.head === 'hammer') {
        const nostril=new T.SphereGeometry(1,lowDetail ? 12 : 16,lowDetail ? 8 : 10);
        nostril.scale(.065,.012,.027);nostril.translate(2.37,-.102,side*1.37);parts.push(processPart(nostril,0x38474a));
      }

      // Gill creases are shaded on the continuous body with pixel-width
      // filtering below. Separate glossy tubes produced flickering wire edges.
      if (anatomy.head === 'hammer' && !lowDetail) {
        for(let i=0;i<19;i++){
          const z=side*(.36+i*.069);
          const pore=new T.SphereGeometry(.008,6,4);
          pore.translate(2.35+.017*Math.sin(i*2.3),-.085-Math.exp(-Math.abs(z)*3)*.055,z);
          parts.push(processPart(pore,0x718080));
        }
      }
    }

    // The hammerhead's closed mouth is shaded into its ventral skin below.
    // Separate lip tubes protruded beyond the head and formed an upturned smile.

    return mergeParts(parts);
  }

  // Three fixed shapes per species add restrained asymmetry without making a
  // new model for every shark. The same smooth warp moves skin, lips and eyes,
  // so details stay attached and the mouth remains closed along its seams.
  function shapeVariant(base,anatomy,variant){
    const geometry=base.clone(),p=geometry.attributes.position,n=geometry.attributes.normal;
    const seed=1.3+variant*2.71;
    function warp(x,y,z){
      const h=1+.035*Math.sin(x*1.7+seed)+.018*Math.cos(x*3.9+seed*.8);
      const w=1+.045*Math.sin(x*1.2+seed*.4);
      return new T.Vector3(x,y*h+.012*Math.sin(x*2+seed)*z+.008*Math.sin(z*8+x*2+seed),
        z*w+.013*Math.sin(x*2.7+seed)*y+.012*Math.sin(x*1.3+seed));
    }
    const normal=new T.Vector3(),jawPivot=anatomy.jaw?warp(...anatomy.jaw.pivot):new T.Vector3();
    let jawReach=0;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),point=warp(x,y,z);
      const yy=1+.035*Math.sin(x*1.7+seed)+.018*Math.cos(x*3.9+seed*.8);
      const zz=1+.045*Math.sin(x*1.2+seed*.4);
      const yz=.012*Math.sin(x*2+seed)+.064*Math.cos(z*8+x*2+seed);
      const zy=.013*Math.sin(x*2.7+seed);
      const yx=y*(.0595*Math.cos(x*1.7+seed)-.0702*Math.sin(x*3.9+seed*.8))
        +.024*Math.cos(x*2+seed)*z+.016*Math.cos(z*8+x*2+seed);
      const zx=z*.054*Math.cos(x*1.2+seed*.4)+.0351*Math.cos(x*2.7+seed)*y
        +.0156*Math.cos(x*1.3+seed);
      // Inverse transpose of the deformation keeps smooth normals, rather than
      // rebuilding flat triangle normals on this merged, non-indexed mesh.
      const det=yy*zz-yz*zy;
      const ny=(zz*n.getY(i)-zy*n.getZ(i))/det;
      const nz=(yy*n.getZ(i)-yz*n.getY(i))/det;
      normal.set(n.getX(i)-yx*ny-zx*nz,ny,nz).normalize();
      p.setXYZ(i,point.x,point.y,point.z);n.setXYZ(i,normal.x,normal.y,normal.z);
      if(geometry.attributes.jawWeight.getX(i)>0)jawReach=Math.max(jawReach,point.distanceTo(jawPivot));
    }
    geometry.userData.jawPivot=jawPivot.toArray();
    geometry.userData.jawReach=jawReach;
    geometry.computeBoundingSphere();
    geometry.userData.restRadius=geometry.boundingSphere.radius;
    geometry.boundingSphere.radius+=1.4;
    return geometry;
  }
  const sharkGeometries=Object.fromEntries(Object.keys(sharkAnatomies).map(species=>{
    const base=buildSharkGeometry(species,false);
    const variants=Array.from({length:3},(_,i)=>shapeVariant(base,sharkAnatomies[species],i));
    base.dispose();return [species,variants];
  }));
  const sharkGeometriesFar=Object.fromEntries(Object.keys(sharkAnatomies).map(species=>{
    const base=buildSharkGeometry(species,true);
    const variants=Array.from({length:3},(_,i)=>shapeVariant(base,sharkAnatomies[species],i));
    base.dispose();return [species,variants];
  }));
  const sharks=[];
  const speciesInputs=Array.from(document.querySelectorAll('input[name="species"]'));
  function selectedSharkSpecies(){
    return speciesInputs.filter(input=>input.checked && input.value!=='jellyfish').map(input=>input.value);
  }
  function createShark(config) {
    let sp = config.species;
    if (!sp) {
      const selected=selectedSharkSpecies();
      sp = selected[sharks.length%selected.length] || 'hammerhead';
    }
    const variantIndex=sharks.length%3,geometry=sharkGeometries[sp][variantIndex];
    const uniforms={ swimTime:{value:0}, swimPhase:{value:config.phase}, swimPower:{value:config.power||1},
      individualSeed:{value:config.phase*13.7+sharks.length*1.73},
      jawAngle:{value:0},jawPivot:{value:new T.Vector3(...geometry.userData.jawPivot)},
      dragBend:{value:new T.Vector2()}, finTurn:{value:new T.Vector2()}, sunColor:waterUniforms.sunColor,
      sunPower:waterUniforms.sunPower, lightDirection:waterUniforms.lightDirection,
      daylight:waterUniforms.daylight, sharkSpeed:{value:0},
      activeSharkCount:oceanOptics.activeSharkCount,
      causticMultiTap:oceanOptics.causticMultiTap,
      animalStates:oceanOptics.animalStates, animalHeadings:oceanOptics.animalHeadings,
      causticMap:{value:causticTarget.texture},causticOrigin:{value:causticOrigin},
      causticSpan:{value:causticSpan},causticDepths:{value:causticDepths} };
    const material=new T.MeshStandardMaterial({
      vertexColors:true,roughness:.58,metalness:0,side:T.DoubleSide
    });
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=`uniform float swimTime; uniform float swimPhase; uniform float swimPower;
        uniform vec2 dragBend;
        uniform vec2 finTurn;
        uniform float jawAngle;
        uniform vec3 jawPivot;
        uniform vec3 lightDirection;
        ${solarOcclusionGLSL}
        attribute float skinDetail;
        attribute float jawWeight;
        attribute float jawSlope;
        attribute float surfaceRoughness;
        attribute float gillMask;
        attribute float mouthRegion;
        attribute float oralDetail;
        attribute float finThinness;
        attribute float finFlex;
        varying float sharkDetail;
        varying float sharkRoughness;
        varying float bodySkin;
        varying float mouthSkin;
        varying float mouthTissue;
        varying float vFinThinness;
        varying vec3 sharkPosition;
        varying vec3 sharkWorldPosition;
        varying vec3 sharkWorldNormal;
        varying vec3 vSharkForward;
        varying float solarShadow;
        mat2 jawRotation(){float a=-jawAngle*jawWeight;return mat2(cos(a),sin(a),-sin(a),cos(a));}
        vec3 jawPosition(vec3 p){p.xy=jawPivot.xy+jawRotation()*(p.xy-jawPivot.xy);return p;}
        float bend(float x){
          float tail=clamp((1.8-x)/6.2,0.,1.2);
          float head=clamp((x-1.8)/1.5,0.,1.0);
          float phase=swimTime*1.9+x*.91+swimPhase;
          float wave=sin(phase)-.15*sin(phase*2.);
          return (wave*tail*tail*.57 - wave*head*.1) * swimPower;
        }
        float bendSlope(float x){return (bend(x+.01)-bend(x-.01))/.02;}
        float elasticWeight(float x){float tail=clamp((1.8-x)/6.2,0.,1.2);return tail*tail;}
        float elasticSlope(float x){return (elasticWeight(x+.01)-elasticWeight(x-.01))/.02;}
        ${shader.vertexShader}`;
      // Normals turn with the surface so lighting follows the moving tail.
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        // Inverse-transpose of the soft hinge, followed by its rigid rotation.
        // The derivative term prevents a lighting crease where the throat flexes.
        if(jawSlope!=0.){
          float angleSlope=-jawAngle*jawSlope;
          vec2 change=angleSlope*vec2(-(position.y-jawPivot.y),position.x-jawPivot.x);
          objectNormal.x-=dot(change,objectNormal.xy)/(1.+change.x);
        }
        objectNormal.xy=jawRotation()*objectNormal.xy;
        float bentX=jawPosition(position).x;
        objectNormal.x-=bendSlope(bentX)*objectNormal.z+elasticSlope(bentX)*dot(dragBend,objectNormal.yz);
        float horizFin=step(.32,abs(position.z));
        objectNormal.y-=finFlex*finTurn.y*horizFin*.85*sign(objectNormal.y+.001)*abs(objectNormal.z);
        objectNormal.z-=finFlex*finTurn.x*(1.-horizFin)*.85*sign(objectNormal.z+.001)*abs(objectNormal.y);`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        transformed=jawPosition(transformed);
        transformed.z+=bend(transformed.x);
        transformed.yz+=dragBend*elasticWeight(transformed.x);
        horizFin=step(.32,abs(position.z));
        transformed.y+=finFlex*finTurn.y*horizFin;
        transformed.z+=finFlex*finTurn.x*(1.-horizFin);
        vFinThinness=finThinness*skinDetail;
        sharkPosition=position;
        sharkDetail=skinDetail;
        sharkRoughness=surfaceRoughness;
        bodySkin=gillMask;
        mouthSkin=mouthRegion*smoothstep(.15,.60,-normal.y);
        mouthTissue=oralDetail;
        sharkWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;
        sharkWorldNormal=normalize(mat3(modelMatrix)*objectNormal);
        vSharkForward=normalize(mat3(modelMatrix)*vec3(1.,0.,0.));
        solarShadow=sharkSolarOcclusion(sharkWorldPosition,lightDirection,modelMatrix[3].xyz);`);
      // Procedural skin follows the model, not the screen. Colour variation, fine
      // denticles and uneven gloss preserve detail without external image files.
      shader.fragmentShader=`
        uniform vec3 sunColor;
        uniform vec3 lightDirection;
        uniform float sunPower;
        uniform float daylight;
        uniform float sharkSpeed;
        uniform float individualSeed;
        uniform float swimTime;
        uniform float swimPhase;
        uniform float jawAngle;
        uniform sampler2D causticMap;
        uniform vec2 causticOrigin;
        uniform float causticSpan;
        uniform vec3 causticDepths;
        uniform float causticMultiTap;
        varying float sharkDetail;
        varying float sharkRoughness;
        varying float bodySkin;
        varying float mouthSkin;
        varying float mouthTissue;
        varying float vFinThinness;
        varying vec3 sharkPosition;
        varying vec3 sharkWorldPosition;
        varying vec3 sharkWorldNormal;
        varying vec3 vSharkForward;
        varying float solarShadow;
        float skinHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float skinNoise(vec3 p){
          vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(skinHash(i),skinHash(i+vec3(1,0,0)),f.x),
                         mix(skinHash(i+vec3(0,1,0)),skinHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(skinHash(i+vec3(0,0,1)),skinHash(i+vec3(1,0,1)),f.x),
                         mix(skinHash(i+vec3(0,1,1)),skinHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        ${shader.fragmentShader}`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        float posDeriv = max(length(dFdx(sharkPosition)), length(dFdy(sharkPosition)));
        float gillPixel = max(fwidth(sharkPosition.x), .002);
        float foldPhase = sharkPosition.x * 34. + sin(sharkPosition.z * 17.) * .65;
        float foldPixel = max(fwidth(foldPhase), .01);
        float skinFine = .5, skinMottle = .5, broadMottle = .5, detailVisibility = 0., gillShade = 0., mouthShade = 0., scarMask = 0., tissueNoise = .5, tissueFolds = 0.;

        if (sharkDetail > .001) {
          vec3 individualOffset=vec3(individualSeed,individualSeed*.37,individualSeed*.79);
          skinFine=skinNoise(sharkPosition*vec3(125.,70.,70.)+individualOffset);
          skinMottle=skinNoise(sharkPosition*vec3(3.1,5.,5.)+individualOffset);
          broadMottle=skinNoise(sharkPosition*1.65+individualOffset*2.);
          detailVisibility=1.-smoothstep(.025,.09,posDeriv);
          diffuseColor.rgb*=1.+sharkDetail*((skinMottle-.5)*.34+(broadMottle-.5)*.32+(skinFine-.5)*.08*detailVisibility);
          diffuseColor.rgb*=mix(vec3(1.),vec3(.94+.04*sin(individualSeed),.98,1.01),sharkDetail);
        }

        // Five coherent slits bow toward the tail (-X). Progressively shorter
        // rear slits share one shape on both sides, rather than independently
        // random curves. Pixel coverage softens each recessed edge in motion.
        if (bodySkin > .001) {
          float gillAngle=atan(abs(sharkPosition.z),sharkPosition.y);
          float gillOpen=1.;
          for(int i=0;i<5;i++){
            float g=float(i),start=.72+g*.032;
            float end=2.40-g*.035;
            float t=clamp((gillAngle-start)/(end-start),0.,1.);
            float centre=1.38-g*.143-(.115-g*.006)*sin(t*3.14159)
              +.003*sin(t*9.+individualSeed);
            float d=abs(sharkPosition.x-centre);
            float respCycle=.5+.5*sin(swimTime*1.15+swimPhase-g*.34);
            float jawPump=clamp(jawAngle*4.0,0.,1.)*(.65+.35*sin(swimTime*1.15-g*.42));
            gillOpen=clamp(.82+.32*max(respCycle*.75,jawPump),.75,1.28);
            float width=(.012-g*.0005)*gillOpen;
            float crease=1.-smoothstep(max(0.,width-gillPixel),width+gillPixel,d);
            crease*=width/max(width,gillPixel);
            crease*=smoothstep(start,start+.14,gillAngle)*(1.-smoothstep(end-.16,end,gillAngle));
            gillShade=max(gillShade,crease);
          }
          gillShade*=bodySkin;
          diffuseColor.rgb*=1.-gillShade*(.39+.08*gillOpen);
        }

        // A shallow, rearward-curving slit on the hammerhead's underside.
        // This changes the skin itself: it cannot detach, extend beyond the
        // silhouette or show through from above like a separate lip tube.
        if (mouthSkin > .001) {
          float mouthZ=sharkPosition.z;
          float mouthX=2.13-.17*pow(mouthZ/.46,2.);
          float mouthSlope=-.34*mouthZ/(.46*.46);
          float mouthDistance=abs(sharkPosition.x-mouthX)/sqrt(1.+mouthSlope*mouthSlope);
          float mouthPixel=max(gillPixel,.002);
          float mouthWidth=.013;
          mouthShade=(1.-smoothstep(max(0.,mouthWidth-mouthPixel),mouthWidth+mouthPixel,mouthDistance))
            *mouthWidth/max(mouthWidth,mouthPixel);
          mouthShade*=mouthSkin*(1.-smoothstep(.34,.46,abs(mouthZ)));
          diffuseColor.rgb*=1.-mouthShade*.55;
        }

        // Healed marks have a visible width at the permitted camera distance.
        // Their own coarse-detail fade is separate from microscopic denticles;
        // otherwise every scar vanished with the fine skin texture in mid-shot.
        float scarVisibility=sharkDetail*(1.-smoothstep(.12,.30,posDeriv));
        if (scarVisibility > .001) {
          vec3 individualOffset=vec3(individualSeed,individualSeed*.37,individualSeed*.79);
          for(int i=0;i<6;i++){
            float id=float(i),seed=skinHash(vec3(individualSeed,id,4.7));
            vec2 centre=vec2(-1.4+seed*3.7,-.04+.42*skinHash(vec3(id,individualSeed,1.2)));
            vec2 axis=normalize(vec2(.4+seed,.55-seed*.75));
            vec2 q=sharkPosition.xy-centre;
            float halfLength=.16+.24*seed;
            float along=clamp(dot(q,axis),-halfLength,halfLength);
            vec2 across=vec2(-axis.y,axis.x);
            float curve=.017*sin(along*15.+seed*9.)+.006*sin(along*37.+id);
            float distanceToScar=length(q-axis*along-across*curve);
            float wearNoise=skinNoise(sharkPosition*vec3(18.,42.,42.)+individualOffset);
            float width=(.018+.020*seed)*(.75+.25*sin(along*29.+seed*9.))*(.55+.60*wearNoise);
            float pixel=max(posDeriv,width*.55);
            float mark=(1.-smoothstep(max(0.,width-pixel),width+pixel,distanceToScar))
              *width/max(width,pixel);
            mark*=1.-smoothstep(halfLength*.55,halfLength,abs(along));
            mark*=.25+.75*smoothstep(.22,.74,wearNoise);
            float side=mod(id,2.)<.5?-1.:1.;
            scarMask=max(scarMask,mark*smoothstep(.09,.22,sharkPosition.z*side));
          }
          scarMask*=scarVisibility;
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.75+vec3(.14,.135,.12),scarMask*.72);
        }

        // Muted mucosal mottling and palatal folds add depth inside the mouth.
        // The rear cavity darkens toward the throat; gums remain gently pink-grey.
        if (mouthTissue > .001) {
          tissueNoise=skinNoise(sharkPosition*vec3(18.,31.,27.));
          tissueFolds=(.5+.5*sin(foldPhase))*(1.-smoothstep(.6,2.,foldPixel));
          float throatShade=mix(.42,1.,smoothstep(1.43,2.20,sharkPosition.x));
          diffuseColor.rgb*=mix(1.,(.78+.30*tissueNoise+.13*tissueFolds)*throatShade,mouthTissue);
        }
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        vec3 smoothNormal=normalize(sharkWorldNormal);
        float normalVariance=dot(dFdx(smoothNormal),dFdx(smoothNormal))+dot(dFdy(smoothNormal),dFdy(smoothNormal));
        roughnessFactor=clamp(mix(sharkRoughness,.45+skinFine*.10+skinMottle*.16,sharkDetail)
          +min(.2,sqrt(normalVariance)*.35),.25,1.);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float skinHeight=skinFine*.008*sharkDetail*detailVisibility-gillShade*.007-mouthShade*.005
          +scarMask*.005+(tissueNoise*.003+tissueFolds*.002)*mouthTissue;
        vec3 sigmaX=normalize(dFdx(-vViewPosition));
        vec3 sigmaY=normalize(dFdy(-vViewPosition));
        vec3 gradientX=cross(sigmaY,normal);
        vec3 gradientY=cross(normal,sigmaX);
        float determinant=dot(sigmaX,gradientX)*faceDirection;
        vec3 skinGradient=sign(determinant)*(dFdx(skinHeight)*gradientX+dFdy(skinHeight)*gradientY);
        normal=normalize(abs(determinant)*normal-skinGradient);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        // Sample projected sunlight in world space. Swimming through the light
        // moves the pattern across the skin; rotating the camera does not.
        float waterDepth=max(0.,15.-sharkWorldPosition.y);
        if(sunPower>.001){
          vec2 surfaceCoordinate=sharkWorldPosition.xz
            +lightDirection.xz*waterDepth/max(.2,lightDirection.y);
          vec2 causticUV=(surfaceCoordinate-causticOrigin)/causticSpan+.5;
          float spread=.0028+waterDepth*.00018;
          vec3 layers=causticMultiTap>.5
            ?(texture2D(causticMap,causticUV).rgb*.40
              +(texture2D(causticMap,causticUV+vec2(spread,0.)).rgb
              + texture2D(causticMap,causticUV-vec2(spread,0.)).rgb
              + texture2D(causticMap,causticUV+vec2(0.,spread)).rgb
              + texture2D(causticMap,causticUV-vec2(0.,spread)).rgb)*.15)*16.
            :texture2D(causticMap,causticUV).rgb*16.;
          float focus=waterDepth<causticDepths.y
            ?mix(layers.r,layers.g,clamp((waterDepth-causticDepths.x)/(causticDepths.y-causticDepths.x),0.,1.))
            :mix(layers.g,layers.b,clamp((waterDepth-causticDepths.y)/(causticDepths.z-causticDepths.y),0.,1.));
          vec2 edge=min(causticUV,1.-causticUV);
          float mapFade=smoothstep(0.,.06,min(edge.x,edge.y));
          float depthFade=exp(-waterDepth*.035)*smoothstep(0.,3.,waterDepth);
          float lightFootprint=max(length(dFdx(surfaceCoordinate)),length(dFdy(surfaceCoordinate)));
          float distanceFilter=1.-smoothstep(.2,1.,lightFootprint);
          float illuminatedBack=max(dot(normalize(sharkWorldNormal),lightDirection),0.)*sharkDetail;
          float rawContrast=focus-.92;
          float lightContrast=rawContrast>0.?(rawContrast*2.2)/(1.+rawContrast*.75):clamp(rawContrast,-.55,0.);
          outgoingLight=max(vec3(0.),outgoingLight+diffuseColor.rgb*sunColor*sunPower
            *lightContrast*illuminatedBack*depthFade*mapFade*distanceFilter*.70*solarShadow);

          vec3 worldViewDir=normalize(cameraPosition-sharkWorldPosition);
          float backSun=pow(max(dot(-worldViewDir,lightDirection),0.),2.6)*sunPower*solarShadow;
          float finRim=.35+.65*pow(1.-abs(dot(normalize(sharkWorldNormal),worldViewDir)),1.8);
          vec3 sssTint=sunColor*vec3(1.08,.76,.52);
          outgoingLight+=sssTint*vFinThinness*backSun*finRim*depthFade*.48;
        }

        // Part 3: 3D Beer-Lambert vertical depth & path spectral absorption
        float viewDist=length(vViewPosition);
        vec3 verticalAbsorption=exp(-vec3(.020,.007,.0015)*max(0.,waterDepth-11.));
        vec3 pathAbsorption=exp(-vec3(.014,.004,.0008)*viewDist);
        outgoingLight*=mix(vec3(1.),verticalAbsorption*pathAbsorption,.78);

        // Part 4: Nocturnal bioluminescent grazing sheen on leading snout/fin skin
        if(daylight<.32){
          float nightBio=smoothstep(.32,.02,daylight);
          float forwardFacing=clamp(dot(normalize(sharkWorldNormal),normalize(vSharkForward)),0.,1.);
          float viewFacing=clamp(dot(normalize(sharkWorldNormal),-normalize(vViewPosition)),0.,1.);
          float graze=pow(1.-viewFacing,2.5);
          float sheenFactor=clamp(sharkSpeed*.4,0.,1.5)*nightBio*(forwardFacing*.65+graze*.35);
          outgoingLight+=diffuseColor.rgb*vec3(.08,.74,1.)*sheenFactor*.35;
        }

        #include <opaque_fragment>
      `);
    };
    const mesh=new T.Mesh(geometry,material);
    mesh.name=sp;
    // Picking uses the same bent surface that is displayed. Three.js
    // calls this method during raycasting, so a moving tail can also be grabbed.
    mesh.getVertexPosition=function(index,target){
      T.Mesh.prototype.getVertexPosition.call(this,index,target);
      const angle=-uniforms.jawAngle.value*this.geometry.attributes.jawWeight.getX(index);
      const c=Math.cos(angle),s=Math.sin(angle),pivot=uniforms.jawPivot.value;
      const localX=target.x-pivot.x,localY=target.y-pivot.y;
      target.x=pivot.x+c*localX-s*localY;
      target.y=pivot.y+s*localX+c*localY;
      const tail=T.MathUtils.clamp((1.8-target.x)/6.2,0,1.2);
      const head=T.MathUtils.clamp((target.x-1.8)/1.5,0,1);
      const phase=uniforms.swimTime.value*1.9+target.x*.91+uniforms.swimPhase.value;
      const wave=Math.sin(phase)-.15*Math.sin(phase*2);
      target.y+=uniforms.dragBend.value.x*tail*tail;
      target.z+=wave*(tail*tail*.57-head*.1)*uniforms.swimPower.value
        +uniforms.dragBend.value.y*tail*tail;
      const flex=this.geometry.attributes.finFlex?this.geometry.attributes.finFlex.getX(index):0;
      if(flex>0){
        const posZ=this.geometry.attributes.position.getZ(index);
        if(Math.abs(posZ)>=.32) target.y+=flex*uniforms.finTurn.value.y;
        else target.z+=flex*uniforms.finTurn.value.x;
      }
      return target;
    };
    mesh.scale.setScalar(config.scale);
    scene.add(mesh); sharks.push({mesh,uniforms,species:sp,variantIndex,isFarLod:false,...config,
      offset:new T.Vector3(),velocity:new T.Vector3(),
      rotationOffset:new T.Quaternion(),angularVelocity:new T.Vector3(),
      finTurnInteraction:new T.Vector2(),
      prevCaudalTip:new T.Vector3(),
      prevPectoralL:new T.Vector3(),
      prevPectoralR:new T.Vector3(),
      hasPrevFinPos:false,
      extraSwimPhase:0,burstPower:0});
  }
  // Asymmetric paths and different orbit periods avoid synchronised movement.
  // There are no visible restarts: sharks follow continuous curves.
  const configurations=[
    {scale:1.22,rx:18,rz:24,z:-10,y:1.6,phase:-.62,rate:.023,direction:1},
    {scale:1.02,rx:26,rz:10,z:-10,y:4.8,phase:1.9,rate:.023,direction:-1},
    {scale:.88,rx:32,rz:10,z:-13,y:-4.2,phase:.48,rate:.026,direction:1},
    {scale:1.08,rx:34,rz:13,z:-19,y:1.7,phase:3.7,rate:.020,direction:-1},
    {scale:.95,rx:36,rz:10,z:-23,y:8,phase:4.4,rate:.022,direction:1},
    {scale:1.02,rx:40,rz:11,z:-27,y:-6,phase:5.5,rate:.018,direction:-1},
    {scale:.85,rx:44,rz:12,z:-32,y:3,phase:2.8,rate:.021,direction:1},
    {scale:.93,rx:46,rz:9,z:-35,y:8,phase:.15,rate:.019,direction:1},
    {scale:.9,rx:50,rz:12,z:-43,y:-1.5,phase:5.9,rate:.019,direction:-1},
    {scale:1,rx:55,rz:10,z:-48,y:7,phase:1.2,rate:.017,direction:1},
    {scale:.92,rx:57,rz:11,z:-50,y:-8,phase:3.2,rate:.016,direction:-1},
    {scale:.95,rx:59,rz:11,z:-56,y:8,phase:4.7,rate:.018,direction:1}
  ];
  configurations.forEach(createShark);
  // Distant paths need more width to cover the same viewing angle. Independent
  // phases spread the background animals rather than keeping one central pack.
  for(let i=0;i<9;i++) createShark({scale:.57+(i%3)*.1,rx:58+(i%3)*6,rz:7,z:-62-(i%3)*4,
    y:-4+Math.sin(i*2.3)*12,phase:.4+i*2.39996,rate:.014,direction:i%2?1:-1});

  // Extra sharks are created only when first needed. They share the model
  // and are hidden/reused as the slider moves back and forth.
  // This creates at most 40 sharks, regardless of how long the page runs.
  const animalCountInput=document.getElementById('animal-count');
  function setSharkCount(value){
    const count=T.MathUtils.clamp(Math.round(Number(value)),0,40);
    while(sharks.length<count){
      const i=sharks.length-21;
      createShark({scale:.66+(i%4)*.10,rx:30+(i%7)*5,rz:9+(i%3)*2,
        z:-16-(i%7)*6,y:-6+(i%6)*2.65,phase:.7+i*2.39996,
        rate:.016+(i%5)*.002,direction:i%2?1:-1});
    }
    const selected=selectedSharkSpecies();
    sharks.forEach((shark,index)=>{
      shark.mesh.visible=index<count && selected.length>0;
      const species=selected[index%selected.length];
      if(species && shark.species!==species){
        shark.species=species;
        shark.mesh.geometry=(shark.isFarLod ? sharkGeometriesFar : sharkGeometries)[species][shark.variantIndex];
        shark.mesh.name=species;
        shark.uniforms.jawPivot.value.fromArray(shark.mesh.geometry.userData.jawPivot);
        shark.uniforms.jawAngle.value=0;
      }
    });
  }
  function setAnimalCount(value){
    const count=T.MathUtils.clamp(Math.round(Number(value)),0,40);
    const selected=speciesInputs.filter(input=>input.checked).map(input=>input.value);
    const jellyIndex=selected.indexOf('jellyfish');
    // Round-robin allocation keeps the exact total, even when it cannot be
    // divided equally. A single selected species receives the whole count.
    const jellyCount=jellyIndex<0?0:Math.floor(count/selected.length)
      +(jellyIndex<count%selected.length?1:0);
    setSharkCount(selected.length?count-jellyCount:0);
    jellyfish.setCount(jellyCount);
    animalCountInput.value=String(count);
    document.getElementById('animal-count-value').value=String(count);
    redrawNeeded=true;
  }

  // Suspended dust and a few tumbling flakes occupy near and distant water.
  // A gentle common current carries small local eddies. Particles fade out at
  // their volume boundaries before recycling, keeping long sessions populated.
  const particleCount=5000;
  const particlePositions=new Float32Array(particleCount*3);
  const particleSizes=new Float32Array(particleCount);
  const particleSeeds=new Float32Array(particleCount*2);
  const particleNearWater=new Float32Array(particleCount);
  let randomSeed=391;
  function random(){randomSeed=(randomSeed*16807)%2147483647;return (randomSeed-1)/2147483646;}
  for(let i=0;i<particleCount;i++) {
    // Interleave depths so reducing the draw count keeps both near and far dust.
    const near=i%3===0;
    particleNearWater[i]=near?1:0;
    particlePositions.set([(random()-.5)*(near?32:115),(near?-7:-24)+random()*(near?19:35),
      near?2+random()*23:random()*-105+16],i*3);
    particleSizes[i]=(near?.030:.024)+random()*(near?.055:.045);
    particleSeeds.set([random()*6.283185,random()],i*2);
  }
  const particleGeometry=new T.BufferGeometry();
  particleGeometry.setAttribute('position',new T.BufferAttribute(particlePositions,3));
  particleGeometry.setAttribute('size',new T.BufferAttribute(particleSizes,1));
  particleGeometry.setAttribute('particleSeed',new T.BufferAttribute(particleSeeds,2));
  particleGeometry.setAttribute('nearWater',new T.BufferAttribute(particleNearWater,1));
  const particleUniforms={time:{value:0},pixelRatio:{value:renderer.getPixelRatio()},
    daylight:waterUniforms.daylight,sunColor:waterUniforms.sunColor,sunPower:waterUniforms.sunPower,
    lightDirection:waterUniforms.lightDirection,causticMap:{value:causticTarget.texture},
    causticOrigin:{value:causticOrigin},causticSpan:{value:causticSpan},causticDepths:{value:causticDepths},
    activeAnimalCount:oceanOptics.activeAnimalCount,
    animalStates:oceanOptics.animalStates,animalMotions:oceanOptics.animalMotions,animalHeadings:oceanOptics.animalHeadings};
  const particleMaterial=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:particleUniforms,toneMapped:false,
    vertexShader:`
      uniform float time;uniform float pixelRatio;uniform float sunPower;uniform float daylight;
      uniform vec3 lightDirection;uniform sampler2D causticMap;
      uniform vec2 causticOrigin;uniform float causticSpan;uniform vec3 causticDepths;
      uniform int activeAnimalCount;
      uniform vec4 animalStates[24];
      uniform vec4 animalMotions[24];
      uniform vec4 animalHeadings[24];
      attribute float size;attribute vec2 particleSeed;attribute float nearWater;
      varying float alpha;varying float illumination;varying vec2 tumble;
      void main(){
        // All particles share a slow rightward current, slightly into the scene.
        // Local eddies are weaker than the current, so neighbours travel together.
        vec3 cell=floor(position/vec3(12.,10.,14.));
        float phase=dot(cell,vec3(1.37,2.11,.83));
        vec3 p=position;
        float halfWidth=mix(70.,24.,nearWater);
        float back=mix(-105.,-2.,nearWater),front=mix(20.,27.,nearWater);
        p.x=mod(p.x+time*.08+halfWidth,halfWidth*2.)-halfWidth;
        p.z=mod(p.z-time*.018-back,front-back)+back;
        // Recycling is fully invisible at both ends; never jump a bright flake.
        float flowFade=smoothstep(0.,4.,halfWidth-abs(p.x))
          *smoothstep(0.,2.,min(p.z-back,front-p.z));
        p.x+=.4*sin(time*.019+phase);
        p.y+=.35*sin(time*.021+phase)+.16*sin(time*.013+phase*.7);
        p.z+=.35*cos(time*.017+phase);

        vec3 wakeOffset=vec3(0.);
        for(int k=0;k<24;k++){
          if(k>=activeAnimalCount)break;
          vec4 st=animalStates[k];
          if(st.w<=.01)continue;
          vec3 rel=p-st.xyz;
          float maxRange=st.w*11.;
          float d2=dot(rel,rel);
          if(d2>maxRange*maxRange)continue;
          vec4 mo=animalMotions[k];
          vec4 hd=animalHeadings[k];
          vec3 axis=hd.w>.01?hd.xyz:(length(mo.xyz)>.01?normalize(mo.xyz):vec3(0.,1.,0.));
          float bodyHalf=max(hd.w,st.w);
          float along=dot(rel,axis);
          vec3 radialVec=rel-axis*clamp(along,-bodyHalf,bodyHalf);
          float radialDist=length(radialVec);
          vec3 radialDir=radialDist>.001?radialVec/radialDist:vec3(0.,1.,0.);

          // 1. Bow & body potential-flow parting: particles part smoothly around the animal's body
          float bodyEnvelope=1.-smoothstep(st.w*.55,st.w*2.4,radialDist);
          float alongBody=1.-smoothstep(bodyHalf*.85,bodyHalf*1.45,abs(along));
          wakeOffset+=radialDir*(bodyEnvelope*alongBody*st.w*.52);

          // 2. Trailing vortex wake behind the tail / bell (-axis direction)
          float behind=clamp((-along-bodyHalf*.35)/(st.w*8.2),0.,1.);
          float inWake=(1.-behind)*step(-bodyHalf-st.w*8.5,along)*step(along,-bodyHalf*.20);
          float wakeRadius=st.w*(1.05+1.95*behind);
          float radialWake=1.-smoothstep(wakeRadius*.22,wakeRadius,radialDist);
          vec3 swirlDir=normalize(cross(axis,radialDir)+vec3(.0001));
          float activity=clamp(mo.w,0.,2.5);
          float swirlPhase=along*2.4-time*3.6+particleSeed.x;
          float nearWake=exp(-behind*2.1);
          wakeOffset+=(swirlDir*sin(swirlPhase)*.42+radialDir*.18)*inWake*radialWake*nearWake*activity*st.w;
        }
        // Respect flowFade so boundary recycling stays invisible even in wakes
        p+=wakeOffset*flowFade;

        float depth=max(0.,15.-p.y);
        illumination=0.;
        if(sunPower>.001){
          vec2 uv=(p.xz+lightDirection.xz*depth/max(.2,lightDirection.y)-causticOrigin)/causticSpan+.5;
          vec3 layers=texture2D(causticMap,uv).rgb*16.;
          float focus=depth<causticDepths.y
            ? mix(layers.r,layers.g,clamp((depth-causticDepths.x)/(causticDepths.y-causticDepths.x),0.,1.))
            : mix(layers.g,layers.b,clamp((depth-causticDepths.y)/(causticDepths.z-causticDepths.y),0.,1.));
          vec2 edge=min(uv,1.-uv);
          illumination=clamp(focus,0.,3.)*smoothstep(0.,.06,min(edge.x,edge.y))*sunPower*exp(-depth*.022);
        }
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        float pixels=size*440.*pixelRatio/max(.1,-mv.z);
        gl_PointSize=clamp(pixels,1.,7.);
        float distanceToEye=length(mv.xyz);
        alpha=exp(-distanceToEye*.022)*smoothstep(.8,3.,distanceToEye)
          *min(1.,pixels*pixels)*(.18+.24*particleSeed.y)*flowFade;
        // Most particles are round dust; sparse flakes turn edge-on as they roll.
        tumble=vec2(time*(.08+particleSeed.y*.08)+particleSeed.x,
          particleSeed.y>.82?.3+.7*abs(sin(time*.11+particleSeed.x)):1.);
      }`,
    fragmentShader:`
      uniform float daylight;uniform vec3 sunColor;
      varying float alpha;varying float illumination;varying vec2 tumble;
      void main(){
        vec2 point=gl_PointCoord-.5;
        point=mat2(cos(tumble.x),sin(tumble.x),-sin(tumble.x),cos(tumble.x))*point;
        point.x/=tumble.y;
        float radius=length(point);
        float coverage=1.-smoothstep(.04,.5,radius);
        vec3 tint=mix(vec3(.36,.62,.84),sunColor,.45*clamp(illumination,0.,1.));
        float dustAlpha=coverage*alpha*(daylight*.60+.85*illumination);
        if(dustAlpha<=.002)discard;
        gl_FragColor=vec4(tint,dustAlpha);
      }`
  });
  const particles=new T.Points(particleGeometry,particleMaterial);
  particles.name='Circulating marine particles';particles.renderOrder=2;
  particles.frustumCulled=false;scene.add(particles);
  const particleCountInput=document.getElementById('particle-count');
  function setParticleCount(value){
    const count=T.MathUtils.clamp(Math.round(Number(value)/100)*100,0,particleCount);
    // Reuse the fixed buffer: changing density allocates no geometry or material.
    particleGeometry.setDrawRange(0,count);
    particles.visible=count>0;
    particleCountInput.value=String(count);
    document.getElementById('particle-count-value').value=String(count);
    redrawNeeded=true;
  }

  // ---------------------------------------------------------------------------
  // Layer 2: Hydrodynamic Wake & Scintillation Ring-Buffer System (10,000 Points)
  // ---------------------------------------------------------------------------
  function createBioluminescenceWakeSystem(T, scene) {
    const N = 10000;
    const geometry = new T.BufferGeometry();
    const posArray = new Float32Array(N * 3);
    const velArray = new Float32Array(N * 3);
    const bioArray = new Float32Array(N * 4); // x: birthTime, y: intensity, z: seed, w: particleType

    for (let i = 0; i < N; i++) {
      bioArray[i * 4 + 0] = -100.0;
      bioArray[i * 4 + 1] = 0.0;
      bioArray[i * 4 + 2] = 0.0;
      bioArray[i * 4 + 3] = 0.0;
    }

    const posAttr = new T.BufferAttribute(posArray, 3);
    const velAttr = new T.BufferAttribute(velArray, 3);
    const bioAttr = new T.BufferAttribute(bioArray, 4);

    posAttr.setUsage(T.DynamicDrawUsage);
    velAttr.setUsage(T.DynamicDrawUsage);
    bioAttr.setUsage(T.DynamicDrawUsage);

    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('aVelocity', velAttr);
    geometry.setAttribute('aBioData', bioAttr);

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    };

    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: T.AdditiveBlending,
      toneMapped: false,
      uniforms: uniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute vec3 aVelocity;
        attribute vec4 aBioData;

        varying float vAlpha;
        varying float vType;
        varying float vCamDist;

        void main(){
          float birthTime = aBioData.x;
          float age = uTime - birthTime;

          if (age <= 0.0 || age > 1.25 || aBioData.y <= 0.001) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }

          // Dobbelt-eksponentiel biokemisk kinetik: tauRise = 25ms, tauDecay = 220ms (320ms for halo)
          float tauRise = 0.025;
          float tauDecay = mix(0.22, 0.32, aBioData.w);
          float localAge = max(0.0, age - aBioData.z * 0.08 * (1.0 - aBioData.w));
          float flash = (tauDecay / (tauDecay - tauRise)) * (exp(-localAge / tauDecay) - exp(-localAge / tauRise));

          vAlpha = clamp(flash * aBioData.y, 0.0, 1.0);
          vType = aBioData.w;

          // Hydrodynamisk viskoes advektion med opbremsning i vandet
          float dragFactor = (1.0 - exp(-age * 3.2)) / 3.2;
          vec3 currentPos = position + aVelocity * dragFactor;

          vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
          vCamDist = max(0.2, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;

          // Point size: 1.0 - 2.6 px for micro-spores, max 8.0 px for subtle diffuse mist
          float baseSize = mix(0.015, 0.060 * (1.0 + age * 0.4), vType);
          float projectedSize = (baseSize * uPixelRatio * 380.0) / vCamDist;
          gl_PointSize = (vType < 0.5) ? clamp(projectedSize, 1.0, 2.6) : clamp(projectedSize, 2.0, 8.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vType;
        varying float vCamDist;

        void main(){
          if (vAlpha <= 0.002) discard;

          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(uv, uv);
          if (r2 > 1.0) discard;

          // Skarp eksponentiel kerne for type 0, bloed diffus Gauss for type 1
          float radialProfile = (vType < 0.5)
            ? exp(-r2 * 6.5) * (1.0 - r2)
            : exp(-r2 * 3.8) * pow(1.0 - r2, 1.6) * 0.12;

          vec3 coreCyan = vec3(0.04, 0.78, 1.00);
          vec3 peakWhiteCyan = vec3(0.50, 0.96, 1.00);
          float energy = vAlpha * radialProfile;
          vec3 bioColor = mix(coreCyan, peakWhiteCyan, clamp(energy * 1.5, 0.0, 1.0));

          // Beer-Lambert absorption i vandet
          vec3 waterExtinction = exp(-vec3(0.24, 0.040, 0.015) * vCamDist);
          bioColor *= waterExtinction;

          gl_FragColor = vec4(bioColor * energy * 2.4, 1.0);
        }
      `
    });

    const mesh = new T.Points(geometry, material);
    mesh.name = 'Bioluminescence Wake Particles';
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);

    let bioHead = 0;
    let needsUpdate = false;

    function emitBurst(x, y, z, vx, vy, vz, shearIntensity, count) {
      if (shearIntensity <= 0.01 || count <= 0) return;
      const birthTime = uniforms.uTime.value;
      const clampedIntensity = Math.min(2.5, shearIntensity);

      for (let c = 0; c < count; c++) {
        const idx = bioHead;
        bioHead = (bioHead + 1) % N;

        const isHalo = Math.random() > 0.96;
        const pType = isHalo ? 1.0 : 0.0;
        const seed = Math.random();

        const jitter = isHalo ? 0.08 : 0.035;
        const jx = (Math.random() - 0.5) * jitter * 2;
        const jy = (Math.random() - 0.5) * jitter * 2;
        const jz = (Math.random() - 0.5) * jitter * 2;

        const pIdx = idx * 3;
        posArray[pIdx + 0] = x + jx;
        posArray[pIdx + 1] = y + jy;
        posArray[pIdx + 2] = z + jz;

        const vJitter = isHalo ? 0.10 : 0.05;
        velArray[pIdx + 0] = vx + (Math.random() - 0.5) * vJitter;
        velArray[pIdx + 1] = vy + (Math.random() - 0.5) * vJitter;
        velArray[pIdx + 2] = vz + (Math.random() - 0.5) * vJitter;

        const bIdx = idx * 4;
        bioArray[bIdx + 0] = birthTime;
        bioArray[bIdx + 1] = clampedIntensity * (0.75 + 0.5 * Math.random());
        bioArray[bIdx + 2] = seed;
        bioArray[bIdx + 3] = pType;
      }
      needsUpdate = true;
    }

    function update(time) {
      uniforms.uTime.value = time;
      if (needsUpdate) {
        posAttr.needsUpdate = true;
        velAttr.needsUpdate = true;
        bioAttr.needsUpdate = true;
        needsUpdate = false;
      }
    }

    return {
      emitBurst,
      update,
      mesh,
      uniforms
    };
  }

  const oceanBioluminescence = createBioluminescenceWakeSystem(T, scene);
  window.oceanBioluminescence = oceanBioluminescence;

  // Background fish use instancing: many fish, one draw call.
  function buildSmallFishGeometry() {
    const vertices = [];
    const colors = [];
    const indices = [];

    const colBack = new T.Color(0x2b5066);
    const colFlank = new T.Color(0xaad0dc);
    const colBelly = new T.Color(0xdce9ed);

    function addV(x, y, z, ny) {
      vertices.push(x, y, z);
      const c = new T.Color();
      if (ny >= 0.) c.copy(colFlank).lerp(colBack, ny);
      else c.copy(colFlank).lerp(colBelly, -ny);
      colors.push(c.r, c.g, c.b);
      return (vertices.length / 3) - 1;
    }

    const rings = 18, sides = 12;
    const startX = -0.21, endX = 0.27, length = endX - startX;

    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const x = startX + u * length;
      const p = Math.sin(Math.pow(u, 0.75) * Math.PI);
      const halfHeight = u === 1 ? 0.001 : (0.068 * p + 0.012 * (1 - u * 0.82) + 0.002);
      const halfWidth = u === 1 ? 0.001 : (0.036 * p + 0.006 * (1 - u * 0.82) + 0.001);

      for (let j = 0; j <= sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        addV(x, sinA * halfHeight, cosA * halfWidth, sinA);
      }
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }

    // Forked caudal fin: x from -0.20 to -0.35, y = ±0.088, notch at (x = -0.27, y = 0)
    const cPedTop = addV(-0.20, 0.014, 0, 0.7);
    const cPedMid = addV(-0.20, 0.0, 0, 0.0);
    const cPedBot = addV(-0.20, -0.014, 0, -0.7);
    const cNotch = addV(-0.27, 0.0, 0, 0.0);
    const cUpperTip = addV(-0.35, 0.088, 0, 0.9);
    const cUpperMid = addV(-0.29, 0.052, 0, 0.6);
    const cLowerTip = addV(-0.35, -0.088, 0, -0.9);
    const cLowerMid = addV(-0.29, -0.052, 0, -0.6);

    indices.push(cPedTop, cUpperMid, cPedMid);
    indices.push(cUpperMid, cUpperTip, cNotch);
    indices.push(cUpperMid, cNotch, cPedMid);

    indices.push(cPedMid, cLowerMid, cPedBot);
    indices.push(cPedMid, cNotch, cLowerMid);
    indices.push(cNotch, cLowerTip, cLowerMid);

    // Tiny dorsal fin triangle: x from -0.04 to +0.07, y up to +0.105
    const dAnt = addV(0.07, 0.062, 0, 0.9);
    const dMid = addV(0.01, 0.105, 0, 1.0);
    const dPos = addV(-0.04, 0.058, 0, 0.8);
    indices.push(dAnt, dMid, dPos);

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  const fishGeometry = buildSmallFishGeometry();
  const fishCount = 110;
  const fishPhases = new Float32Array(fishCount);
  for (let i = 0; i < fishCount; i++) fishPhases[i] = random() * Math.PI * 2;
  fishGeometry.setAttribute('fishPhase', new T.InstancedBufferAttribute(fishPhases, 1));

  const fishMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: .33,
    metalness: .18,
    side: T.DoubleSide
  });
  fishMaterial.onBeforeCompile = shader => {
    shader.uniforms.time = waterUniforms.time;
    shader.uniforms.daylight = waterUniforms.daylight;
    shader.vertexShader = `uniform float time;
      attribute float fishPhase;
      varying vec3 vFishWorld;
      ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      float tailW = clamp((.10 - position.x) / .45, 0., 1.);
      float wave = sin(time * 9.2 + fishPhase + position.x * 11.5) * tailW * tailW * .058;
      float slope = cos(time * 9.2 + fishPhase + position.x * 11.5) * 11.5 * tailW * tailW * .058;
      objectNormal.x -= slope * objectNormal.z;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float tailW2 = clamp((.10 - position.x) / .45, 0., 1.);
      float wave2 = sin(time * 9.2 + fishPhase + position.x * 11.5) * tailW2 * tailW2 * .058;
      transformed.z += wave2;
      vFishWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;`);
    shader.fragmentShader = `varying vec3 vFishWorld;
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `float waterDepth = max(0., 15. - vFishWorld.y);
      float viewDist = length(vViewPosition);
      vec3 verticalAbsorption = exp(-vec3(.020, .007, .0015) * max(0., waterDepth - 11.));
      vec3 pathAbsorption = exp(-vec3(.014, .004, .0008) * viewDist);
      outgoingLight *= mix(vec3(1.), verticalAbsorption * pathAbsorption, .78);
      #include <opaque_fragment>`);
  };
  const fish = new T.InstancedMesh(fishGeometry, fishMaterial, fishCount);
  fish.count = currentQuality.fish;
  fish.instanceMatrix.setUsage(T.DynamicDrawUsage);
  fish.frustumCulled = false;
  scene.add(fish);
  const fishTransform = new T.Object3D();
  const fishSeeds = Array.from({length: fishCount}, () => [random(), random(), random(), random() * Math.PI * 2]);

  function buildRemoraGeometry() {
    const vertices = [];
    const colors = [];
    const indices = [];

    const colDorsal = new T.Color(0x34444c);
    const colVentral = new T.Color(0xc2cbcd);
    const colSuction = new T.Color(0x232d32);

    function addV(x, y, z, ny, isDisc = false) {
      vertices.push(x, y, z);
      const c = new T.Color();
      if (isDisc) {
        c.copy(colSuction);
      } else {
        const underside = T.MathUtils.smoothstep(-ny, -0.15, 0.45);
        c.copy(colDorsal).lerp(colVentral, underside);
      }
      colors.push(c.r, c.g, c.b);
      return (vertices.length / 3) - 1;
    }

    const rings = 18, sides = 12;
    const startX = -0.26, endX = 0.34, length = endX - startX;

    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const x = startX + u * length;
      const p = Math.sin(Math.pow(u, 0.65) * Math.PI);
      const halfHeight = u === 1 ? 0.003 : (0.048 * p + 0.012 * (1 - u * 0.75));
      const halfWidth = u === 1 ? 0.005 : (0.042 * p + 0.010 * (1 - u * 0.75));
      const discZone = u > 0.62 && u < 0.96;

      for (let j = 0; j <= sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        let y = sinA * halfHeight;
        const z = cosA * halfWidth;
        const isDisc = discZone && sinA > 0.55;
        if (isDisc) y = Math.min(y, halfHeight * 0.72);
        addV(x, y, z, sinA, isDisc);
      }
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }

    // Forked caudal fin: x from -0.25 to -0.44
    const rPedTop = addV(-0.25, 0.012, 0, 0.6);
    const rPedMid = addV(-0.25, 0.0, 0, 0.0);
    const rPedBot = addV(-0.25, -0.012, 0, -0.6);
    const rNotch = addV(-0.35, 0.0, 0, 0.0);
    const rUpperTip = addV(-0.44, 0.065, 0, 0.9);
    const rUpperMid = addV(-0.36, 0.038, 0, 0.7);
    const rLowerTip = addV(-0.44, -0.065, 0, -0.9);
    const rLowerMid = addV(-0.36, -0.038, 0, -0.7);

    indices.push(rPedTop, rUpperMid, rPedMid);
    indices.push(rUpperMid, rUpperTip, rNotch);
    indices.push(rUpperMid, rNotch, rPedMid);

    indices.push(rPedMid, rLowerMid, rPedBot);
    indices.push(rPedMid, rNotch, rLowerMid);
    indices.push(rNotch, rLowerTip, rLowerMid);

    // Small dorsal fin (x from -0.05 to -0.18, y up to +0.058)
    const rdAnt = addV(-0.05, 0.040, 0, 0.8);
    const rdMid = addV(-0.11, 0.058, 0, 0.9);
    const rdPos = addV(-0.18, 0.024, 0, 0.7);
    indices.push(rdAnt, rdMid, rdPos);

    // Small anal fin (x from -0.05 to -0.18, y down to -0.058)
    const raAnt = addV(-0.05, -0.040, 0, -0.8);
    const raMid = addV(-0.11, -0.058, 0, -0.9);
    const raPos = addV(-0.18, -0.024, 0, -0.7);
    indices.push(raAnt, raPos, raMid);

    // Small pectoral fins (side = -1 and +1)
    for (const s of [-1, 1]) {
      const rpBase1 = addV(0.12, -0.015, s * 0.036, -0.2);
      const rpBase2 = addV(0.04, -0.018, s * 0.032, -0.3);
      const rpTip = addV(0.02, -0.028, s * 0.082, -0.2);
      if (s === 1) indices.push(rpBase1, rpTip, rpBase2);
      else indices.push(rpBase1, rpBase2, rpTip);
    }

    const geom = new T.BufferGeometry();
    geom.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  const maxRemoras = 22;
  const remoraGeometry = buildRemoraGeometry();
  const remoraPhases = new Float32Array(maxRemoras);
  for (let i = 0; i < maxRemoras; i++) remoraPhases[i] = random() * Math.PI * 2;
  remoraGeometry.setAttribute('remoraPhase', new T.InstancedBufferAttribute(remoraPhases, 1));

  const remoraMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: .46,
    metalness: .04,
    side: T.DoubleSide
  });
  remoraMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      time: waterUniforms.time,
      daylight: waterUniforms.daylight,
      sunColor: waterUniforms.sunColor,
      sunPower: waterUniforms.sunPower,
      lightDirection: waterUniforms.lightDirection,
      causticMap: { value: causticTarget.texture },
      causticOrigin: { value: causticOrigin },
      causticSpan: { value: causticSpan },
      causticDepths: { value: causticDepths },
      causticMultiTap: oceanOptics.causticMultiTap,
      activeSharkCount: oceanOptics.activeSharkCount,
      animalStates: oceanOptics.animalStates,
      animalHeadings: oceanOptics.animalHeadings
    });
    shader.vertexShader = `uniform float time;
      uniform vec3 lightDirection;
      ${solarOcclusionGLSL}
      attribute float remoraPhase;
      varying vec3 vRemoraWorld;
      varying vec3 vRemoraNormal;
      varying float vRemoraShadow;
      ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      float tailW = clamp((.05 - position.x) / .49, 0., 1.);
      float remoraWave = sin(time * 10.8 + remoraPhase + position.x * 9.5) * tailW * tailW * .052;
      float remoraSlope = cos(time * 10.8 + remoraPhase + position.x * 9.5) * 9.5 * tailW * tailW * .052;
      objectNormal.x -= remoraSlope * objectNormal.z;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      float tailW2 = clamp((.05 - position.x) / .49, 0., 1.);
      float remoraWave2 = sin(time * 10.8 + remoraPhase + position.x * 9.5) * tailW2 * tailW2 * .052;
      transformed.z += remoraWave2;
      vRemoraWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
      vRemoraNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
      vRemoraShadow = sharkSolarOcclusion(vRemoraWorld, lightDirection, vec3(9999.));`);
    shader.fragmentShader = `uniform vec3 sunColor;
      uniform vec3 lightDirection;
      uniform float sunPower;
      uniform float daylight;
      uniform sampler2D causticMap;
      uniform vec2 causticOrigin;
      uniform float causticSpan;
      uniform vec3 causticDepths;
      uniform float causticMultiTap;
      varying vec3 vRemoraWorld;
      varying vec3 vRemoraNormal;
      varying float vRemoraShadow;
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `float waterDepth = max(0., 15. - vRemoraWorld.y);
      if (sunPower > .001) {
        vec2 surfaceCoordinate = vRemoraWorld.xz + lightDirection.xz * waterDepth / max(.2, lightDirection.y);
        vec2 causticUV = (surfaceCoordinate - causticOrigin) / causticSpan + .5;
        float spread = .0028 + waterDepth * .00018;
        vec3 layers = causticMultiTap > .5
          ? (texture2D(causticMap, causticUV).rgb * .40
            + (texture2D(causticMap, causticUV + vec2(spread, 0.)).rgb
            +  texture2D(causticMap, causticUV - vec2(spread, 0.)).rgb
            +  texture2D(causticMap, causticUV + vec2(0., spread)).rgb
            +  texture2D(causticMap, causticUV - vec2(0., spread)).rgb) * .15) * 16.
          : texture2D(causticMap, causticUV).rgb * 16.;
        float focus = waterDepth < causticDepths.y
          ? mix(layers.r, layers.g, clamp((waterDepth - causticDepths.x) / (causticDepths.y - causticDepths.x), 0., 1.))
          : mix(layers.g, layers.b, clamp((waterDepth - causticDepths.y) / (causticDepths.z - causticDepths.y), 0., 1.));
        vec2 edge = min(causticUV, 1. - causticUV);
        float mapFade = smoothstep(0., .06, min(edge.x, edge.y));
        float depthFade = exp(-waterDepth * .035) * smoothstep(0., 3., waterDepth);
        float lightFootprint = max(length(dFdx(surfaceCoordinate)), length(dFdy(surfaceCoordinate)));
        float distanceFilter = 1. - smoothstep(.2, 1., lightFootprint);
        float illuminatedBack = max(dot(vRemoraNormal, lightDirection), 0.);
        float rawContrast = focus - .92;
        float lightContrast = rawContrast > 0. ? (rawContrast * 2.2) / (1. + rawContrast * .75) : clamp(rawContrast, -.55, 0.);
        outgoingLight = max(vec3(0.), outgoingLight + diffuseColor.rgb * sunColor * sunPower
          * lightContrast * illuminatedBack * depthFade * mapFade * distanceFilter * .70 * vRemoraShadow);
      }

      // Part 3: 3D Beer-Lambert vertical depth & path spectral absorption
      float viewDist = length(vViewPosition);
      vec3 verticalAbsorption = exp(-vec3(.020, .007, .0015) * max(0., waterDepth - 11.));
      vec3 pathAbsorption = exp(-vec3(.014, .004, .0008) * viewDist);
      outgoingLight *= mix(vec3(1.), verticalAbsorption * pathAbsorption, .78);

      #include <opaque_fragment>`);
  };
  const remoras = new T.InstancedMesh(remoraGeometry, remoraMaterial, maxRemoras);
  remoras.instanceMatrix.setUsage(T.DynamicDrawUsage);
  remoras.frustumCulled = false;
  scene.add(remoras);

  const remoraAttachments = [
    { sharkIndex: 0, offset: [.42, -.62, .38], scale: .84, seed: 1.15 },
    { sharkIndex: 0, offset: [-.65, -.52, -.34], scale: .74, seed: 2.38 },
    { sharkIndex: 1, offset: [.88, -.56, -.28], scale: .88, seed: 3.51 },
    { sharkIndex: 1, offset: [-.22, .68, .28], scale: .72, seed: 4.74 },
    { sharkIndex: 2, offset: [.35, -.58, -.36], scale: .78, seed: 0.92 },
    { sharkIndex: 3, offset: [.72, -.60, .32], scale: .86, seed: 2.14 },
    { sharkIndex: 3, offset: [-.50, -.48, .30], scale: .68, seed: 5.43 },
    { sharkIndex: 4, offset: [.45, -.55, -.32], scale: .76, seed: 3.27 },
    { sharkIndex: 5, offset: [.80, -.58, .30], scale: .85, seed: 1.83 },
    { sharkIndex: 6, offset: [-.30, .65, -.26], scale: .70, seed: 4.19 },
    { sharkIndex: 7, offset: [.55, -.52, -.35], scale: .80, seed: 2.91 },
    { sharkIndex: 8, offset: [.65, -.54, .32], scale: .75, seed: 0.54 },
    { sharkIndex: 9, offset: [.92, -.62, -.30], scale: .88, seed: 3.82 },
    { sharkIndex: 9, offset: [-.45, -.50, .35], scale: .72, seed: 5.16 },
    { sharkIndex: 10, offset: [.40, -.56, .34], scale: .78, seed: 1.47 },
    { sharkIndex: 11, offset: [.75, -.58, -.28], scale: .82, seed: 2.65 },
    { sharkIndex: 21, offset: [.50, -.54, .30], scale: .74, seed: 4.31 },
    { sharkIndex: 22, offset: [.60, -.52, -.32], scale: .72, seed: 0.77 },
    { sharkIndex: 23, offset: [-.25, .66, .25], scale: .69, seed: 3.64 },
    { sharkIndex: 24, offset: [.70, -.58, .32], scale: .76, seed: 2.22 },
    { sharkIndex: 25, offset: [.48, -.52, -.28], scale: .75, seed: 5.89 },
    { sharkIndex: 26, offset: [-.40, -.46, .30], scale: .71, seed: 1.95 }
  ];

  const remoraLocalPos = new T.Vector3();
  const remoraWorldPos = new T.Vector3();
  const remoraYawQuat = new T.Quaternion();
  const remoraDummy = new T.Object3D();
  const remoraUp = new T.Vector3(0, 1, 0);
  const jellyfish=window.createJellyfish(T,scene,waterUniforms,oceanOptics);
  const freedivers = window.createFreedivers
    ? window.createFreedivers(T, scene, waterUniforms, oceanOptics, oceanBioluminescence)
    : null;
  const showFreediversInput = document.getElementById('show-freedivers');
  if (showFreediversInput && freedivers) {
    freedivers.setVisible(showFreediversInput.checked);
    showFreediversInput.addEventListener('change', () => {
      freedivers.setVisible(showFreediversInput.checked);
      redrawNeeded = true;
    });
  }

  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed=Number(document.getElementById('speed').value);
  // Randomized start offset so every visit starts at a different, organic point in time
  let animationTime = Math.random() * 600.0;
  let lastFrame=performance.now();
  let lastRendered=0;
  let lastLightingUpdate=-Infinity;
  let animationRequest=0;
  let contextLost=false;
  let redrawNeeded=true;
  function changeLightingTime(){
    updateDaylight(new Date());
    redrawNeeded=true;
    revealControls();
  }
  timeMode.addEventListener('change',changeLightingTime);
  lightTime.addEventListener('input',()=>{
    // Moving the slider deliberately leaves the live clock. Selecting Local
    // clock resumes it; selecting Custom time restores the last manual setting.
    customHour=Number(lightTime.value)/60;
    timeMode.value='custom';
    changeLightingTime();
  });
  setAnimalCount(animalCountInput.value);
  animalCountInput.addEventListener('input',event=>setAnimalCount(event.target.value));
  setParticleCount(particleCountInput.value);
  particleCountInput.addEventListener('input',event=>setParticleCount(event.target.value));

  speciesInputs.forEach(input=>{
    input.addEventListener('change',()=>{
      setAnimalCount(animalCountInput.value);
    });
  });

  const pointer=new T.Vector2();
  const easedPointer=new T.Vector2();
  const raycaster=new T.Raycaster();
  const dragTarget=new T.Vector3();
  const gripLocal=new T.Vector3();
  const dragNormal=new T.Vector3();
  const dragNdc=new T.Vector2();
  const gripArm=new T.Vector3();
  const gripVelocity=new T.Vector3();
  const appliedForce=new T.Vector3();
  const appliedTorque=new T.Vector3();
  const rotationStep=new T.Quaternion();
  const levellingError=new T.Quaternion();
  const baseRotation=new T.Quaternion();
  const localVelocity=new T.Vector3();
  const inverseRotation=new T.Quaternion();
  let gripDepth=0,depthDirection=0,gripTorque=0;
  let heldShark=null,heldPointer=null,lastSharkGrab=-Infinity;

  // Three scene units represent the requested approximate three-metre gap.
  // Protect the whole animal, not just its origin: a head, fin or bent tail
  // must not enter the camera bubble when a shark rotates or is pulled closer.
  const minimumCameraClearance=3;
  const clearanceCentre=new T.Vector3(),clearanceNormal=new T.Vector3();
  function keepSharkAwayFromCamera(shark,elapsed){
    const geometry=shark.mesh.geometry,u=shark.uniforms;
    // Conservative motion bounds match the GPU's maximum tail weight (1.2²),
    // wave amplitude and jaw rotation. They avoid scanning vertices each frame.
    const elasticReach=1.44*u.dragBend.value.length() + (u.finTurn ? .24 * u.finTurn.value.length() : 0);
    let radius;
    if(shark.isJellyfish){
      radius=(3+elasticReach)*shark.scale;
      clearanceCentre.copy(shark.mesh.position);
    }else{
      const swimReach=1.15*(.57*1.44+.1)*Math.abs(u.swimPower.value);
      const jawReach=2*geometry.userData.jawReach*Math.sin(Math.abs(u.jawAngle.value)*.5);
      radius=(geometry.userData.restRadius+swimReach+elasticReach+jawReach)*shark.scale;
      clearanceCentre.copy(geometry.boundingSphere.center).multiplyScalar(shark.scale)
        .applyQuaternion(shark.mesh.quaternion).add(shark.mesh.position);
    }
    clearanceNormal.copy(clearanceCentre).sub(camera.position);
    const distance=clearanceNormal.length(),limit=radius+minimumCameraClearance;
    if(distance>=limit+1.5)return;
    if(distance>.0001)clearanceNormal.multiplyScalar(1/distance);
    else camera.getWorldDirection(clearanceNormal);
    if(distance<limit){
      const correction=limit-distance;
      shark.mesh.position.addScaledVector(clearanceNormal,correction);
      shark.offset.addScaledVector(clearanceNormal,correction);
    }
    // Ease approaching motion before contact, then remove only inward velocity.
    // Tangential motion and rotation remain available for pushing and steering.
    const inwardSpeed=shark.velocity.dot(clearanceNormal);
    if(inwardSpeed<0){
      const damping=distance<limit?1:1-Math.exp(-elapsed*8*(1-(distance-limit)/1.5));
      shark.velocity.addScaledVector(clearanceNormal,-inwardSpeed*damping);
    }
  }

  // The pointer selects a viewing ray. The right button pulls the contact point towards
  // the camera; the left pushes it deeper into the water. Mouse motion also
  // steers sideways. The contact point follows the shark's rotation.
  function pointerRay(event){
    const rect=canvas.getBoundingClientRect();
    dragNdc.set((event.clientX-rect.left)/rect.width*2-1,
      1-(event.clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(dragNdc,camera);
  }
  function releaseShark(){
    const wasHeld=heldShark!==null;
    const pointerId=heldPointer;
    heldShark=null;heldPointer=null;
    canvas.classList.remove('grabbing','pushing');
    if(pointerId!==null && canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
    if(wasHeld)revealControls();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(![0,2].includes(event.button) || heldShark || contextLost)return;
    pointerRay(event);
    const candidates=sharks.concat(jellyfish.group.visible?jellyfish.animals:[]).filter(s=>s.mesh.visible);
    const hits=raycaster.intersectObjects(candidates.map(s=>s.pickMesh||s.mesh),false);
    if(!hits.length)return;
    heldShark=candidates.find(s=>(s.pickMesh||s.mesh)===hits[0].object);
    heldPointer=event.pointerId;lastSharkGrab=performance.now();
    dragTarget.copy(hits[0].point);
    gripLocal.copy(hits[0].point);heldShark.mesh.worldToLocal(gripLocal);
    gripDepth=hits[0].distance;
    depthDirection=event.pointerType==='touch'?0:(event.button===2?-1:1);
    // A soft zone around the body centre makes translation easy, while
    // the head, tail and fins provide clear lever arms for torque.
    gripTorque=heldShark.isJellyfish
      ? T.MathUtils.smoothstep(Math.hypot(gripLocal.x,gripLocal.y-.3,gripLocal.z),.2,.8)
      : T.MathUtils.smoothstep(gripLocal.length(),.8,1.55);
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('grabbing');
    canvas.classList.toggle('pushing',depthDirection>0);
    event.preventDefault();redrawNeeded=true;
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==heldPointer)return;
    pointerRay(event);
    redrawNeeded=true;
  });
  // The browser menu would interrupt right-button dragging. Controls outside
  // the ocean canvas retain normal browser context menus.
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  for(const eventName of ['pointerup','pointercancel','lostpointercapture']){
    canvas.addEventListener(eventName,event=>{if(event.pointerId===heldPointer)releaseShark();});
  }
  window.addEventListener('blur',releaseShark);
  function resize(){
    const width=innerWidth,height=innerHeight;
    renderer.setSize(width,height,false);
    renderer.getDrawingBufferSize(waterUniforms.resolution.value);
    if(particleUniforms && particleUniforms.pixelRatio) particleUniforms.pixelRatio.value = renderer.getPixelRatio();
    camera.aspect=width/height;
    // Portrait layouts get a wider field of view so whole sharks remain visible.
    camera.fov=camera.aspect<.85?62:49;
    camera.updateProjectionMatrix();
    redrawNeeded=true;
  }
  window.addEventListener('resize',resize);
  resize();

  const qualityInput = document.getElementById('quality');
  const qualityValue = document.getElementById('quality-value');
  function setQuality(index) {
    const idx = T.MathUtils.clamp(Math.round(Number(index)), 0, 3);
    currentQuality = qualityPresets[idx];
    renderer.setPixelRatio(Math.min(devicePixelRatio, currentQuality.maxDpr));
    resize();
    if (causticTarget.width !== currentQuality.causticSize) {
      causticTarget.setSize(currentQuality.causticSize, currentQuality.causticSize);
    }
    causticMesh.geometry = causticGeometries[currentQuality.causticGridIndex];
    causticUniforms.waveFootprint.value = causticSpan / currentQuality.causticGrid;
    oceanOptics.causticMultiTap.value = currentQuality.multiTap;
    shaftGeometry.instanceCount = currentQuality.shafts;
    if (fish) fish.count = currentQuality.fish;
    previousCausticTime = NaN;
    redrawNeeded = true;
    if (qualityInput) {
      qualityInput.value = String(idx);
      qualityInput.setAttribute('aria-valuetext', currentQuality.aria);
    }
    if (qualityValue) {
      qualityValue.value = currentQuality.label;
    }
  }
  if (qualityInput) qualityInput.addEventListener('input', e => setQuality(e.target.value));
  setQuality(qualityInput ? qualityInput.value : 1);

  // Preallocated scratch objects for renderScene — zero heap allocations per frame
  const boidForces=Array.from({length:40},()=>new T.Vector3());
  const boidP1=new T.Vector3(),boidP2=new T.Vector3(),boidDiff=new T.Vector3();
  const freediverLOS = new T.Vector3();
  const sharkToCam = new T.Vector3();
  const losProjPoint = new T.Vector3();
  const losClearanceVec = new T.Vector3();
  const maxCandidateAnimals=100;
  const candidateAnimals=new Array(maxCandidateAnimals).fill(null);
  const animalSortIndices=new Int32Array(maxCandidateAnimals);
  const animalSortDists=new Float32Array(maxCandidateAnimals);
  const animalForwardScratch=new T.Vector3();
  const localAngularScratch=new T.Vector3();

  // Scratch objects and kinematic fin tracker for bioluminescent shear wake
  const bioSharkTipScratch=new T.Vector3();
  const bioSharkTipWorld=new T.Vector3();
  const bioFinVel=new T.Vector3();
  const bioSharkForward=new T.Vector3();
  const bioJellyRimScratch=new T.Vector3();
  const bioJellyExpelScratch=new T.Vector3();

  function getSharkFinWorldPos(shark,lx,ly,lz,flexVal,isPectoral,out){
    const tail=T.MathUtils.clamp((1.8-lx)/6.2,0,1.2);
    const head=T.MathUtils.clamp((lx-1.8)/1.5,0,1);
    const phase=shark.uniforms.swimTime.value*1.9+lx*.91+shark.uniforms.swimPhase.value;
    const wave=Math.sin(phase)-.15*Math.sin(phase*2);
    let defY=ly+shark.uniforms.dragBend.value.x*tail*tail;
    let defZ=lz+wave*(tail*tail*.57-head*.1)*shark.uniforms.swimPower.value
                  +shark.uniforms.dragBend.value.y*tail*tail;
    if(flexVal>0){
      if(isPectoral)defY+=flexVal*shark.uniforms.finTurn.value.y;
      else defZ+=flexVal*shark.uniforms.finTurn.value.x;
    }
    bioSharkTipScratch.set(lx,defY,defZ);
    out.copy(bioSharkTipScratch)
       .multiplyScalar(shark.scale)
       .applyQuaternion(shark.mesh.quaternion)
       .add(shark.mesh.position);
    return out;
  }

  function updateAnimalPhysics(shark,sharkIndex,elapsed){
    if(!shark.mesh.visible || (shark.isJellyfish&&!jellyfish.group.visible)){
      if(shark===heldShark)releaseShark();return;
    }
    let x,y,z;
    if(shark.isJellyfish){
      ({x,y,z}=shark.mesh.position);
    }else{
      const phase=shark.phase+animationTime*shark.rate*shark.direction;
      x=Math.sin(phase)*shark.rx;z=shark.z+Math.cos(phase)*shark.rz;
      y=shark.y+Math.sin(phase*2+shark.phase)*.85;
      const dx=Math.cos(phase)*shark.rx*shark.direction;
      const dz=-Math.sin(phase)*shark.rz*shark.direction;
      shark.mesh.rotation.set(0,Math.atan2(-dz,dx),0);
      shark.mesh.rotateX(Math.sin(phase)*.20*shark.direction+Math.sin(animationTime*.11+shark.phase)*.055);
      shark.mesh.rotateZ(Math.cos(phase*2+shark.phase)*.045);
      const dyRate=1.7*Math.cos(phase*2+shark.phase);
      const dPosDt=Math.hypot(dx,dyRate,dz)*shark.rate;
      shark.uniforms.sharkSpeed.value=(paused?0:dPosDt*speed)+shark.velocity.length();
    }
    baseRotation.copy(shark.mesh.quaternion);
    // Force at the contact point moves the body and produces torque
    // r cross F. An elongated body has less inertia around its longitudinal axis.
    // Small substeps and water resistance damp both translation and rotation.
    const steps=Math.max(1,Math.ceil(elapsed*120)),dt=elapsed/steps;
    for(let step=0;step<steps;step++){
      shark.mesh.quaternion.copy(baseRotation).premultiply(shark.rotationOffset);
      if(shark===heldShark){
        gripArm.copy(gripLocal).multiplyScalar(shark.scale).applyQuaternion(shark.mesh.quaternion);
        gripVelocity.crossVectors(shark.angularVelocity,gripArm).add(shark.velocity);
        appliedForce.copy(dragTarget).sub(gripArm);
        appliedForce.x-=x+shark.offset.x;
        appliedForce.y-=y+shark.offset.y;
        appliedForce.z-=z+shark.offset.z;
        appliedForce.multiplyScalar(45).addScaledVector(gripVelocity,-9).clampLength(0,80);
        shark.velocity.addScaledVector(appliedForce,dt);
        shark.velocity.clampLength(0,40);
        appliedTorque.crossVectors(gripArm,appliedForce).multiplyScalar(gripTorque);
        inverseRotation.copy(shark.mesh.quaternion).invert();
        appliedTorque.applyQuaternion(inverseRotation);
        appliedTorque.x/=(shark.isJellyfish?1.1:.6)*shark.scale*shark.scale;
        appliedTorque.y/=(shark.isJellyfish?1.1:3.8)*shark.scale*shark.scale;
        appliedTorque.z/=(shark.isJellyfish?1.1:3.8)*shark.scale*shark.scale;
        appliedTorque.applyQuaternion(shark.mesh.quaternion);
        shark.angularVelocity.addScaledVector(appliedTorque,dt).clampLength(0,2.5);
      }else{
        shark.velocity.multiplyScalar(Math.exp(-5.5*dt));
        if(!shark.isJellyfish)shark.velocity.addScaledVector(boidForces[sharkIndex], dt * 15.0);
        // After release, swim back towards the normal upright attitude with
        // a damped angular spring. Apply torque rather than resetting the
        // rotation, so the shark retains its inertia and cannot snap upright.
        // q and -q describe the same attitude: choose the shortest return,
        // including when the shark has been turned completely upside down.
        levellingError.copy(shark.rotationOffset).invert();
        const sign=levellingError.w<0?-1:1;
        appliedTorque.set(levellingError.x,levellingError.y,levellingError.z).multiplyScalar(sign);
        const sineHalfAngle=appliedTorque.length();
        if(sineHalfAngle>0){
          const angle=2*Math.atan2(sineHalfAngle,Math.abs(levellingError.w));
          appliedTorque.multiplyScalar(6.5*angle/sineHalfAngle);
          shark.angularVelocity.addScaledVector(appliedTorque,dt).clampLength(0,2.5);
        }
      }
      shark.angularVelocity.multiplyScalar(Math.exp(-5*dt));
      shark.offset.addScaledVector(shark.velocity,dt);
      const angularSpeed=shark.angularVelocity.length();
      if(angularSpeed>0){
        dragNormal.copy(shark.angularVelocity).divideScalar(angularSpeed);
        rotationStep.setFromAxisAngle(dragNormal,angularSpeed*dt);
        shark.rotationOffset.premultiply(rotationStep).normalize();
      }
    }
    if(shark!==heldShark && shark.velocity.lengthSq()<.00001)shark.velocity.set(0,0,0);
    if(shark!==heldShark && shark.angularVelocity.lengthSq()<.00001)shark.angularVelocity.set(0,0,0);
    // Finish below a tenth of a degree so a paused scene can stop rendering
    // after settling instead of following an endless asymptotic return.
    if(shark!==heldShark && 1-shark.rotationOffset.w*shark.rotationOffset.w<.000001
        && shark.angularVelocity.lengthSq()<.0001){
      shark.rotationOffset.identity();
      shark.angularVelocity.set(0,0,0);
    }
    shark.mesh.position.set(x,y,z).add(shark.offset);
    shark.mesh.quaternion.copy(baseRotation).premultiply(shark.rotationOffset);
    // The tail yields against movement, including when direction changes.
    // The deformation is filtered so it straightens gently after release.
    inverseRotation.copy(shark.mesh.quaternion).invert();
    localVelocity.copy(shark.velocity).applyQuaternion(inverseRotation).divideScalar(shark.scale);
    const elasticity=1-Math.exp(-8*elapsed);
    const bend=shark.uniforms.dragBend.value;
    bend.x+= (T.MathUtils.clamp(-(shark.isJellyfish?localVelocity.x:localVelocity.y)*.055,-.85,.85)-bend.x)*elasticity;
    bend.y+= (T.MathUtils.clamp(-localVelocity.z*.055,-.85,.85)-bend.y)*elasticity;
    if(shark.velocity.lengthSq()===0 && bend.lengthSq()<.00001)bend.set(0,0);
    if(shark.isJellyfish){keepSharkAwayFromCamera(shark,elapsed);return;}
    localAngularScratch.copy(shark.angularVelocity).applyQuaternion(inverseRotation);
    const targetTurnX=T.MathUtils.clamp(-localVelocity.z*.055-localAngularScratch.y*.14,-.20,.20);
    const targetTurnY=T.MathUtils.clamp(-localVelocity.y*.055+localAngularScratch.x*.15,-.20,.20);
    shark.finTurnInteraction.x+=(targetTurnX-shark.finTurnInteraction.x)*elasticity;
    shark.finTurnInteraction.y+=(targetTurnY-shark.finTurnInteraction.y)*elasticity;
    if(shark.velocity.lengthSq()===0 && shark.angularVelocity.lengthSq()===0 && shark.finTurnInteraction.lengthSq()<.00001){
      shark.finTurnInteraction.set(0,0);
    }
    const phase=shark.phase+animationTime*shark.rate*shark.direction;
    const pathTurn=-shark.direction*.045*(1+.3*Math.cos(phase*2));
    const pathHeave=-.035*Math.cos(phase*2+shark.phase);
    shark.uniforms.finTurn.value.set(
      T.MathUtils.clamp(shark.finTurnInteraction.x+pathTurn,-.24,.24),
      T.MathUtils.clamp(shark.finTurnInteraction.y+pathHeave,-.24,.24)
    );
    const effort=shark===heldShark?0:T.MathUtils.clamp(shark.velocity.length()*.22+boidForces[sharkIndex].length()*.07,0,1.25);
    shark.burstPower+=(effort-shark.burstPower)*(1-Math.exp(-5.5*elapsed));
    if(effort<.0015 && shark.burstPower<.0015) shark.burstPower=0;
    if(!paused && elapsed>0) shark.extraSwimPhase+=elapsed*speed*shark.burstPower*2.1;
    shark.uniforms.swimTime.value=animationTime*(.83+shark.rate*7)+shark.extraSwimPhase;
    shark.uniforms.swimPower.value=(shark.power||1)*(1+.38*shark.burstPower);
    const jaw=sharkAnatomies[shark.species].jaw;
    // Small, unhurried openings, offset for each individual. Animation time
    // also freezes the mouth when the screensaver is paused.
    shark.uniforms.jawAngle.value=jaw ? jaw.restAngle+jaw.idleAmplitude*Math.sin(animationTime*.63+shark.phase)
      +(jaw.maximumAngle-jaw.restAngle-jaw.idleAmplitude)*Math.pow(.5+.5*Math.sin(animationTime*.13+shark.phase*1.73),18) : 0;
    keepSharkAwayFromCamera(shark,elapsed);
    if (!shark.isJellyfish) {
      const distSq = shark.mesh.position.distanceToSquared(camera.position);
      const farDist = currentQuality.lodDist + 2;
      const nearDist = currentQuality.lodDist - 2;
      if (!shark.isFarLod && distSq > farDist * farDist && shark !== heldShark) {
        shark.isFarLod = true;
        shark.mesh.geometry = sharkGeometriesFar[shark.species][shark.variantIndex];
        shark.uniforms.jawPivot.value.fromArray(shark.mesh.geometry.userData.jawPivot);
      } else if (shark.isFarLod && (distSq < nearDist * nearDist || shark === heldShark)) {
        shark.isFarLod = false;
        shark.mesh.geometry = sharkGeometries[shark.species][shark.variantIndex];
        shark.uniforms.jawPivot.value.fromArray(shark.mesh.geometry.userData.jawPivot);
      }
    }
  }

  function renderScene(elapsed=0){
    jellyfish.update(animationTime);
    if (freedivers) freedivers.update(animationTime, paused, speed);
    waterUniforms.time.value=animationTime;
    particleUniforms.time.value=animationTime;
    oceanBioluminescence.update(animationTime);
    if(!paused && !heldShark)easedPointer.lerp(pointer,.015);
    camera.position.x=Math.sin(animationTime*.027)*.75+easedPointer.x*.65;
    camera.position.y=3.5+Math.sin(animationTime*.039)*.24+easedPointer.y*.35;
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    if(heldShark){
      raycaster.setFromCamera(dragNdc,camera);
      gripDepth=T.MathUtils.clamp(gripDepth+depthDirection*4*elapsed,8,135);
      raycaster.ray.at(gripDepth,dragTarget);
    }
    lightShafts.visible=waterUniforms.sunPower.value>0;

    for(let i=0;i<sharks.length;i++) boidForces[i].set(0,0,0);
    if(!paused){
      for(let i=0;i<sharks.length;i++){
        if(!sharks[i].mesh.visible||sharks[i]===heldShark)continue;
        const s1=sharks[i], ph1=s1.phase+animationTime*s1.rate*s1.direction;
        boidP1.set(Math.sin(ph1)*s1.rx,s1.y+Math.sin(ph1*2+s1.phase)*.85,s1.z+Math.cos(ph1)*s1.rz).add(s1.offset);
        if (freedivers && freedivers.group.visible) {
          // 1. Direct Repulsion from the Freediver Rig & Shot Line
          if (boidP1.y >= freedivers.ropeBottomY - 3 && boidP1.y <= freedivers.ropeTopY + 2) {
            const rdx = boidP1.x - freedivers.rigX;
            const rdz = boidP1.z - freedivers.rigZ;
            const rDistSq = rdx * rdx + rdz * rdz;
            if (rDistSq < 144.0 && rDistSq > 0.01) {
              const rDist = Math.sqrt(rDistSq);
              const rPush = (1.0 - rDist / 12.0) * 7.5;
              boidForces[i].x += (rdx / rDist) * rPush;
              boidForces[i].z += (rdz / rDist) * rPush;
            }
          }

          // 2. Camera-to-Freediver Sightline Corridor Clearance (prevents sharks from swimming in front of the divers)
          // Camera is at camera.position; Freediver target center is at (freedivers.rigX, 0.0, freedivers.rigZ)
          freediverLOS.set(freedivers.rigX - camera.position.x, 0.0 - camera.position.y, freedivers.rigZ - camera.position.z);
          const losLenSq = freediverLOS.lengthSq();
          if (losLenSq > 1.0) {
            sharkToCam.subVectors(boidP1, camera.position);
            const uLOS = sharkToCam.dot(freediverLOS) / losLenSq;
            if (uLOS > 0.05 && uLOS < 0.95) {
              losProjPoint.copy(camera.position).addScaledVector(freediverLOS, uLOS);
              losClearanceVec.subVectors(boidP1, losProjPoint);
              const losDistSq = losClearanceVec.lengthSq();
              const clearRadius = 6.5;
              if (losDistSq < clearRadius * clearRadius && losDistSq > 0.001) {
                const losDist = Math.sqrt(losDistSq);
                const losPush = (1.0 - losDist / clearRadius) * 5.5;
                // Gently nudge shark away from the sightline corridor
                boidForces[i].addScaledVector(losClearanceVec, losPush / losDist);
              }
            }
          }
        }
        for(let j=0;j<i;j++){
          if(!sharks[j].mesh.visible||sharks[j]===heldShark)continue;
          const s2=sharks[j], ph2=s2.phase+animationTime*s2.rate*s2.direction;
          boidP2.set(Math.sin(ph2)*s2.rx,s2.y+Math.sin(ph2*2+s2.phase)*.85,s2.z+Math.cos(ph2)*s2.rz).add(s2.offset);
          boidDiff.subVectors(boidP1,boidP2);
          const distSq=boidDiff.lengthSq();
          if(distSq<144&&distSq>0.1){
            const factor=40.0/(distSq*Math.sqrt(distSq));
            boidForces[i].addScaledVector(boidDiff,factor);
            boidForces[j].addScaledVector(boidDiff,-factor);
          }
        }
      }
    }

    // Both kinds of animal share grabbing, inertia and release recovery.
    // Jellyfish supply their own path and orient their bell along that path.
    for(let i=0;i<sharks.length;i++) updateAnimalPhysics(sharks[i],i,elapsed);
    if(jellyfish && jellyfish.group && jellyfish.group.visible){
      for(let i=0;i<jellyfish.animals.length;i++) updateAnimalPhysics(jellyfish.animals[i],i,elapsed);
    }

    // Hydrodynamic Shear Wake Bioluminescence (Sharks & Jellyfish)
    const nightBioFactor = Math.max(0, Math.min(1, (0.32 - waterUniforms.daylight.value) / 0.30));
    if (nightBioFactor > 0.01 && elapsed > 0.001) {
      for (let i = 0; i < sharks.length; i++) {
        const s = sharks[i];
        if (!s.mesh.visible) continue;
        bioSharkForward.set(1, 0, 0).applyQuaternion(s.mesh.quaternion).normalize();

        // 1. Caudal fin upper lobe tip: lx = -4.685, ly = 1.95, lz = 0.0
        getSharkFinWorldPos(s, -4.685, 1.95, 0.0, 0.35, false, bioSharkTipWorld);
        if (s.hasPrevFinPos) {
          bioFinVel.subVectors(bioSharkTipWorld, s.prevCaudalTip).divideScalar(elapsed);
          const finSpeed = bioFinVel.length();
          if (finSpeed > 0.45) {
            const shear = Math.min(2.0, (finSpeed - 0.45) / 0.85);
            const count = Math.min(6, Math.floor(1 + shear * 4));
            oceanBioluminescence.emitBurst(
              bioSharkTipWorld.x, bioSharkTipWorld.y, bioSharkTipWorld.z,
              bioFinVel.x * 0.32 - bioSharkForward.x * 0.28,
              bioFinVel.y * 0.32,
              bioFinVel.z * 0.32 - bioSharkForward.z * 0.28,
              shear * nightBioFactor,
              count
            );
          }
        }
        s.prevCaudalTip.copy(bioSharkTipWorld);

        // 2. Pectoral tips (during fast turns/speed)
        getSharkFinWorldPos(s, -1.275, -0.57, -2.18, 1.0, true, bioSharkTipWorld);
        if (s.hasPrevFinPos) {
          bioFinVel.subVectors(bioSharkTipWorld, s.prevPectoralL).divideScalar(elapsed);
          const finSpeed = bioFinVel.length();
          if (finSpeed > 0.45) {
            const shear = Math.min(1.8, (finSpeed - 0.45) / 0.85);
            oceanBioluminescence.emitBurst(
              bioSharkTipWorld.x, bioSharkTipWorld.y, bioSharkTipWorld.z,
              bioFinVel.x * 0.30 - bioSharkForward.x * 0.20,
              bioFinVel.y * 0.30,
              bioFinVel.z * 0.30 - bioSharkForward.z * 0.20,
              shear * nightBioFactor * 0.75,
              Math.min(3, Math.floor(1 + shear * 2))
            );
          }
        }
        s.prevPectoralL.copy(bioSharkTipWorld);

        getSharkFinWorldPos(s, -1.275, -0.57, 2.18, 1.0, true, bioSharkTipWorld);
        if (s.hasPrevFinPos) {
          bioFinVel.subVectors(bioSharkTipWorld, s.prevPectoralR).divideScalar(elapsed);
          const finSpeed = bioFinVel.length();
          if (finSpeed > 0.45) {
            const shear = Math.min(1.8, (finSpeed - 0.45) / 0.85);
            oceanBioluminescence.emitBurst(
              bioSharkTipWorld.x, bioSharkTipWorld.y, bioSharkTipWorld.z,
              bioFinVel.x * 0.30 - bioSharkForward.x * 0.20,
              bioFinVel.y * 0.30,
              bioFinVel.z * 0.30 - bioSharkForward.z * 0.20,
              shear * nightBioFactor * 0.75,
              Math.min(3, Math.floor(1 + shear * 2))
            );
          }
        }
        s.prevPectoralR.copy(bioSharkTipWorld);
        s.hasPrevFinPos = true;
      }

      // Jellyfish peripheral vortex ring emission during active contraction
      if (jellyfish && jellyfish.group && jellyfish.group.visible) {
        for (let j = 0; j < jellyfish.animals.length; j++) {
          const a = jellyfish.animals[j];
          if (!a.body.visible) continue;
          const cycle = (animationTime * (0.22 + 0.012 * Math.sin(a.phase)) + a.phase) % 1;
          if (cycle > 0.02 && cycle < 0.16) {
            const contractionShear = Math.sin((cycle - 0.02) / 0.14 * Math.PI) * 0.85;
            if (contractionShear > 0.20) {
              const rimRadius = 0.88 * a.scale;
              for (let b = 0; b < 2; b++) {
                const angle = Math.random() * Math.PI * 2;
                bioJellyRimScratch.set(Math.cos(angle) * rimRadius, -0.12 * a.scale, Math.sin(angle) * rimRadius);
                bioJellyRimScratch.applyQuaternion(a.body.quaternion).add(a.body.position);
                bioJellyExpelScratch.set(0, -0.32, 0).applyQuaternion(a.body.quaternion);
                oceanBioluminescence.emitBurst(
                  bioJellyRimScratch.x, bioJellyRimScratch.y, bioJellyRimScratch.z,
                  bioJellyExpelScratch.x + a.velocity.x * 0.25,
                  bioJellyExpelScratch.y + a.velocity.y * 0.25,
                  bioJellyExpelScratch.z + a.velocity.z * 0.25,
                  contractionShear * nightBioFactor * 0.80,
                  1
                );
              }
            }
          }
        }
      }
    }

    for (let r = 0; r < maxRemoras; r++) {
      const att = remoraAttachments[r];
      const host = sharks[att.sharkIndex];
      if (!host || !host.mesh.visible) {
        remoraDummy.scale.setScalar(0);
        remoraDummy.position.set(0, -999, 0);
        remoraDummy.updateMatrix();
        remoras.setMatrixAt(r, remoraDummy.matrix);
        continue;
      }
      const ax = att.offset[0];
      const tail = T.MathUtils.clamp((1.8 - ax) / 6.2, 0, 1.2);
      const head = T.MathUtils.clamp((ax - 1.8) / 1.5, 0, 1);
      const phase = host.uniforms.swimTime.value * 1.9 + ax * .91 + host.uniforms.swimPhase.value;
      const wave = (Math.sin(phase) - .15 * Math.sin(phase * 2)) * (tail * tail * .57 - head * .1) * host.uniforms.swimPower.value;
      const spineSlope = (Math.cos(phase) - .3 * Math.cos(phase * 2)) * .91 * (tail * tail * .57 - head * .1) * host.uniforms.swimPower.value;
      const stationWeave = Math.sin(animationTime * 1.9 + att.seed) * .035;

      remoraLocalPos.set(
        ax,
        att.offset[1] + host.uniforms.dragBend.value.x * tail * tail,
        att.offset[2] + wave + host.uniforms.dragBend.value.y * tail * tail + stationWeave
      );
      remoraWorldPos.copy(remoraLocalPos).multiplyScalar(host.scale).applyQuaternion(host.mesh.quaternion).add(host.mesh.position);
      remoraDummy.position.copy(remoraWorldPos);

      remoraYawQuat.setFromAxisAngle(remoraUp, -spineSlope * 0.4);
      remoraDummy.quaternion.copy(host.mesh.quaternion).multiply(remoraYawQuat);
      remoraDummy.scale.setScalar(att.scale * (.85 + .15 * host.scale));
      remoraDummy.updateMatrix();
      remoras.setMatrixAt(r, remoraDummy.matrix);
    }
    remoras.instanceMatrix.needsUpdate = true;

    // Populate shared 24-animal optical field (oceanOptics) with closest visible animals
    let candidateCount = 0;
    for (let i = 0; i < sharks.length; i++) {
      const s = sharks[i];
      if (s.mesh.visible) {
        candidateAnimals[candidateCount] = s;
        const pos = s.mesh.position;
        const dx = pos.x, dy = pos.y - 1.0, dz = pos.z + 18.0;
        animalSortDists[candidateCount] = dx * dx + dy * dy + dz * dz;
        animalSortIndices[candidateCount] = candidateCount;
        candidateCount++;
        if (candidateCount >= maxCandidateAnimals) break;
      }
    }
    if (jellyfish && jellyfish.group && jellyfish.group.visible) {
      for (let i = 0; i < jellyfish.animals.length; i++) {
        const j = jellyfish.animals[i];
        if (j.mesh.visible) {
          if (candidateCount >= maxCandidateAnimals) break;
          candidateAnimals[candidateCount] = j;
          const pos = j.mesh.position;
          const dx = pos.x, dy = pos.y - 1.0, dz = pos.z + 18.0;
          animalSortDists[candidateCount] = dx * dx + dy * dy + dz * dz;
          animalSortIndices[candidateCount] = candidateCount;
          candidateCount++;
        }
      }
    }
    const activeCount = Math.min(candidateCount, currentQuality.maxOptical, animalFieldCount);
    for (let i = 0; i < activeCount; i++) {
      let minIdx = i;
      let minDist = animalSortDists[animalSortIndices[i]];
      for (let j = i + 1; j < candidateCount; j++) {
        const d = animalSortDists[animalSortIndices[j]];
        if (d < minDist) {
          minDist = d;
          minIdx = j;
        }
      }
      if (minIdx !== i) {
        const tmp = animalSortIndices[i];
        animalSortIndices[i] = animalSortIndices[minIdx];
        animalSortIndices[minIdx] = tmp;
      }
    }

    let writeSlot = 0;
    for (let k = 0; k < activeCount; k++) {
      const a = candidateAnimals[animalSortIndices[k]];
      if (!a.isJellyfish) {
        animalForwardScratch.set(1, 0, 0).applyQuaternion(a.mesh.quaternion).normalize();
        const bodyRadius = 0.88 * a.scale;
        const cx = a.mesh.position.x - animalForwardScratch.x * (0.3 * a.scale);
        const cy = a.mesh.position.y - animalForwardScratch.y * (0.3 * a.scale);
        const cz = a.mesh.position.z - animalForwardScratch.z * (0.3 * a.scale);
        animalStates[writeSlot].set(cx, cy, cz, bodyRadius);
        animalHeadings[writeSlot].set(animalForwardScratch.x, animalForwardScratch.y, animalForwardScratch.z, 2.95 * a.scale);

        const phase = a.phase + animationTime * a.rate * a.direction;
        const dPhase = a.rate * a.direction;
        const dxdt = Math.cos(phase) * a.rx * dPhase;
        const dzdt = -Math.sin(phase) * a.rz * dPhase;
        const dydt = 1.7 * Math.cos(phase * 2 + a.phase) * dPhase;
        const pathScale = paused ? 0 : speed;
        const vx = dxdt * pathScale + a.velocity.x;
        const vy = dydt * pathScale + a.velocity.y;
        const vz = dzdt * pathScale + a.velocity.z;
        const activitySpeed = (paused ? 0 : speed) + a.velocity.length() * 0.25;
        animalMotions[writeSlot].set(vx, vy, vz, activitySpeed);
        writeSlot++;
      }
    }
    const activeSharkCount = writeSlot;
    for (let k = 0; k < activeCount; k++) {
      const a = candidateAnimals[animalSortIndices[k]];
      if (a.isJellyfish) {
        animalForwardScratch.set(0, 1, 0).applyQuaternion(a.mesh.quaternion).normalize();
        const bodyRadius = 1.05 * a.scale;
        animalStates[writeSlot].set(a.mesh.position.x, a.mesh.position.y, a.mesh.position.z, bodyRadius);
        animalHeadings[writeSlot].set(animalForwardScratch.x, animalForwardScratch.y, animalForwardScratch.z, 0);

        const pathScale = paused ? 0 : speed * 0.22;
        const vx = animalForwardScratch.x * pathScale + a.velocity.x;
        const vy = animalForwardScratch.y * pathScale + a.velocity.y;
        const vz = animalForwardScratch.z * pathScale + a.velocity.z;
        const activitySpeed = (paused ? 0 : speed * 0.65) + a.velocity.length() * 0.25;
        animalMotions[writeSlot].set(vx, vy, vz, activitySpeed);
        writeSlot++;
      }
    }
    if (freedivers && freedivers.group.visible && freedivers.activeDivers) {
      for (let dIdx = 0; dIdx < freedivers.activeDivers.length; dIdx++) {
        const d = freedivers.activeDivers[dIdx];
        if (d.active && writeSlot < animalFieldCount) {
          animalStates[writeSlot].set(d.position.x, d.position.y, d.position.z, 0.65 * d.scale);
          animalHeadings[writeSlot].set(d.heading.x, d.heading.y, d.heading.z, 1.65 * d.scale);
          const kickBoost = (typeof d.kickAmp === 'number') ? d.kickAmp * 1.2 : 0.6;
          const actSpeed = paused ? 0 : (0.75 + d.velocity.length() * 0.95 + kickBoost);
          animalMotions[writeSlot].set(d.velocity.x, d.velocity.y, d.velocity.z, actSpeed);
          writeSlot++;
        }
      }
    }
    for (let k = writeSlot; k < animalFieldCount; k++) {
      animalStates[k].set(0, 0, 0, 0);
      animalMotions[k].set(0, 0, 0, 0);
      animalHeadings[k].set(1, 0, 0, 0);
    }
    oceanOptics.activeSharkCount.value = activeSharkCount;
    oceanOptics.activeAnimalCount.value = writeSlot;
    for (let i = candidateCount; i < maxCandidateAnimals && candidateAnimals[i] !== null; i++) {
      candidateAnimals[i] = null;
    }
    for(let i=0;i<currentQuality.fish;i++) {
      const seed=fishSeeds[i];
      const school=i<55?0:1;
      const orbitDir=school===0?1:-1;
      const orbitRate=school===0?0.016:0.014;
      const rx=school===0?27:29;
      const rz=9.5;
      const centerY=school===0?7.5:-5.5;
      const centerZ=school===0?-36:-56;
      const orbitAngle=animationTime*orbitRate*orbitDir+seed[3]*0.12+school*3.14159;

      let fx=Math.sin(orbitAngle)*rx+(seed[0]-.5)*8.0+Math.sin(animationTime*.65+seed[3])*.35;
      let fy=centerY+(seed[1]-.5)*3.5+Math.sin(orbitAngle*2.0+seed[3])*1.6+Math.cos(animationTime*.55+seed[3]*1.3)*.25;
      let fz=centerZ+Math.cos(orbitAngle)*rz+(seed[2]-.5)*6.5+Math.sin(animationTime*.75+seed[3]*.7)*.35;

      let dx=Math.cos(orbitAngle)*rx*orbitDir;
      let dy=3.2*Math.cos(orbitAngle*2.0+seed[3])*orbitDir;
      let dz=-Math.sin(orbitAngle)*rz*orbitDir;

      let avoidX=0,avoidY=0,avoidZ=0;
      for(let k=0;k<activeCount;k++){
        if(animalHeadings[k].w<=0.01)continue;
        const sx=animalStates[k].x,sy=animalStates[k].y,sz=animalStates[k].z;
        const distSq=(fx-sx)*(fx-sx)+(fy-sy)*(fy-sy)+(fz-sz)*(fz-sz);
        if(distSq<72.25&&distSq>0.01){
          const dist=Math.sqrt(distSq);
          const push=(1.0-dist/8.5)*1.8;
          avoidX+=((fx-sx)/dist)*push;
          avoidY+=((fy-sy)/dist)*push;
          avoidZ+=((fz-sz)/dist)*push;
        }
      }
      if (freedivers && freedivers.group.visible && fy >= freedivers.ropeBottomY - 3 && fy <= freedivers.ropeTopY + 2) {
        const rdx = fx - freedivers.rigX;
        const rdz = fz - freedivers.rigZ;
        const rDistSq = rdx * rdx + rdz * rdz;
        if (rDistSq < 49.0 && rDistSq > 0.01) {
          const rDist = Math.sqrt(rDistSq);
          const rPush = (1.0 - rDist / 7.0) * 1.5;
          avoidX += (rdx / rDist) * rPush;
          avoidZ += (rdz / rDist) * rPush;
        }
      }
      fx+=avoidX;fy+=avoidY;fz+=avoidZ;
      dx+=avoidX*1.5;dy+=avoidY*1.5;dz+=avoidZ*1.5;

      const horizSpeed=Math.hypot(dx,dz);
      const speed3D=Math.hypot(horizSpeed,dy);
      const yaw=Math.atan2(-dz,dx);
      const pitch=Math.asin(T.MathUtils.clamp(dy/Math.max(0.01,speed3D),-0.85,0.85));
      const roll=T.MathUtils.clamp(-dx*orbitDir*0.012,-0.28,0.28);

      fishTransform.position.set(fx,fy,fz);
      fishTransform.rotation.set(pitch,yaw,roll,'YXZ');
      fishTransform.scale.setScalar(0.48+seed[1]*0.42);
      fishTransform.updateMatrix();
      fish.setMatrixAt(i,fishTransform.matrix);
    }
    fish.instanceMatrix.needsUpdate=true;
    renderer.clear();
    updateCaustics();
    renderer.render(background,backgroundCamera);
    renderer.clearDepth();
    renderer.render(scene,camera);
  }
  function frame(now){
    animationRequest=requestAnimationFrame(frame);
    const minFrameMs = 1000 / currentQuality.fps - 1.8;
    if(now-lastRendered<minFrameMs || contextLost) return;
    const elapsed=Math.min((now-lastFrame)/1000,.12);
    lastFrame=now; lastRendered=now;
    if(!paused){
      animationTime+=elapsed*speed;
      // A one-second update interval is sufficient for the smooth day cycle. Pause freezes
      // both movement and lighting; resuming fetches the current local time.
      if(now-lastLightingUpdate>=1000){updateDaylight(new Date());lastLightingUpdate=now;}
    }
    const isInteracting=s=>s.mesh.visible &&
      (s.velocity.lengthSq()>0 || s.angularVelocity.lengthSq()>0 || s.uniforms.dragBend.value.lengthSq()>0
        || (s.finTurnInteraction && s.finTurnInteraction.lengthSq()>0)
        || (s.burstPower>0)
        || s.rotationOffset.x!==0 || s.rotationOffset.y!==0 || s.rotationOffset.z!==0);
    const interacting=heldShark || sharks.some(isInteracting) || (jellyfish.group.visible && jellyfish.animals.some(isInteracting));
    if(!paused || redrawNeeded || interacting){renderScene(elapsed);redrawNeeded=false;}
  }
  updateDaylight(new Date());
  renderScene();
  animationRequest=requestAnimationFrame(frame);
  loading.hidden=true;
  document.body.dataset.ready='true';

  // Hidden tabs do not need rendering. The scene resumes without jumps
  // when the tab becomes visible again; a visible scene has no time limit.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)releaseShark();
    cancelAnimationFrame(animationRequest);
    if(!document.hidden){lastFrame=performance.now();lastLightingUpdate=-Infinity;animationRequest=requestAnimationFrame(frame);}
  });
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();releaseShark();contextLost=true;
    showError('The 3D display was interrupted. It will resume when the browser graphics are ready.');
  });
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;previousCausticTime=NaN;errorBox.hidden=true;redrawNeeded=true;lastFrame=performance.now();});

  const pauseButton=document.getElementById('pause');
  function updatePauseButton(){
    document.getElementById('pause-label').textContent=paused?'Resume':'Pause';
    document.getElementById('pause-icon').setAttribute('d',paused?'M8 5l11 7-11 7V5':'M9 5v14M15 5v14');
    pauseButton.setAttribute('aria-label',paused?'Resume animation':'Pause animation');
    pauseButton.setAttribute('aria-pressed',String(paused));
  }
  function togglePause(){paused=!paused;lastLightingUpdate=-Infinity;redrawNeeded=true;updatePauseButton();revealControls();}
  pauseButton.addEventListener('click',togglePause);
  updatePauseButton();
  document.getElementById('speed').addEventListener('input',event=>{speed=Number(event.target.value);});

  // Fullscreen requires a click or keypress. The screen wake lock is
  // active only in fullscreen and is released when fullscreen ends.
  let wakeLock=null;
  let noticeTimer;
  function notice(message){
    const element=document.getElementById('notice');
    element.textContent=message;element.classList.add('visible');
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>element.classList.remove('visible'),4500);
  }
  async function requestWakeLock(){
    if(document.fullscreenElement && 'wakeLock' in navigator && !document.hidden){
      try{wakeLock=await navigator.wakeLock.request('screen');}catch(error){/* Normal browser power management applies if denied. */}
    }
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notice('Use your browser fullscreen option to fill the screen.');
    }catch(error){notice('Press F11 to enter browser fullscreen.');}
  }
  document.getElementById('fullscreen').addEventListener('click',toggleFullscreen);
  canvas.addEventListener('dblclick',()=>{if(performance.now()-lastSharkGrab>650)toggleFullscreen();});
  document.addEventListener('fullscreenchange',async()=>{
    document.querySelector('#fullscreen span').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';
    if(document.fullscreenElement) await requestWakeLock();
    else if(wakeLock){await wakeLock.release();wakeLock=null;}
    revealControls();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) requestWakeLock();});

  let hideTimer;
  function revealControls(){
    document.body.classList.remove('immersed');
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      if(heldShark || !errorBox.hidden)return;
      document.body.classList.add('immersed');
    },5000);
  }
  document.addEventListener('pointermove',event=>{
    pointer.set((event.clientX/innerWidth-.5)*2,(.5-event.clientY/innerHeight)*2);
    revealControls();
  },{passive:true});
  document.addEventListener('pointerdown',revealControls,{passive:true});
  document.addEventListener('input',revealControls);
  document.addEventListener('change',revealControls);
  document.addEventListener('keydown',event=>{
    revealControls();
    if(event.repeat || event.ctrlKey || event.metaKey || event.altKey)return;
    if(event.target.matches('input,select,textarea'))return;
    if(event.key.toLowerCase()==='f'){event.preventDefault();toggleFullscreen();return;}
    if(event.target.matches('button'))return;
    if(event.code==='Space'){event.preventDefault();togglePause();}
  });
  document.addEventListener('focusin',revealControls);
  revealControls();
})();
