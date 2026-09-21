/**
 * main.js —— 渲染器 / 相机 / 光照 / 交互 / 主循环
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildVoxelMeshes } from './voxel.js';
import { buildScene } from './site.js';
import { PRESETS, makeSkyTexture, makeGlowTexture } from './lighting.js';

const OVERVIEW = { pos: [112, 110, 188], target: [0, 17, -18] };
const INTRO_FROM = [252, 232, 384];
const MAX_PR = 1.5;   // 像素比上限（Retina 上再高性价比很低）

let renderer, scene, camera, controls, sun, hemi, ambient, skyMesh, sunSprite, solidMesh, glowMesh;
const pointLights = [];
let preset = 'dusk';
let stats = { fps: 0, ms: 0, tri: 0, calls: 0, quads: 0, voxels: 0 };
const quality = { pr: 1, target: 1, min: 0.7, cool: 0 };

/* ------------------------------------------------------------------ */
function init() {
  const canvasHost = document.getElementById('app');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  quality.target = Math.min(window.devicePixelRatio || 1, MAX_PR);
  quality.pr = quality.target;
  renderer.setPixelRatio(quality.pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // 静态场景：阴影贴图只在光源变化时重算
  canvasHost.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 1, 2400);
  camera.position.set(...INTRO_FROM);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...OVERVIEW.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 70;
  controls.maxDistance = 620;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;
  controls.enabled = false;   // 开场动画结束后开启

  /* ---------- 光照 ---------- */
  hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 0.6);
  scene.add(hemi);
  ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const d = 212;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 20, far: 1400 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.7;
  sun.target.position.set(0, 0, -10);
  scene.add(sun, sun.target);

  /* ---------- 天空 ---------- */
  const skyGeo = new THREE.SphereGeometry(900, 32, 20);
  skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  skyMesh.renderOrder = -1;
  scene.add(skyMesh);

  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  }));
  scene.add(sunSprite);

  /* ---------- 体素建筑群 ---------- */
  const { grid, marks, buildMs } = buildScene();
  const built = buildVoxelMeshes(grid);
  stats.quads = built.quads;
  stats.voxels = built.voxels;

  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  if (built.solid) {
    solidMesh = new THREE.Mesh(built.solid, solidMat);
    solidMesh.castShadow = true;
    solidMesh.receiveShadow = true;
    scene.add(solidMesh);
  }
  if (built.glow) {
    glowMesh = new THREE.Mesh(built.glow, glowMat);
    scene.add(glowMesh);
  }

  for (const L of marks.lights.slice(0, 4)) {
    const pl = new THREE.PointLight(L.color ?? 0xffb066, L.intensity, L.distance, 2);
    pl.position.set(L.x, L.y, L.z);
    scene.add(pl);
    pointLights.push({ light: pl, base: L.intensity });
  }

  applyPreset(preset);
  setupUI(buildMs);

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey);
  renderer.setAnimationLoop(loop);

  document.getElementById('loading').classList.add('hide');
  setTimeout(() => { const el = document.getElementById('loading'); if (el) el.remove(); }, 1200);
}

/* ------------------------------------------------------------------ */
function applyPreset(name) {
  preset = name;
  const P = PRESETS[name];
  sun.color.set(P.sun.color);
  sun.intensity = P.sun.intensity;
  const dir = new THREE.Vector3(...P.sun.dir).normalize();
  sun.position.copy(dir).multiplyScalar(520);
  hemi.color.set(P.hemi.sky);
  hemi.groundColor.set(P.hemi.ground);
  hemi.intensity = P.hemi.intensity;
  ambient.intensity = P.ambient;
  renderer.toneMappingExposure = P.exposure;

  if (P.fog) scene.fog = new THREE.Fog(P.fog.color, P.fog.near, P.fog.far);
  else scene.fog = null;

  if (skyMesh) {
    skyMesh.material.map?.dispose();
    skyMesh.material.map = makeSkyTexture(P.sky);
    skyMesh.material.needsUpdate = true;
  }
  if (sunSprite) {
    sunSprite.position.copy(dir).multiplyScalar(760);
    sunSprite.scale.setScalar(P.glow.size);
    sunSprite.material.color.set(P.glow.color);
    sunSprite.material.opacity = P.glow.opacity;
  }
  for (const p of pointLights) p.light.intensity = p.base * P.lantern;
  if (renderer) renderer.shadowMap.needsUpdate = true;   // 光源变了，重算一次阴影
  document.querySelectorAll('#times button').forEach((b) => b.classList.toggle('on', b.dataset.k === name));
  const info = document.getElementById('envName');
  if (info) info.textContent = P.label;
}

/* ------------------------------------------------------------------ */
function setupUI(buildMs) {
  const box = document.getElementById('times');
  for (const [k, P] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.textContent = P.label;
    b.dataset.k = k;
    b.onclick = () => applyPreset(k);
    box.appendChild(b);
  }
  const rot = document.getElementById('rotBtn');
  rot.onclick = () => { controls.autoRotate = !controls.autoRotate; rot.classList.toggle('on', controls.autoRotate); };
  rot.classList.toggle('on', controls.autoRotate);
  document.getElementById('voxInfo').textContent =
    `体素 ${stats.voxels.toLocaleString()} · 面 ${stats.quads.toLocaleString()} · 生成 ${buildMs.toFixed(0)}ms`;
}

function onKey(e) {
  if (e.key === ' ') { controls.autoRotate = !controls.autoRotate; document.getElementById('rotBtn').classList.toggle('on', controls.autoRotate); e.preventDefault(); }
  if (e.key === 'r' || e.key === 'R') { resetView(); }
  for (const [k, P] of Object.entries(PRESETS)) if (e.key === P.key) applyPreset(k);
}

function resetView() {
  camera.position.set(...OVERVIEW.pos);
  controls.target.set(...OVERVIEW.target);
  controls.update();
}

/* ------------------------------------------------------------------ */
let intro = { t: 0, dur: 3.2, done: false };
let last = performance.now();
let fpsAcc = 0, fpsFrames = 0, uiTimer = 0, warmup = 3;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (warmup > 0) { renderer.shadowMap.needsUpdate = true; warmup--; }

  if (!intro.done) {
    intro.t = Math.min(1, intro.t + dt / intro.dur);
    const e = intro.t < 0.5 ? 4 * intro.t ** 3 : 1 - Math.pow(-2 * intro.t + 2, 3) / 2;
    camera.position.set(
      INTRO_FROM[0] + (OVERVIEW.pos[0] - INTRO_FROM[0]) * e,
      INTRO_FROM[1] + (OVERVIEW.pos[1] - INTRO_FROM[1]) * e,
      INTRO_FROM[2] + (OVERVIEW.pos[2] - INTRO_FROM[2]) * e,
    );
    camera.lookAt(controls.target);
    if (intro.t >= 1) {
      intro.done = true;
      controls.enabled = true;
      controls.update();
    }
  } else {
    controls.update();
  }

  renderer.render(scene, camera);

  // 帧率统计 + 自适应分辨率（保证 ≥30fps）
  fpsAcc += dt; fpsFrames++; uiTimer += dt;
  if (uiTimer > 0.45) {
    const fps = fpsFrames / fpsAcc;
    stats.fps = fps;
    const el = document.getElementById('fps');
    if (el) el.textContent = `${fps.toFixed(0)} FPS · ${(1000 / fps).toFixed(1)} ms · ${(renderer.info.render.triangles / 1000).toFixed(0)}k 三角面 · ${renderer.info.render.calls} draw · ×${quality.pr.toFixed(2)}`;
    if (now - quality.cool > 1400) {
      if (fps < 28 && quality.pr > quality.min) {
        quality.pr = Math.max(quality.min, quality.pr - 0.1);
        renderer.setPixelRatio(quality.pr); quality.cool = now;
      } else if (fps > 57 && quality.pr < quality.target) {
        quality.pr = Math.min(quality.target, quality.pr + 0.06);
        renderer.setPixelRatio(quality.pr); quality.cool = now;
      }
    }
    fpsAcc = 0; fpsFrames = 0; uiTimer = 0;
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ------------------------------------------------------------------ */
requestAnimationFrame(() => requestAnimationFrame(init));

// 便于调试
window.__scene = () => ({ renderer, scene, camera, controls, stats, applyPreset, PRESETS });
