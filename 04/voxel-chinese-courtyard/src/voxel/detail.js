/**
 * 中式建筑构件库：台基、踏道、斗拱、额枋彩画、隔扇门窗、栏杆、香炉、灯笼、石狮…
 * 全部以体素堆叠实现，供各建筑调用。
 */
import { octInside } from './roof.js';

/* ───────────────────────── 台基与踏道 ───────────────────────── */

/**
 * 台基（须弥座式）：底层放大、腰部收进、台面再放大
 * @returns 台面标高（顶层 y）
 */
export function platform(b, o) {
  const { x0, x1, z0, z1, y0 = 1, h = 3, body = 'stone2', deck = 'marble', waist = 1, stretch = 0 } = o;
  for (let i = 0; i < h; i++) {
    const isTop = i === h - 1;
    const mid = i > 0 && !isTop;
    const ins = mid ? waist : 0;
    const extra = isTop ? stretch : 0;
    b.box(x0 - extra + ins, y0 + i, z0 - extra + ins, x1 + extra - ins, y0 + i, z1 + extra - ins, isTop ? deck : body);
  }
  return y0 + h - 1;
}

/**
 * 踏道（台阶）+ 中央御路
 * dir: 'south'(+z) | 'north'(-z) | 'west'(-x) | 'east'(+x)
 */
export function stairway(b, o) {
  const { yTop, levels, levels_start, tread = 1, yBase = 1, k = 'stone', kTread = 'stone2', kRamp = 'marble', rampHalf = 0 } = o;
  const start = o.levelStart;
  for (let i = 0; i < levels; i++) {
    const y = yTop - 1 - i;
    if (y < yBase) break;
    for (let t = 0; t < tread; t++) {
      const d = i * tread + t;
      const key = t === 0 ? kTread : k;
      if (o.dir === 'south') b.box(o.x0, y, start + d, o.x1, y, start + d, key);
      else if (o.dir === 'north') b.box(o.x0, y, start - d, o.x1, y, start - d, key);
      else if (o.dir === 'west') b.box(start - d, y, o.z0, start - d, y, o.z1, key);
      else b.box(start + d, y, o.z0, start + d, y, o.z1, key);
    }
  }
  void levels_start;
}

/* ───────────────────────── 斗拱 / 彩画 ───────────────────────── */

/**
 * 斗拱层：沿建筑四周出挑，隔一定步距挑出更远（栱）
 */
export function dougong(b, o) {
  const { x0, x1, z0, z1, y, h = 2, k = 'wood', kAlt = 'gold', out = 1, step = 3 } = o;
  for (let i = 0; i < h; i++) {
    const yy = y + i;
    const oo = i === 0 ? out : out;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        b.set(x, yy, z, (((Math.abs(x + 0.5) | 0) + z + i) % step === 0) ? kAlt : k);
      }
    }
    // 出挑两格：栱头
    for (let x = x0; x <= x1; x++) {
      for (const s of [-1, 1]) {
        if (((Math.abs(x + 0.5) | 0) - (Math.abs(x0 + 0.5) | 0)) % step === 0) {
          b.set(x, yy, z0 - oo, i === 0 ? k : kAlt);
          b.set(x, yy, z1 + oo, i === 0 ? k : kAlt);
        }
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (const s of [-1, 1]) {
        if ((z - z0) % step === 0) {
          b.set(x0 - oo, yy, z, i === 0 ? k : kAlt);
          b.set(x1 + oo, yy, z, i === 0 ? k : kAlt);
        }
      }
    }
  }
}

/** 额枋彩画：青绿叠晕 + 金线 */
export function caihua(b, o) {
  const { x0, x1, z0, z1, y, k = 'paintBlue', kAlt = 'paintGreen', kLine = 'gold' } = o;
  const ring = (yy, fn) => {
    for (let x = x0; x <= x1; x++) { fn(x, yy, z0); fn(x, yy, z1); }
    for (let z = z0; z <= z1; z++) { fn(x0, yy, z); fn(x1, yy, z); }
  };
  const am = (x) => Math.abs(x + 0.5) | 0; // 镜像不变量
  ring(y, (x, yy, z) => b.set(x, yy, z, ((am(x) + z) % 4 < 2) ? k : kAlt));
  ring(y + 1, (x, yy, z) => b.set(x, yy, z, ((am(x) + z) % 2 === 0) ? kLine : 'wood'));
}

/* ───────────────────────── 门窗 / 棂条 ───────────────────────── */

/**
 * 隔扇门窗：木框 + 棂花格心 + 裙板
 * axis='x' 表示墙面沿 x 方向（z 固定）
 */
export function latticeWall(b, o) {
  const { a0, a1, y0, y1, fixed, axis = 'x', frame = 'wood3', field = 'wood', field2 = 'wood2', sill = true } = o;
  const put = (a, y, key) => (axis === 'x' ? b.set(a, y, fixed, key) : b.set(fixed, y, a, key));
  for (let a = a0; a <= a1; a++) {
    const am = Math.abs(a + 0.5) | 0; // 镜像不变，保证左右花纹一致
    for (let y = y0; y <= y1; y++) {
      const edge = a === a0 || a === a1 || y === y0 || y === y1;
      const mullion = am % 3 === 0;
      if (edge || mullion) { put(a, y, frame); continue; }
      // 下部裙板较实，上部棂花通透
      const lower = sill && y <= y0 + 1;
      put(a, y, lower ? field2 : (((am + y) & 1) ? field : 'wood2'));
    }
  }
}

/** 板门（含门钉）：红门 + 金钉 */
export function studdedDoor(b, o) {
  const { x0, x1, y0, y1, fixed, axis = 'x', k = 'wallRed2', kStud = 'gold' } = o;
  const put = (a, y, key) => (axis === 'x' ? b.set(a, y, fixed, key) : b.set(fixed, y, a, key));
  for (let a = x0; a <= x1; a++) {
    for (let y = y0; y <= y1; y++) {
      const edge = a === x0 || a === x1 || y === y0 || y === y1;
      const half = (x1 - x0 + 1) / 2;
      const seam = a === x0 + half - 1 || a === x0 + half;   // 中央两列，镜像对称
      let key = k;
      if (edge) key = 'wood2';
      else if (seam) key = 'black';
      else if ((y - y0) % 2 === 1 && ((Math.abs(a + 0.5) | 0) % 2 === 1)) key = kStud;
      put(a, y, key);
    }
  }
}

/** 匾额：黑底金字 */
export function plaque(b, o) {
  const { x0, x1, y, z, k = 'black', kText = 'gold', kFrame = 'wood3' } = o;
  for (let x = x0; x <= x1; x++) {
    for (let dy = 0; dy <= 2; dy++) {
      const edge = x === x0 || x === x1 || dy === 0 || dy === 2;
      // 简化的“字”：中间三格点阵
      const gx = (Math.abs(x + 0.5) | 0) % 3;   // 镜像不变的字位
      const glyph = !edge && gx === 2 && dy === 1;
      const glyph2 = !edge && gx === 1 && dy === 1;
      b.set(x, y + dy, z, edge ? kFrame : (glyph || glyph2 ? kText : k));
    }
  }
}

/* ───────────────────────── 八角塔身 ───────────────────────── */

/** 八角形墙体（1 格厚），带门窗 */
export function octBody(b, o) {
  const { cx, cz, r, y0, y1, k = 'wallRed', kWin = 'wood2', kDoor = 'black', kBase = 'stone2', accent = 'gold' } = o;
  for (let dx = -r; dx <= r - 1; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (!octInside(dx + 0.5, dz, r)) continue;
      if (octInside(dx + 0.5, dz, r - 1)) continue;
      for (let y = y0; y <= y1; y++) {
        let key = k;
        const onFace = Math.abs(dx + 0.5) <= 1.5 || Math.abs(dz) <= 1;
        const winRow = y >= y0 + 1 && y <= y0 + 2 && (((Math.abs(dx + 0.5) | 0) + dz + 300) % 3 !== 0);
        if (y === y0) key = kBase;
        else if (onFace && y >= y0 + 1 && y <= y0 + 4) key = y <= y0 + 2 ? kDoor : kWin;
        else if (winRow) key = kWin;
        b.set(cx + dx, y, cz + dz, key);
      }
      // 转角包金
      if ((Math.abs(dx + 0.5) === r - 0.5 && Math.abs(dz) <= 1) || (Math.abs(dz) === r && Math.abs(dx + 0.5) <= 1.5)) {
        b.set(cx + dx, y1, cz + dz, accent);
      }
    }
  }
}

/* ───────────────────────── 器物 ───────────────────────── */

/** 灯笼（悬挂式）：骨架 + 发光纸面 */
export function lantern(b, o) {
  const { x, y, z, k = 'lanternRed', kGlow = 'lanternLite', kTop = 'gold', size = 1 } = o;
  // 吊绳
  b.set(x, y + 3, z, 'wood2');
  b.set(x, y + 2, z, kTop);
  for (let dx = -size; dx <= size; dx++) {
    for (let dz = -size; dz <= size; dz++) {
      const corner = Math.abs(dx) === size && Math.abs(dz) === size;
      if (corner) continue;
      const edge = Math.abs(dx) === size || Math.abs(dz) === size;
      b.set(x + dx, y + 1, z + dz, edge ? k : kGlow);
      const inner = Math.abs(dx) < size && Math.abs(dz) < size;
      b.set(x + dx, y, z + dz, inner ? kGlow : k);
    }
  }
  b.box(x - size, y - 1, z - size, x + size, y - 1, z + size, kTop);
  // 流苏
  b.set(x, y - 2, z, kTop);
  b.set(x, y - 3, z, k);
}

/** 灯杆（立地灯笼） */
export function lanternPole(b, o) {
  const { x, z, y = 1, h = 6 } = o;
  b.box(x, y, z, x, y + h, z, 'wood2');
  b.set(x, y + h + 1, z, 'gold');
  lantern(b, { x, y: y + h + 2, z });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + h + 2, z + dz, 'wood');
}

/** 石狮（含须弥座） */
export function stoneLion(b, o) {
  const { x, z, y = 1, flip = 1 } = o;
  const k = 'stone';
  // 座
  b.box(x - 2, y, z - 2, x + 2, y + 2, z + 2, 'stone2');
  b.box(x - 2, y + 3, z - 2, x + 2, y + 3, z + 2, 'stone');
  const b0 = y + 4;
  // 身
  b.box(x - 1, b0, z - 2, x, b0 + 2, z + 1, k);
  b.box(x - 1, b0 - 1, z - 1, x, b0 - 1, z + 1, k); // 腿
  // 头
  b.box(x - 1, b0 + 3, z - 3, x, b0 + 4, z - 1, k);
  b.set(x - 1, b0 + 5, z - 3, k); b.set(x, b0 + 5, z - 3, k);         // 耳
  b.set(x - 1, b0 + 4, z - 4, 'black'); b.set(x, b0 + 4, z - 4, 'black'); // 目
  // 尾/鬃
  b.set(x - 1, b0 + 2, z + 2, k); b.set(x, b0 + 2, z + 2, k);
  b.set(x, b0 + 3, z + 2, k);
  // 绣球（外侧爪下）
  b.set(x, b0 - 1, z - 2, 'gold');
  void flip;
}

/** 香炉（三足鼎 + 屋顶式盖）；x0..x1 显式给定，便于骑中轴对称 */
export function incenseBurner(b, o) {
  const { y = 1 } = o;
  const x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1;
  const cx = (x0 + x1) / 2 - 0.5, cz = (z0 + z1) / 2;
  const k = 'bronze';
  // 座
  b.box(x0 - 1, y, z0 - 1, x1 + 1, y + 1, z1 + 1, 'stone2');
  // 足
  for (const [dx, dz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(dx, y + 2, dz, dx, y + 3, dz, k);
  // 鼎身
  b.box(x0, y + 4, z0, x1, y + 7, z1, k);
  b.box(x0 - 1, y + 5, z0 - 1, x1 + 1, y + 6, z1 + 1, k);
  // 耳：两侧 + 前后（每只耳都由「肩→上沿→外探」三格组成，保证与鼎身面接）
  // 曾经只 set(x0-2 / x1+2) 与 box(z0-2 / z1+2)，中间空 1–2 格 —— 四只金耳因此悬在空中
  // （由 no-airborne-fragments 断言钉住：薄片/单点的悬空构件一律判失败）
  const cz2 = Math.round(cz), yEar = y + 8;
  for (const [dx, dz, side] of [[-1, 0, 'x'], [1, 0, 'x']]) {
    const x = dx < 0 ? x0 - 1 : x1 + 1;
    b.set(x, yEar - 1, cz2, 'gold');
    b.set(x, yEar, cz2, 'gold');
    b.set(x + dx, yEar, cz2, 'gold');
  }
  for (const x of [x0 + 2, x0 + 3]) {
    b.set(x, yEar - 1, z0 - 1, 'gold'); b.set(x, yEar, z0 - 1, 'gold'); b.set(x, yEar, z0 - 2, 'gold');
    b.set(x, yEar - 1, z1 + 1, 'gold'); b.set(x, yEar, z1 + 1, 'gold'); b.set(x, yEar, z1 + 2, 'gold');
  }
  // 炉口 + 顶盖（小攒尖）
  b.box(x0 + 1, y + 8, z0 + 1, x1 - 1, y + 8, z1 - 1, 'gold');
  b.box(x0 + 1, y + 9, z0 + 1, x1 - 1, y + 9, z1 - 1, k);
  b.box(x0 + 2, y + 10, Math.round(cz) - 1, x0 + 3, y + 10, Math.round(cz), k);
  b.box(x0 + 2, y + 11, Math.round(cz), x0 + 3, y + 11, Math.round(cz), 'gold');
  b.box(x0 + 2, y + 12, Math.round(cz), x0 + 3, y + 12, Math.round(cz), 'ridgeGold');
}

/** 石灯（幢）：须弥座 + 灯室 */
export function stoneLamp(b, o) {
  const { x, y = 1, z } = o;
  b.box(x - 1, y, z - 1, x, y + 2, z, 'stone2');
  b.box(x, y + 3, z, x, y + 4, z, 'stone');
  b.box(x - 1, y + 5, z - 1, x, y + 6, z, 'stone');
  b.set(x - 1, y + 6, z - 1, 'lanternLite');
  b.set(x, y + 6, z, 'lanternLite');
  b.box(x - 1, y + 7, z - 1, x, y + 8, z, 'stone2');
  b.set(x - 1, y + 9, z - 1, 'stone'); b.set(x, y + 9, z, 'stone');
  b.set(x - 1, y + 10, z - 1, 'gold');
}

/** 幡杆（旗杆 + 夹杆石 + 幡） */
export function banner(b, o) {
  const { x, y = 1, z, h = 18, k = 'banner' } = o;
  b.box(x, y, z, x, y + h, z, 'wood2');                  // 旗杆
  b.box(x - 1, y, z - 1, x + 1, y + 1, z + 1, 'stone2'); // 夹杆石
  b.set(x, y + h + 1, z, 'gold');
  b.set(x, y + h, z, 'gold');
  // 幡：细长条，自杆顶垂下
  for (let i = 0; i < 9; i++) b.box(x + 1, y + h - 10 + i, z, x + 2, y + h - 10 + i, z, k);
  b.box(x + 1, y + h - 11, z, x + 2, y + h - 11, z, 'gold');
  b.set(x + 3, y + h - 9, z, k);
  b.set(x + 3, y + h - 3, z, k);
}

/** 古松：树干 + 层叠松针 */
export function pineTree(b, o) {
  const { x, z, y = 1, h = 11, seed = 0 } = o;
  const rnd = mulberry(seed * 7919 + x * 131 + z * 17);
  b.box(x, y, z, x, y + h, z, 'trunk');
  b.set(x + (rnd() > 0.5 ? 1 : -1), y + Math.floor(h * 0.6), z, 'trunk');
  const tiers = 3 + Math.floor(rnd() * 2);
  for (let t = 0; t < tiers; t++) {
    const ty = y + Math.floor(h * (0.28 + 0.58 * (t / Math.max(1, tiers - 1))));
    const rr = Math.max(1, Math.round((tiers - t) * 1.35));
    for (let dx = -rr; dx <= rr; dx++) {
      for (let dz = -rr; dz <= rr; dz++) {
        const d = Math.abs(dx) + Math.abs(dz);
        if (d > rr + 1) continue;
        if (d === rr + 1 && rnd() > 0.35) continue;
        b.set(x + dx, ty, z + dz, d > rr - 1 ? 'leaf2' : 'leaf');
        if (rnd() > 0.72) b.set(x + dx, ty + 1, z + dz, 'leaf');
      }
    }
  }
  return h;
}

/** 阔叶树（银杏/槐） */
export function broadTree(b, o) {
  const { x, z, y = 1, h = 9, seed = 1, warm = false } = o;
  const rnd = mulberry(seed * 104729 + x * 37 + z * 91);
  b.box(x, y, z, x, y + h - 3, z, 'trunk');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (rnd() > 0.45) b.set(x + dx, y + h - 4, z + dz, 'trunk');
  const c = warm ? 'leafWarm' : 'leaf';
  const rr = 3;
  for (let dy = 0; dy <= 3; dy++) {
    const r = rr - Math.abs(dy - 1);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        if (rnd() > 0.86) continue;
        b.set(x + dx, y + h - 3 + dy, z + dz, rnd() > 0.5 ? c : 'leaf2');
      }
    }
  }
}

/** 确定性随机数（保证每次运行场景一致） */
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
