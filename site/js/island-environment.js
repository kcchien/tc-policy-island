// 島嶼檢視的環境：天空（漸層、太陽光暈、夜晚星星）、太陽、半球光與補光、霧、水面、夜間發光材質。
// 每幀用 apply(lighting) 套上 island-daylight.js 算出的光線；色碼都在關鍵影格表，這裡不寫色碼。
// 著色器的混色比例（光暈、星星、閃光）也取自 island-daylight.js，禁用色測試照同一組比例檢查。

import * as THREE from 'three';
import { glowLevel, KEYFRAMES, SKY_HALO, STAR_COLOR, WATER_SPARKLE, WATER_STARS } from './island-daylight.js';
import { SEA_LEVEL } from './island-terrain.js';

const SKY_RADIUS = 300;

// 天空：從裡面看的球體。地平線到天頂漸層，太陽方向一圈光暈；夜裡依夜間係數亮起星星（位置固定，不閃爍）。
// 不受霧與色調映射影響，顏色照關鍵影格。
function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunGlow: { value: new THREE.Color() },
      starColor: { value: new THREE.Color(STAR_COLOR) },
      night: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      uniform vec3 sunGlow;
      uniform vec3 starColor;
      uniform float night;
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1) * 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      void main() {
        vec3 dir = normalize(vDir);
        // 鏡頭最低只到俯角約 20 度，畫面頂端看到的是海面盡頭外、略低於地平線的天空；漸層與星星從地平線下方一點就開始。
        vec3 color = mix(horizon, top, smoothstep(-0.1, 0.45, dir.y));
        color = mix(color, sunGlow, pow(max(dot(dir, sunDir), 0.0), 18.0) * ${SKY_HALO.toFixed(3)});
        // 星星：方向切成小格，亂數夠大的格子中央畫一個圓點；越接近地平線越淡。
        vec3 cell = dir * 180.0;
        float star = step(0.9965, hash(floor(cell))) * (1.0 - smoothstep(0.18, 0.32, length(fract(cell) - 0.5)));
        color = mix(color, starColor, star * night * smoothstep(-0.09, 0.05, dir.y));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

// 水面：近島淺、離島越遠越深，兩組交疊的正弦波讓深淺緩慢漂移，再加細小的閃光。
// 用標準材質加一段著色器，保留光照、陰影、霧與雲影（island-outskirts.js 再疊一段，兩段都用乘的，順序不影響）。
// uniforms 的 waterTime 由 setWaterTime 依動畫時間更新，動畫停住時水面也停住。
function waterMaterialOf({ center, near, far }) {
  const uniforms = {
    waterShallow: { value: new THREE.Color() },
    waterDeep: { value: new THREE.Color() },
    waterSparkle: { value: new THREE.Color() },
    waterStar: { value: new THREE.Color(STAR_COLOR) },
    waterNight: { value: 0 },
    waterTime: { value: 0 },
    waterCenter: { value: new THREE.Vector2(center.x, center.z) },
    waterRange: { value: new THREE.Vector2(near, far) },
  };
  // 底色設為 1，水色全部由著色器乘上去。
  const material = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  material.color.setScalar(1);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaterPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWaterPos;
        uniform vec3 waterShallow;
        uniform vec3 waterDeep;
        uniform vec3 waterSparkle;
        uniform vec3 waterStar;
        uniform float waterNight;
        uniform float waterTime;
        uniform vec2 waterCenter;
        uniform vec2 waterRange;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vWaterPos;
          float depth = smoothstep(waterRange.x, waterRange.y, distance(p, waterCenter));
          float drift = sin(p.x * 0.35 + waterTime * 0.5) * sin(p.y * 0.3 - waterTime * 0.4)
            + 0.5 * sin((p.x + p.y) * 0.9 + waterTime * 0.9) * sin((p.x - p.y) * 0.7 - waterTime * 0.7);
          vec3 water = mix(waterShallow, waterDeep, clamp(depth + drift * 0.08, 0.0, 1.0));
          float glint = sin(p.x * 4.1 + waterTime * 1.7) * sin(p.y * 3.7 - waterTime * 1.3) * sin((p.x + p.y) * 2.3 + waterTime * 2.1);
          water = mix(water, waterSparkle, smoothstep(0.8, 0.98, glint) * (1.0 - 0.7 * depth) * ${WATER_SPARKLE.toFixed(3)});
          // 星光倒影：水面切成小格，少數格子中央一個小圓點，位置固定不隨時間動；離島越遠越明顯。
          vec2 cell = p * 1.6;
          float pick = fract(sin(dot(floor(cell), vec2(127.1, 311.7))) * 43758.5453);
          float star = step(0.985, pick) * (1.0 - smoothstep(0.08, 0.16, length(fract(cell) - 0.5)));
          water = mix(water, waterStar, star * waterNight * smoothstep(0.1, 0.5, depth) * ${WATER_STARS.toFixed(3)});
          diffuseColor.rgb *= water;
        }`);
  };
  material.customProgramCacheKey = () => 'island-water';
  return { material, uniforms };
}

// center 是島中心，radius 是島的範圍半徑（決定陰影相機與太陽距離）。waterRadius 是水面的半徑，要蓋過外圍地形。
export function createEnvironment(scene, { center, radius, quality, waterRadius }) {
  const sky = skyDome();
  sky.position.copy(center);
  scene.add(sky);
  scene.fog = new THREE.Fog(KEYFRAMES.day.fog, KEYFRAMES.day.fogNear, KEYFRAMES.day.fogFar);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.target.position.copy(center);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: 80 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  // 補光：從太陽的對面斜上方打一點冷光，陰影面不會死黑。不投影。
  const fill = new THREE.DirectionalLight();
  fill.target.position.copy(center);
  scene.add(hemi, sun, sun.target, fill, fill.target);

  // 水面從島中心往外：島的範圍內是淺色，到外圍地形邊緣漸深。
  const { material: waterMaterial, uniforms: water } = waterMaterialOf({ center, near: radius * 0.8, far: waterRadius * 0.7 });
  const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(waterRadius, 96), waterMaterial);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.copy(center).setY(SEA_LEVEL);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // 所有發光件（窗、燈泡）共用：不受色調映射，顏色乘上夜間係數換算的倍率，夜裡超過 1 看起來自己發光。
  const glowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });

  const direction = new THREE.Vector3();
  const uniforms = sky.material.uniforms;
  return {
    glowMaterial,
    waterMaterial,
    // 水面波紋與閃光的時間（秒），由外圍的動畫依動畫時間呼叫。
    setWaterTime(t) {
      water.waterTime.value = t;
    },
    // renderer 是 WebGLRenderer，用來設曝光。
    apply(lighting, renderer) {
      uniforms.top.value.setHex(lighting.skyTop);
      uniforms.horizon.value.setHex(lighting.skyHorizon);
      uniforms.sunGlow.value.setHex(lighting.sunGlow);
      uniforms.night.value = lighting.night;
      scene.fog.color.setHex(lighting.fog);
      scene.fog.near = lighting.fogNear;
      scene.fog.far = lighting.fogFar;
      hemi.color.setHex(lighting.hemiSky);
      hemi.groundColor.setHex(lighting.hemiGround);
      hemi.intensity = lighting.hemiIntensity;
      sun.color.setHex(lighting.sunColor);
      sun.intensity = lighting.sunIntensity;
      direction.fromArray(lighting.sunDirection).normalize();
      uniforms.sunDir.value.copy(direction);
      sun.position.copy(center).addScaledVector(direction, 30);
      fill.color.setHex(lighting.fillColor);
      fill.intensity = lighting.fillIntensity;
      fill.position.copy(center).add(direction.set(-direction.x * 30, 18, -direction.z * 30));
      water.waterShallow.value.setHex(lighting.waterShallow);
      water.waterDeep.value.setHex(lighting.waterDeep);
      water.waterSparkle.value.setHex(lighting.sunGlow);
      water.waterNight.value = lighting.night;
      glowMaterial.color.setScalar(glowLevel(lighting.night));
      renderer.toneMappingExposure = lighting.exposure;
    },
  };
}
