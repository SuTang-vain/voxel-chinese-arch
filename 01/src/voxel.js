/**
 * voxel.js — 体素世界（稀疏存储 + 隐藏面剔除 + 顶点 AO）
 *
 * 设计要点：
 *  1. 稀疏 Map 存储，key 为稠密整数（避免字符串 key 带来的 GC 压力）。
 *  2. 网格化时只输出「暴露面」——内部体素完全不产生三角形，
 *     这是体素场景能保持高帧率的关键（数十万体素 -> 仅数万面）。
 *  3. 每个顶点计算 Minecraft 风格 AO，并叠加法线方向明暗 + 位置抖动，
 *     使体素表面自带层次与肌理，无需任何贴图。
 *  4. 自发光体素（窗纸 / 灯笼）单独输出到第二个网格，用 Basic 材质渲染。
 */
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

const S = 512;
const YS = 512 * 512;
const OX = 256;
const OZ = 256;

/** 稠密整数 key（x,z ∈ [-256,255]，y ∈ [0,1023]） */
export function vkey(x, y, z) {
  return x + OX + S * (z + OZ) + YS * y;
}

/** 确定性哈希（无随机数状态，保证每次构建结果一致） */
export function hash3(x, y, z) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** 颜色规格：number | number[] | (x,y,z)=>number */
export function pick(spec, x, y, z) {
  if (typeof spec === 'number') return spec;
  if (typeof spec === 'function') return spec(x, y, z);
  return spec[(hash3(x, y, z) * spec.length) | 0] || spec[0];
}

export class VoxelWorld {
  constructor() {
    /** @type {Map<number, number>} key -> (glow<<24 | rgb) */
    this.map = new Map();
    this.groundSolid = true; // y < 0 视为实心：省掉地面层整片底面
  }

  get(x, y, z) {
    return this.map.get(vkey(x, y, z)) ?? -1;
  }

  solid(x, y, z) {
    if (y < 0) return this.groundSolid;
    return this.map.has(vkey(x, y, z));
  }

  set(x, y, z, color, glow = false) {
    if (y < 0) return;
    this.map.set(vkey(x, y, z), glow ? color | 0x1000000 : color);
  }

  del(x, y, z) {
    this.map.delete(vkey(x, y, z));
  }

  /** 实心长方体（含端点）；color 支持 number / array / function */
  fill(x0, y0, z0, x1, y1, z1, color, glow = false) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++)
        for (let x = ax; x <= bx; x++) this.set(x, y, z, pick(color, x, y, z), glow);
  }

  /** 挖空（含端点） */
  clear(x0, y0, z0, x1, y1, z1) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.del(x, y, z);
  }

  /** 单层矩形环（斗拱 / 栏杆 / 瓦垄边） */
  ring(y, x0, z0, x1, z1, color, glow = false) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let x = ax; x <= bx; x++) {
      this.set(x, y, az, pick(color, x, y, az), glow);
      this.set(x, y, bz, pick(color, x, y, bz), glow);
    }
    for (let z = az + 1; z <= bz - 1; z++) {
      this.set(ax, y, z, pick(color, ax, y, z), glow);
      this.set(bx, y, z, pick(color, bx, y, z), glow);
    }
  }

  /** 单层矩形面 */
  rect(y, x0, z0, x1, z1, color, glow = false) {
    this.fill(x0, y, z0, x1, y, z1, color, glow);
  }

  static inOct(dx, dz, r) {
    if (r <= 0) return false;
    return Math.abs(dx) <= r && Math.abs(dz) <= r && Math.abs(dx) + Math.abs(dz) <= Math.round(r * 1.42);
  }

  /** 八边形实体（塔 / 亭） */
  octFill(cx, y, cz, r, color, glow = false) {
    const R = Math.ceil(r);
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++)
        if (VoxelWorld.inOct(dx, dz, r)) this.set(cx + dx, y, cz + dz, pick(color, cx + dx, y, cz + dz), glow);
  }

  /** 八边形环 */
  octRing(cx, y, cz, r, color, glow = false) {
    const R = Math.ceil(r);
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) {
        if (!VoxelWorld.inOct(dx, dz, r)) continue;
        if (VoxelWorld.inOct(dx, dz, r - 1)) continue;
        this.set(cx + dx, y, cz + dz, pick(color, cx + dx, y, cz + dz), glow);
      }
  }

  stats() {
    let glow = 0;
    for (const v of this.map.values()) if (v & 0x1000000) glow++;
    return { voxels: this.map.size, glow };
  }

  /** 实际体素包围盒 */
  bounds() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of this.map.keys()) {
      const y = Math.floor(k / YS);
      const rest = k - y * YS;
      const z = Math.floor(rest / S) - OZ;
      const x = (rest % S) - OX;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    return { x0, x1, y0, y1, z0, z1 };
  }
}

/* ------------------------------------------------------------------ */
/*  几何烘焙                                                            */
/* ------------------------------------------------------------------ */

// n 法线 / u 切向 / v = n × u（保证 (u,v,n) 右手系 => 从外侧看逆时针缠绕）
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], shade: 0.92 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.92 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], shade: 1.0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.52 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.82 },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0], shade: 0.82 },
];

const AO_LEVEL = [0.62, 0.79, 0.91, 1.0];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// sRGB hex -> linear rgb 缓存（顶点色在线性空间参与光照）
const linCache = new Map();
const _c = new Color();
function lin(hex) {
  let v = linCache.get(hex);
  if (v === undefined) {
    _c.setHex(hex);
    v = [_c.r, _c.g, _c.b];
    linCache.set(hex, v);
  }
  return v;
}

/**
 * 把体素世界烘焙为 BufferGeometry（solid: 受光材质 / glow: 自发光材质）
 */
export function buildGeometry(world) {
  const mk = () => ({ pos: [], nor: [], col: [], idx: [], faces: 0 });
  const solid = mk();
  const glow = mk();
  const map = world.map;
  const isSolid = (x, y, z) => (y < 0 ? world.groundSolid : map.has(vkey(x, y, z)));

  for (const [k, value] of map) {
    const y = Math.floor(k / YS);
    const rest = k - y * YS;
    const z = Math.floor(rest / S) - OZ;
    const x = (rest % S) - OX;

    const g = value & 0x1000000 ? glow : solid;
    const [cr, cg, cb] = lin(value & 0xffffff);
    const jitter = 0.945 + hash3(x, y, z) * 0.11;
    const base = g.pos.length / 3;

    for (let f = 0; f < 6; f++) {
      const { n, u, v, shade } = FACES[f];
      const nx = x + n[0], ny = y + n[1], nz = z + n[2];
      if (isSolid(nx, ny, nz)) continue; // 隐藏面剔除

      const cx = x + 0.5 + n[0] * 0.5;
      const cy = y + 0.5 + n[1] * 0.5;
      const cz = z + 0.5 + n[2] * 0.5;

      for (let i = 0; i < 4; i++) {
        const su = CORNERS[i][0], sv = CORNERS[i][1];
        const s1 = isSolid(nx + u[0] * su, ny + u[1] * su, nz + u[2] * su) ? 1 : 0;
        const s2 = isSolid(nx + v[0] * sv, ny + v[1] * sv, nz + v[2] * sv) ? 1 : 0;
        const cc = isSolid(
          nx + u[0] * su + v[0] * sv,
          ny + u[1] * su + v[1] * sv,
          nz + u[2] * su + v[2] * sv,
        ) ? 1 : 0;
        const m = shade * AO_LEVEL[s1 && s2 ? 0 : 3 - (s1 + s2 + cc)] * jitter;

        g.pos.push(
          cx + (u[0] * su + v[0] * sv) * 0.5,
          cy + (u[1] * su + v[1] * sv) * 0.5,
          cz + (u[2] * su + v[2] * sv) * 0.5,
        );
        g.nor.push(n[0], n[1], n[2]);
        g.col.push(cr * m, cg * m, cb * m);
      }
      g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      g.faces++;
    }
  }

  const toGeometry = (g) => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(Float32Array.from(g.pos), 3));
    geo.setAttribute('normal', new Float32BufferAttribute(Float32Array.from(g.nor), 3));
    geo.setAttribute('color', new Float32BufferAttribute(Float32Array.from(g.col), 3));
    geo.setIndex(g.idx);
    geo.computeBoundingSphere();
    return geo;
  };

  return { solid: toGeometry(solid), glow: toGeometry(glow), faces: solid.faces + glow.faces };
}
