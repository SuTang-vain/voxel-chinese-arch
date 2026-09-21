/**
 * 建筑群主体：山门（歇山）、主殿（重檐庑殿）、配殿（歇山）、
 * 钟鼓楼（腰檐 + 攒尖）、宝塔（八角楼阁式五层）。
 * 所有建筑按 LAYOUT 的中轴坐标建造；东侧单体建在临时画板上，
 * 再以 x → -1-x 镜像盖印，保证左右完全对称。
 */
import { VoxelBuilder } from '../voxel/VoxelBuilder.js';
import { hipRoof, xieshanRoof, pyramidRoof, skirtRoof, octRoof, octInside } from '../voxel/roof.js';
import { platform, stairway, dougong, caihua, latticeWall, studdedDoor, plaque, octBody, mulberry } from '../voxel/detail.js';
import { LAYOUT } from './layout.js';

/* ══════════════════════════ 山门 ══════════════════════════ */
export function buildGate(b) {
  const G = LAYOUT.gate;
  // ── 台基（前后各出踏道） ──
  platform(b, { x0: G.x0 - 3, x1: G.x1 + 3, z0: G.z0 - 3, z1: G.z1 + 3, y0: 1, h: 3, waist: 1, stretch: 1 });
  stairway(b, { x0: -9, x1: 8, yTop: 3, levelStart: 56, levels: 2, tread: 1, dir: 'south' });
  stairway(b, { x0: -9, x1: 8, yTop: 3, levelStart: 35, levels: 2, tread: 1, dir: 'north' });
  // 台基栏杆（仅两侧，避开门洞）
  b.railing(G.x0 - 3, G.z0 - 3, G.x0 - 3, G.z1 + 3, 4, 'marble', 'marble', 'w');
  b.railing(G.x1 + 3, G.z0 - 3, G.x1 + 3, G.z1 + 3, 4, 'marble', 'marble', 'e');

  // ── 墙身 ──
  const y0 = 4, yTop = 11;
  b.shell(G.x0, y0, G.z0, G.x1, yTop, G.z1, 'wallRed');
  b.shell(G.x0, y0, G.z0, G.x1, y0 + 1, G.z1, 'stone2'); // 石脚
  b.shell(G.x0, yTop, G.z0, G.x1, yTop, G.z1, 'wallRed2'); // 压顶

  // ── 三座门洞：中央贯通，两侧安板门 ──
  const openings = [
    { x0: -3, x1: 2, open: true },
    { x0: -9, x1: -6, open: false },
    { x0: 5, x1: 8, open: false },
  ];
  for (const op of openings) {
    for (const z of [G.z0, G.z1]) b.carve(op.x0, y0, z, op.x1, y0 + 4, z);
    if (!op.open) {
      studdedDoor(b, { x0: op.x0, x1: op.x1, y0: y0, y1: y0 + 4, fixed: 46, axis: 'x' });
    }
    // 门楣（木过梁）+ 门枕石
    for (const z of [G.z0, G.z1]) {
      b.box(op.x0 - 1, y0 + 5, z, op.x1 + 1, y0 + 5, z, 'wood2');
      b.set(op.x0 - 1, y0, z, 'stone'); b.set(op.x1 + 1, y0, z, 'stone');
    }
  }
  // ── 檐柱（门洞两侧，左右对称） ──
  for (const x of [-4, 3, -10, -5, 4, 9]) {
    for (const z of [G.z1 + 1, G.z0 - 1]) {
      b.box(x, y0, z, x, yTop + 1, z, 'wallRed2');
      b.set(x, y0, z, 'stone');
    }
  }
  // 山墙立柱
  for (const [x, z] of [[G.x0 - 1, G.z1 + 1], [G.x1 + 1, G.z1 + 1], [G.x0 - 1, G.z0 - 1], [G.x1 + 1, G.z0 - 1]]) {
    b.box(x, y0, z, x, yTop + 1, z, 'wallRed2');
  }

  // ── 匾额（前檐） ──
  plaque(b, { x0: -4, x1: 3, y: 9, z: G.z1 + 1, k: 'black', kText: 'gold', kFrame: 'wood3' });

  // ── 额枋彩画 + 斗拱 ──
  caihua(b, { x0: G.x0 - 1, x1: G.x1 + 1, z0: G.z0 - 1, z1: G.z1 + 1, y: 12 });
  dougong(b, { x0: G.x0 - 2, x1: G.x1 + 2, z0: G.z0 - 2, z1: G.z1 + 2, y: 13, h: 2, out: 1, step: 3 });

  // ── 屋顶：歇山，绿琉璃瓦 ──
  xieshanRoof(b, {
    x0: G.x0 - 5, x1: G.x1 + 5, z0: G.z0 - 4, z1: G.z1 + 4, y0: 15, h: 11,
    tile: 'tileGreen', tile2: 'tileGreen2', ridge: 'ridgeGreen',
    eaveAccent: 'gold', hipFrac: 0.4, reach: 3,
  });
}

/* ══════════════════════════ 主殿 ══════════════════════════ */
export function buildMainHall(b) {
  const M = LAYOUT.main, T = LAYOUT.terrace;
  // ── 台基 + 月台 ──
  platform(b, { x0: M.x0 - 5, x1: M.x1 + 5, z0: M.z0 - 5, z1: M.z1 + 5, y0: 1, h: 4, waist: 1 });
  platform(b, { x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, y0: 1, h: 4, waist: 1 });
  // 台基栏杆（后、左、右；前方为月台无栏）
  b.railing(M.x0 - 5, M.z0 - 5, M.x1 + 5, M.z0 - 5, 5, 'marble', 'marble', 'n');
  b.railing(M.x0 - 5, M.z0 - 5, M.x0 - 5, M.z1 - 1, 5, 'marble', 'marble', 'w');
  b.railing(M.x1 + 5, M.z0 - 5, M.x1 + 5, M.z1 - 1, 5, 'marble', 'marble', 'e');
  // 月台栏杆（两侧，中间留踏道）
  b.railing(T.x0, T.z0, T.x0, T.z1, 5, 'marble', 'marble', 'w');
  b.railing(T.x1, T.z0, T.x1, T.z1, 5, 'marble', 'marble', 'e');
  b.railing(T.x0, T.z1, -5, T.z1, 5, 'marble', 'marble');
  b.railing(4, T.z1, T.x1, T.z1, 5, 'marble', 'marble');
  // 踏道（三层，中央御路）
  stairway(b, { x0: -12, x1: 11, yTop: 4, levelStart: -12, levels: 3, tread: 2, dir: 'south' });
  for (let i = 0; i < 6; i++) {
    const z = -12 + i;
    const y = Math.max(1, Math.round(4 - (i / 5) * 3));
    b.box(-4, y, z, 3, y, z, 'marble');
    if (y >= 2 && i === 2) { b.set(-2, y, z, 'stone2'); b.set(1, y, z, 'stone2'); }
  }

  // ── 殿身 ──
  const y0 = 5, yTop = 15;
  b.shell(M.x0, y0, M.z0, M.x1, yTop, M.z1, 'wallRed');
  b.shell(M.x0, y0, M.z0, M.x1, y0 + 1, M.z1, 'stone2');   // 石脚
  b.shell(M.x0, yTop, M.z0, M.x1, yTop, M.z1, 'wallRed2'); // 压顶木枋
  // 前檐隔扇门（南面）
  latticeWall(b, { a0: M.x0, a1: M.x1, y0: y0 + 2, y1: yTop - 2, fixed: M.z1, axis: 'x' });
  // 两山槛窗
  latticeWall(b, { a0: M.z0 + 3, a1: M.z1 - 3, y0: y0 + 5, y1: yTop - 2, fixed: M.x0, axis: 'z' });
  latticeWall(b, { a0: M.z0 + 3, a1: M.z1 - 3, y0: y0 + 5, y1: yTop - 2, fixed: M.x1, axis: 'z' });
  // 后檐墙
  for (let x = M.x0 + 1; x <= M.x1 - 1; x++) {
    for (let y = y0 + 3; y <= yTop - 1; y++) if ((Math.abs(x + 0.5) | 0) % 4 === 0) b.set(x, y, M.z0, 'wood2');
  }
  // 前檐柱（出檐廊，左右对称）
  for (let x = M.x0; x < 0; x += 4) {
    for (const xx of [x, -1 - x]) {
      b.box(xx, y0, M.z1 + 1, xx, yTop + 1, M.z1 + 1, 'wallRed2');
      b.set(xx, y0, M.z1 + 1, 'stone');
    }
  }
  // 两山檐柱
  for (let z = M.z0 + 2; z <= M.z1 - 2; z += 4) {
    for (const x of [M.x0 - 1, M.x1 + 1]) {
      b.box(x, y0, z, x, yTop + 1, z, 'wallRed2');
      b.set(x, y0, z, 'stone');
    }
  }
  // 匾额
  plaque(b, { x0: -5, x1: 4, y: 12, z: M.z1 + 1, k: 'black', kText: 'gold', kFrame: 'wood3' });

  // ── 额枋 + 下檐斗拱 ──
  caihua(b, { x0: M.x0 - 1, x1: M.x1 + 1, z0: M.z0 - 1, z1: M.z1 + 1, y: 16 });
  dougong(b, { x0: M.x0 - 2, x1: M.x1 + 2, z0: M.z0 - 2, z1: M.z1 + 2, y: 17, h: 2, out: 1, step: 3 });

  // ── 重檐：下檐（围脊）——檐口比上檐宽出很多，重檐才看得出层次 ──
  skirtRoof(b, {
    x0: M.x0 - 6, x1: M.x1 + 6, z0: M.z0 - 6, z1: M.z1 + 6, y0: 19, h: 4,
    inner: { x0: M.x0 - 1, x1: M.x1 + 1, z0: M.z0 - 1, z1: M.z1 + 1 },
    tile: 'tileGold', tile2: 'tileGold2', ridge: 'ridgeGold',
  });
  // 上层楼板（封住暗层）+ 平座栏杆
  b.plate(M.x0 - 1, M.z0 - 1, M.x1 + 1, M.z1 + 1, 23, 'wood2');
  b.railing(M.x0 - 1, M.z0 - 1, M.x1 + 1, M.z0 - 1, 23, 'marble', 'marble', 'n');
  b.railing(M.x0 - 1, M.z0 - 1, M.x0 - 1, M.z1 + 1, 23, 'marble', 'marble', 'w');
  b.railing(M.x1 + 1, M.z0 - 1, M.x1 + 1, M.z1 + 1, 23, 'marble', 'marble', 'e');
  // 上层檐墙（暗层）+ 上檐斗拱
  b.shell(M.x0, 23, M.z0, M.x1, 23, M.z1, 'wallRed');
  b.shell(M.x0, 24, M.z0, M.x1, 24, M.z1, 'paintGreen');
  dougong(b, { x0: M.x0 - 1, x1: M.x1 + 1, z0: M.z0 - 1, z1: M.z1 + 1, y: 25, h: 2, out: 1, step: 3, k: 'wood3', kAlt: 'gold' });

  // ── 上檐：庑殿顶，黄琉璃瓦（举折约 40°，与殿身高度相当） ──
  hipRoof(b, {
    x0: M.x0 - 2, x1: M.x1 + 2, z0: M.z0 - 2, z1: M.z1 + 2, y0: 27, h: 11,
    tile: 'tileGold', tile2: 'tileGold2', ridge: 'ridgeGold',
    eaveAccent: 'ridgeGold', reach: 3,
  });
}

/* ══════════════════════════ 配殿（东侧，镜像成对） ══════════════════════════ */
export function buildSideHall() {
  const S = LAYOUT.side;
  const t = new VoxelBuilder(false);
  // ── 台基 ──
  platform(t, { x0: S.x0 - 2, x1: S.x1 + 2, z0: S.z0 - 2, z1: S.z1 + 2, y0: 1, h: 3, waist: 1 });
  t.railing(S.x0 - 2, S.z0 - 2, S.x0 - 2, S.z1 + 2, 4, 'marble', 'marble', 'w');
  t.railing(S.x0 - 2, S.z0 - 2, S.x1 + 2, S.z0 - 2, 4, 'marble', 'marble', 'n');
  t.railing(S.x0 - 2, S.z1 + 2, S.x1 + 2, S.z1 + 2, 4, 'marble', 'marble', 's');
  // 面向中轴的踏道（西侧）
  stairway(t, { z0: -19, z1: -8, yTop: 3, levelStart: S.x0 - 3, levels: 2, tread: 1, dir: 'west' });
  // ── 殿身 ──
  const y0 = 4, yTop = 13;
  t.shell(S.x0, y0, S.z0, S.x1, yTop, S.z1, 'wallRed');
  t.shell(S.x0, y0, S.z0, S.x1, y0 + 1, S.z1, 'stone2');
  t.shell(S.x0, yTop, S.z0, S.x1, yTop, S.z1, 'wallRed2');
  // 西面（朝中轴）隔扇门
  latticeWall(t, { a0: S.z0 + 2, a1: S.z1 - 2, y0: y0 + 1, y1: yTop - 2, fixed: S.x0, axis: 'z' });
  // 东面槛窗
  latticeWall(t, { a0: S.z0 + 3, a1: S.z1 - 3, y0: y0 + 5, y1: yTop - 2, fixed: S.x1, axis: 'z' });
  // 檐柱（西侧一列）
  for (let z = S.z0 + 1; z <= S.z1 - 1; z += 4) {
    t.box(S.x0 - 1, y0, z, S.x0 - 1, yTop + 1, z, 'wallRed2');
    t.set(S.x0 - 1, y0, z, 'stone');
  }
  // ── 额枋 + 斗拱 ──
  caihua(t, { x0: S.x0 - 1, x1: S.x1 + 1, z0: S.z0 - 1, z1: S.z1 + 1, y: 14 });
  dougong(t, { x0: S.x0 - 2, x1: S.x1 + 2, z0: S.z0 - 2, z1: S.z1 + 2, y: 15, h: 2, out: 1, step: 3 });
  // ── 屋顶：歇山，青瓦 ──
  xieshanRoof(t, {
    x0: S.x0 - 4, x1: S.x1 + 4, z0: S.z0 - 3, z1: S.z1 + 3, y0: 17, h: 11,
    tile: 'tileGray', tile2: 'tileGray2', ridge: 'ridgeGray',
    eaveAccent: 'ridgeGray', hipFrac: 0.42, reach: 3,
  });
  return t;
}

/* ══════════════════════════ 钟鼓楼（东侧，镜像成对） ══════════════════════════ */
export function buildTower(kind = 'bell') {
  const T = LAYOUT.tower;
  const t = new VoxelBuilder(false);
  const cx = Math.round((T.x0 + T.x1) / 2); // 31
  const cz = Math.round((T.z0 + T.z1) / 2); // 15
  // ── 台基 ──
  platform(t, { x0: T.x0 - 2, x1: T.x1 + 2, z0: T.z0 - 2, z1: T.z1 + 2, y0: 1, h: 3, waist: 1 });
  t.railing(T.x0 - 2, T.z0 - 2, T.x1 + 2, T.z0 - 2, 4, 'marble', 'marble', 'n');
  t.railing(T.x0 - 2, T.z1 + 2, T.x1 + 2, T.z1 + 2, 4, 'marble', 'marble', 's');
  t.railing(T.x0 - 2, T.z0 - 2, T.x0 - 2, T.z1 + 2, 4, 'marble', 'marble', 'w');
  t.railing(T.x1 + 2, T.z0 - 2, T.x1 + 2, T.z1 + 2, 4, 'marble', 'marble', 'e');
  stairway(t, { z0: 11, z1: 19, yTop: 3, levelStart: T.x0 - 3, levels: 2, tread: 1, dir: 'west' });
  // ── 一层：墙身 + 门 ──
  const a = { x0: T.x0 + 1, x1: T.x1 - 1, z0: T.z0 + 1, z1: T.z1 - 1 }; // 9×9
  t.shell(a.x0, 4, a.z0, a.x1, 11, a.z1, 'wallRed');
  t.shell(a.x0, 4, a.z0, a.x1, 5, a.z1, 'stone2');
  // 朝中轴的门（西面）
  t.carve(a.x0, 4, cz - 1, a.x0, 8, cz + 1);
  studdedDoor(t, { x0: cz - 1, x1: cz + 1, y0: 4, y1: 8, fixed: a.x0 + 1, axis: 'z' });
  // 其余三面槛窗（注意：axis:'x' 时 a0/a1 必须是 **x** 坐标 —— 曾误传 z 范围，
  // 于是 5×4 的格栅被发射到塔西侧 15 格外的半空，塔身南北两面反而是空的）
  latticeWall(t, { a0: a.x0 + 2, a1: a.x1 - 2, y0: 6, y1: 9, fixed: a.z1, axis: 'x' });
  latticeWall(t, { a0: a.x0 + 2, a1: a.x1 - 2, y0: 6, y1: 9, fixed: a.z0, axis: 'x' });
  latticeWall(t, { a0: a.z0 + 2, a1: a.z1 - 2, y0: 6, y1: 9, fixed: a.x1, axis: 'z' });
  // ── 腰檐 ──
  skirtRoof(t, {
    x0: T.x0 - 1, x1: T.x1 + 1, z0: T.z0 - 1, z1: T.z1 + 1, y0: 12, h: 3,
    inner: { x0: a.x0 + 1, x1: a.x1 - 1, z0: a.z0 + 1, z1: a.z1 - 1 },
    tile: 'tileGreen', tile2: 'tileGreen2', ridge: 'ridgeGreen',
  });
  // ── 二层：平座 + 四角柱 + 栏杆 ──
  const b2 = { x0: a.x0 + 1, x1: a.x1 - 1, z0: a.z0 + 1, z1: a.z1 - 1 }; // 7×7
  t.box(b2.x0, 15, b2.z0, b2.x1, 15, b2.z1, 'wood2'); // 楼板
  t.railing(b2.x0, b2.z0, b2.x1, b2.z1, 16, 'wood3', 'wallRed', 'nsew');
  for (const [x, z] of [[b2.x0, b2.z0], [b2.x1, b2.z0], [b2.x0, b2.z1], [b2.x1, b2.z1]]) {
    t.box(x, 16, z, x, 20, z, 'wallRed2');
  }
  // 内部：悬钟 / 立鼓
  if (kind === 'bell') {
    t.box(cx - 1, 20, cz - 1, cx + 1, 20, cz + 1, 'wood2');
    for (let y = 16; y <= 19; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 3) continue;
          if (y !== 16 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          t.set(cx + dx, y, cz + dz, y === 16 ? 'gold' : 'bronze');
        }
      }
      // 钟体内部掏空
      t.carve(cx - 1, y, cz - 1, cx + 1, y, cz + 1);
    }
    t.set(cx, 19, cz, 'gold');
    t.box(cx - 2, 16, cz - 2, cx + 2, 16, cz + 2, 'bronze');
  } else {
    t.box(cx - 2, 18, cz - 1, cx + 2, 18, cz + 1, 'wood2');
    for (let y = 16; y <= 19; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dz) === 2 && dx !== 0) continue;
          t.set(cx + dx, y, cz + dz, y === 16 || y === 19 ? 'gold' : ((y === 17 && dz === 0) ? 'gold' : 'wallRed'));
        }
      }
    }
  }
  // ── 斗拱 + 攒尖顶 ──
  dougong(t, { x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, y: 21, h: 2, out: 1, step: 3, k: 'wood3', kAlt: 'gold' });
  pyramidRoof(t, {
    x0: T.x0 - 1, x1: T.x1 + 1, z0: T.z0 - 1, z1: T.z1 + 1, y0: 23, h: 8,
    tile: 'tileGreen', tile2: 'tileGreen2', ridge: 'ridgeGreen',
    eaveAccent: 'gold', reach: 3,
  });
  return t;
}

/* ══════════════════════════ 宝塔（八角五层） ══════════════════════════ */
export function buildPagoda(b) {
  const { cx, cz } = LAYOUT.pagoda;
  const rnd = mulberry(20240915);
  // ── 八角石台基 ──
  // 八角台基：dx ∈ [-R, R-1] + 半整数度量 ⇒ 关于中轴 x=-0.5 严格对称
  const R = 13, cut = Math.round(R * 1.28);
  const inOct = (dx, dz, r = R) => octInside(dx + 0.5, dz, r, Math.round(r * 1.28));
  for (let dx = -R; dx <= R - 1; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (!inOct(dx, dz)) continue;
      for (let y = 1; y <= 3; y++) b.set(cx + dx, y, cz + dz, y === 3 ? 'marble' : 'stone2');
    }
  }
  // 台基栏杆
  for (let dx = -R; dx <= R - 1; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (!inOct(dx, dz)) continue;
      const edge = !inOct(dx + 1, dz) || !inOct(dx - 1, dz) || !inOct(dx, dz + 1) || !inOct(dx, dz - 1);
      if (!edge) continue;
      if (dz > 4 && Math.abs(dx + 0.5) <= 2.5) continue;      // 南面留踏道
      const post = ((Math.abs(dx + 0.5) | 0) + dz) % 3 === 0; // 望柱左右对齐
      b.set(cx + dx, 4, cz + dz, post ? 'marble' : 'marble');
      if (post) b.set(cx + dx, 5, cz + dz, 'marble');
    }
  }
  stairway(b, { x0: -3, x1: 2, yTop: 3, levelStart: cz + 14, levels: 2, tread: 1, dir: 'south' });

  // ── 五层塔身 ──
  const radii = [10, 8, 7, 5, 4];
  const tile = ['tileGray', 'tileGray2'];
  let y = 4;
  for (let k = 0; k < radii.length; k++) {
    const r = radii[k];
    const top = k === radii.length - 1;
    octBody(b, {
      cx, cz, r, y0: y, y1: y + (top ? 4 : 5),
      k: 'wallRed', kWin: 'wood2', kDoor: 'black', kBase: 'stone2', accent: 'gold',
    });
    // 斗拱一圈
    const yb = y + (top ? 5 : 6);
    for (let dx = -r - 1; dx <= r; dx++) {
      for (let dz = -r - 1; dz <= r + 1; dz++) {
        if (!octInside(dx + 0.5, dz, r + 1)) continue;
        if (octInside(dx + 0.5, dz, r)) continue;
        b.set(cx + dx, yb, cz + dz, (((Math.abs(dx + 0.5) | 0) + dz) % 3 === 0) ? 'gold' : 'wood3');
      }
    }
    // 塔檐
    const eaveY = yb + 1;
    const res = octRoof(b, {
      cx, cz, r0: r + 3, rEnd: r, y0: eaveY, h: 4,
      tile: tile[0], tile2: tile[1], ridge: 'ridgeGray', run: 0.9,
    });
    // 檐角风铃（东西两侧取镜像对，保证左右对称）
    const d = Math.round((r + 3) * 0.72);
    for (const [bx, sz] of [[d, 1], [-1 - d, 1], [d, -1], [-1 - d, -1]]) {
      b.set(cx + bx, eaveY - 1, cz + sz * d, 'gold');
      b.set(cx + bx, eaveY - 2, cz + sz * d, 'bronze');
    }
    if (top) {
      // ── 塔顶：攒尖 + 塔刹 ──
      const topY = res.topY;
      octRoof(b, { cx, cz, r0: r + 3, rEnd: 1, y0: topY + 1, h: 6, tile: tile[0], tile2: tile[1], ridge: 'ridgeGray', run: 0.95, hipRidge: false });
      // 塔刹：截面一律取「骑中轴的两格」，保证石/金构件左右严格对称
      const sy = topY + 7;
      const sp = (y, half, key, depthHalf = half) => b.box(-half, y, cz - depthHalf, half - 1, y, cz + depthHalf, key);
      sp(sy, 1, 'gold');            // 刹座
      sp(sy + 1, 2, 'ridgeGold');   // 相轮
      sp(sy + 2, 1, 'gold');
      sp(sy + 3, 2, 'gold');
      sp(sy + 4, 1, 'ridgeGold');
      sp(sy + 5, 1, 'gold', 0);     // 刹杆
      sp(sy + 6, 1, 'ridgeGold', 0);
      sp(sy + 7, 1, 'gold', 0);
    }
    y += 9;
  }
  void rnd;
}

/* ══════════════════════════ 塔院角亭（碑亭） ══════════════════════════ */
/**
 * 塔院院北两角的碑亭：5×5 台基 + 四角柱 + 阑额 + 攒尖顶 + 小碑。
 * 用户要求放回院北两角的空地（俯视时那两处的绿色是松柏树冠），松柏因此改去东西两侧中点。
 * 位置取院北两角（x[-19,-15] z[-99,-95]，镜像出东侧）。裕量必须按**檐角**算：
 * 后墙压顶（y=7）向外挑 1 格，而亭檐翘角还会再向外挑 2 格（reach:2）——
 * 故北沿只能到 z0-1-2=-102，离压顶外挑那行（z=-103）尚余 1 格。
 * 不要再往北推 2 格以上：会先后撞上压顶外挑与墙身（wall-intact 会直接变红）。
 */
export function buildPagodaPavilions(b) {
  for (const mirror of [false, true]) {
    const t = new VoxelBuilder(false);
    const x0 = -19, x1 = -15, z0 = -99, z1 = -95;
    t.box(x0 - 1, 1, z0 - 1, x1 + 1, 1, z1 + 1, 'stone2');   // 下台明 7×7
    t.box(x0, 2, z0, x1, 2, z1, 'marble');                    // 上台明 5×5
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) t.box(cx, 3, cz, cx, 5, cz, 'wallRed2');
    t.shell(x0, 6, z0, x1, 6, z1, 'wood2');                   // 阑额
    // 小碑（骑亭心）
    t.box(x0 + 1, 3, z0 + 1, x1 - 1, 3, z1 - 1, 'stone2');
    t.box(x0 + 2, 4, z0 + 2, x1 - 2, 6, z1 - 2, 'stone');
    pyramidRoof(t, { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, y0: 7, h: 3, tile: 'tileGray', tile2: 'tileGray2', ridge: 'ridgeGray', eaveAccent: 'gold', reach: 2 });
    b.stamp(t, { mirrorX: mirror });
  }
}

/* ══════════════════════════ 组装全群 ══════════════════════════ */
export function buildComplex(b) {
  buildGate(b);
  buildMainHall(b);
  buildPagoda(b);
  buildPagodaPavilions(b);

  // 东侧配殿 + 镜像西侧配殿
  const side = buildSideHall();
  b.stamp(side);
  b.stamp(side, { mirrorX: true });

  // 东钟楼、西鼓楼（对称布局，形制相同、内器不同）
  b.stamp(buildTower('bell'));
  b.stamp(buildTower('drum'), { mirrorX: true });
}
