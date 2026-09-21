/**
 * voxel.js —— 体素网格数据 + 面剔除网格化（mesher）
 *
 * 设计要点：
 *  - 用一个 Uint32Array 存整个场景（稀疏度靠位运算压缩），比 Map<string,color> 快得多也省内存。
 *  - 每个格子 32 位：bit24 = 是否自发光，低 24 位 = RGB 颜色。0 表示空气。
 *  - 网格化时只输出「暴露面」（邻居为空的 6 个面），内部体素完全不产生三角形，
 *    所以哪怕场景有几十万个体素，最终三角面也只有几万个 → 帧率稳定。
 *  - 顶点色里直接烘焙进方向性明暗（顶面最亮、底面最暗），即使背光也有体素体积感。
 */
import * as THREE from 'three';

export const EMISSIVE = 0x01000000;

/** 六个面：顶点顺序保证逆时针（从外面看），法线朝外 */
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.94 }, // +X
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.86 }, // -X
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },  // +Y
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.68 }, // -Y
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.98 },  // +Z
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.80 }, // -Z
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class VoxelGrid {
  constructor({ x0, x1, y0, y1, z0, z1 }) {
    this.x0 = x0; this.y0 = y0; this.z0 = z0;
    this.sx = x1 - x0 + 1; this.sy = y1 - y0 + 1; this.sz = z1 - z0 + 1;
    this.data = new Uint32Array(this.sx * this.sy * this.sz);
    this.count = 0;              // 已放置体素数
    this.lo = { x: x1, y: y1, z: z1 };
    this.hi = { x: x0, y: y0, z: z0 };
    this.random = mulberry32(20240501);
  }

  idx(x, y, z) {
    return (x - this.x0) + this.sx * ((y - this.y0) + this.sy * (z - this.z0));
  }
  inside(x, y, z) {
    return x >= this.x0 && x < this.x0 + this.sx &&
           y >= this.y0 && y < this.y0 + this.sy &&
           z >= this.z0 && z < this.z0 + this.sz;
  }
  /** 稳定哈希，保证同一坐标每次运行抖动一致 */
  hash3(x, y, z) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  get(x, y, z) {
    return this.inside(x, y, z) ? this.data[this.idx(x, y, z)] : 0;
  }
  solid(x, y, z) {
    return (this.get(x, y, z) & 0xffffff) !== 0;
  }
  /** 网格外一律当作实心：世界边缘不再产生朝外的面 */
  solidOrOutside(x, y, z) {
    if (!this.inside(x, y, z)) return true;
    return (this.data[this.idx(x, y, z)] & 0xffffff) !== 0;
  }

  /** 挖空一个格子（用于水池等） */
  clear(x, y, z) {
    if (!this.inside(x, y, z)) return;
    const i = this.idx(x, y, z);
    if ((this.data[i] & 0xffffff) !== 0) { this.data[i] = 0; this.count--; }
  }
  clearBox(x0, x1, y0, y1, z0, z1) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.clear(x, y, z);
  }

  set(x, y, z, color, opts = {}) {
    x |= 0; y |= 0; z |= 0;
    if (!this.inside(x, y, z)) return;
    const jitter = opts.jitter || 0;
    if (jitter) color = jitterColor(color, 1 + (this.hash3(x, y, z) * 2 - 1) * jitter);
    const v = (color & 0xffffff) || 0x010101;
    const i = this.idx(x, y, z);
    const prev = this.data[i];
    this.data[i] = v | (opts.emissive ? EMISSIVE : 0);
    if (!(prev & 0xffffff)) this.count++;
    // 维护包围盒，加速网格化
    if (x < this.lo.x) this.lo.x = x; if (x > this.hi.x) this.hi.x = x;
    if (y < this.lo.y) this.lo.y = y; if (y > this.hi.y) this.hi.y = y;
    if (z < this.lo.z) this.lo.z = z; if (z > this.hi.z) this.hi.z = z;
  }

  /** 闭区间填充 x0..x1, y0..y1, z0..z1 */
  fill(x0, x1, y0, y1, z0, z1, color, opts = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.set(x, y, z, color, opts);
  }

  /** 只画盒子外壳（省体素，用于围墙 / 建筑外墙等不需要实心的地方） */
  shell(x0, x1, y0, y1, z0, z1, color, opts = {}) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const edge = (x === x0 || x === x1) || (y === y0 || y === y1) || (z === z0 || z === z1);
          if (edge) this.set(x, y, z, color, opts);
        }
  }

  /** 某一层（y 平面）上的「回」字形环 */
  ring(y, x0, x1, z0, z1, color, opts = {}, thickness = 1) {
    for (let t = 0; t < thickness; t++) {
      this.fill(x0 + t, x1 - t, y, y, z0 + t, z0 + t, color, opts);
      this.fill(x0 + t, x1 - t, y, y, z1 - t, z1 - t, color, opts);
      this.fill(x0 + t, x0 + t, y, y, z0 + t, z1 - t, color, opts);
      this.fill(x1 - t, x1 - t, y, y, z0 + t, z1 - t, color, opts);
    }
  }

  /** 水平矩形（一层） */
  plate(y, x0, x1, z0, z1, color, opts = {}) {
    this.fill(x0, x1, y, y, z0, z1, color, opts);
  }

  /** 竖直柱子 */
  post(x, z, y0, y1, color, opts = {}) {
    this.fill(x, x, y0, y1, z, z, color, opts);
  }
}

function jitterColor(color, f) {
  let r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  r = Math.max(1, Math.min(255, Math.round(r * f)));
  g = Math.max(1, Math.min(255, Math.round(g * f)));
  b = Math.max(1, Math.min(255, Math.round(b * f)));
  return (r << 16) | (g << 8) | b;
}

/**
 * 把体素网格转成两个 BufferGeometry：受光实体 + 自发光（灯笼 / 窗户）。
 * 返回 { solid, glow, quads, voxels }
 */
export function buildVoxelMeshes(grid) {
  const { lo, hi } = grid;
  const buckets = [
    { pos: [], nor: [], col: [], idx: [], quads: 0 }, // 0 受光
    { pos: [], nor: [], col: [], idx: [], quads: 0 }, // 1 自发光
  ];
  const c = { r: 0, g: 0, b: 0 };

  for (let z = lo.z; z <= hi.z; z++) {
    for (let y = lo.y; y <= hi.y; y++) {
      for (let x = lo.x; x <= hi.x; x++) {
        const v = grid.get(x, y, z);
        const rgb = v & 0xffffff;
        if (!rgb) continue;
        const b = buckets[(v & EMISSIVE) ? 1 : 0];
        c.r = ((rgb >> 16) & 255) / 255;
        c.g = ((rgb >> 8) & 255) / 255;
        c.b = (rgb & 255) / 255;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          if (grid.solidOrOutside(x + F.n[0], y + F.n[1], z + F.n[2])) continue;
          const base = b.pos.length / 3;
          const sh = F.s;
          for (let k = 0; k < 4; k++) {
            const p = F.v[k];
            b.pos.push(x + p[0], y + p[1], z + p[2]);
            b.nor.push(F.n[0], F.n[1], F.n[2]);
            b.col.push(c.r * sh, c.g * sh, c.b * sh);
          }
          b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          b.quads++;
        }
      }
    }
  }

  const make = (b) => {
    if (!b.quads) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    geo.computeBoundingSphere();
    b.pos = b.nor = b.col = b.idx = null; // 释放
    return geo;
  };

  return {
    solid: make(buckets[0]),
    glow: make(buckets[1]),
    quads: buckets[0].quads + buckets[1].quads,
    voxels: grid.count,
  };
}
