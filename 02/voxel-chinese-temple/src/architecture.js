/**
 * architecture.js —— 中式古典建筑的体素生成器
 *
 * 提供：台基/台阶/栏杆、墙体与门窗隔扇、斗拱额枋、
 *      庑殿顶 / 歇山顶 / 攒尖顶（带飞檐翘角、垂脊、正脊、鸱吻、瓦当、檐椽）、
 *      殿宇、山门、钟鼓楼、宝塔、院墙、回廊、石狮、灯笼、香炉、树木等。
 *
 * 所有尺寸单位为「体素」，1 体素 = 1 世界单位。
 */
import { C } from './palette.js';

export { C };

const sgn = (v) => (v >= 0 ? 1 : -1);

/** 取整并保证偶数/对称 */
export const half = (w) => Math.floor(w / 2);

/* ------------------------------------------------------------------ *
 *  通用：矩形环上的格子（带朝外法向）
 * ------------------------------------------------------------------ */
export function ringCells(x0, x1, z0, z1) {
  const out = [];
  for (let x = x0; x <= x1; x++) { out.push([x, z0, 0, -1]); out.push([x, z1, 0, 1]); }
  for (let z = z0 + 1; z <= z1 - 1; z++) { out.push([x0, z, -1, 0]); out.push([x1, z, 1, 0]); }
  return out;
}

/* ------------------------------------------------------------------ *
 *  台基、台阶、栏杆
 * ------------------------------------------------------------------ */
export function platform(g, { cx, cz, w, d, y = 1, h = 3, color = C.marble, dark = C.stoneDk, light = C.stoneLt }) {
  const x0 = cx - half(w), x1 = cx + half(w);
  const z0 = cz - half(d), z1 = cz + half(d);
  g.fill(x0, x1, y, y + h - 1, z0, z1, color, { jitter: 0.035 });
  g.ring(y + h - 1, x0, x1, z0, z1, light, { jitter: 0.03 });      // 压面石
  if (h >= 3) g.ring(y + Math.floor(h / 2), x0, x1, z0, z1, dark, { jitter: 0.03 }); // 须弥座束腰
  if (h >= 4) g.ring(y + 1, x0, x1, z0, z1, dark, { jitter: 0.03 });                 // 圭角
  return { x0, x1, z0, z1, top: y + h };
}

/** 台阶：dir 为下行方向（'+z' | '-z' | '+x' | '-x'），line 为台基外沿坐标 */
export function stairs(g, { dir, line, a0, a1, y = 1, h = 3, color = C.marble, light = C.stoneLt, dark = C.stoneDk, dragon = true, side = true }) {
  const out = dir === '+z' || dir === '+x' ? 1 : -1;
  const alongX = dir === '+z' || dir === '-z';
  const n = Math.max(1, h - 1);
  for (let k = 0; k < n; k++) {
    const top = y + h - 2 - k;
    const c = line + out * (k + 1);
    for (let a = a0; a <= a1; a++) {
      if (top < y) continue;
      const col = dragon && Math.abs(a - (a0 + a1) / 2) < 1.5 ? light : color;
      if (alongX) g.fill(a, a, y, top, c, c, col, { jitter: 0.03 });
      else g.fill(c, c, y, top, a, a, col, { jitter: 0.03 });
    }
    // 垂带（两侧斜栏）
    if (side) {
      const tl = top + 1;
      if (alongX) {
        g.fill(a0 - 1, a0 - 1, y, tl, c, c, light, {}); g.fill(a1 + 1, a1 + 1, y, tl, c, c, light, {});
        g.fill(a0 - 2, a0 - 2, y, top, c, c, color, {}); g.fill(a1 + 2, a1 + 2, y, top, c, c, color, {});
      } else {
        g.fill(c, c, y, tl, a0 - 1, a0 - 1, light, {}); g.fill(c, c, y, tl, a1 + 1, a1 + 1, light, {});
        g.fill(c, c, y, top, a0 - 2, a0 - 2, color, {}); g.fill(c, c, y, top, a1 + 2, a1 + 2, color, {});
      }
    }
  }
}

/** 汉白玉栏杆（望柱 + 栏板） */
export function balustrade(g, { x0, x1, z0, z1, y, color = C.marble, post = C.stoneLt, gaps = [] }) {
  const inGap = (x, z) => gaps.some((gp) => {
    if (gp.dir === '+z' || gp.dir === '-z') return z === (gp.dir === '+z' ? z1 : z0) && x >= gp.a0 - 2 && x <= gp.a1 + 2;
    return x === (gp.dir === '+x' ? x1 : x0) && z >= gp.a0 - 2 && z <= gp.a1 + 2;
  });
  const cells = ringCells(x0, x1, z0, z1);
  let i = 0;
  for (const [x, z] of cells) {
    if (inGap(x, z)) { i++; continue; }
    g.set(x, y, z, color, { jitter: 0.03 });
    if (i % 3 === 0) g.set(x, y + 1, z, post, { jitter: 0.03 });
    i++;
  }
}

/* ------------------------------------------------------------------ *
 *  中式屋顶
 * ------------------------------------------------------------------ */
/**
 * @param o.cx,o.cz   平面中心
 * @param o.w,o.d     檐口外沿总宽 / 总深
 * @param o.y         檐口所在体素层
 * @param o.levels    竖向层数（决定举架高度）
 * @param o.ridgeAxis 正脊方向 'x' | 'z'
 * @param o.style     'hip'(庑殿) | 'xieshan'(歇山) | 'pyramid'(攒尖)
 * @param o.noRidge   只做腰檐/裙檐（不加正脊）
 * @returns 屋顶最高体素层
 */
export function chineseRoof(g, o) {
  const {
    cx, cz, w, d, y, levels,
    ridgeAxis = 'x', style = 'hip',
    ridgeHalf = null, breakP = 0.52,
    tile = C.goldTile, tileDk = C.goldTileDk, tileLt = C.goldTileLt,
    ridge = C.ridgeGold, ridgeDk = C.ridgeDark,
    gableColor = C.plaster, barge = C.woodDk,
    flare = 2, curve = 0.8, ridgeH = 2, noRidge = false,
    rafters = true, eaveDots = true, jitter = 0.055, stripes = true,
    inner = null,
  } = o;

  const swap = ridgeAxis === 'z';
  const hu0 = half(swap ? d : w);
  const hv0 = half(swap ? w : d);
  const map = swap ? (u, v) => [cx + v, cz + u] : (u, v) => [cx + u, cz + v];
  const put = (u, yy, v, color, opts = {}) => { const [X, Z] = map(u, v); g.set(X, yy, Z, color, opts); };
  const bar = (u0, u1, yy, v0, v1, color, opts = {}) => {
    const [ax, az] = map(u0, v0), [bx, bz] = map(u1, v1);
    g.fill(Math.min(ax, bx), Math.max(ax, bx), yy, yy, Math.min(az, bz), Math.max(az, bz), color, { jitter, ...opts });
  };

  let huTop, hvTop;
  if (style === 'pyramid') { huTop = 1; hvTop = 1; }
  else if (style === 'xieshan') { huTop = ridgeHalf ?? Math.max(2, Math.round(hu0 * 0.34)); hvTop = 0; }
  else { huTop = ridgeHalf ?? Math.max(2, Math.round(hu0 * 0.30)); hvTop = 0; }

  const insU = hu0 - huTop, insV = hv0 - hvTop;
  const kBreak = style === 'xieshan' ? Math.max(1, Math.round(levels * breakP)) : levels;

  const layers = [];
  let holdU = hu0, prevU = hu0, prevV = hv0;
  for (let i = 0; i < levels; i++) {
    const p = levels > 1 ? i / (levels - 1) : 1;
    const f = Math.pow(p, curve);           // 举折：檐口缓、脊部陡
    let HU = Math.round(hu0 - insU * f);
    let HV = Math.round(hv0 - insV * f);
    if (style === 'xieshan' && i >= kBreak) HU = holdU; else holdU = HU;
    HU = Math.max(0, Math.min(HU, prevU));
    HV = Math.max(0, Math.min(HV, prevV));
    prevU = HU; prevV = HV;
    layers.push([HU, HV]);
    bar(-HU, HU, y + i, -HV, HV, i === 0 ? tileDk : tile);
    // 瓦垄（沿坡面方向的浅色瓦条，让大屋面有肌理）
    if (stripes && i > 0) {
      for (let u = -HU + 1; u <= HU - 1; u += 3) bar(u, u, y + i, -HV, HV, tileLt, { jitter: 0.03 });
    }
    // 垂脊
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      put(su * HU, y + i, sv * HV, ridge);
      if (HU > 0) put(su * HU, y + i, sv * Math.max(0, HV - 1), ridge);
      if (HV > 0) put(su * Math.max(0, HU - 1), y + i, sv * HV, ridge);
    }
  }

  // 山花（歇山顶两端三角面）+ 博风板
  if (style === 'xieshan') {
    for (let i = kBreak; i < levels; i++) {
      const [HU, HV] = layers[i];
      for (let v = -HV; v <= HV; v++) {
        const edge = Math.abs(v) === HV;
        for (const su of [-1, 1]) put(su * HU, y + i, v, edge ? barge : gableColor);
      }
    }
  }

  // 檐椽：檐下按 2 格一根的椽子（只铺在墙外挑檐范围内，形成檐下木构肌理）
  if (rafters) {
    const iu = inner ? half(swap ? inner.d : inner.w) : -1;
    const iv = inner ? half(swap ? inner.w : inner.d) : -1;
    if (inner) {
      for (let u = -hu0; u <= hu0; u += 2) {
        bar(u, u, y - 1, -hv0, -iv - 1, C.woodDk);
        bar(u, u, y - 1, iv + 1, hv0, C.woodDk);
      }
      for (let v = -iv; v <= iv; v += 2) {
        bar(-hu0, -iu - 1, y - 1, v, v, C.woodDk);
        bar(iu + 1, hu0, y - 1, v, v, C.woodDk);
      }
    }
    for (let u = -hu0; u <= hu0; u += 2) { put(u, y - 1, hv0, C.woodLt); put(u, y - 1, -hv0, C.woodLt); }
    for (let v = -hv0; v <= hv0; v += 2) { put(hu0, y - 1, v, C.woodLt); put(-hu0, y - 1, v, C.woodLt); }
  }
  if (eaveDots) {
    for (let u = -hu0; u <= hu0; u += 3) { put(u, y, hv0, tileLt); put(u, y, -hv0, tileLt); }
    for (let v = -hv0; v <= hv0; v += 3) { put(hu0, y, v, tileLt); put(-hu0, y, v, tileLt); }
  }
  // 飞檐翘角
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    for (let k = 1; k <= flare; k++) {
      const u = su * (hu0 + k), v = sv * (hv0 + k);
      const yy = y + Math.round(k * 0.55);
      put(u, yy, v, ridge);
      put(u - su, yy, v, tileLt);
      put(u, yy, v - sv, tileLt);
      if (k === flare) put(u, yy + 1, v, ridgeDk);
    }
  }

  const [huT, hvT] = layers[layers.length - 1];
  const ry = y + levels;

  if (noRidge) return ry - 1;

  if (style === 'pyramid') {
    bar(-1, 1, ry, -1, 1, ridge);
    put(0, ry + 1, 0, ridge); put(0, ry + 2, 0, ridge);
    bar(-1, 1, ry + 3, -1, 1, ridge);
    put(0, ry + 4, 0, ridgeDk);
    return ry + 4;
  }

  // 正脊
  for (let hh = 0; hh < ridgeH; hh++) {
    const sh = hh === 0 ? 0 : 1;
    bar(-Math.max(0, huT - sh), Math.max(0, huT - sh), ry + hh, 0, 0, hh === 0 ? ridge : ridgeDk);
  }
  const top = ry + ridgeH - 1;
  // 正吻（两端起翘，小型兽吻）
  for (const su of [-1, 1]) {
    put(su * huT, top + 1, 0, ridgeDk);
    put(su * (huT + 1), top + 1, 0, ridgeDk);
    put(su * (huT + 1), top + 2, 0, ridge);
    if (hvT >= 0) { put(su * huT, top + 2, 0, ridgeDk); }
  }
  return top + 2;
}

/* ------------------------------------------------------------------ *
 *  斗拱 / 额枋
 * ------------------------------------------------------------------ */
export function dougong(g, { x0, x1, z0, z1, y, beam = C.woodDk, block = C.wood, accent = C.gold, step = 3 }) {
  g.ring(y, x0, x1, z0, z1, beam, { jitter: 0.03 });
  let i = 0;
  for (const [x, z, dx, dz] of ringCells(x0, x1, z0, z1)) {
    if (i % step === 0) {
      g.set(x + dx, y + 1, z + dz, block, { jitter: 0.03 });
      g.set(x + dx, y + 2, z + dz, accent, {});
      g.set(x, y + 1, z, block, { jitter: 0.03 });
    }
    i++;
  }
  return y + 2;
}

/* ------------------------------------------------------------------ *
 *  立面：隔扇门 / 槛窗 / 立柱 / 匾额
 * ------------------------------------------------------------------ */
function facePainter(g, dir, plane, x0, x1, z0, z1) {
  // 沿立面的局部坐标 a 映射到世界坐标
  if (dir === '+z' || dir === '-z') {
    const a0 = x0, a1 = x1;
    return { a0, a1, put: (a, y, c, o) => g.set(a, y, plane, c, o) };
  }
  const a0 = z0, a1 = z1;
  return { a0, a1, put: (a, y, c, o) => g.set(plane, y, a, c, o) };
}

export function decorateFacade(g, o) {
  const {
    dir, plane, x0, x1, z0, z1,
    floorY, wallTop, bays = 5,
    wall = C.wallRed, wallLt = C.wallRedLt,
    columnColor = C.column, wood = C.wood, woodDk = C.woodDk,
    door = C.doorRed, paper = C.windowPaper, gold = C.gold,
    plaque = false, doorBays = 'center', doorH = null,
  } = o;
  const { a0, a1, put } = facePainter(g, dir, plane, x0, x1, z0, z1);
  const len = a1 - a0;
  const wallH = wallTop - floorY + 1;
  const dH = doorH ?? Math.min(wallH - 4, 8);
  const yDoor0 = floorY, yDoor1 = floorY + dH - 1;
  const yWin0 = yDoor1 + 1, yWin1 = wallTop - 1;

  // 每间分界柱位
  const cols = [];
  for (let i = 0; i <= bays; i++) cols.push(a0 + Math.round((i * len) / bays));

  for (let b = 0; b < bays; b++) {
    const ca = cols[b], cb = cols[b + 1];
    const isDoor = doorBays === 'all' || (doorBays === 'center' && Math.abs((ca + cb) / 2 - (a0 + a1) / 2) <= len / bays);
    // 门 / 墙
    for (let a = ca + 1; a <= cb - 1; a++) {
      for (let y = yDoor0; y <= yDoor1; y++) {
        if (isDoor) {
          const stud = (y - yDoor0) % 4 === 2 && (a - ca) % 3 === 0;
          put(a, y, stud ? gold : door, { jitter: 0.04 });
        } else {
          put(a, y, ((a + y) % 5 === 0) ? wallLt : wall, { jitter: 0.04 });
        }
      }
      // 槛窗（棂条，两格一根）
      for (let y = yWin0; y <= yWin1; y++) {
        const frame = (a - ca) % 2 === 0 || y % 2 === 0;
        put(a, y, frame ? woodDk : paper, { jitter: 0.03 });
      }
      // 墙裙
      put(a, floorY, C.stone, { jitter: 0.03 });
    }
    // 立柱（角柱出头，凸出墙面一格）
    for (const cc of [ca, cb]) {
      for (let y = floorY; y <= wallTop; y++) {
        put(cc, y, columnColor, { jitter: 0.03 });
        const [ox, , oz] = dir === '+z' ? [0, 0, 1] : dir === '-z' ? [0, 0, -1] : dir === '+x' ? [1, 0, 0] : [-1, 0, 0];
        if (dir === '+z' || dir === '-z') g.set(cc, y, plane + oz, columnColor, { jitter: 0.03 });
        else g.set(plane + ox, y, cc, columnColor, { jitter: 0.03 });
      }
      put(cc, wallTop + 1, woodDk, {});
    }
  }

  // 匾额
  if (plaque) {
    const c0 = cols[Math.floor(bays / 2)], c1 = cols[Math.floor(bays / 2) + 1];
    for (let a = c0 + 1; a <= c1 - 1; a++) {
      for (let y = wallTop - 2; y <= wallTop; y++) {
        const edge = y === wallTop - 2 || y === wallTop || a === c0 + 1 || a === c1 - 1;
        put(a, y, edge ? gold : C.plaqueDark, { jitter: 0.02 });
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 *  大殿 / 配殿
 * ------------------------------------------------------------------ */
export function hall(g, o) {
  const {
    cx, cz, w, d,
    baseY = 1, platH = 3, platPad = 6,
    wallH = 12, wallT = 1, facing = '+z',
    ridgeAxis = 'x', roofStyle = 'hip', roofLevels = 12, overhang = 4, curve = 0.8,
    tile = C.goldTile, tileDk = C.goldTileDk, ridgeColor = C.ridgeGold,
    wall = C.wallRed, ridgeHalf = null, breakP = 0.52,
    doubleEave = false, upperWallH = 8, upperShrink = 5, skirtLevels = 4, skirtExtra = 4,
    bays = 5, doorBays = 'center', plaque = false, plaqueW = 0, stairsW = 0, railings = true,
    gable = C.plaster, doorH = null,
  } = o;

  const hw = half(w), hd = half(d);
  const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;

  // 台基
  const plat = platform(g, { cx, cz, w: w + platPad * 2, d: d + platPad * 2, y: baseY, h: platH });
  const floorY = baseY + platH;
  const wallTop = floorY + wallH - 1;

  // 台阶 + 栏杆
  const sw = stairsW || Math.round(w * 0.34);
  const gaps = [];
  if (facing === '+z') {
    stairs(g, { dir: '+z', line: plat.z1, a0: cx - half(sw), a1: cx + half(sw), y: baseY, h: platH, dragon: true });
    gaps.push({ dir: '+z', a0: cx - half(sw), a1: cx + half(sw) });
  } else if (facing === '-z') {
    stairs(g, { dir: '-z', line: plat.z0, a0: cx - half(sw), a1: cx + half(sw), y: baseY, h: platH, dragon: true });
    gaps.push({ dir: '-z', a0: cx - half(sw), a1: cx + half(sw) });
  } else if (facing === '+x') {
    stairs(g, { dir: '+x', line: plat.x1, a0: cz - half(sw), a1: cz + half(sw), y: baseY, h: platH, dragon: false, side: true });
    gaps.push({ dir: '+x', a0: cz - half(sw), a1: cz + half(sw) });
  } else {
    stairs(g, { dir: '-x', line: plat.x0, a0: cz - half(sw), a1: cz + half(sw), y: baseY, h: platH, dragon: false, side: true });
    gaps.push({ dir: '-x', a0: cz - half(sw), a1: cz + half(sw) });
  }
  if (railings) balustrade(g, { x0: plat.x0, x1: plat.x1, z0: plat.z0, z1: plat.z1, y: floorY, gaps });

  // 墙体（空心壳 → 门洞透出深色内室）
  const wt = wallT;
  g.fill(x0, x1, floorY, wallTop, z1 - wt + 1, z1, wall, { jitter: 0.035 });
  g.fill(x0, x1, floorY, wallTop, z0, z0 + wt - 1, wall, { jitter: 0.035 });
  g.fill(x0, x0 + wt - 1, floorY, wallTop, z0, z1, wall, { jitter: 0.035 });
  g.fill(x1 - wt + 1, x1, floorY, wallTop, z0, z1, wall, { jitter: 0.035 });
  // 室内地板
  g.fill(x0, x1, floorY, floorY, z0, z1, C.stoneDark, { jitter: 0.03 });

  // 四面立面
  const dims = { x0, x1, z0, z1 };
  const faces = [
    { dir: '+z', plane: z1, door: facing === '+z' },
    { dir: '-z', plane: z0, door: facing === '-z' },
    { dir: '+x', plane: x1, door: facing === '+x' },
    { dir: '-x', plane: x0, door: facing === '-x' },
  ];
  for (const f of faces) {
    decorateFacade(g, {
      dir: f.dir, plane: f.plane, ...dims,
      floorY, wallTop, bays: f.door ? bays : Math.max(2, Math.round(bays / 2)),
      wall, doorBays: f.door ? doorBays : 'none',
      plaque: plaque && f.door, doorH,
    });
  }

  // 斗拱 + 屋顶
  let roofTop;
  if (!doubleEave) {
    const beamTop = dougong(g, { x0, x1, z0, z1, y: wallTop + 1 });
    roofTop = chineseRoof(g, {
      cx, cz, w: w + overhang * 2, d: d + overhang * 2,
      y: beamTop + 1, levels: roofLevels, ridgeAxis, style: roofStyle,
      tile, tileDk, ridge: ridgeColor, ridgeHalf, breakP, curve, gableColor: gable,
      inner: { w, d },
    });
  } else {
    // 下层身 → 腰檐（裙檐）→ 平座 → 上层身 → 上层顶（重檐庑殿）
    const skirtY = dougong(g, { x0, x1, z0, z1, y: wallTop + 1 }) + 1;
    chineseRoof(g, {
      cx, cz, w: w + overhang * 2 + skirtExtra, d: d + overhang * 2 + skirtExtra,
      y: skirtY, levels: skirtLevels, ridgeAxis, style: 'hip',
      tile, tileDk, ridge: ridgeColor, noRidge: true, flare: 3, rafters: true, eaveDots: true,
      inner: { w, d },
    });
    const skirtTop = skirtY + skirtLevels;
    // 平座（回廊栏杆）
    const pr = upperShrink + 3;
    platform(g, { cx, cz, w: (hw - upperShrink) * 2 + pr * 2, d: (hd - upperShrink) * 2 + pr * 2, y: skirtTop, h: 1, color: C.wood, dark: C.woodDk, light: C.woodLt });
    balustrade(g, {
      x0: cx - (hw - upperShrink) - pr, x1: cx + (hw - upperShrink) + pr,
      z0: cz - (hd - upperShrink) - pr, z1: cz + (hd - upperShrink) + pr, y: skirtTop + 1, color: C.marble,
    });
    // 上层身
    const ux0 = cx - (hw - upperShrink), ux1 = cx + (hw - upperShrink);
    const uz0 = cz - (hd - upperShrink), uz1 = cz + (hd - upperShrink);
    const uFloor = skirtTop + 1, uTop = uFloor + upperWallH - 1;
    g.fill(ux0, ux1, uFloor, uTop, uz1 - 1, uz1, wall, { jitter: 0.035 });
    g.fill(ux0, ux1, uFloor, uTop, uz0, uz0 + 1, wall, { jitter: 0.035 });
    g.fill(ux0, ux0 + 1, uFloor, uTop, uz0, uz1, wall, { jitter: 0.035 });
    g.fill(ux1 - 1, ux1, uFloor, uTop, uz0, uz1, wall, { jitter: 0.035 });
    decorateFacade(g, { dir: '+z', plane: uz1, x0: ux0, x1: ux1, z0: uz0, z1: uz1, floorY: uFloor, wallTop: uTop, bays: bays, doorBays: 'none', wall });
    decorateFacade(g, { dir: '-z', plane: uz0, x0: ux0, x1: ux1, z0: uz0, z1: uz1, floorY: uFloor, wallTop: uTop, bays: bays, doorBays: 'none', wall });
    const uBeam = dougong(g, { x0: ux0, x1: ux1, z0: uz0, z1: uz1, y: uTop + 1, step: 2 });
    roofTop = chineseRoof(g, {
      cx, cz, w: (hw - upperShrink) * 2 + overhang * 2, d: (hd - upperShrink) * 2 + overhang * 2,
      y: uBeam + 1, levels: roofLevels, ridgeAxis, style: roofStyle,
      tile, tileDk, ridge: ridgeColor, ridgeHalf, breakP, curve, gableColor: gable,
      inner: { w: (hw - upperShrink) * 2, d: (hd - upperShrink) * 2 },
    });
  }

  return { x0, x1, z0, z1, floorY, wallTop, roofTop, plat, eaveY: wallTop + 4, facing };
}

/* ------------------------------------------------------------------ *
 *  山门
 * ------------------------------------------------------------------ */
export function gateHouse(g, o) {
  const {
    cx, cz, w = 38, d = 16, baseY = 1, platH = 2, platPad = 5,
    wallH = 9, tile = C.goldTile, tileDk = C.goldTileDk,
    roofStyle = 'xieshan', roofLevels = 10, overhang = 4, bays = 3,
  } = o;
  const hw = half(w), hd = half(d);
  const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;
  const plat = platform(g, { cx, cz, w: w + platPad * 2, d: d + platPad * 2, y: baseY, h: platH });
  const floorY = baseY + platH, wallTop = floorY + wallH - 1;

  stairs(g, { dir: '+z', line: plat.z1, a0: cx - 9, a1: cx + 9, y: baseY, h: platH, dragon: true });
  stairs(g, { dir: '-z', line: plat.z0, a0: cx - 9, a1: cx + 9, y: baseY, h: platH, dragon: true });
  balustrade(g, { x0: plat.x0, x1: plat.x1, z0: plat.z0, z1: plat.z1, y: floorY, gaps: [{ dir: '+z', a0: cx - 9, a1: cx + 9 }, { dir: '-z', a0: cx - 9, a1: cx + 9 }] });

  // 墙
  g.fill(x0, x1, floorY, wallTop, z1 - 1, z1, C.wallRed, { jitter: 0.035 });
  g.fill(x0, x1, floorY, wallTop, z0, z0 + 1, C.wallRed, { jitter: 0.035 });
  g.fill(x0, x0 + 1, floorY, wallTop, z0, z1, C.wallRed, { jitter: 0.035 });
  g.fill(x1 - 1, x1, floorY, wallTop, z0, z1, C.wallRed, { jitter: 0.035 });

  // 前后立面立柱 + 匾额（先铺立面，再开门洞，保证门洞通透）
  decorateFacade(g, { dir: '+z', plane: z1, x0, x1, z0, z1, floorY, wallTop, bays, doorBays: 'none', plaque: true });
  decorateFacade(g, { dir: '-z', plane: z0, x0, x1, z0, z1, floorY, wallTop, bays, doorBays: 'none', plaque: true });

  // 三个门洞（中门大，两侧小），门洞贯穿南北
  const doorTop = floorY + 7;
  const openDoor = (a0, a1, top) => {
    for (let x = a0; x <= a1; x++)
      for (let y = floorY; y <= top; y++) {
        const arch = (top - y) >= 2 || (x > a0 && x < a1);
        if (!arch) continue;
        g.set(x, y, z1 - 1, C.doorInner, {}); g.set(x, y, z1, C.doorInner, {});
        g.set(x, y, z0, C.doorInner, {}); g.set(x, y, z0 + 1, C.doorInner, {});
      }
    // 门框
    for (let y = floorY; y <= top + 1; y++) { g.set(a0 - 1, y, z1, C.woodDk, {}); g.set(a1 + 1, y, z1, C.woodDk, {}); }
    for (let x = a0 - 1; x <= a1 + 1; x++) g.set(x, top + 1, z1, C.woodDk, {});
  };
  openDoor(cx - 3, cx + 3, doorTop);
  openDoor(cx - 14, cx - 9, floorY + 5);
  openDoor(cx + 9, cx + 14, floorY + 5);

  const beamTop = dougong(g, { x0, x1, z0, z1, y: wallTop + 1 });
  const roofTop = chineseRoof(g, {
    cx, cz, w: w + overhang * 2, d: d + overhang * 2, y: beamTop + 1,
    levels: roofLevels, ridgeAxis: 'x', style: roofStyle, tile, tileDk,
    inner: { w, d },
  });
  return { x0, x1, z0, z1, floorY, wallTop, roofTop, plat, z1 };
}

/* ------------------------------------------------------------------ *
 *  钟楼 / 鼓楼（二层，攒尖顶）
 * ------------------------------------------------------------------ */
export function tower(g, o) {
  const {
    cx, cz, w = 16, baseY = 1, platH = 3, facing = '+x', kind = 'bell',
  } = o;
  const hw = half(w);
  const plat = platform(g, { cx, cz, w: w + 8, d: w + 8, y: baseY, h: platH });
  const floorY = baseY + platH;
  const h1 = 10, wallTop1 = floorY + h1 - 1;

  // 台阶朝中轴
  const dir = facing;
  stairs(g, {
    dir, line: dir === '+x' ? plat.x1 : plat.x0, a0: cz - 5, a1: cz + 5, y: baseY, h: platH, dragon: false,
  });
  balustrade(g, { x0: plat.x0, x1: plat.x1, z0: plat.z0, z1: plat.z1, y: floorY, gaps: [{ dir, a0: cz - 5, a1: cz + 5 }] });

  // 一层
  const x0 = cx - hw, x1 = cx + hw, z0 = cz - hw, z1 = cz + hw;
  g.fill(x0, x1, floorY, wallTop1, z1 - 1, z1, C.wallRed, { jitter: 0.035 });
  g.fill(x0, x1, floorY, wallTop1, z0, z0 + 1, C.wallRed, { jitter: 0.035 });
  g.fill(x0, x0 + 1, floorY, wallTop1, z0, z1, C.wallRed, { jitter: 0.035 });
  g.fill(x1 - 1, x1, floorY, wallTop1, z0, z1, C.wallRed, { jitter: 0.035 });
  g.fill(x0, x1, floorY, floorY, z0, z1, C.stoneDark, {});
  // 券门
  const doorTop = floorY + 5;
  for (let y = floorY; y <= doorTop; y++) {
    const inset = y > floorY + 3 ? 1 : 0;
    for (let a = 3 - inset; a >= -(3 - inset); a--) {
      if (dir === '+x') { g.set(x1, y, cz + a, C.doorInner, {}); g.set(x1 - 1, y, cz + a, C.doorInner, {}); }
      else { g.set(x0, y, cz + a, C.doorInner, {}); g.set(x0 + 1, y, cz + a, C.doorInner, {}); }
    }
  }
  decorateFacade(g, { dir: dir === '+x' ? '-x' : '+x', plane: dir === '+x' ? x0 : x1, x0, x1, z0, z1, floorY, wallTop: wallTop1, bays: 2, doorBays: 'none' });
  decorateFacade(g, { dir: '+z', plane: z1, x0, x1, z0, z1, floorY, wallTop: wallTop1, bays: 2, doorBays: 'none' });
  decorateFacade(g, { dir: '-z', plane: z0, x0, x1, z0, z1, floorY, wallTop: wallTop1, bays: 2, doorBays: 'none' });

  dougong(g, { x0, x1, z0, z1, y: wallTop1 + 1 });
  // 腰檐（平坐一层）
  chineseRoof(g, {
    cx, cz, w: w + 10, d: w + 10, y: wallTop1 + 3, levels: 4, style: 'hip',
    tile: C.grayTile, tileDk: C.grayTileDk,
    noRidge: true, flare: 2, rafters: true, inner: { w, d: w },
  });
  const balY = wallTop1 + 3 + 4;
  platform(g, { cx, cz, w: w + 6, d: w + 6, y: balY, h: 1, color: C.wood, dark: C.woodDk, light: C.woodLt });
  balustrade(g, { x0: cx - (hw + 3), x1: cx + (hw + 3), z0: cz - (hw + 3), z1: cz + (hw + 3), y: balY + 1, color: C.marble });

  // 二层：开敞亭子 + 钟 / 鼓
  const f2 = balY + 1;
  const s2 = hw - 1;
  const colH = 9;
  const c2x0 = cx - s2, c2x1 = cx + s2, c2z0 = cz - s2, c2z1 = cz + s2;
  for (const [px, pz] of [[c2x0, c2z0], [c2x1, c2z0], [c2x0, c2z1], [c2x1, c2z1]]) {
    g.fill(px, px + (px === c2x0 ? 1 : 0), f2, f2 + colH - 1, pz, pz + (pz === c2z0 ? 1 : 0), C.column, { jitter: 0.03 });
  }
  g.fill(c2x0, c2x1, f2, f2, c2z0, c2z1, C.wood, { jitter: 0.03 });
  // 阑额 + 挂落
  for (let x = c2x0; x <= c2x1; x++) { g.set(x, f2 + colH - 1, c2z0, C.woodDk, {}); g.set(x, f2 + colH - 1, c2z1, C.woodDk, {}); }
  for (let z = c2z0; z <= c2z1; z++) { g.set(c2x0, f2 + colH - 1, z, C.woodDk, {}); g.set(c2x1, f2 + colH - 1, z, C.woodDk, {}); }
  for (let x = c2x0 + 2; x <= c2x1 - 2; x += 3) {
    for (const z of [c2z0, c2z1]) for (let y = f2 + colH - 4; y < f2 + colH - 1; y++) g.set(x, y, z, C.woodDk, {});
  }

  // 钟或鼓
  const cy = f2 + 3;
  if (kind === 'bell') {
    g.fill(cx - 2, cx + 2, cy + 2, cy + 4, cz - 2, cz + 2, C.bronze, { jitter: 0.05 });
    g.fill(cx - 3, cx + 3, cy, cy + 1, cz - 3, cz + 3, C.bronzeDk, { jitter: 0.05 });
    g.fill(cx - 2, cx + 2, cy - 1, cy - 1, cz - 2, cz + 2, C.bronze, { jitter: 0.05 });
    g.fill(cx, cx, cy + 5, cy + colH - 2 - 3, cz, cz, C.woodDk, {});
  } else {
    g.fill(cx - 3, cx + 3, cy, cy + 5, cz - 1, cz + 1, C.drumRed, { jitter: 0.05 });
    g.fill(cx - 4, cx - 4, cy, cy + 5, cz, cz, C.gold, {});
    g.fill(cx + 4, cx + 4, cy, cy + 5, cz, cz, C.gold, {});
    g.fill(cx - 3, cx + 3, cy - 1, cy - 1, cz - 1, cz + 1, C.woodDk, {});
    g.fill(cx - 3, cx + 3, cy + 6, cy + 6, cz - 1, cz + 1, C.woodDk, {});
  }

  const beam2 = dougong(g, { x0: c2x0, x1: c2x1, z0: c2z0, z1: c2z1, y: f2 + colH, step: 2 });
  const roofTop = chineseRoof(g, {
    cx, cz, w: w + 12, d: w + 12, y: beam2 + 1, levels: 9, style: 'pyramid',
    tile: C.grayTile, tileDk: C.grayTileDk, ridge: C.grayTileLt, ridgeDk: C.ridgeDark, curve: 0.72, flare: 3,
    inner: { w: s2 * 2, d: s2 * 2 },
  });
  return { x0, x1, z0, z1, floorY, roofTop, plat, balY, f2 };
}

/* ------------------------------------------------------------------ *
 *  宝塔（密檐方形塔 + 攒尖顶 + 塔刹）
 * ------------------------------------------------------------------ */
export function pagoda(g, o) {
  const {
    cx, cz, baseY = 1, stories = 7, baseHalf = 12, bodyH = 6, shrink = 1,
  } = o;
  // 八角台基（切角近似）
  const pr = baseHalf + 6;
  for (let x = cx - pr; x <= cx + pr; x++)
    for (let z = cz - pr; z <= cz + pr; z++) {
      const d = Math.abs(x - cx) + Math.abs(z - cz);
      if (d > Math.round(pr * 1.42)) continue;
      for (let y = baseY; y <= baseY + 2; y++) g.set(x, y, z, C.marble, { jitter: 0.035 });
    }
  for (let x = cx - pr; x <= cx + pr; x++)
    for (let z = cz - pr; z <= cz + pr; z++) {
      const d = Math.abs(x - cx) + Math.abs(z - cz);
      if (d > Math.round(pr * 1.42) || d < pr - 1) continue;
      g.set(x, baseY + 3, z, C.marble, { jitter: 0.03 });
      if ((x + z) % 5 === 0) g.set(x, baseY + 4, z, C.stoneLt, {});
    }

  let top = baseY + 4;
  let h = baseHalf;
  for (let s = 0; s < stories; s++) {
    const y0 = top, y1 = y0 + bodyH - 1;
    const x0 = cx - h, x1 = cx + h, z0 = cz - h, z1 = cz + h;
    // 塔身
    g.fill(x0, x1, y0, y1, z1 - 1, z1, C.wallRed, { jitter: 0.035 });
    g.fill(x0, x1, y0, y1, z0, z0 + 1, C.wallRed, { jitter: 0.035 });
    g.fill(x0, x0 + 1, y0, y1, z0, z1, C.wallRed, { jitter: 0.035 });
    g.fill(x1 - 1, x1, y0, y1, z0, z1, C.wallRed, { jitter: 0.035 });
    g.fill(x0, x1, y0, y0, z0, z1, C.stoneDark, {});
    // 四门龛 / 窗
    const dh = Math.max(3, bodyH - 2);
    for (let a = -2; a <= 2; a++) {
      for (let y = y0 + 1; y <= y0 + dh; y++) {
        if (Math.abs(a) === 2 && y > y0 + dh - 2) continue;
        g.set(cx + a, y, z1, C.doorInner, {}); g.set(cx + (s % 2 ? a : a), y, z0, C.doorInner, {});
        g.set(x1, y, cz + a, C.doorInner, {}); g.set(x0, y, cz + a, C.doorInner, {});
      }
    }
    // 每层平座栏杆 + 挑檐
    const eaveY = y1 + 1;
    chineseRoof(g, {
      cx, cz, w: (h + 3) * 2, d: (h + 3) * 2, y: eaveY, levels: 3, style: 'hip',
      tile: C.grayTile, tileDk: C.grayTileDk, ridge: C.grayTileLt,
      noRidge: true, flare: 2, rafters: false, curve: 0.85,
    });
    top = eaveY + 3;
    h -= shrink;
    if (h < 3) h = 3;
  }

  // 攒尖顶 + 塔刹
  const spireTop = chineseRoof(g, {
    cx, cz, w: (h + 4) * 2, d: (h + 4) * 2, y: top, levels: 7, style: 'pyramid',
    tile: C.grayTile, tileDk: C.grayTileDk, ridge: C.grayTileLt, curve: 0.7, flare: 2,
  });
  let y = spireTop + 1;
  g.fill(cx - 1, cx + 1, y, y + 1, cz - 1, cz + 1, C.gold, { jitter: 0.04 });
  y += 2;
  g.fill(cx - 3, cx + 3, y, y, cz - 3, cz + 3, C.gold, {});
  g.fill(cx - 2, cx + 2, y + 1, y + 1, cz - 2, cz + 2, C.gold, {});
  y += 2;
  g.fill(cx, cx, y, y + 3, cz, cz, C.gold, {});
  g.fill(cx - 2, cx + 2, y + 1, y + 1, cz, cz, C.gold, {});
  g.fill(cx, cx, y + 1, y + 1, cz - 2, cz + 2, C.gold, {});
  g.fill(cx - 1, cx + 1, y + 5, y + 5, cz - 1, cz + 1, C.goldLt, {});
  return { cx, cz, top: y + 5, baseHalf };
}

/* ------------------------------------------------------------------ *
 *  院墙 / 回廊
 * ------------------------------------------------------------------ */
export function wallRun(g, o) {
  const { axis = 'x', at, from, to, y0 = 1, h = 7, t = 2, gaps = [], wallColor = C.wallRed, tile = C.grayTile, tileDk = C.tileDark } = o;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const skip = (a) => gaps.some((gp) => a >= gp[0] && a <= gp[1]);
  for (let a = lo; a <= hi; a++) {
    if (skip(a)) continue;
    for (let d = 0; d < t; d++) {
      for (let y = y0; y < y0 + h; y++) {
        const c = y === y0 ? C.stoneDark : wallColor;
        if (axis === 'x') g.set(a, y, at - (t >> 1) + d, c, { jitter: 0.04 });
        else g.set(at - (t >> 1) + d, y, a, c, { jitter: 0.04 });
      }
    }
    // 瓦顶
    for (let d = -(t); d <= t; d++) {
      const c = ((a % 4) === 0) ? tileDk : tile;
      if (axis === 'x') { g.set(a, y0 + h, at + d, c, { jitter: 0.05 }); g.set(a, y0 + h + 1, at, tileDk, {}); }
      else { g.set(at + d, y0 + h, a, c, { jitter: 0.05 }); g.set(at, y0 + h + 1, a, tileDk, {}); }
    }
  }
}

export function colonnade(g, o) {
  const { axis = 'x', at, from, to, y0 = 1, h = 6, step = 6, side = -1 } = o;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  for (let a = lo; a <= hi; a++) {
    if ((a - lo) % step === 0) {
      for (let y = y0; y < y0 + h; y++) {
        if (axis === 'x') g.set(a, y, at, C.column, { jitter: 0.03 });
        else g.set(at, y, a, C.column, { jitter: 0.03 });
      }
    }
  }
  // 额枋 + 屋顶
  for (let a = lo; a <= hi; a++) {
    for (let d = -3; d <= 4; d++) {
      const y = y0 + h + (Math.abs(d) <= 1 ? 2 : Math.abs(d) <= 2 ? 1 : 0);
      const c = Math.abs(d) <= 1 ? C.grayTileDk : C.grayTile;
      if (axis === 'x') g.set(a, y, at + d, c, { jitter: 0.05 });
      else g.set(at + d, y, a, c, { jitter: 0.05 });
    }
    if (axis === 'x') g.set(a, y0 + h, at, C.woodDk, {});
    else g.set(at, y0 + h, a, C.woodDk, {});
  }
}

/* ------------------------------------------------------------------ *
 *  陈设：石狮、灯笼、香炉、松树、假山
 * ------------------------------------------------------------------ */
export function lion(g, { x, z, y = 1, dir = 1, stone = C.lion, dark = C.lionDk, gold = C.gold }) {
  // 须弥座
  g.fill(x - 2, x + 2, y, y + 2, z - 2, z + 2, C.marble, { jitter: 0.04 });
  g.fill(x - 2, x + 2, y + 2, y + 2, z - 2, z + 2, C.stoneLt, { jitter: 0.03 });
  const b = y + 3;
  // 腿
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) g.fill(x + dx, x + dx, b, b + 1, z + dz, z + dz, stone, { jitter: 0.05 });
  // 身
  g.fill(x - 1, x + 1, b + 1, b + 2, z - 1, z + 1, stone, { jitter: 0.05 });
  // 尾
  g.fill(x - 2 * dir, x - 2 * dir, b + 2, b + 3, z, z, dark, {});
  // 头
  const hz = z + dir * 2;
  g.fill(x - 1, x + 1, b + 3, b + 4, hz - 1 * dir, hz, stone, { jitter: 0.05 });
  g.fill(x - 2, x + 2, b + 3, b + 4, hz - 1 * dir, hz, dark, { jitter: 0.05 });
  g.fill(x - 1, x + 1, b + 4, b + 5, hz, hz + dir, stone, { jitter: 0.05 });
  g.set(x - 1, b + 4, hz + dir, dark, {}); g.set(x + 1, b + 4, hz + dir, dark, {});
  g.set(x, b + 3, hz + dir, gold, {});
  return y + 8;
}

export function lantern(g, { x, y, z, cord = 4, glow = true }) {
  g.fill(x, x, y + 2, y + cord, z, z, C.woodDk, {});
  g.fill(x - 1, x + 1, y + 1, y + 1, z - 1, z + 1, C.gold, { jitter: 0.03 });
  g.fill(x - 1, x + 1, y - 1, y, z - 1, z + 1, C.lantern, { emissive: glow, jitter: 0.03 });
  g.fill(x - 1, x + 1, y - 2, y - 2, z - 1, z + 1, C.gold, { jitter: 0.03 });
  g.fill(x, x, y - 3, y - 3, z, z, C.gold, {});
  return y + cord;
}

export function burner(g, { x, z, y = 1 }) {
  g.fill(x - 2, x + 2, y, y, z - 2, z + 2, C.stone, { jitter: 0.03 });
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) g.fill(x + dx, x + dx, y + 1, y + 1, z + dz, z + dz, C.bronzeDk, {});
  g.fill(x - 2, x + 2, y + 1, y + 4, z - 2, z + 2, C.bronze, { jitter: 0.05 });
  g.fill(x - 3, x + 3, y + 5, y + 5, z - 3, z + 3, C.bronzeLt, { jitter: 0.04 });
  g.fill(x - 3, x - 3, y + 6, y + 7, z, z, C.bronze, {});
  g.fill(x + 3, x + 3, y + 6, y + 7, z, z, C.bronze, {});
  g.fill(x - 1, x + 1, y + 6, y + 6, z - 1, z + 1, C.fire, { emissive: true, jitter: 0.06 });
  return y + 7;
}

export function tree(g, o) {
  const { x, z, y = 1, h = 9, r = 3, kind = 'pine', leaf = C.leaf, leafLt = C.leafLt, trunk = C.trunk } = o;
  const hh = Math.max(3, Math.round(h + (g.hash3(x, 5, z) - 0.5) * 3));
  g.fill(x, x, y, y + hh, z, z, trunk, { jitter: 0.08 });
  if (kind === 'pine') {
    let rad = r;
    for (let k = 0; k < 4; k++) {
      const yy = y + hh - 1 + k * Math.max(1, Math.round(hh / 6));
      const rr = Math.max(0, rad - k);
      for (let dx = -rr; dx <= rr; dx++)
        for (let dz = -rr; dz <= rr; dz++) {
          const d = Math.abs(dx) + Math.abs(dz);
          if (d > rr + 0.5) continue;
          if (g.hash3(x + dx, yy, z + dz) < 0.14) continue;
          g.set(x + dx, yy, z + dz, g.hash3(x + dx, yy + 1, z + dz) > 0.6 ? leafLt : leaf, { jitter: 0.12 });
        }
      if (k === 3) {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 1) continue;
          g.set(x + dx, yy + 1, z + dz, leafLt, { jitter: 0.1 });
        }
        g.set(x, yy + 2, z, leafLt, {});
      }
    }
  } else {
    const cy = y + hh;
    for (let dy = -r; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++)
        for (let dz = -r - 1; dz <= r + 1; dz++) {
          const dist = Math.sqrt(dx * dx + (dy * 1.25) ** 2 + dz * dz);
          if (dist > r + 0.6) continue;
          if (g.hash3(x + dx, cy + dy, z + dz) < 0.18) continue;
          g.set(x + dx, cy + dy, z + dz, dist > r - 0.9 ? leafLt : leaf, { jitter: 0.12 });
        }
  }
}

export function rock(g, { x, z, y = 1, r = 3, color = C.stone, dark = C.stoneDk }) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = 0; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++) {
        const dist = Math.sqrt(dx * dx + (dy * 1.5) ** 2 + dz * dz);
        if (dist > r + 0.4) continue;
        if (g.hash3(x + dx, y + dy, z + dz) < 0.25) continue;
        g.set(x + dx, y + dy, z + dz, g.hash3(x + dx, y + dy, z + dz) > 0.7 ? dark : color, { jitter: 0.12 });
      }
}
