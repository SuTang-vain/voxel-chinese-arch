/**
 * scene.js — 渲染环境：天空 / 光照 / 阴影 / 相机 / 时辰预设
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------- 时辰预设 ------------------------- */
// dir: 太阳方位 —— 以 +y 为上，x 为东，z 为南（入口方向）
export const PRESETS = {
  dawn: {
    label: '晨曦',
    el: 19, az: 76,
    sun: 0xffb066, sunI: 2.9,
    hemiSky: 0xa8c0e2, hemiGround: 0x6e5e46, hemiI: 0.7,
    amb: 0x3b4a6a, ambI: 0.55,
    skyTop: 0x20407a, skyMid: 0xe8a468, skyBot: 0xf6cd9e,
    fog: 0xe3b98e, exposure: 0.98, lantern: 0.35,
  },
  noon: {
    label: '正午',
    el: 62, az: 152,
    sun: 0xfff4e0, sunI: 2.7,
    hemiSky: 0xc3dcf7, hemiGround: 0x71804f, hemiI: 0.65,
    amb: 0xbcd0e8, ambI: 0.3,
    skyTop: 0x2f72c8, skyMid: 0x9ec9ef, skyBot: 0xdceaf6,
    fog: 0xcfe1f0, exposure: 0.92, lantern: 0.0,
  },
  dusk: {
    label: '黄昏',
    el: 17, az: -66,
    sun: 0xff9a4a, sunI: 2.7,
    hemiSky: 0x9a86be, hemiGround: 0x5c4030, hemiI: 0.68,
    amb: 0x554668, ambI: 0.72,
    skyTop: 0x233060, skyMid: 0xf07c3c, skyBot: 0xf9c47e,
    fog: 0xdd9a66, exposure: 1.05, lantern: 0.7,
  },
  night: {
    label: '夜阑',
    el: 46, az: 118,
    sun: 0x9db8ea, sunI: 0.85,
    hemiSky: 0x22365a, hemiGround: 0x14181f, hemiI: 0.42,
    amb: 0x111c30, ambI: 0.6,
    skyTop: 0x03050d, skyMid: 0x0a1224, skyBot: 0x1a2740,
    fog: 0x121a2e, exposure: 1.1, lantern: 1.0,
  },
};

function sunDirection(elDeg, azDeg) {
  const el = (elDeg * Math.PI) / 180;
  const az = (azDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

/* ------------------------- 天空 ------------------------- */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 cTop, cMid, cBot, cSun, sunDir;
  uniform float sunI;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(cBot, cMid, smoothstep(0.40, 0.505, h));
    col = mix(col, cTop, smoothstep(0.50, 0.98, h));
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += cSun * pow(s, 320.0) * 3.0 * sunI;      // 日轮
    col += cSun * pow(s, 8.0) * 0.20 * sunI;       // 大气辉光
    col += cSun * pow(max(1.0 - abs(d.y) * 3.4, 0.0), 4.0) * 0.10 * sunI; // 地平霞光
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------- 场景 ------------------------- */

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe1f0, 420, 1500);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 1, 4000);

  /* 天空穹顶 */
  const skyUniforms = {
    cTop: { value: new THREE.Color(0x2f72c8) },
    cMid: { value: new THREE.Color(0x9ec9ef) },
    cBot: { value: new THREE.Color(0xdceaf6) },
    cSun: { value: new THREE.Color(0xfff4e0) },
    sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) },
    sunI: { value: 1.0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 40, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  /* 光照 */
  const sunDir = sunDirection(PRESETS.noon.el, PRESETS.noon.az);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 8, -16);
  scene.add(sunTarget);
  sun.target = sunTarget;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 150;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  // 紧瘦的深度范围 => 阴影贴图精度更高，避免大面积暗斑
  sun.shadow.camera.near = 260;
  sun.shadow.camera.far = 820;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.7;
  sun.shadow.camera.updateProjectionMatrix();
  sun.position.copy(sunDir).multiplyScalar(520).add(sunTarget.position);
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xc3dcf7, 0x71804f, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xbcd0e8, 0.35);
  scene.add(amb);

  /* 檐下灯火（夜间暖光池） */
  const lamps = [
    [0, 13, -19, 46, 34],
    [0, 12, 66, 40, 30],
    [0, 7, 22, 34, 26],
    [-50, 12, -30, 34, 26],
    [50, 12, -30, 34, 26],
    [0, 22, -76, 30, 22],
  ];
  const lampLights = lamps.map(([x, y, z, i, dist]) => {
    const l = new THREE.PointLight(0xffb066, 0, dist, 2);
    l.position.set(x, y, z);
    l.userData.maxI = i;
    scene.add(l);
    return l;
  });

  /* 远景草地（体素地面之外的补底）：远方做体素式阶地，近处保持平整 */
  const groundGeo = new THREE.PlaneGeometry(3400, 3400, 170, 170);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colAttr = new Float32Array(pos.count * 3);
  const gc = new THREE.Color();
  const palette = [0x5c8f4a, 0x54843f, 0x64974d, 0x4d7a3b, 0x76985a];
  const siteDist = (x, z) => {
    const dx = Math.max(0, Math.abs(x) - 76);
    const dz = Math.max(0, Math.abs(z + 14) - 100);
    return Math.hypot(dx, dz);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = siteDist(x, z);
    const fade = Math.min(1, Math.max(0, (r - 34) / 90));
    const h =
      (Math.sin(x * 0.0121 + 0.7) * Math.cos(z * 0.0097) * 2.6 +
        Math.sin(x * 0.031 - z * 0.024) * 1.5 +
        Math.cos(z * 0.052 + 1.3) * 0.8) * fade;
    pos.setY(i, Math.round(h / 1.5) * 1.5 - 0.1); // 量化成阶地 => 体素感
    const t = (h + 4.9) / 9.8;
    gc.setHex(palette[Math.min(palette.length - 1, Math.max(0, ((t * palette.length) | 0)))]);
    const rnd = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    gc.multiplyScalar(0.9 + rnd * 0.2);
    colAttr[i * 3] = gc.r;
    colAttr[i * 3 + 1] = gc.g;
    colAttr[i * 3 + 2] = gc.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
  groundGeo.computeVertexNormals();
  const farGround = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xffffff }),
  );
  farGround.receiveShadow = true;
  scene.add(farGround);

  /* 相机 / 控制器 */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.6;
  controls.minDistance = 45;
  controls.maxDistance = 900;
  controls.maxPolarAngle = Math.PI * 0.492;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.42;
  controls.target.set(0, 9, -14);

  /* ---------------- 时辰切换（带过渡） ---------------- */
  const state = {
    sun: new THREE.Color(PRESETS.noon.sun),
    sunI: PRESETS.noon.sunI,
    hemiSky: new THREE.Color(PRESETS.noon.hemiSky),
    hemiGround: new THREE.Color(PRESETS.noon.hemiGround),
    hemiI: PRESETS.noon.hemiI,
    amb: new THREE.Color(PRESETS.noon.amb),
    ambI: PRESETS.noon.ambI,
    skyTop: new THREE.Color(PRESETS.noon.skyTop),
    skyMid: new THREE.Color(PRESETS.noon.skyMid),
    skyBot: new THREE.Color(PRESETS.noon.skyBot),
    fog: new THREE.Color(PRESETS.noon.fog),
    lantern: PRESETS.noon.lantern,
    exposure: PRESETS.noon.exposure,
    dir: sunDirection(PRESETS.noon.el, PRESETS.noon.az),
  };
  const goal = {
    sun: state.sun.clone(),
    hemiSky: state.hemiSky.clone(),
    hemiGround: state.hemiGround.clone(),
    amb: state.amb.clone(),
    skyTop: state.skyTop.clone(),
    skyMid: state.skyMid.clone(),
    skyBot: state.skyBot.clone(),
    fog: state.fog.clone(),
    dir: state.dir.clone(),
    sunI: state.sunI,
    hemiI: state.hemiI,
    ambI: state.ambI,
    lantern: state.lantern,
    exposure: state.exposure,
  };

  function setTimeOfDay(name) {
    const p = PRESETS[name];
    if (!p) return;
    goal.sun.setHex(p.sun);
    goal.hemiSky.setHex(p.hemiSky);
    goal.hemiGround.setHex(p.hemiGround);
    goal.amb.setHex(p.amb);
    goal.skyTop.setHex(p.skyTop);
    goal.skyMid.setHex(p.skyMid);
    goal.skyBot.setHex(p.skyBot);
    goal.fog.setHex(p.fog);
    goal.dir.copy(sunDirection(p.el, p.az));
    goal.sunI = p.sunI;
    goal.hemiI = p.hemiI;
    goal.ambI = p.ambI;
    goal.lantern = p.lantern;
    goal.exposure = p.exposure;
  }

  function applyTransition(dt) {
    const k = 1 - Math.exp(-dt * 4.5);
    state.sun.lerp(goal.sun, k);
    state.hemiSky.lerp(goal.hemiSky, k);
    state.hemiGround.lerp(goal.hemiGround, k);
    state.amb.lerp(goal.amb, k);
    state.skyTop.lerp(goal.skyTop, k);
    state.skyMid.lerp(goal.skyMid, k);
    state.skyBot.lerp(goal.skyBot, k);
    state.fog.lerp(goal.fog, k);
    state.dir.lerp(goal.dir, k).normalize();
    state.sunI += (goal.sunI - state.sunI) * k;
    state.hemiI += (goal.hemiI - state.hemiI) * k;
    state.ambI += (goal.ambI - state.ambI) * k;
    state.lantern += (goal.lantern - state.lantern) * k;
    state.exposure += (goal.exposure - state.exposure) * k;

    sun.color.copy(state.sun);
    sun.intensity = state.sunI;
    sun.position.copy(state.dir).multiplyScalar(520).add(sunTarget.position);
    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiI;
    amb.color.copy(state.amb);
    amb.intensity = state.ambI;
    skyUniforms.cTop.value.copy(state.skyTop);
    skyUniforms.cMid.value.copy(state.skyMid);
    skyUniforms.cBot.value.copy(state.skyBot);
    skyUniforms.cSun.value.copy(state.sun);
    skyUniforms.sunDir.value.copy(state.dir);
    skyUniforms.sunI.value = Math.min(1, state.sunI / 2.2);
    scene.fog.color.copy(state.fog);
    renderer.toneMappingExposure = state.exposure;
    for (const l of lampLights) l.intensity = state.lantern * l.userData.maxI;
  }

  /* ---------------- 视角自适应 ---------------- */
  let fitPoints = [];
  const _v4 = new THREE.Vector4();
  const _m = new THREE.Matrix4();
  /** 用“地表高度采样点”而非包围盒拟合，避免被空旷的盒子角拉远 */
  function setFitPoints(points) {
    fitPoints = points;
  }

  function fitDistance(dir, fill = 0.9) {
    let d = 100;
    for (let iter = 0; iter < 80; iter++) {
      camera.position.copy(controls.target).addScaledVector(dir, d);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      let ok = true;
      for (let i = 0; i < fitPoints.length; i++) {
        const c = fitPoints[i];
        _v4.set(c.x, c.y, c.z, 1).applyMatrix4(_m);
        if (_v4.w <= 1e-3) { ok = false; break; }
        if (Math.abs(_v4.x) > fill * _v4.w || Math.abs(_v4.y) > fill * _v4.w) { ok = false; break; }
      }
      if (ok) break;
      d *= 1.04;
    }
    return d;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, controls, sun, sky,
    setTimeOfDay, applyTransition, setFitPoints, fitDistance, resize,
    sunDirection,
  };
}
