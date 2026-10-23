// 島嶼檢視的環境：天空兩色漸層球、太陽與半球光、霧、水面、夜間發光材質。
// 每幀用 apply(lighting) 套上 island-daylight.js 算出的光線；色碼都在關鍵影格表，這裡不寫色碼。

import * as THREE from 'three';
import { glowLevel, KEYFRAMES } from './island-daylight.js';
import { SEA_LEVEL } from './island-terrain.js';

const SKY_RADIUS = 300;

// 天空：從裡面看的球體，依高度在地平線色與天頂色之間漸層。不受霧與色調映射影響，顏色照關鍵影格。
function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      varying float vHeight;
      void main() {
        gl_FragColor = vec4(mix(horizon, top, pow(clamp(vHeight, 0.0, 1.0), 0.7)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
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
  scene.add(hemi, sun, sun.target);

  const waterMaterial = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(waterRadius, 64), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.copy(center).setY(SEA_LEVEL);
  water.receiveShadow = true;
  scene.add(water);

  // 所有發光件（窗、燈泡）共用：不受色調映射，顏色乘上夜間係數換算的倍率，夜裡超過 1 看起來自己發光。
  const glowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });

  const direction = new THREE.Vector3();
  return {
    glowMaterial,
    waterMaterial,
    // renderer 是 WebGLRenderer，用來設曝光。
    apply(lighting, renderer) {
      sky.material.uniforms.top.value.setHex(lighting.skyTop);
      sky.material.uniforms.horizon.value.setHex(lighting.skyHorizon);
      scene.fog.color.setHex(lighting.fog);
      scene.fog.near = lighting.fogNear;
      scene.fog.far = lighting.fogFar;
      hemi.color.setHex(lighting.hemiSky);
      hemi.groundColor.setHex(lighting.hemiGround);
      hemi.intensity = lighting.hemiIntensity;
      sun.color.setHex(lighting.sunColor);
      sun.intensity = lighting.sunIntensity;
      direction.fromArray(lighting.sunDirection).normalize().multiplyScalar(30);
      sun.position.copy(center).add(direction);
      waterMaterial.color.setHex(lighting.water);
      glowMaterial.color.setScalar(glowLevel(lighting.night));
      renderer.toneMappingExposure = lighting.exposure;
    },
  };
}
