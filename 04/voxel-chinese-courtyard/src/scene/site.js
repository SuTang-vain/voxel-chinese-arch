/**
 * 场地营造：草地、铺装、御路、院墙、放生池、林木、远山。
 * 与建筑群共用同一体素画板，先铺地再起楼，保证衔接自然。
 */
import { LAYOUT as L } from './layout.js';
import { pineTree, broadTree, mulberry } from '../voxel/detail.js';

/** 铺装：两尺方砖（2×2 一格换色），并以“散水”收边 */
function pave(b, x0, z0, x1, z1, { border = true } = {}) {
  const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
  const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
  for (let x = ax; x <= bx; x++) {
    for (let z = az; z <= bz; z++) {
      const edge = x === ax || x === bx || z === az || z === bz;
      if (edge && border) { b.set(x, 1, z, 'stone2'); continue; }
      // 方砖错缝：x 方向用镜像不变量 |x+0.5|，保证中轴左右砖缝对齐
      const mx = (Math.abs(x + 0.5) | 0) >> 1;
      b.set(x, 1, z, ((mx + (z >> 1)) & 1) ? 'paving' : 'paving2');
    }
  }
}

/** 草地：带深浅斑块，边缘处逐渐消隐，使体素地面自然融入远景地面 */
function grassField(b, x0, z0, x1, z1, rnd, skip) {
  const feather = 10;
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      if (skip && skip(x, z)) continue;
      // 与地块边缘的距离 → 生成概率（碎边效果）
      const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      if (edge < feather && rnd() > 0.25 + 0.075 * edge) continue;
      const n = rnd();
      b.set(x, 0, z, n > 0.86 ? 'grass2' : 'grass');
      // 草丛点缀
      if (n > 0.968) b.set(x, 1, z, n > 0.986 ? 'leaf' : 'grass2');
    }
  }
}

/** 一段院墙（厚 2 格）+ 瓦顶压顶 */
function wallRun(b, x0, z0, x1, z1) {
  b.box(x0, 1, z0, x1, 6, z1, 'wallRed');
  b.box(x0, 6, z0, x1, 6, z1, 'wallRed2');
  const pad = (v) => 1;
  b.box(x0 - pad(), 7, z0 - pad(), x1 + pad(), 7, z1 + pad(), 'tileGray2');
  b.box(x0, 8, z0, x1, 8, z1, 'tileGray');
  if (x1 - x0 > 0) { b.box(x0, 5, z0, x1, 5, z1, 'brick'); }
}

/** 墙上一座小门楼（掖门） */
function sideDoor(b, x, z) {
  b.carve(x - 1, 1, z - 2, x + 1, 4, z + 3);
  b.box(x - 2, 5, z - 3, x + 2, 5, z + 4, 'wood2');
  b.box(x - 2, 6, z - 3, x + 2, 6, z + 4, 'wallRed2');
  b.box(x - 3, 7, z - 4, x + 3, 7, z + 5, 'tileGray2');
  b.box(x - 2, 8, z - 3, x + 2, 8, z + 4, 'tileGray');
  b.set(x - 1, 9, z - 1, 'tileGray'); b.set(x + 1, 9, z - 1, 'tileGray');
  b.set(x - 1, 9, z + 2, 'tileGray'); b.set(x + 1, 9, z + 2, 'tileGray');
}

/* ═══════════════════ 院墙 ═══════════════════ */
function enclosure(b) {
  const W = L.wall;
  // 东西院墙
  for (const [a0, a1] of [[W.x0, W.x0 + 1], [W.x1 - 1, W.x1]]) {
    wallRun(b, a0, W.zBack, a1, W.zFront + 1);
  }
  // 后墙
  wallRun(b, W.x0, W.zBack, W.x1, W.zBack + 1);
  // 前墙（山门两侧）
  wallRun(b, W.x0, W.zFront, L.gate.x0 - 1, W.zFront + 1);
  wallRun(b, L.gate.x1 + 1, W.zFront, W.x1, W.zFront + 1);
  // 掖门
  sideDoor(b, -40, W.zFront);
  sideDoor(b, 39, W.zFront);
}

/* ═══════════════════ 放生池 ═══════════════════ */
function pond(b, rnd) {
  const P = L.pond;
  const [ax, bx] = [P.x0, P.x1];
  const [az, bz] = [P.z0, P.z1];
  for (let x = ax - 2; x <= bx + 2; x++) {
    for (let z = az - 2; z <= bz + 2; z++) {
      const inner = x >= ax && x <= bx && z >= az && z <= bz;
      b.set(x, 1, z, inner ? 'water' : 'stone2');
      if (inner) {
        b.set(x, 0, z, 'soil');
        // 固定每格两次 rnd()：调用次数一变，下游林木/云的随机序列整体移位
        // （实测移位后有一棵树冠落进院墙，被 axis-symmetry 抓到）
        const isPad = rnd() > 0.88;                       // 荷叶 ~12%
        if (isPad) b.set(x, 1, z, 'lotus');
        const flowers = rnd() > 0.75;
        if (isPad && flowers) b.set(x, 2, z, 'blossom');  // 花只开在荷叶上
      } else if (x === ax - 2 || x === bx + 2 || z === az - 2 || z === bz + 2) {
        b.set(x, 2, z, 'stone');   // 池沿
      }
    }
  }
  // 矮石栏：沿池沿立望柱 + 栏板；朝御路的一侧（西）留口，便于观鱼与取水。
  // 望柱节拍用 |x+0.5|，镜像后左右柱位对齐（见 VoxelBuilder.railing）。
  b.railing(ax - 2, az - 2, bx + 2, bz + 2, 2, 'marble', 'marble', 'nse');
}

/* ═══════════════════ 林木 ═══════════════════ */
const TREE_PAIRS = [
  // [东侧 x, z, 类型] —— 西侧由镜像生成
  [46, 40, 'pine'], [47, 32, 'broad'], [45, 20, 'pine'],
  [46, 2, 'broad'], [47, -22, 'pine'], [44, -40, 'broad'],
  [40, 60, 'pine'], [30, 62, 'broad'],
  [30, -72, 'pine'], [22, -66, 'broad'], [16, -96, 'pine'],
  [34, -98, 'pine'], [12, -70, 'pine'],
];

const BUILT_KEYS = new Set(['paving', 'paving2', 'stone', 'stone2', 'marble', 'brick', 'wallRed', 'wallRed2', 'tileGray', 'tileGray2', 'tileGreen', 'tileGreen2', 'tileGold', 'tileGold2', 'gold', 'wood', 'wood2', 'wood3']);

/** 该位置邻域（含树冠投影范围）是否已有营造体素 */
function onBuilt(b, x, z, r = 3) {
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let y = 0; y <= 3; y++) {
        const v = b.get(x + dx, y, z + dz);
        if (v && BUILT_KEYS.has(v.k)) return true;
      }
    }
  }
  return false;
}

/** 种树：树冠投影范围内若已有营造体素则放弃（树不穿墙、不长在铺装上） */
function plant(b, { x, z, kind, seed, h, y = 1, warm = false }) {
  if (onBuilt(b, x, z, 4)) return false;
  if (kind === 'pine') pineTree(b, { x, z, y, h, seed });
  else broadTree(b, { x, z, y, h, seed, warm });
  return true;
}

function forest(b, rnd) {
  for (const [x, z, kind] of TREE_PAIRS) {
    for (const mx of [false, true]) {
      const px = mx ? -1 - x : x;
      plant(b, { x: px, z, kind, seed: (px * 31 + z) | 0, h: (kind === 'pine' ? 10 + Math.round(rnd() * 5) : 9 + Math.round(rnd() * 3)), warm: rnd() > 0.6 });
    }
  }
  // 墙外林带（避开铺装/构筑物：树干压住铺装会同时破坏观感与左右对称）
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    let x, z;
    if (side === 0) { x = 58 + Math.round(rnd() * 12); z = Math.round(rnd() * 160 - 100); }
    else if (side === 1) { x = -70 + Math.round(rnd() * 12); z = Math.round(rnd() * 160 - 100); }
    else if (side === 2) { x = Math.round(rnd() * 120 - 60); z = 52 + Math.round(rnd() * 22); }
    else { x = Math.round(rnd() * 120 - 60); z = -108 - Math.round(rnd() * 16); }
    const pine = rnd() > 0.5;
    plant(b, { x, z, kind: pine ? 'pine' : 'broad', seed: i * 977 + 13, h: pine ? 9 + Math.round(rnd() * 6) : 8 + Math.round(rnd() * 4), warm: rnd() > 0.5 });
  }
}

/* ═══════════════════ 环场地林带（远景地面） ═══════════════════ */
function treeBelt(b, rnd) {
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = 86 + rnd() * 96;
    const x = Math.round(Math.sin(a) * rad);
    const z = Math.round(Math.cos(a) * rad) - 16;
    const insideSite = x > -72 && x < 71 && z > -122 && z < 90;
    if (insideSite) continue;
    const pine = rnd() > 0.45;
    plant(b, { x, z, y: 0, kind: pine ? 'pine' : 'broad', seed: i * 977 + 5, h: pine ? 9 + Math.round(rnd() * 7) : 8 + Math.round(rnd() * 5), warm: rnd() > 0.62 });
  }
}

/* ═══════════════════ 总装 ═══════════════════ */
export function buildSite(b) {
  const G = L.ground;
  const rnd = mulberry(2024);

  grassField(b, G.x0, G.z0, G.x1, G.z1, rnd);

  // ── 前广场（山门外） ──
  const F = L.plazaFront;
  pave(b, F.x0, F.z0, F.x1, F.z1);
  // 两侧甬道连到广场
  pave(b, F.x0, F.z1, -14, F.z1 + 8);
  pave(b, 13, F.z1, F.x1, F.z1 + 8);
  pave(b, -14, F.z1 + 8, 13, F.z1 + 16);

  // ── 中路御路 ──
  pave(b, L.path.x0, -22, L.path.x1, 50, { border: false });
  for (let z = -22; z <= 50; z++) {
    for (const x of [L.path.x0, L.path.x1]) b.set(x, 1, z, 'stone2');
    if ((z & 3) === 0) { b.set(-1, 1, z, 'stone2'); b.set(0, 1, z, 'stone2'); }
  }
  // 主殿前广场
  pave(b, -30, -70, 29, -22);
  // 月台前坪：御路两侧同样铺装。否则香炉（骑中轴、z ∈ [-5,1]）会把中轴卡死——
  // 只有 6 格宽的御路可走，绕行道全是草地（真实寺院殿前也是满铺）。
  pave(b, -16, -26, 15, 2, { border: false });
  // 主殿两侧甬道（通塔院）
  pave(b, 27, -70, 32, -10);
  pave(b, -33, -70, -28, -10);
  // 钟鼓楼、配殿前铺装
  pave(b, 24, 8, 39, 23);
  pave(b, -40, 8, -25, 23);
  pave(b, 31, -34, 47, 7);
  pave(b, -48, -34, -32, 7);
  // 后部塔院
  pave(b, -20, -104, 19, -64);
  pave(b, -3, -64, 2, -66);
  // 放生池（东侧建好后镜像到西侧）
  pond(b, rnd);
  mirrorSide(b);

  // 塔院补景（地面层：回纹带 / 十字甬道 / 四角松柏与树池）
  pagodaCourt(b);

  // 院墙边甬道 + 塔院两侧松林（需在 enclosure/forest 之前，树的 onBuilt 守卫才会避让）
  pagodaGrove(b);

  enclosure(b);
  forest(b, rnd);
  treeBelt(b, rnd);
}

/** 3×3 树池：掀掉铺装、铺土、砌一圈低石沿（树就种在池心） */
function treePit(b, x, z) {
  b.carve(x - 1, 0, z - 1, x + 1, 3, z + 1);
  b.box(x - 1, 0, z - 1, x + 1, 0, z + 1, 'soil');
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      b.set(x + dx, 1, z + dz, 'stone');
    }
  }
}

/**
 * 宝塔院补景（地面层）。塔院是一片 39×41 的空石板，塔高 63 格独处其中，
 * 而“绕塔”的净空必须保留 —— 所以所有补景只贴在院边与院角，不进塔基外那圈环道：
 *   ① 回纹带：紧贴院边石线内侧一圈用砖，给大院一个清晰的边框；
 *   ② 十字甬道：北臂与东西两臂（四臂都在塔基八边形之外的空白带里）；
 *   ③ 四角松柏 4 株 + 树池：南两角 + 东西两侧中点（北两角让给碑亭），
 *      仍关于中轴 x=-0.5 对称。
 * 注意：院内是铺装，plant() 的 onBuilt 守卫会直接拒种，所以这里直呼 pineTree。
 */
function pagodaCourt(b) {
  const C = { x0: -20, x1: 19, z0: -104, z1: -64 };   // 与 pave(-20,-104,19,-64) 同口径
  const P = L.pagoda, R = P.r + 3;                     // 塔基八角半径（buildings.js 的 R）
  // ① 回纹带
  for (let x = C.x0 + 1; x <= C.x1 - 1; x++) { b.set(x, 1, C.z0 + 1, 'brick'); b.set(x, 1, C.z1 - 1, 'brick'); }
  for (let z = C.z0 + 1; z <= C.z1 - 1; z++) { b.set(C.x0 + 1, 1, z, 'brick'); b.set(C.x1 - 1, 1, z, 'brick'); }
  // ② 轴线甬道（marble）：北臂 + 南臂（南端接宝塔自己的踏道）。
  //    原先的东西横臂去掉 —— 碑亭现在正骑东西两侧，横臂会插进亭子里。
  for (let x = -3; x <= 2; x++) {
    for (let z = C.z0; z <= P.cz - R - 1; z++) b.set(x, 1, z, 'marble');
    for (let z = P.cz + R + 1; z <= C.z1; z++) b.set(x, 1, z, 'marble');
  }
  // ③ 松柏 + 树池：南两角 + 东西两侧中点（北两角已让给碑亭）
  // ③ 四株树 + 树池：南两角与东西中点各一；成对同种（南对松、东西对阔）以免显得呆板也不破对称
  const COURT = [[-17, -67], [16, -67], [-17, -84], [16, -84]];
  COURT.forEach(([px, pz], i) => {
    treePit(b, px, pz);
    const seed = (Math.abs(px) * 131 + Math.abs(pz) * 19) | 0;
    if (i < 2) pineTree(b, { x: px, z: pz, y: 1, h: 10 + i, seed, warm: false });
    else broadTree(b, { x: px, z: pz, y: 1, h: 9 + (i - 2), seed, warm: i === 3 });
  });
}

/**
 * 塔院两侧：沿院墙夹一条甬道，并在院墙与塔院之间的两条草带上疏植杂树。
 * 甬道与入口横向连接段围出一个环 —— 从配殿前坪能绕到塔院两侧。
 * 林木用**局部固定种子的 RNG**（mulberry）撒点，不消耗公共 rnd（否则会把下游林木/云的
 * 随机序列整体移位）；稀疏（每侧 4 株）+ 最小间距 12 格 + 避开铺装/甬道/构筑物（onBuilt）+ 松/阔混搭。
 * 点位仍镜像成对：树属自然物、不参与 axis-symmetry 检查，但两侧均衡观感更好。
 */
function pagodaGrove(b) {
  // 甬道：沿东西院墙内缘（院墙占 x -55..-54 / 53..54），三格宽；
  // 北端到 z=-103 止 —— 后墙占着 z -105..-104 两行，画到 -104 会把甬道埋进墙里
  // （walk-paths-clear 第一次运行就报 (-53,1,-104) 是 wallRed）。
  pave(b, -53, -103, -51, 8);
  pave(b, 50, -103, 52, 8);
  // 塔院入口两端横向连接（接到塔院铺装的 x=-20/19）
  pave(b, -51, -64, -21, -62);
  pave(b, 20, -64, 50, -62);
  // 稀疏杂树：随机撒点（固定种子，「稀疏/随机/混搭」都不需要断言，全属自然物）
  const rng = mulberry(20240915);
  const spots = [];
  const tooClose = (x, z) => spots.some(([px, pz]) => Math.abs(px - x) <= 12 && Math.abs(pz - z) <= 12);
  for (let tries = 0; tries < 600 && spots.length < 4; tries++) {
    const x = -22 - Math.floor(rng() * 29);   // -22..-50（院墙之内、塔院之外）
    const z = -62 - Math.floor(rng() * 38);   // -62..-99
    if (tooClose(x, z) || onBuilt(b, x, z, 4)) continue;
    spots.push([x, z]);
  }
  for (const mirror of [false, true]) {
    for (const [gx, gz] of spots) {
      const x = mirror ? -1 - gx : gx;
      const seed = (Math.abs(x) * 131 + Math.abs(gz) * 17) | 0;
      if ((gx + gz) % 2 === 0) pineTree(b, { x, z: gz, y: 1, h: 9 + (((gz % 4) + 4) % 4), seed, warm: false });
      else broadTree(b, { x, z: gz, y: 1, h: 8 + (((gx % 4) + 4) % 4), seed, warm: gz % 3 === 0 });
    }
  }
}

/** 把东侧水池镜像到西侧（含矮石栏的望柱上段，故 y 到 3） */
function mirrorSide(b) {
  const P = L.pond;
  for (let x = P.x0 - 2; x <= P.x1 + 2; x++) {
    for (let z = P.z0 - 2; z <= P.z1 + 2; z++) {
      for (let y = 0; y <= 3; y++) {
        const blk = b.get(x, y, z);
        if (!blk) continue;
        b.set(-1 - x, y, z, blk.k);
      }
    }
  }
}
