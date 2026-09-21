/**
 * site.js —— 场地规划与建筑群总装
 *
 * 总平面（坐北朝南，中轴对称；+Z 为南=前，-Z 为北=后）：
 *
 *                        ▲ 北（后）
 *            宝塔（中轴末端）
 *      ┌──────── 后墙 ────────┐
 *      │      后院 · 松柏      │
 *      │        主殿（重檐庑殿）│ ← 中轴核心，体量最大
 *   配殿│     月台·丹陛·御道   │配殿      ← 对称配殿
 *      │   香炉   庭院   香炉  │
 *   钟楼│        泮池·石桥    │鼓楼      ← 对称钟鼓楼
 *      └──────── 山门 ────────┘
 *          石狮 · 前广场 · 御道
 *                        ▼ 南（前）
 */
import { VoxelGrid } from './voxel.js';
import { C } from './palette.js';
import * as A from './architecture.js';

export const PLAN = {
  grid: { x0: -106, x1: 106, y0: -3, y1: 100, z0: -130, z1: 130 },
  // 地面铺满整个网格：地平线正好落在网格边界，视觉上不会出现"地面断层"
  ground: { x0: -106, x1: 106, z0: -130, z1: 130 },
  wallX: 74,
  frontZ: 98,
  backZ: -116,
  gate: { cx: 0, cz: 98, w: 38, d: 16 },
  towerX: 46, towerZ: 68,
  sideX: 56, sideZ: 4,
  main: { cx: 0, cz: -40 },
  pagoda: { cx: 0, cz: -92 },
  pond: { x0: -16, x1: 16, z0: 46, z1: 66 },
};

/* 简单值噪声，用于草地/铺装的自然变化 */
const noise2 = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.13) * Math.cos(z * 0.11)
  + 0.18 * Math.sin(x * 0.41 + z * 0.37);

/* ------------------------------------------------------------------ *
 *  地面：土层 + 草地 + 铺装 + 道路
 * ------------------------------------------------------------------ */
function groundLayer(g) {
  const G = PLAN.ground;
  g.fill(G.x0, G.x1, -3, -1, G.z0, G.z1, C.soil, { jitter: 0.07 });
  for (let x = G.x0; x <= G.x1; x++) {
    for (let z = G.z0; z <= G.z1; z++) {
      const n = noise2(x, z);
      let c = n > 0.62 ? C.grassLt : n < 0.36 ? C.grassDk : C.grass;
      if (g.hash3(x, 7, z) < 0.012) c = C.soil;
      g.set(x, 0, z, c, { jitter: 0.075 });
    }
  }
}

/** 方砖铺地（4×4 一块，带砖缝） */
function pave(g, x0, x1, z0, z1, base = C.brick, alt = C.brickLt, seam = C.stoneDark, step = 4) {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const bx = Math.floor((x + 512) / step), bz = Math.floor((z + 512) / step);
      let c = ((bx + bz) & 1) ? base : alt;
      if (((x % step) + step) % step === 0 || ((z % step) + step) % step === 0) c = seam;
      g.set(x, 0, z, c, { jitter: 0.045 });
    }
  }
}

/** 石板甬道 / 御道（带牙子石边线） */
function road(g, x0, x1, z0, z1, base = C.road, edge = C.roadDk) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
      const c = onEdge ? edge : (Math.floor((x + 512) / 3) + Math.floor((z + 512) / 3)) & 1 ? base : C.brickLt;
      g.set(x, 0, z, c, { jitter: 0.04 });
    }
}

function pavingPlan(g) {
  // 院落铺装
  pave(g, -PLAN.wallX, PLAN.wallX, PLAN.backZ, PLAN.frontZ);
  // 前广场
  pave(g, -44, 44, PLAN.frontZ, 128, C.brick, C.brickDk, C.stoneDark, 5);
  // 御道：前广场 → 山门 → 泮池石桥 → 主殿丹陛
  road(g, -9, 9, PLAN.frontZ + 1, 130);
  road(g, -9, 9, -20, PLAN.frontZ);
  // 甬道：通往钟鼓楼
  road(g, -34, 34, PLAN.towerZ - 6, PLAN.towerZ + 6, C.brick, C.stoneDark);
  // 甬道：通往东西配殿
  road(g, -46, 46, PLAN.sideZ - 7, PLAN.sideZ + 7, C.brick, C.stoneDark);
  // 后院甬道：主殿 → 宝塔
  road(g, -9, 9, -76, -18);
}

/* ------------------------------------------------------------------ *
 *  泮池 + 石桥
 * ------------------------------------------------------------------ */
function pond(g, marks) {
  const P = PLAN.pond;
  g.clearBox(P.x0, P.x1, -1, 0, P.z0, P.z1);
  for (let x = P.x0; x <= P.x1; x++)
    for (let z = P.z0; z <= P.z1; z++) {
      g.set(x, -2, z, C.soil, { jitter: 0.08 });
      g.set(x, -1, z, ((x + z) % 7 === 0) ? C.waterLt : C.water, { jitter: 0.05 });
    }
  // 池岸压石
  for (let x = P.x0 - 1; x <= P.x1 + 1; x++) { g.set(x, 1, P.z0 - 1, C.marble, { jitter: 0.03 }); g.set(x, 1, P.z1 + 1, C.marble, { jitter: 0.03 }); }
  for (let z = P.z0 - 1; z <= P.z1 + 1; z++) { g.set(P.x0 - 1, 1, z, C.marble, { jitter: 0.03 }); g.set(P.x1 + 1, 1, z, C.marble, { jitter: 0.03 }); }
  // 石桥（御道跨池）
  for (let z = P.z0 - 1; z <= P.z1 + 1; z++) {
    for (let x = -6; x <= 6; x++) g.set(x, 0, z, C.marble, { jitter: 0.03 });
    g.set(-6, 1, z, C.stoneLt, {}); g.set(6, 1, z, C.stoneLt, {});
    if ((z - P.z0) % 4 === 0) { g.fill(-6, -6, 2, 2, z, z, C.marble, {}); g.fill(6, 6, 2, 2, z, z, C.marble, {}); }
  }
  // 桥栏望柱
  for (const x of [-6, 6]) for (let z = P.z0 - 1; z <= P.z1 + 1; z += 4) g.set(x, 2, z, C.marble, {});
}

/* ------------------------------------------------------------------ *
 *  院墙 / 回廊
 * ------------------------------------------------------------------ */
function walls(g) {
  const X = PLAN.wallX;
  A.wallRun(g, { axis: 'z', at: -X, from: 96, to: PLAN.backZ, h: 7 });
  A.wallRun(g, { axis: 'z', at: X, from: 96, to: PLAN.backZ, h: 7 });
  A.wallRun(g, { axis: 'x', at: PLAN.frontZ, from: -X - 2, to: -20, h: 7 });
  A.wallRun(g, { axis: 'x', at: PLAN.frontZ, from: 20, to: X + 2, h: 7 });
  A.wallRun(g, { axis: 'x', at: PLAN.backZ, from: -X - 2, to: X + 2, h: 7 });
  // 回廊（东西两侧，配殿处断开）
  for (const at of [-70, 70]) {
    A.colonnade(g, { axis: 'z', at, from: 84, to: 36, h: 6 });
    A.colonnade(g, { axis: 'z', at, from: -30, to: -108, h: 6 });
  }
}

/* ------------------------------------------------------------------ *
 *  建筑群
 * ------------------------------------------------------------------ */
function buildings(g, marks) {
  /* 山门（入口，歇山顶） */
  const gate = A.gateHouse(g, {
    cx: PLAN.gate.cx, cz: PLAN.gate.cz, w: PLAN.gate.w, d: PLAN.gate.d,
    baseY: 1, platH: 2, platPad: 5, wallH: 9, bays: 3,
    roofStyle: 'xieshan', roofLevels: 10, overhang: 4, bays2: 2,
  });
  marks.gate = gate;

  /* 主殿（重檐庑殿顶，体量最大，中轴核心） */
  const main = A.hall(g, {
    cx: PLAN.main.cx, cz: PLAN.main.cz, w: 60, d: 32,
    baseY: 1, platH: 4, platPad: 7, wallH: 13, wallT: 2,
    facing: '+z', ridgeAxis: 'x', roofStyle: 'hip', roofLevels: 13, overhang: 5, curve: 0.78,
    tile: C.goldTile, tileDk: C.goldTileDk, ridgeColor: C.ridgeGold,
    doubleEave: true, upperWallH: 8, upperShrink: 5, skirtLevels: 4, skirtExtra: 4,
    bays: 5, doorBays: 'center', plaque: true, stairsW: 22,
  });
  marks.main = main;

  /* 东西配殿（歇山顶，绿琉璃） */
  for (const [sx, facing] of [[-1, '+x'], [1, '-x']]) {
    A.hall(g, {
      cx: sx * PLAN.sideX, cz: PLAN.sideZ, w: 16, d: 36,
      baseY: 1, platH: 3, platPad: 5, wallH: 10, wallT: 1,
      facing, ridgeAxis: 'z', roofStyle: 'xieshan', roofLevels: 11, overhang: 4, curve: 0.8,
      tile: C.greenTile, tileDk: C.greenTileDk, ridgeColor: C.stoneLt,
      bays: 3, doorBays: 'all', stairsW: 12,
    });
  }

  /* 钟楼 / 鼓楼（攒尖顶） */
  marks.towers = [
    A.tower(g, { cx: -PLAN.towerX, cz: PLAN.towerZ, w: 16, baseY: 1, platH: 3, facing: '+x', kind: 'bell' }),
    A.tower(g, { cx: PLAN.towerX, cz: PLAN.towerZ, w: 16, baseY: 1, platH: 3, facing: '-x', kind: 'drum' }),
  ];

  /* 宝塔（密檐方形塔 + 攒尖顶 + 塔刹） */
  marks.pagoda = A.pagoda(g, { cx: PLAN.pagoda.cx, cz: PLAN.pagoda.cz, baseY: 1, stories: 6, baseHalf: 12, bodyH: 5, shrink: 1 });
}

/* ------------------------------------------------------------------ *
 *  陈设与绿化
 * ------------------------------------------------------------------ */
function props(g, marks) {
  // 石狮（山门前）
  A.lion(g, { x: -27, z: 112, y: 1, dir: 1 });
  A.lion(g, { x: 27, z: 112, y: 1, dir: 1 });

  // 灯笼：山门 2 盏
  for (const x of [-13, 13]) {
    A.lantern(g, { x, y: 12, z: 108, cord: 2 });
    marks.lights.push({ x, y: 11, z: 108, intensity: 26, distance: 34 });
  }
  // 主殿檐下 4 盏
  for (const x of [-21, -7, 7, 21]) {
    A.lantern(g, { x, y: 19, z: -13, cord: 2 });
    if (Math.abs(x) === 21 || Math.abs(x) === 7) marks.lights.push({ x, y: 18, z: -13, intensity: 30, distance: 36 });
  }
  // 钟鼓楼各 2 盏
  for (const tx of [-PLAN.towerX, PLAN.towerX]) {
    for (const dz of [-6, 6]) A.lantern(g, { x: tx, y: 16, z: PLAN.towerZ + dz, cord: 2, glow: true });
  }
  // 宝塔每层檐角挂灯（只放发光体素，不加实时光源）
  for (let s = 0; s < 6; s++) {
    const y = 8 + s * 8;
    for (const x of [-10, 10]) A.lantern(g, { x, y, z: PLAN.pagoda.cz + 14 - s, cord: 1, glow: true });
  }

  // 香炉一对
  A.burner(g, { x: -26, z: -8 });
  A.burner(g, { x: 26, z: -8 });
  marks.lights.push({ x: -26, y: 9, z: -8, intensity: 18, distance: 24, color: 0xff8a3c });
  marks.lights.push({ x: 26, y: 9, z: -8, intensity: 18, distance: 24, color: 0xff8a3c });

  // 绿化：前广场、院外、后院
  const rnd = g.random;
  const outside = [];
  for (let z = -112; z <= 118; z += 13) {
    outside.push([-86 + Math.round(rnd() * 4), z], [86 - Math.round(rnd() * 4), z]);
  }
  for (let x = -80; x <= 80; x += 16) outside.push([x, -124 + Math.round(rnd() * 4)]);
  for (let x = -36; x <= 36; x += 12) outside.push([x, 116 + Math.round(rnd() * 5)]);
  for (const [x, z] of outside) {
    if (Math.abs(x) < 12 && z > 96) continue;
    A.tree(g, { x, z, y: 1, h: 8 + Math.round(rnd() * 5), r: 3, kind: 'pine' });
  }
  // 院内：山门内两株 + 后院柏树
  for (const [x, z] of [[-60, 86], [60, 86], [-38, -100], [38, -100], [-56, -92], [56, -92], [-40, -66], [40, -66]]) {
    A.tree(g, { x, z, y: 1, h: 11, r: 4, kind: 'round' });
  }
  // 角隅点景
  for (const [x, z] of [[-66, -8], [66, -8], [-66, 30], [66, 30]]) A.tree(g, { x, z, y: 1, h: 9, r: 3, kind: 'pine' });

  // 假山
  A.rock(g, { x: -34, z: -104, y: 1, r: 4 });
  A.rock(g, { x: 34, z: -104, y: 1, r: 3 });
  A.rock(g, { x: -52, z: 44, y: 1, r: 3 });
  A.rock(g, { x: 52, z: 44, y: 1, r: 3 });
}

/* ------------------------------------------------------------------ *
 *  远山（雾中剪影，增强纵深）
 * ------------------------------------------------------------------ */
function hills(g) {
  const mound = (mx, mz, r, h, color = C.hill) => {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        const top = Math.round(h * Math.pow(1 - d / r, 0.75));
        for (let y = 1; y <= top; y++) {
          const c = y > top - 3 ? C.grassDk : (g.hash3(mx + dx, y, mz + dz) > 0.72 ? C.stoneDk : color);
          g.set(mx + dx, y, mz + dz, c, { jitter: 0.1 });
        }
      }
  };
  // 背景群山（北）
  for (let x = -100; x <= 100; x += 22) mound(x, -126 - Math.round((x % 3) * 2), 16 + (Math.abs(x) % 7), 20 + (Math.abs(x) % 11));
  mound(0, -128, 22, 30);
  // 东西侧丘
  for (let z = -100; z <= 100; z += 34) { mound(-104, z, 12, 12 + (Math.abs(z) % 9)); mound(104, z, 12, 12 + (Math.abs(z) % 7)); }
  // 前方案山
  mound(-78, 126, 15, 12); mound(78, 126, 15, 10);
}

/* ------------------------------------------------------------------ *
 *  总装
 * ------------------------------------------------------------------ */
export function buildScene() {
  const t0 = performance.now();
  const g = new VoxelGrid(PLAN.grid);
  const marks = { lights: [] };

  groundLayer(g);
  hills(g);
  pavingPlan(g);
  pond(g, marks);
  walls(g);
  buildings(g, marks);
  props(g, marks);

  return { grid: g, marks, buildMs: performance.now() - t0 };
}
