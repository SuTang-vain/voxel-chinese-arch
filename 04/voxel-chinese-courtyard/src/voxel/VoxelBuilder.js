import * as THREE from 'three';
import { PALETTE, matClassOf, paletteIndex, hash3 } from './palette.js';

/* 坐标 → 唯一 key（位运算打包，比字符串快得多） */
export const keyOf = (x, y, z) => ((x + 512) * 1024 + (z + 512)) * 1024 + (y + 96);

export const NEIGHBORS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** 六邻域占用统计（剔除判定与伪 AO 共用同一份事实） */
export function neighborsOf(map, x, y, z) {
  let occ = 0, topEmpty = false, belowEmpty = false;
  for (const n of NEIGHBORS) {
    if (map.has(keyOf(x + n[0], y + n[1], z + n[2]))) occ++;
    else if (n[1] === 1) topEmpty = true;
    else if (n[1] === -1) belowEmpty = true;
  }
  return { occ, topEmpty, belowEmpty };
}

/**
 * 不可见体素判定（渲染与自检的唯一真源）：
 * · 六面被包住 → 剔除；
 * · 仅底面外露（铺装/水池之下，相机永远不会到地面以下）→ 剔除；
 * · 顶面外露的一律保留。
 */
export function cullVerdict(nb, cullBuried = true) {
  if (nb.occ === 6) return true;
  return cullBuried && nb.occ === 5 && nb.belowEmpty;
}

export function shouldCull(map, x, y, z, cullBuried = true) {
  return cullVerdict(neighborsOf(map, x, y, z), cullBuried);
}

/**
 * 体素构建器
 * ─────────────────────────────────────────────────────────
 * · 用 Map 存体素（同一坐标后写覆盖先写），构建完成后一次性转成
 *   InstancedMesh：按材质大类（哑光/高光/自发光/水面）分 4 个批次，
 *   逐实例颜色写在 instanceColor 上，包含伪 AO 与色阶抖动。
 * · 渲染批次 = 4，因此整座建筑群（十万级体素）只有个位数 draw call。
 */
export class VoxelBuilder {
  /** @param {boolean} resolve false 表示只记录（用于镜像拷贝的临时画板） */
  constructor(resolve = true) {
    this.resolve = resolve;
    this.map = new Map();
  }

  get count() {
    return this.map.size;
  }

  set(x, y, z, k, opts = {}) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (!PALETTE[k]) return; // 防御：未定义色卡直接忽略
    const key = keyOf(x, y, z);
    if (opts.ifEmpty && this.map.has(key)) return;
    if (!this.resolve) {
      this.map.set(key, { x, y, z, k, scale: opts.scale });
      return;
    }
    const shades = PALETTE[k].c;
    const s = shades.length > 1 ? hash3(x, y, z, paletteIndex(k)) % shades.length : 0;
    this.map.set(key, { x, y, z, k, s, scale: opts.scale });
  }

  del(x, y, z) {
    this.map.delete(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  /** 挖空（开门洞、窗洞用） */
  carve(x0, y0, z0, x1, y1, z1) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) this.del(x, y, z);
  }

  has(x, y, z) {
    return this.map.has(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  get(x, y, z) {
    return this.map.get(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  /* ─────────── 基本体块 ─────────── */

  /** 实心长方体（闭区间） */
  box(x0, y0, z0, x1, y1, z1, k, opts) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) this.set(x, y, z, k, opts);
  }

  /** 空心盒（四周墙体） */
  shell(x0, y0, z0, x1, y1, z1, k, opts) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) {
          if (x > ax && x < bx && z > az && z < bz) continue;
          this.set(x, y, z, k, opts);
        }
  }

  /** 水平铺装（单层） */
  plate(x0, z0, x1, z1, y, k, opts) {
    this.box(x0, y, z0, x1, y, z1, k, opts);
  }

  /** 水平边框（单层） */
  frame(x0, z0, x1, z1, y, k, opts) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++) {
      this.set(x, y, az, k, opts);
      this.set(x, y, bz, k, opts);
    }
    for (let z = az; z <= bz; z++) {
      this.set(ax, y, z, k, opts);
      this.set(bx, y, z, k, opts);
    }
  }

  /** 立柱：截面 size×size，从 y0 到 y1 */
  column(x, z, y0, y1, k, size = 1, opts) {
    const h = size >> 1;
    this.box(x - h, y0, z - h, x - h + size - 1, y1, z - h + size - 1, k, opts);
  }

  /** 檐柱排：沿一条边按 step 布置，外凸 1 格 */
  colonnade(axis, fixed, from, to, y0, y1, k, step = 4, outward = 1) {
    for (let v = from; v <= to; v += step) {
      if (axis === 'x') this.box(v, y0, fixed, v, y1, fixed, k);
      else this.box(fixed, y0, v, fixed, y1, v, k);
    }
  }

  /** 台阶：向 dir 方向逐级下降 */
  stairs(x0, x1, z0, z1, yTop, levels, dir, k, opts) {
    for (let i = 0; i < levels; i++) {
      const y = yTop - i - 1;
      if (dir === 'z+' || dir === 'z-') {
        const z = dir === 'z+' ? z1 + i : z0 - i;
        this.box(x0, y, z, x1, y, z, k, opts);
      } else {
        const x = dir === 'x+' ? x1 + i : x0 - i;
        this.box(x, y, z0, x, y, z1, k, opts);
      }
    }
  }

  /**
   * 石栏（望柱 + 栏板）：y 为栏板所在层，望柱为 y 与 y+1 两层
   * sides: 'n','s','e','w' 组合，例如 'nsw'
   */
  railing(x0, z0, x1, z1, y, kPost, kPanel, sides = 'nsew') {
    const seg = (ax, az, bx, bz, vertical) => {
      const n = vertical ? Math.abs(bz - az) : Math.abs(bx - ax);
      const sx = vertical ? 0 : Math.sign(bx - ax), sz = vertical ? Math.sign(bz - az) : 0;
      for (let i = 0; i <= n; i++) {
        const x = ax + sx * i, z = az + sz * i;
        // 望柱节拍只依赖「镜像不变量」的沿段坐标：
        // 横向段用 |x+0.5|（左右两侧柱位对齐），纵向段 z 在镜像下不变，用 z 本身
        const beat = vertical ? (((z % 3) + 3) % 3) : ((Math.abs(x + 0.5) | 0) % 3);
        const post = i === 0 || i === n || beat === 0;
        this.set(x, y, z, post ? kPost : kPanel);
        if (post) this.set(x, y + 1, z, kPost);
      }
    };
    if (sides.includes('n')) seg(x0, z0, x1, z0, false);
    if (sides.includes('s')) seg(x0, z1, x1, z1, false);
    if (sides.includes('w')) seg(x0, z0, x0, z1, true);
    if (sides.includes('e')) seg(x1, z0, x1, z1, true);
  }

  /* ─────────── 镜像 / 拷贝 ─────────── */

  /**
   * 把另一块画板（局部坐标）盖印到本画板。
   * mirrorX 时按中轴平面 x = -0.5 镜像：gx = -(x + dx) - 1
   */
  stamp(src, { dx = 0, dy = 0, dz = 0, mirrorX = false } = {}) {
    for (const b of src.map.values()) {
      const x = mirrorX ? -(b.x + dx) - 1 : b.x + dx;
      this.set(x, b.y + dy, b.z + dz, b.k, { scale: b.scale });
    }
  }

  /** 把本画板整体镜像到另一侧（建筑内部对称时用） */
  mirrorTo(dst) {
    for (const b of this.map.values()) {
      const x = -b.x - 1;
      dst.set(x, b.y, b.z, b.k);
    }
  }

  /* ─────────── 渲染 ─────────── */

  /**
   * 生成渲染分组：4 种材质 × InstancedMesh
   * @returns {{group: THREE.Group, stats: {total:number, visible:number, calls:number}}}
   */
  toObject3D({ blockScale = 0.985, ao = true, cullBuried = true } = {}) {
    const buckets = new Map(); // matClass -> array of {x,y,z,color}
    let total = 0;

    for (const b of this.map.values()) {
      total++;
      // 不可见体素剔除（判定逻辑见 cullVerdict，自检脚本用的是同一个函数）
      if (ao) {
        const nb = neighborsOf(this.map, b.x, b.y, b.z);
        if (cullVerdict(nb, cullBuried)) continue;
        b.occ = nb.occ;
      }
      const def = PALETTE[b.k];
      const cls = matClassOf(def);
      if (!buckets.has(cls)) buckets.set(cls, []);
      const hex = def.c[b.s ?? 0];
      // 伪 AO：暴露面越少越暗，增强体素堆叠的体积感
      let mul = 1;
      if (ao) mul = 0.87 + 0.027 * (6 - b.occ);
      const col = new THREE.Color(hex).multiplyScalar(Math.min(mul, 1.02));
      buckets.get(cls).push({ x: b.x, y: b.y, z: b.z, scale: b.scale ?? 1, color: col });
    }

    const group = new THREE.Group();
    group.name = 'voxel-world';
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // 复用模块级单例材质：setGlowIntensity/setWaterOpacity 改的就是这套对象，
    // 若在此处重新 makeMaterials()，两者指向不同实例，灯笼自发光与水面降级都会失效
    const mats = MATS;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    for (const [cls, list] of buckets) {
      const mesh = new THREE.InstancedMesh(geo, mats[cls], list.length);
      mesh.name = `voxels-${cls}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const s = blockScale * b.scale;
        pos.set(b.x, b.y, b.z);
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, b.color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    }

    return { group, stats: { total, visible: group.children.reduce((n, c) => n + c.count, 0), calls: group.children.length } };
  }
}

const MATS = makeMaterials();

/** 四种材质：哑光 / 高光 / 自发光 / 水面（自发光颜色随实例色） */
function makeMaterials() {
  const opaque = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const glossy = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.28, roughness: 0.42 });
  const glow = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.0 });
  glow.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      // 注意：three 启用 instanceColor 时 varying vColor 是 vec4，必须取 .rgb
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'
    );
  };
  const water = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.12,
    transparent: true,
    opacity: 0.86,
  });
  return { opaque, glossy, glow, water };
}

/** 统一设置灯笼自发光强度（黄昏点亮） */
export function setGlowIntensity(v) {
  MATS.glow.emissiveIntensity = v;
}

/** 水面在不透明/半透明间切换（低配降级时使用） */
export function setWaterOpacity(v) {
  MATS.water.opacity = v;
  MATS.water.transparent = v < 1;
  MATS.water.needsUpdate = true;
}
