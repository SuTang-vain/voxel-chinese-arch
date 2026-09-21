/**
 * temple.js — 建筑群总平面
 *
 * 中轴对称院落布局（+z 为南 / 入口方向）：
 *
 *                  ┌──────── 后墙 ────────┐
 *      宝塔 (z=-78) ○  五层攒尖 · 塔院
 *                  │
 *      主殿 (z=-34) █  重檐庑殿顶 · 三层汉白玉台基   ← 体量最大，中轴核心
 *   配殿(z=-30) ◧────┼────◨ 配殿       歇山顶 · x=±50
 *   钟鼓楼(z=30) ▣  甬道  ▣ 钟鼓楼      攒尖顶 · x=±50
 *      山门 (z=60) █  歇山顶 · 三开间
 *                  └──── 宫墙 · 入口 ────┘
 */
import { C, tiles } from './palette.js';
import { roof, podium, railing, stairs, dougong, latticeWindow, door, plaque, bigLantern, pine, lion, censer } from './parts.js';

export const BASE = 1; // 地面体素层 y=0，其顶面即世界 y=1 => 建筑自 y=1 起造

const TILE_GOLD = tiles(C.TILE_GOLD, C.TILE_GOLD_D);
const TILE_GREEN = tiles(C.TILE_GREEN, C.TILE_GREEN[1]);
const TILE_GRAY = tiles(C.TILE_GRAY, C.TILE_GRAY_D);

/* ============================ 地景 ============================ */

const GX0 = -74, GX1 = 74, GZ0 = -112, GZ1 = 84;

function ground(w) {
  w.fill(GX0, 0, GZ0, GX1, 0, GZ1, C.GRASS);
  w.fill(-64, 0, -102, 64, 0, 74, C.PAVE); // 院内满铺青石板

  // 草地庭院
  const gardens = [
    [-62, -14, -36, 18],
    [36, -14, 62, 18],
    [-62, 38, -36, 72],
    [36, 38, 62, 72],
    [-62, -100, -36, -58],
    [36, -100, 62, -58],
    [-32, 40, -14, 72],
    [14, 40, 32, 72],
    [-60, -56, -34, -46],
    [34, -56, 60, -46],
  ];
  for (const [x0, z0, x1, z1] of gardens) w.fill(x0, 0, z0, x1, 0, z1, C.GRASS);

  // 中轴甬道（御道石 + 深色牙子）
  for (const [za, zb] of [[-16, 52], [-70, -50]]) {
    w.fill(-9, 0, za, 9, 0, zb, C.PAVE_WARM);
    w.fill(-10, 0, za, -10, 0, zb, C.PAVE_DARK);
    w.fill(10, 0, za, 10, 0, zb, C.PAVE_DARK);
  }
  w.fill(-18, 0, -94, 18, 0, -64, C.PAVE); // 塔院
  w.fill(-34, 0, -38, 34, 0, 2, C.PAVE_WARM); // 殿前横向甬路

  // 墙外草地杂色
  for (let x = GX0; x <= GX1; x++) {
    for (let z = GZ0; z <= GZ1; z++) {
      if (!(x < -64 || x > 64 || z < -102 || z > 74)) continue;
      if ((x + z) % 7 === 0) w.set(x, 0, z, C.GRASS_DRY);
      else if ((x * 3 + z * 5) % 23 === 0) w.set(x, 0, z, C.MOSS);
    }
  }
}

/* ============================ 宫墙 ============================ */

function wallSegment(w, x0, z0, x1, z1) {
  const h = 6;
  w.fill(x0, BASE, z0, x1, BASE + h - 1, z1, C.BRICK);
  w.fill(x0 - 1, BASE + h, z0 - 1, x1 + 1, BASE + h, z1 + 1, TILE_GRAY);
  w.fill(x0 - 1, BASE + h + 1, z0 - 1, x1 + 1, BASE + h + 1, z1 + 1, C.TILE_GRAY_D);
}

function precinctWalls(w) {
  const g = 24;
  wallSegment(w, -66, 74, -g, 76);
  wallSegment(w, g, 74, 66, 76);
  wallSegment(w, -67, -104, -65, 76);
  wallSegment(w, 65, -104, 67, 76);
  wallSegment(w, -67, -104, 67, -102);
}

/* ============================ 山门（歇山顶 · 三开间） ============================ */

function gate(w) {
  const y0 = BASE;
  podium(w, -22, 52, 22, 68, y0, 3, { skirt: 1 });
  railing(w, -22, 52, 22, 68, y0 + 2, {
    openings: [{ x0: -10, x1: 10, z0: 66, z1: 72 }, { x0: -10, x1: 10, z0: 48, z1: 54 }],
  });
  stairs(w, -10, 10, 68, 1, y0 + 2, 2, { imperial: true, tread: 3 });
  stairs(w, -10, 10, 52, -1, y0 + 2, 2, { imperial: true, tread: 3 });

  const bx0 = -18, bx1 = 18, bz0 = 54, bz1 = 66;
  const wy0 = y0 + 3, wy1 = wy0 + 9; // y4..13
  w.fill(bx0, wy0, bz0, bx1, wy1, bz0, C.BRICK);
  w.fill(bx0, wy0, bz1, bx1, wy1, bz1, C.BRICK);
  w.fill(bx0, wy0, bz0, bx0, wy1, bz1, C.BRICK);
  w.fill(bx1, wy0, bz0, bx1, wy1, bz1, C.BRICK);
  w.ring(wy0 + 6, bx0, bz0, bx1, bz1, C.PLASTER); // 束腰线脚

  // 三开间门洞（前后贯通）
  const holes = [
    [-5, 5, 6],
    [-14, -10, 5],
    [10, 14, 5],
  ];
  for (const [a, b, h] of holes) {
    w.clear(a, wy0, bz0, b, wy0 + h, bz1);
    door(w, a, b, wy0, wy0 + h, bz0, 'z-');
    door(w, a, b, wy0, wy0 + h, bz1, 'z+');
  }
  plaque(w, -6, 6, wy1 - 2, wy1, bz1, 'z+');
  plaque(w, -6, 6, wy1 - 2, wy1, bz0, 'z-');

  // 前后檐柱
  for (const x of [-17, -8, 8, 17]) {
    w.fill(x, wy0, bz1 + 1, x, wy1 + 2, bz1 + 1, C.COLUMN);
    w.fill(x, wy0, bz0 - 1, x, wy1 + 2, bz0 - 1, C.COLUMN);
  }

  dougong(w, bx0, bz0, bx1, bz1, wy1 + 1);
  roof(w, bx0, bz0, bx1, bz1, wy1 + 4, {
    style: 'xieshan',
    ridge: 'x',
    overhang: 3,
    step: 1,
    breakLayer: 2,
    tile: TILE_GREEN,
    trim: C.TILE_GRAY_D,
    curl: 3,
  });

  for (const x of [-16, 0, 16]) bigLantern(w, x, wy1 + 3, bz1 + 3, 2);
  lion(w, -27, BASE, 70, 1);
  lion(w, 27, BASE, 70, 1);
}

/* ============================ 主殿（重檐庑殿顶 · 三层台基） ============================ */

function mainHall(w) {
  const y0 = BASE;
  /* 三层汉白玉台基 */
  podium(w, -35, -55, 35, -13, y0, 2, { skirt: 1 }); // y1..2
  podium(w, -30, -50, 30, -18, y0 + 2, 2, { skirt: 1 }); // y3..4
  podium(w, -25, -45, 25, -23, y0 + 4, 2, { skirt: 0 }); // y5..6
  railing(w, -35, -55, 35, -13, y0 + 1, { openings: [{ x0: -14, x1: 14, z0: -15, z1: -6 }] });
  railing(w, -30, -50, 30, -18, y0 + 3, { openings: [{ x0: -14, x1: 14, z0: -20, z1: -12 }] });
  railing(w, -25, -45, 25, -23, y0 + 5, {
    edges: { front: false, back: true, left: true, right: true },
  });

  /* 三层大踏道（含御路） */
  stairs(w, -13, 13, -23, 1, y0 + 5, 2, { imperial: true, tread: 2 });
  stairs(w, -13, 13, -18, 1, y0 + 3, 2, { imperial: true, tread: 2 });
  stairs(w, -13, 13, -13, 1, y0 + 1, 1, { imperial: true, tread: 2 });
  stairs(w, -13, 13, -45, -1, y0 + 3, 3, { imperial: true, tread: 2 }); // 后檐踏道

  /* 下层殿身 y6..16 */
  const bx0 = -23, bx1 = 23, bz0 = -43, bz1 = -25;
  const wy0 = y0 + 5, wy1 = wy0 + 10;
  w.fill(bx0, wy0, bz0, bx1, wy1, bz0, C.BRICK);
  w.fill(bx0, wy0, bz1, bx1, wy1, bz1, C.BRICK);
  w.fill(bx0, wy0, bz0, bx0, wy1, bz1, C.BRICK);
  w.fill(bx1, wy0, bz0, bx1, wy1, bz1, C.BRICK);
  w.ring(wy0, bx0, bz0, bx1, bz1, C.STONE_DARK); // 台度
  w.ring(wy1, bx0, bz0, bx1, bz1, C.PAINT_BLUE); // 额枋

  door(w, -4, 4, wy0, wy0 + 7, bz1, 'z+');
  for (const [a, b] of [[-19, -16], [16, 19]]) door(w, a, b, wy0, wy0 + 5, bz1, 'z+');
  for (const [a, b] of [[-14, -11], [-9, -6], [6, 9], [11, 14]])
    latticeWindow(w, a, b, wy0 + 3, wy0 + 7, bz1, 'z+');
  plaque(w, -7, 7, wy1 - 3, wy1 - 1, bz1, 'z+');
  // 后檐门
  door(w, -4, 4, wy0, wy0 + 6, bz0, 'z-');
  // 两山开窗
  for (const x of [bx0, bx1]) {
    for (const [a, b] of [[-40, -37], [-34, -31]])
      latticeWindow(w, a, b, wy0 + 3, wy0 + 7, x, x === bx0 ? 'x-' : 'x+');
  }

  // 前檐廊柱（承下檐）
  for (const x of [0, -5, 5, -10, 10, -15, 15, -20, 20]) {
    w.fill(x, wy0, bz1 + 1, x, wy1 + 3, bz1 + 1, C.COLUMN);
    w.set(x, wy0, bz1 + 1, C.STONE);
    w.set(x, wy1 - 1, bz1 + 1, C.GOLD);
  }

  dougong(w, bx0, bz0, bx1, bz1, wy1 + 1);

  /* 下檐（重檐裙檐）y20..22 */
  roof(w, bx0, bz0, bx1, bz1, wy1 + 4, {
    style: 'hip',
    ridge: 'x',
    overhang: 4,
    step: 1,
    layers: 3,
    tile: TILE_GOLD,
    trim: C.TILE_GOLD_D,
    curl: 3,
    beast: false,
  });

  /* 上层殿身 y20..29 */
  const ux0 = -17, ux1 = 17, uz0 = -40, uz1 = -28;
  const uy0 = wy0 + 14, uy1 = uy0 + 9;
  w.fill(ux0, uy0, uz0, ux1, uy1, uz0, C.BRICK);
  w.fill(ux0, uy0, uz1, ux1, uy1, uz1, C.BRICK);
  w.fill(ux0, uy0, uz0, ux0, uy1, uz1, C.BRICK);
  w.fill(ux1, uy0, uz0, ux1, uy1, uz1, C.BRICK);
  w.ring(uy1, ux0, uz0, ux1, uz1, C.PAINT_GREEN);
  door(w, -5, 5, uy0, uy0 + 6, uz1, 'z+');
  for (const [a, b] of [[-14, -11], [11, 14]]) latticeWindow(w, a, b, uy0 + 2, uy0 + 7, uz1, 'z+');
  plaque(w, -6, 6, uy1 - 2, uy1, uz1, 'z+');
  for (const x of [ux0, ux1]) {
    for (const [a, b] of [[-38, -35], [-33, -30]])
      latticeWindow(w, a, b, uy0 + 3, uy0 + 6, x, x === ux0 ? 'x-' : 'x+');
  }

  dougong(w, ux0, uz0, ux1, uz1, uy1 + 1);

  /* 上檐：重檐庑殿顶 y33..38 */
  roof(w, ux0, uz0, ux1, uz1, uy1 + 4, {
    style: 'hip',
    ridge: 'x',
    overhang: 3,
    step: 1,
    tile: TILE_GOLD,
    trim: C.TILE_GOLD_D,
    curl: 3,
  });

  for (const x of [-20, -10, 10, 20]) bigLantern(w, x, wy1 + 3, bz1 + 4, 3);
}

/* ============================ 配殿（歇山顶，对称） ============================ */

function sideHall(w, s) {
  const cx = 50 * s;
  const inEdge = s < 0 ? -41 : 41;
  const dir = s < 0 ? 1 : -1;
  const px0 = cx - 9, px1 = cx + 9, pz0 = -44, pz1 = -16;

  podium(w, px0, pz0, px1, pz1, BASE, 3, { skirt: 1 });
  railing(w, px0, pz0, px1, pz1, BASE + 2, {
    openings: [{ x0: inEdge, x1: inEdge + dir * 5, z0: -34, z1: -26 }],
  });
  stairs(w, -34, -26, inEdge, dir, BASE + 2, 2, { axis: 'x', tread: 2 });

  const bx0 = cx - 7, bx1 = cx + 7, bz0 = -40, bz1 = -20; // 13 × 21
  const fx = s < 0 ? bx1 : bx0; // 朝中轴的立面
  const wy0 = BASE + 3, wy1 = wy0 + 10;
  w.fill(bx0, wy0, bz0, bx1, wy1, bz0, C.BRICK);
  w.fill(bx0, wy0, bz1, bx1, wy1, bz1, C.BRICK);
  w.fill(bx0, wy0, bz0, bx0, wy1, bz1, C.BRICK);
  w.fill(bx1, wy0, bz0, bx1, wy1, bz1, C.BRICK);
  w.ring(wy0, bx0, bz0, bx1, bz1, C.STONE_DARK);
  w.ring(wy1, bx0, bz0, bx1, bz1, C.PAINT_BLUE);

  const face = s < 0 ? 'x+' : 'x-';
  door(w, cx - 4, cx + 4, wy0, wy0 + 6, fx, face);
  for (const [a, b] of [[-37, -34], [-26, -23]]) latticeWindow(w, a, b, wy0 + 3, wy0 + 7, fx, face);
  for (const x of [bz0]) latticeWindow(w, cx - 3, cx + 3, wy0 + 3, wy0 + 6, x, 'z-');
  plaque(w, cx - 3, cx + 3, wy1 - 2, wy1, fx, face);

  // 檐柱
  const ox = fx + (s < 0 ? 1 : -1);
  for (const z of [-38, -33, -28, -23]) w.fill(ox, wy0, z, ox, wy1 + 3, z, C.COLUMN);

  dougong(w, bx0, bz0, bx1, bz1, wy1 + 1);
  roof(w, bx0, bz0, bx1, bz1, wy1 + 4, {
    style: 'xieshan',
    ridge: 'z',
    overhang: 2,
    step: 1,
    breakLayer: 2,
    tile: TILE_GRAY,
    trim: C.TILE_GRAY_D,
    curl: 3,
  });
  for (const z of [-35, -25]) bigLantern(w, ox, wy1 + 3, z, 2);
}

/* ============================ 钟鼓楼（攒尖顶 · 二层） ============================ */

function tower(w, s, kind) {
  const cx = 50 * s, cz = 30;
  const inEdge = cx + (s < 0 ? 9 : -9);
  const dir = s < 0 ? 1 : -1;

  podium(w, cx - 9, cz - 9, cx + 9, cz + 9, BASE, 3, { skirt: 1 });
  railing(w, cx - 9, cz - 9, cx + 9, cz + 9, BASE + 2, {
    openings: [{ x0: inEdge, x1: inEdge + dir * 5, z0: cz - 5, z1: cz + 5 }],
  });
  stairs(w, cz - 5, cz + 5, inEdge, dir, BASE + 2, 2, { axis: 'x', tread: 2 });

  /* 一层 */
  const y0 = BASE + 3, y1 = y0 + 8;
  w.fill(cx - 5, y0, cz - 5, cx + 5, y1, cz + 5, C.BRICK);
  w.clear(cx - 4, y0, cz - 4, cx + 4, y1 - 1, cz + 4);
  w.fill(cx - 5, y0, cz - 5, cx + 5, y0, cz + 5, C.BRICK);
  const d = 3;
  w.clear(cx - d, y0, cz - 5, cx + d, y0 + 5, cz - 5);
  w.clear(cx - d, y0, cz + 5, cx + d, y0 + 5, cz + 5);
  w.clear(cx - 5, y0, cz - d, cx - 5, y0 + 5, cz + d);
  w.clear(cx + 5, y0, cz - d, cx + 5, y0 + 5, cz + d);
  door(w, cx - d, cx + d, y0, y0 + 5, cz - 5, 'z-');
  door(w, cx - d, cx + d, y0, y0 + 5, cz + 5, 'z+');
  w.ring(y1, cx - 5, cz - 5, cx + 5, cz + 5, C.PAINT_GREEN);
  dougong(w, cx - 5, cz - 5, cx + 5, cz + 5, y1 + 1);
  roof(w, cx - 5, cz - 5, cx + 5, cz + 5, y1 + 4, {
    style: 'hip',
    ridge: 'x',
    overhang: 2,
    step: 1,
    layers: 3,
    tile: TILE_GREEN,
    trim: C.TILE_GRAY_D,
    curl: 3,
    beast: false,
  });

  /* 二层 */
  const uy0 = y1 + 5, uy1 = uy0 + 7;
  w.fill(cx - 4, uy0, cz - 4, cx + 4, uy1, cz + 4, C.BRICK);
  w.clear(cx - 3, uy0 + 1, cz - 3, cx + 3, uy1, cz + 3);
  w.fill(cx - 4, uy0, cz - 4, cx + 4, uy0, cz + 4, C.BRICK);
  for (const [a, b] of [[cz - 2, cz + 2]]) {
    latticeWindow(w, a, b, uy0 + 2, uy1 - 1, cx - 4, 'x-');
    latticeWindow(w, a, b, uy0 + 2, uy1 - 1, cx + 4, 'x+');
  }
  for (const [a, b] of [[cx - 2, cx + 2]]) {
    latticeWindow(w, a, b, uy0 + 2, uy1 - 1, cz - 4, 'z-');
    latticeWindow(w, a, b, uy0 + 2, uy1 - 1, cz + 4, 'z+');
  }
  w.ring(uy1, cx - 4, cz - 4, cx + 4, cz + 4, C.PAINT_BLUE);
  // 钟 / 鼓
  if (kind === 'bell') {
    w.fill(cx - 1, uy0 + 3, cz - 1, cx + 1, uy0 + 4, cz + 1, C.BRONZE_DARK);
    w.set(cx, uy0 + 5, cz, C.BRONZE);
    w.set(cx, uy0 + 6, cz, C.BRONZE);
  } else {
    w.fill(cx - 2, uy0 + 3, cz - 1, cx + 2, uy0 + 4, cz + 1, C.BRICK_DARK);
    w.ring(uy0 + 4, cx - 2, cz - 1, cx + 2, cz + 1, C.GOLD);
  }
  dougong(w, cx - 4, cz - 4, cx + 4, cz + 4, uy1 + 1);
  roof(w, cx - 4, cz - 4, cx + 4, cz + 4, uy1 + 4, {
    style: 'hip',
    ridge: 'x',
    overhang: 2,
    step: 1,
    tile: TILE_GREEN,
    trim: C.TILE_GRAY_D,
    curl: 3,
  });
  bigLantern(w, cx, uy1 + 3, cz + 6, 2);
}

/* ============================ 宝塔（五层攒尖 · 八角） ============================ */

function pagoda(w) {
  const cx = 0, cz = -78;
  for (let y = BASE; y <= BASE + 2; y++) w.octFill(cx, y, cz, 11, y === BASE + 2 ? C.STONE : C.STONE_SIDE);
  w.fill(-3, BASE, cz + 11, 3, BASE + 2, cz + 15, C.STONE_SIDE); // 踏道

  let y = BASE + 3;
  const radii = [8, 7, 6, 5, 4];
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    for (let k = 0; k < 3; k++) {
      w.octFill(cx, y + k, cz, r, C.BRICK);
      w.octRing(cx, y + k, cz, r, i % 2 === 0 ? C.BRICK : C.BRICK_DARK);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      w.set(cx + dx * r, y + 1, cz + dz * r, C.WIN_GLOW, true);
      w.set(cx + dx * r, y + 2, cz + dz * r, C.WIN_GLOW, true);
      w.set(cx + dx * (r - 1), y + 2, cz + dz * (r - 1), C.PAINT_BLUE);
    }
    // 平座腰檐
    const tile = i === 4 ? TILE_GOLD : TILE_GRAY;
    w.octFill(cx, y + 3, cz, r + 3, tile);
    w.octRing(cx, y + 3, cz, r + 3, C.TILE_GRAY_D);
    w.octFill(cx, y + 4, cz, r + 1, tile);
    w.octRing(cx, y + 4, cz, r + 1, C.TILE_GRAY_D);
    // 八角翘角
    const m = Math.round((r + 3) * 0.71);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      w.set(cx + sx * m, y + 4, cz + sz * m, C.GOLD_DARK);
      w.set(cx + sx * (m + 1), y + 4, cz + sz * (m + 1), C.GOLD_DARK);
    }
    y += 5;
  }

  // 攒尖 + 塔刹
  w.octFill(cx, y, cz, 4, TILE_GOLD);
  w.octFill(cx, y + 1, cz, 3, TILE_GOLD);
  w.octFill(cx, y + 2, cz, 2, TILE_GOLD);
  w.octFill(cx, y + 3, cz, 1, C.TILE_GOLD_D);
  for (let i = 0; i < 3; i++) w.set(cx, y + 4 + i, cz, i % 2 === 0 ? C.GOLD : C.GOLD_DARK);
  w.fill(cx - 1, y + 5, cz - 1, cx + 1, y + 5, cz + 1, C.GOLD);
}

/* ============================ 陈设 / 植被 ============================ */

function props(w) {
  censer(w, 0, BASE, 22);
  const trees = [
    [-50, -6, 9], [50, -6, 9], [-48, 12, 8], [48, 12, 8],
    [-56, 46, 10], [56, 46, 10], [-42, 58, 9], [42, 58, 9],
    [-24, 60, 8], [24, 60, 8], [-56, -78, 10], [56, -78, 10],
    [-42, -94, 9], [42, -94, 9], [-26, -60, 8], [26, -60, 8],
    [-84, -30, 11], [-86, 30, 10], [84, -20, 11], [86, 26, 10],
    [-80, -80, 12], [80, -84, 12], [-70, 62, 10], [70, 66, 10],
    [-46, 96, 11], [-16, 98, 9], [18, 96, 11], [48, 98, 10],
    [-88, 6, 9], [88, -60, 10], [-4, -114, 10], [30, -112, 9], [-34, -114, 11],
  ];
  for (const [x, z, h] of trees) pine(w, x, BASE, z, h);

  // 墙外散石
  for (let i = 0; i < 90; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const r = 82 + ((i * 7919) % 40);
    const x = Math.round(Math.cos(a) * r);
    const z = Math.round(Math.sin(a) * r * 1.15) + 10;
    if (x > -78 && x < 78 && z > -106 && z < 88) continue;
    const h = 1 + ((i * 13) % 3);
    for (let k = 0; k < h; k++) w.set(x, BASE + k, z, k === h - 1 ? C.STONE : C.STONE_DARK);
  }
}

/* ============================ 组装 ============================ */

export function buildTemple(w) {
  ground(w);
  precinctWalls(w);
  gate(w);
  mainHall(w);
  sideHall(w, -1);
  sideHall(w, 1);
  tower(w, -1, 'bell');
  tower(w, 1, 'drum');
  pagoda(w);
  props(w);
  return w;
}
