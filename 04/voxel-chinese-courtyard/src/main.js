/**
 * 体素中式古建群 · 主程序
 * ─────────────────────────────────────────────────────────
 * 场景装配顺序：场地 → 建筑 → 陈设 → 体素合并（InstancedMesh）
 *               → 天光（晨曦/正午/黄昏）→ 云 → 相机巡航
 * 全场景仅 4 个体素材质批次（哑光/高光/自发光/水面），十万级体素亦只需
 * 个位数 draw call；太阳阴影只在切换时辰时重算。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelBuilder, setGlowIntensity } from './voxel/VoxelBuilder.js';
import { assembleWorld, STAGES } from './scene/assemble.js';
import { SkyRig } from './scene/sky.js';
import { makeClouds } from './scene/clouds.js';

const app = document.getElementById('app');
const bootEl = document.getElementById('boot');
const bootBar = document.getElementById('bootbar');
const bootText = document.getElementById('boottext');
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const setBoot = (p, t) => { bootBar.style.width = `${Math.round(p * 100)}%`; if (t) bootText.textContent = t; };

/* ───────────── 渲染器 ───────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;      // 静态场景：按需重算
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

/* ───────────── 相机与控制器 ───────────── */
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 1, 6000);
const TARGET = new THREE.Vector3(0, 18, -24);
camera.position.set(330, 250, 420);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 45;
controls.maxDistance = 520;
controls.maxPolarAngle = Math.PI * 0.492;
controls.autoRotateSpeed = 0.28;
controls.enablePan = true;
controls.enabled = false;   // 开场动画期间关闭

/* ───────────── 场景装配 ───────────── */
await nextFrame();
const world = new VoxelBuilder(true);
await assembleWorld(world, { onStage: (i, stage) => setBoot(0.12 + i * 0.26, stage.label), yieldTo: nextFrame });

setBoot(0.84, '合并体素…');
const { group: voxelGroup, stats } = world.toObject3D({ blockScale: 0.985, ao: true });
scene.add(voxelGroup);

/* 大地面：填补体素块缝隙并延伸至雾外，避免露出“悬浮板”边缘 */
const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(9000, 9000),
  new THREE.MeshLambertMaterial({ color: 0x4a6633 })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.49;
groundPlane.receiveShadow = false;
scene.add(groundPlane);

/* ───────────── 天光与云 ───────────── */
setBoot(0.92, '点灯、布光…');
const sky = new SkyRig(scene, renderer);
const clouds = makeClouds(scene, 8);

/* ───────────── 交互 ───────────── */
let cruise = true;           // 自动环绕
let lastTouch = -1e9;        // 最近一次用户操作时间
let intro = { t: 0, dur: 7.5, played: false };

const spherical = new THREE.Spherical();
controls.addEventListener('start', () => { lastTouch = clock.elapsedTime; });
controls.addEventListener('end', () => { lastTouch = clock.elapsedTime; });

document.querySelectorAll('#timebar button').forEach((btn) => {
  btn.addEventListener('click', () => selectSky(btn.dataset.sky));
});
addEventListener('keydown', (e) => {
  if (e.key === '1') selectSky('dawn');
  else if (e.key === '2') selectSky('noon');
  else if (e.key === '3') selectSky('dusk');
  else if (e.key === 'r' || e.key === 'R') {
    cruise = !cruise;
    controls.autoRotate = cruise && !intro.played;
  }
});

function selectSky(key) {
  sky.set(key);
  document.querySelectorAll('#timebar button').forEach((b) => b.classList.toggle('on', b.dataset.sky === key));
}

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ───────────── 帧循环 ───────────── */
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps');
const voxEl = document.getElementById('vox');
const callsEl = document.getElementById('calls');
voxEl.textContent = stats.visible.toLocaleString() + ' / ' + stats.total.toLocaleString();

let frames = 0, acc = 0, fpsShown = 0;
let perfSamples = 0, perfAcc = 0, degraded = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = clock.elapsedTime;

  // 开场：由高空缓缓推进到全景
  if (!intro.played) {
    intro.t = Math.min(1, intro.t + dt / intro.dur);
    const e = 1 - Math.pow(1 - intro.t, 3);
    const r = 640 + (228 - 640) * e;
    const phi = 0.48 + (1.14 - 0.48) * e;
    const theta = 0.8 + (0.48 - 0.8) * e;
    spherical.set(r, phi, theta);
    camera.position.copy(TARGET).add(new THREE.Vector3().setFromSpherical(spherical));
    camera.lookAt(TARGET);
    if (intro.t >= 1) {
      intro.played = true;
      controls.enabled = true;
      controls.autoRotate = cruise;
      controls.update();
    }
  } else {
    // 用户操作后暂停巡航，静置 9 秒自动恢复
    if (cruise && !controls.autoRotate && now - lastTouch > 9) controls.autoRotate = true;
    controls.update();
  }

  // 云飘移
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 470) c.position.x = -470;
  }

  // 天光过渡
  const skyChanging = sky.update(dt);
  setGlowIntensity(sky.lantern);
  if (skyChanging) renderer.shadowMap.needsUpdate = true;

  renderer.render(scene, camera);

  // HUD
  frames++; acc += dt;
  if (acc >= 0.5) {
    fpsShown = Math.round(frames / acc);
    fpsEl.textContent = fpsShown;
    callsEl.textContent = renderer.info.render.calls;
    frames = 0; acc = 0;
  }

  // 自适应画质：持续掉帧则降分辨率 / 降阴影
  if (now > 3 && degraded < 2) {
    perfSamples++; perfAcc += dt;
    if (perfSamples >= 120) {
      const avg = perfAcc / perfSamples;
      perfSamples = 0; perfAcc = 0;
      if (avg > 0.034) {
        degraded++;
        if (degraded === 1) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
          sky.sun.shadow.mapSize.set(2048, 2048);
          if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
        } else {
          renderer.setPixelRatio(1);
          renderer.shadowMap.enabled = false;
        }
        renderer.shadowMap.needsUpdate = true;
      }
    }
  }
}

/* 首帧渲染后收起启动遮罩 */
setBoot(1, '入画');
renderer.shadowMap.needsUpdate = true;
renderer.render(scene, camera);
await nextFrame();
bootEl.classList.add('hide');
setTimeout(() => bootEl.remove(), 1000);

// 调试/截图入口
window.__vcc = { THREE, scene, camera, controls, renderer, sky, voxelGroup, stats, TARGET };
animate();
