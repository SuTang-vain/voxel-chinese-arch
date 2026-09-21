/**
 * lighting.js —— 晨昏光影预设 + 天空贴图 / 太阳辉光贴图
 */
import * as THREE from 'three';

export const PRESETS = {
  dawn: {
    label: '晨曦', key: '1',
    sun: { dir: [-0.78, 0.24, 0.58], color: 0xffc79c, intensity: 2.45 },
    hemi: { sky: 0xa6c8ec, ground: 0x6d5c46, intensity: 0.62 },
    ambient: 0.16,
    fog: { color: 0xdcd5c6, near: 330, far: 860 },
    sky: { top: 0x2c68b0, horizon: 0xf6dcbb, bottom: 0xc0ab92 },
    glow: { color: 0xffd9a8, size: 90, opacity: 0.8 },
    exposure: 1.0, lantern: 0.5,
  },
  noon: {
    label: '正午', key: '2',
    sun: { dir: [0.3, 0.92, 0.25], color: 0xfff4e2, intensity: 2.55 },
    hemi: { sky: 0xbfd8f2, ground: 0x7d6b52, intensity: 0.62 },
    ambient: 0.12,
    fog: { color: 0xd6e2ee, near: 340, far: 860 },
    sky: { top: 0x1f5fa8, horizon: 0xd2e2f2, bottom: 0xa8b6bd },
    glow: { color: 0xffffff, size: 54, opacity: 0.45 },
    exposure: 0.98, lantern: 0.2,
  },
  dusk: {
    label: '黄昏', key: '3',
    sun: { dir: [-0.72, 0.2, 0.66], color: 0xff9c52, intensity: 2.6 },
    hemi: { sky: 0x8fa4cc, ground: 0x6f4c34, intensity: 0.56 },
    ambient: 0.13,
    fog: { color: 0xd8b189, near: 330, far: 880 },
    sky: { top: 0x2a4a86, horizon: 0xf2ab68, bottom: 0x9a6a4a },
    glow: { color: 0xffb066, size: 130, opacity: 1.0 },
    exposure: 1.06, lantern: 1.3,
  },
  night: {
    label: '夜色', key: '4',
    sun: { dir: [-0.42, 0.5, 0.76], color: 0xa8bce8, intensity: 0.7 },
    hemi: { sky: 0x2b3c60, ground: 0x1a1a24, intensity: 0.45 },
    ambient: 0.11,
    fog: { color: 0x1c2438, near: 220, far: 660 },
    sky: { top: 0x070d1e, horizon: 0x26365a, bottom: 0x101828 },
    glow: { color: 0xcfe0ff, size: 40, opacity: 0.55 },
    exposure: 1.15, lantern: 2.4,
  },
};

/** 竖直渐变天空贴图（等距圆柱映射到天空球） */
export function makeSkyTexture(sky) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const hex = (v) => '#' + v.toString(16).padStart(6, '0');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.00, hex(sky.top));
  grd.addColorStop(0.34, hex(sky.top));
  grd.addColorStop(0.47, hex(sky.horizon));
  grd.addColorStop(0.53, hex(sky.horizon));
  grd.addColorStop(0.72, hex(sky.bottom));
  grd.addColorStop(1.00, hex(sky.bottom));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** 径向辉光贴图（太阳 / 光晕） */
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.06)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
