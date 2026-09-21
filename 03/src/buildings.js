import { P } from './palette.js';

/**
 * 参数化中式建筑构件库。约定：
 * - 所有面阔/进深 (w, d) 均为偶数，建筑中心 (cx, cz) 为整数坐标；
 *   偶数宽 w 时占格 [cx-w/2, cx+w/2-1]。
 * - y 为体素层，地面顶面为 y=0.5（体素中心 y=0 与地面齐平），台基从 y=1 起。
 * - face: 'S'(南/正向+z) | 'N' | 'E' | 'W'，门窗开在朝向面。
 */

/* ---------------- 台基与台阶 ---------------- */
export function platform(b, cx, cz, w, d, h, color = P.stone) {
  const x0 = cx - w / 2, x1 = cx + w / 2 - 1;
  const z0 = cz - d / 2, z1 = cz + d / 2 - 1;
  b.fill(x0, h, z0, x1, h, z1, P.stoneLight);          // 台面
  for (let y = Math.max(1, h - 1); y < h; y++) b.ring(x0, z0, x1, z1, y, color);
  if (h >= 2) b.ring(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 1, P.stoneDark); // 底部收分
}

/** 踏跺：czFaceOut 为台基外第一格，dir=+1 向南（+z） */
export function stairs(b, cx, czFaceOut, w, h, dir = 1, color = P.stoneLight) {
  for (let k = 1; k <= h; k++) {
    const z = czFaceOut + dir * (k - 1);
    b.fill(cx - w / 2, h - k, z, cx + w / 2 - 1, h - k, z, color);
  }
}

/** 平台四周栏杆（望柱+栏板），gapS：南面中央留口宽度（对台阶） */
export function railing(b, cx, cz, w, d, y, gapHalfS = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2 - 1;
  const z0 = cz - d / 2, z1 = cz + d / 2 - 1;
  const post = (x, z) => { b.set(x, y, z, P.stoneLight); b.set(x, y + 1, z, P.stoneLight); };
  for (let x = x0; x <= x1; x++) {
    if (Math.abs(x - cx + 0.5) > gapHalfS) {          // 南面中央豁口
      if ((x - x0) % 3 === 0) post(x, z1); else b.set(x, y, z1, P.stone);
    }
    if ((x - x0) % 3 === 0) post(x, z0); else b.set(x, y, z0, P.stone);
  }
  for (let z = z0 + 1; z <= z1 - 1; z++) {
    if ((z - z0) % 3 === 0) { post(x0, z); post(x1, z); }
    else { b.set(x0, y, z, P.stone); b.set(x1, y, z, P.stone); }
  }
}

/* ---------------- 墙体 / 立柱 / 门窗 ---------------- */
export function walls(b, cx, cz, w, d, y0, h, o = {}) {
  const wall = o.wall ?? P.wallRed, col = o.column ?? P.columnRed;
  const face = o.face ?? 'S';
  const x0 = cx - w / 2, x1 = cx + w / 2 - 1;
  const z0 = cz - d / 2, z1 = cz + d / 2 - 1;
  for (let y = y0; y < y0 + h; y++) b.ring(x0, z0, x1, z1, y, wall);

  // 立柱：四角 + 沿檐墙每 3 格一根
  const cols = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  for (let x = x0 + 3; x <= x1 - 2; x += 3) cols.push([x, z0], [x, z1]);
  for (let z = z0 + 3; z <= z1 - 2; z += 3) cols.push([x0, z], [x1, z]);
  for (const [px, pz] of cols) b.fill(px, y0, pz, px, y0 + h - 1, pz, col);

  // 朝向面坐标映射
  const horiz = (face === 'S' || face === 'N');
  const c = horiz ? cx : cz;
  const lo = horiz ? x0 : z0, hi = horiz ? x1 : z1;
  const put = (t, y, color) => {
    if (face === 'S') b.set(t, y, z1, color);
    else if (face === 'N') b.set(t, y, z0, color);
    else if (face === 'E') b.set(x1, y, t, color);
    else b.set(x0, y, t, color);
  };
  const door = (center, dw, dh) => {
    const half = Math.floor(dw / 2);
    for (let t = center - half; t <= center - half + dw - 1; t++)
      for (let y = y0; y < y0 + dh; y++) put(t, y, P.door);
    if (dh < h) for (let t = center - half; t <= center - half + dw - 1; t++)
      put(t, y0 + dh, P.lattice);                     // 门楣横披窗
  };
  const win = (center) => {
    for (let t = center; t <= center + 1; t++)
      for (let y = y0 + 1; y <= y0 + Math.min(2, h - 1); y++) put(t, y, P.lattice);
  };

  const dh = Math.min(h - 1, 4);
  door(c, o.doorW ?? 3, dh);
  if (o.extraDoors) for (const off of o.extraDoors) if (c + off - 1 > lo && c + off + 1 < hi) door(c + off, 2, Math.min(3, dh));
  if (!o.noWindows) for (const off of [-6, 6]) if (c + off > lo + 1 && c + off + 1 < hi - 1) win(c + off);
  if (o.backDoor) {                                   // 背面开门（山门过厅）
    const put2 = (t, y, color) => {
      if (face === 'S') b.set(t, y, z0, color); else if (face === 'N') b.set(t, y, z1, color);
      else if (face === 'E') b.set(x0, y, t, color); else b.set(x1, y, t, color);
    };
    const half = Math.floor((o.doorW ?? 3) / 2);
    for (let t = c - half; t <= c - half + (o.doorW ?? 3) - 1; t++)
      for (let y = y0; y < y0 + dh; y++) put2(t, y, P.door);
  }
}

/* ---------------- 斗拱（檐下铺作层） ---------------- */
export function brackets(b, cx, cz, w, d, y) {
  const x0 = cx - w / 2 - 1, x1 = cx + w / 2;
  const z0 = cz - d / 2 - 1, z1 = cz + d / 2;
  for (let x = x0; x <= x1; x += 2) { b.set(x, y, z0, P.bracket); b.set(x, y, z1, P.bracket); }
  for (let z = z0 + 1; z <= z1 - 1; z += 2) { b.set(x0, y, z, P.bracket); b.set(x1, y, z, P.bracket); }
  for (let x = x0 + 1; x <= x1; x += 4) {             // 上层小斗
    b.set(x, y + 1, z0, P.wood); b.set(x, y + 1, z1, P.wood);
    b.set(x, y + 1, z0 + 1, P.wood); b.set(x, y + 1, z1 - 1, P.wood);
  }
}

/* ---------------- 屋顶 ---------------- */
/** 檐口平板 + 深色剪边 + 四角起翘 */
export function slab(b, cx, cz, w, d, y, tile, edge) {
  const x0 = cx - w / 2, x1 = cx + w / 2 - 1;
  const z0 = cz - d / 2, z1 = cz + d / 2 - 1;
  b.fill(x0, y, z0, x1, y, z1, tile);
  b.ring(x0, z0, x1, z1, y, edge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {  // 飞檐翘角
    const cxx = sx < 0 ? x0 : x1, czz = sz < 0 ? z0 : z1;
    b.set(cxx, y + 1, czz, edge);
    b.set(cxx + sx, y + 1, czz, edge);
    b.set(cxx, y + 1, czz + sz, edge);
  }
}
function cornerRaise(b, cx, cz, w, d, y, color) {
  const x0 = cx - w / 2, x1 = cx + w / 2 - 1;
  const z0 = cz - d / 2, z1 = cz + d / 2 - 1;
  b.set(x0, y + 1, z0, color); b.set(x1, y + 1, z0, color);
  b.set(x0, y + 1, z1, color); b.set(x1, y + 1, z1, color);
}
/** 正脊 + 两端鸱吻 */
function ridgeLine(b, cx, cz, ww, dd, y, ridge, ornament) {
  if (dd < 2 && ww >= 2) {
    b.fill(cx - ww / 2, y, cz, cx + ww / 2 - 1, y, cz, ridge);
    b.set(cx - ww / 2, y + 1, cz, ornament); b.set(cx + ww / 2 - 1, y + 1, cz, ornament);
  } else if (ww < 2 && dd >= 2) {
    b.fill(cx, y, cz - dd / 2, cx, y, cz + dd / 2 - 1, ridge);
    b.set(cx, y + 1, cz - dd / 2, ornament); b.set(cx, y + 1, cz + dd / 2 - 1, ornament);
  } else {
    b.fill(cx - 1, y, cz - 1, cx, y, cz, ridge);
  }
}

/** 庑殿顶：四面收分，顶端正脊 */
export function hipRoof(b, cx, cz, w, d, y, o = {}) {
  const tile = o.tile ?? P.tileGrey, edge = o.edge ?? P.tileGreyEdge;
  slab(b, cx, cz, w, d, y, tile, edge);
  let ww = w - 2, dd = d - 2, yy = y + 1;
  while (ww >= 2 && dd >= 2) {
    b.ring(cx - ww / 2, cz - dd / 2, cx + ww / 2 - 1, cz + dd / 2 - 1, yy, tile);
    if (ww >= 6 && dd >= 6) cornerRaise(b, cx, cz, ww, dd, yy, edge);
    ww -= 2; dd -= 2; yy++;
  }
  ridgeLine(b, cx, cz, ww, dd, yy, o.ridge ?? P.ridgeGrey, o.ornament ?? P.gold);
}

/** 歇山顶：下部两层四面收分，上部前后坡收分、两端留山墙 */
export function xieshanRoof(b, cx, cz, w, d, y, o = {}) {
  const tile = o.tile ?? P.tileGreen, edge = o.edge ?? P.tileGreenEdge;
  slab(b, cx, cz, w, d, y, tile, edge);
  let ww = w - 2, dd = d - 2, yy = y + 1;
  for (let i = 0; i < 2 && ww >= 2 && dd >= 2; i++) {      // 歇山收山
    b.ring(cx - ww / 2, cz - dd / 2, cx + ww / 2 - 1, cz + dd / 2 - 1, yy, tile);
    if (ww >= 6 && dd >= 6) cornerRaise(b, cx, cz, ww, dd, yy, edge);
    ww -= 2; dd -= 2; yy++;
  }
  while (dd >= 2) {                                        // 上部悬山段
    b.ring(cx - ww / 2, cz - dd / 2, cx + ww / 2 - 1, cz + dd / 2 - 1, yy, tile);
    const gx0 = cx - ww / 2, gx1 = cx + ww / 2 - 1;        // 山墙（红色木作填充）
    b.fill(gx0, y + 1, cz - dd / 2, gx0, yy, cz + dd / 2 - 1, o.gable ?? P.gable);
    b.fill(gx1, y + 1, cz - dd / 2, gx1, yy, cz + dd / 2 - 1, o.gable ?? P.gable);
    dd -= 2; yy++;
  }
  ridgeLine(b, cx, cz, ww, dd, yy, o.ridge ?? P.ridgeGreen, o.ornament ?? P.gold);
}

/** 攒尖顶：方形收分至宝顶（亭 / 塔刹用） */
export function pyramidalRoof(b, cx, cz, w, d, y, o = {}) {
  const tile = o.tile ?? P.tileGrey, edge = o.edge ?? P.tileGreyEdge;
  slab(b, cx, cz, w, d, y, tile, edge);
  let ww = w - 2, dd = d - 2, yy = y + 1;
  while (ww >= 2 && dd >= 2) {
    b.ring(cx - ww / 2, cz - dd / 2, cx + ww / 2 - 1, cz + dd / 2 - 1, yy, tile);
    if (ww >= 6 && dd >= 6) cornerRaise(b, cx, cz, ww, dd, yy, edge);
    ww -= 2; dd -= 2; yy++;
  }
  const g = o.ornament ?? P.gold;                          // 宝顶刹
  b.fill(cx - 1, yy, cz - 1, cx, yy + 1, cz, g);
  b.set(cx - 1, yy + 2, cz - 1, g); b.set(cx, yy + 2, cz, g);
}

/* ---------------- 单体建筑组合 ---------------- */
/** 通用殿堂：台基 + 台阶 + 墙柱门窗 + 斗拱 + 屋顶('hip'|'xieshan') */
export function hall(b, cx, cz, w, d, o = {}) {
  const ph = o.platH ?? 2, wh = o.wallH ?? 4;
  const face = o.face ?? 'S';
  platform(b, cx, cz, w + 4, d + 4, ph);
  const pw = w + 4, pd = d + 4;
  if (face === 'S') stairs(b, cx, cz + pd / 2, o.stairW ?? 6, ph, +1);
  else if (face === 'N') stairs(b, cx, cz - pd / 2, o.stairW ?? 6, ph, -1);
  else if (face === 'E') {                               // 侧面台阶（东西向）
    for (let k = 1; k <= ph; k++)
      b.fill(cx + pw / 2 + (k - 1), ph - k, cz - 3, cx + pw / 2 + (k - 1), ph - k, cz + 2, P.stoneLight);
  } else {
    for (let k = 1; k <= ph; k++)
      b.fill(cx - pw / 2 - (k - 1), ph - k, cz - 3, cx - pw / 2 - (k - 1), ph - k, cz + 2, P.stoneLight);
  }
  const y0 = ph + 1;
  walls(b, cx, cz, w, d, y0, wh, o);
  brackets(b, cx, cz, w, d, y0 + wh);
  const roofFn = o.roof === 'xieshan' ? xieshanRoof : hipRoof;
  roofFn(b, cx, cz, w + 6, d + 6, y0 + wh + 1, o);
  return y0 + wh + 1;                                    // 檐口高度
}

/** 主殿：重檐庑殿顶，须弥座台基 + 栏杆 */
export function mainHall(b, cx, cz) {
  const w = 30, d = 18, ph = 3;
  platform(b, cx, cz, w + 4, d + 4, ph);
  stairs(b, cx, cz + (d + 4) / 2, 8, ph, +1);
  railing(b, cx, cz, w + 4, d + 4, ph + 1, 5);
  // 下檐
  const y0 = ph + 1;
  walls(b, cx, cz, w, d, y0, 4, { face: 'S', doorW: 5 });
  brackets(b, cx, cz, w, d, y0 + 4);
  slab(b, cx, cz, w + 4, d + 4, y0 + 5, P.tileYellow, P.tileYellowEdge);
  // 上层身（收进 2 间）
  const w2 = w - 4, d2 = d - 4, y1 = y0 + 6;
  walls(b, cx, cz, w2, d2, y1, 3, { face: 'S', wall: P.wallRed, column: P.columnRed });
  brackets(b, cx, cz, w2, d2, y1 + 3);
  hipRoof(b, cx, cz, w2 + 6, d2 + 6, y1 + 4, {
    tile: P.tileYellow, edge: P.tileYellowEdge, ridge: P.ridgeYellow, ornament: P.gold,
  });
}

/** 钟鼓楼：两层方形楼阁，攒尖顶；kind: 'bell' | 'drum' */
export function tower(b, cx, cz, kind = 'bell') {
  const ph = 2;
  platform(b, cx, cz, 14, 14, ph);
  stairs(b, cx, cz + 7, 6, ph, +1);
  const y0 = ph + 1;
  walls(b, cx, cz, 10, 10, y0, 4, { face: 'S', doorW: 3 });
  brackets(b, cx, cz, 10, 10, y0 + 4);
  slab(b, cx, cz, 16, 16, y0 + 5, P.tileGrey, P.tileGreyEdge);
  // 二层：四面开敞，内悬钟 / 鼓
  const y1 = y0 + 6;
  walls(b, cx, cz, 8, 8, y1, 3, { face: 'S', doorW: 3, noWindows: true });
  const inner = kind === 'bell' ? P.gold : 0x9c3a26;
  b.fill(cx - 1, y1 + 1, cz - 1, cx, y1 + 2, cz, inner);          // 钟/鼓本体
  b.set(cx, y1 + 3, cz, P.wood);                                   // 悬挂梁
  brackets(b, cx, cz, 8, 8, y1 + 3);
  pyramidalRoof(b, cx, cz, 12, 12, y1 + 4, { tile: P.tileGrey, edge: P.tileGreyEdge });
}

/** 宝塔：多层密檐方塔，逐层收分，攒尖刹 */
export function pagoda(b, cx, cz, floors = 5) {
  platform(b, cx, cz, 16, 16, 2);
  stairs(b, cx, cz + 8, 4, 2, +1);
  let w = 12, y = 3;
  for (let f = 0; f < floors; f++) {
    walls(b, cx, cz, w, w, y, 3, {
      face: 'S', doorW: 2, wall: f % 2 ? P.wallRed : 0xb0453a, column: P.columnRed, noWindows: f > 0,
    });
    brackets(b, cx, cz, w, w, y + 3);
    slab(b, cx, cz, w + 4, w + 4, y + 4, P.tileGreen, P.tileGreenEdge);
    w -= 2; y += 5;
  }
  // 塔刹
  b.fill(cx - 1, y, cz - 1, cx, y + 1, cz, P.tileGreenEdge);
  b.fill(cx - 1, y + 2, cz - 1, cx, y + 4, cz, P.gold);
  b.set(cx - 1, y + 5, cz - 1, P.gold); b.set(cx, y + 5, cz, P.gold);
}

/** 山门（入口门楼）：庑殿顶、前后贯通三门 */
export function gatehouse(b, cx, cz) {
  hall(b, cx, cz, 18, 10, {
    platH: 2, wallH: 4, roof: 'hip', face: 'S', doorW: 3,
    extraDoors: [-6, 6], noWindows: true, backDoor: true, stairW: 6,
    tile: P.tileGrey, edge: P.tileGreyEdge, ridge: P.ridgeGrey, ornament: P.gold,
  });
  // 北面也开台阶
  stairs(b, cx, cz - 5 - 2, 6, 2, -1);
}

/* ---------------- 小品 ---------------- */
/** 石狮（抽象体素造型），dir=+1 面朝南 */
export function lion(b, x, z, dir = 1) {
  b.fill(x - 1, 1, z - 1, x, 1, z, P.stoneDark);            // 座
  b.fill(x - 1, 2, z - 1, x, 3, z, P.lion);                 // 身
  b.fill(x - 1, 4, z + (dir > 0 ? 0 : -1), x, 5, z + (dir > 0 ? 0 : -1), P.lion); // 头
  b.set(x - (dir > 0 ? 0 : 1), 4, z + dir, P.stoneLight);   // 吻部
  b.set(x - 1, 6, z + (dir > 0 ? 0 : -1), P.lion);          // 耳
  b.set(x, 3, z - dir, P.lion);                             // 尾
}

/** 灯笼杆：木杆挑臂挂红灯（自发光） */
export function lanternPost(b, x, z, dir = 1) {
  b.fill(x, 1, z, x, 5, z, P.wood);
  b.set(x + dir, 5, z, P.wood);                             // 挑臂
  b.set(x + dir, 4, z, P.lanternCap);
  b.set(x + dir, 3, z, P.lantern, { emissive: true });      // 灯身
  b.set(x + dir, 2, z, P.lantern, { emissive: true });
  b.set(x + dir, 1, z, P.lanternCap);                       // 坠
}

/** 桧柏（塔形） */
export function cypress(b, x, z, h = 4) {
  b.fill(x, 1, z, x, h, z, P.trunk);
  b.fill(x - 1, h + 1, z - 1, x + 1, h + 2, z + 1, P.pineDark);
  b.fill(x, h + 3, z, x, h + 4, z, P.pine);
}
/** 松树（伞形） */
export function pine(b, x, z, h = 4) {
  b.fill(x, 1, z, x, h, z, P.trunk);
  b.fill(x - 2, h + 1, z - 2, x + 2, h + 1, z + 2, P.pine);
  b.fill(x - 1, h + 2, z - 1, x + 1, h + 2, z + 1, P.pineDark);
  b.set(x, h + 3, z, P.pine);
}
