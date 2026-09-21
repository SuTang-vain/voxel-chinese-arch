/**
 * main.js — 组装：体素世界 -> 烘焙几何 -> 场景 -> 交互
 */
import * as THREE from 'three';
import { VoxelWorld, buildGeometry } from './voxel.js';
import { buildTemple } from './temple.js';
import { createScene, PRESETS } from './scene.js';

const DEG = Math.PI / 180;

/* ---------------- 1. 建造体素世界 ---------------- */
const t0 = performance.now();
const world = new VoxelWorld();
buildTemple(world);
const t1 = performance.now();
const { solid, glow, faces } = buildGeometry(world);
const t2 = performance.now();
const vstats = world.stats();

/* ---------------- 2. 场景 ---------------- */
const env = createScene(document.getElementById('app'));
const { renderer, scene, camera, controls } = env;

const matSolid = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  metalness: 0.0,
  dithering: true,
});
const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true });

const meshSolid = new THREE.Mesh(solid, matSolid);
meshSolid.castShadow = true;
meshSolid.receiveShadow = true;
scene.add(meshSolid);

const meshGlow = new THREE.Mesh(glow, matGlow);
meshGlow.castShadow = false;
meshGlow.receiveShadow = false;
scene.add(meshGlow);

/* ---------------- 3. 视角 ---------------- */
// 用“每列最高体素”的采样点做相机拟合：中轴高、院墙低，几何上更紧
function heightSamples(world, stride = 4) {
  const YS = 512 * 512, S = 512, O = 256;
  const top = new Map();
  for (const k of world.map.keys()) {
    const y = Math.floor(k / YS);
    const rest = k - y * YS;
    const xz = rest;
    const prev = top.get(xz);
    if (prev === undefined || y > prev) top.set(xz, y);
  }
  const pts = [];
  for (const [xz, y] of top) {
    const z = Math.floor(xz / S) - O;
    const x = (xz % S) - O;
    if (((x % stride) + stride) % stride !== 0) continue;
    if (((z % stride) + stride) % stride !== 0) continue;
    if (y <= 1) continue; // 纯地面列不计入：允许草地被裁切，建筑才充满画面
    pts.push(new THREE.Vector3(x, y + 1, z));
  }
  return pts;
}
env.setFitPoints(heightSamples(world, 4));

const AZ_END = 42 * DEG;
const EL_END = 30 * DEG;
const dirEnd = new THREE.Vector3(
  Math.sin(AZ_END) * Math.cos(EL_END),
  Math.sin(EL_END),
  Math.cos(AZ_END) * Math.cos(EL_END),
).normalize();

const dFinal = env.fitDistance(dirEnd, 0.93);
const AZ_START = AZ_END - 34 * DEG;
const EL_START = 58 * DEG;
const dStart = dFinal * 1.7;

function placeCamera(az, el, dist) {
  const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  camera.position.copy(controls.target).addScaledVector(d, dist);
  camera.lookAt(controls.target);
}
placeCamera(AZ_START, EL_START, dStart);

/* ---------------- 4. 入场动画 ---------------- */
let intro = 0;
const INTRO_MS = 3200;
let started = false;
let userTouched = false;
controls.enabled = false;
controls.autoRotate = false;

function updateIntro(dt) {
  if (intro >= 1) return;
  intro = Math.min(1, intro + (dt * 1000) / INTRO_MS);
  const e = 1 - Math.pow(1 - intro, 3);
  placeCamera(
    AZ_START + (AZ_END - AZ_START) * e,
    EL_START + (EL_END - EL_START) * e,
    dStart + (dFinal - dStart) * e,
  );
  if (intro >= 1 && !started) {
    started = true;
    controls.enabled = true;
    controls.autoRotate = true;
    controls.update();
  }
}

/* ---------------- 5. 界面 ---------------- */
const timesEl = document.getElementById('times');
let currentTime = 'dawn';
for (const key of Object.keys(PRESETS)) {
  const b = document.createElement('button');
  b.textContent = PRESETS[key].label;
  b.dataset.key = key;
  b.className = key === currentTime ? 'on' : '';
  b.onclick = () => {
    currentTime = key;
    env.setTimeOfDay(key);
    [...timesEl.children].forEach((c) => c.classList.toggle('on', c.dataset.key === key));
  };
  timesEl.appendChild(b);
}
env.setTimeOfDay(currentTime);

const btnRotate = document.getElementById('btnRotate');
btnRotate.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle('on', controls.autoRotate);
};
const btnShadow = document.getElementById('btnShadow');
let shadowsOn = true;
btnShadow.onclick = () => {
  shadowsOn = !shadowsOn;
  env.sun.castShadow = shadowsOn;
  matSolid.needsUpdate = true;
  btnShadow.classList.toggle('on', shadowsOn);
};

controls.addEventListener('start', () => {
  userTouched = true;
  if (controls.autoRotate) {
    controls.autoRotate = false;
    btnRotate.classList.remove('on');
  }
  if (intro < 1) {
    intro = 1;
    started = true;
    controls.enabled = true;
  }
});

// 窗口变化时重新拟合取景（用户手动操作过则尊重其视角）
let refitTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => {
    if (userTouched || intro < 1) return;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = env.fitDistance(dir, 0.93);
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    controls.update();
  }, 180);
});

const statsEl = document.getElementById('stats');
const info = `${vstats.voxels.toLocaleString()} 体素 · ${faces.toLocaleString()} 面 · 建造 ${(t1 - t0).toFixed(0)}ms + 烘焙 ${(t2 - t1).toFixed(0)}ms`;

/* ---------------- 6. 渲染循环 ---------------- */
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsShown = 0, statTimer = 0;
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();

  updateIntro(dt);
  env.applyTransition(dt);
  controls.update();
  renderer.render(scene, camera);

  // FPS
  const frameMs = now - last;
  last = now;
  fpsAcc += 1000 / Math.max(frameMs, 1);
  fpsN++;
  statTimer += dt;
  if (statTimer > 0.5) {
    fpsShown = Math.round(fpsAcc / Math.max(fpsN, 1));
    fpsAcc = 0;
    fpsN = 0;
    statTimer = 0;
    statsEl.textContent = `${fpsShown} FPS · ${info} · 绘制调用 ${renderer.info.render.calls}`;
  }
}

renderer.render(scene, camera);
requestAnimationFrame(tick);
document.getElementById('loading').classList.add('hide');
document.title = `紫微宫 · ${vstats.voxels.toLocaleString()} 体素`;

// 调试入口
window.__temple = { env, world, meshSolid, camera, controls, faces, vstats, dFinal };

console.log('[voxel-temple]', {
  voxels: vstats.voxels,
  glowVoxels: vstats.glow,
  faces,
  triangles: renderer.info.render.triangles,
  buildMs: +(t1 - t0).toFixed(1),
  bakeMs: +(t2 - t1).toFixed(1),
  cameraDistance: +dFinal.toFixed(1),
});
