import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld } from './voxel.js';
import { buildScene } from './scene.js';
import { P } from './palette.js';

/* ---------- 渲染器 ---------- */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

/* ---------- 场景 / 晨昏天空 ---------- */
const scene = new THREE.Scene();
{
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#6f9fcf');   // 高空蓝
  grad.addColorStop(0.55, '#c9c0a4');
  grad.addColorStop(0.8, '#f0bd7e');   // 地平线暖橙（黄昏）
  grad.addColorStop(1.0, '#e8a765');
  g.fillStyle = grad; g.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
scene.fog = new THREE.Fog(0xe0b384, 170, 460);

/* ---------- 相机 / 控制器 ---------- */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(66, 52, 96);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 2);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 20;
controls.maxDistance = 260;
controls.autoRotate = true;            // 打开页面即缓慢环绕展示全貌
controls.autoRotateSpeed = 0.55;
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

/* ---------- 灯光：黄昏低角度暖阳 ---------- */
const sun = new THREE.DirectionalLight(0xffd9a0, 1.9);
sun.position.set(-85, 58, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.9;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd2e8, 0x8a7a5c, 0.72));
const fill = new THREE.DirectionalLight(0x9fb6d8, 0.35);   // 冷色补光拉开阴影层次
fill.position.set(60, 40, -70);
scene.add(fill);

/* ---------- 体素场景 ---------- */
const world = new VoxelWorld();
buildScene(world);
world.build(scene);
console.info(`[voxel] 体素总数: ${world.count}`);

/* ---------- 地面（草地大平面 + 隐形阴影接收） ---------- */
const grassMat = new THREE.MeshStandardMaterial({ color: P.grass, roughness: 1 });
const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(132, 1, 124), grassMat);
groundMesh.position.set(0, -0.02, 0); // 顶面 y=0.48：略低于 y=0 层铺装体素顶面，避免共面闪烁
groundMesh.receiveShadow = true;
scene.add(groundMesh);

/* ---------- FPS 统计 ---------- */
const fpsEl = document.getElementById('fps');
let frames = 0, last = performance.now();
setInterval(() => {
  const now = performance.now();
  fpsEl.textContent = `${Math.round(frames / ((now - last) / 1000))} FPS · ${world.count.toLocaleString()} voxels`;
  frames = 0; last = now;
}, 1000);

/* ---------- 主循环 ---------- */
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  frames++;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 调试钩子：便于外部脚本调整机位截图
window.__voxel = { camera, controls };
