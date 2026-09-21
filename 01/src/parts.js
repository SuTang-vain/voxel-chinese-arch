/**
 * parts.js — 中式古建构件生成器
 *
 *  roof()      屋顶：庑殿顶 / 歇山顶 / 攒尖顶，含飞檐翘角、正脊、鸱吻、宝顶
 *  podium()    台基：须弥座收分 + 压边石
 *  railing()   汉白玉栏杆（望柱 + 栏板），可留出踏道口
 *  stairs()    踏道（含御路）
 *  dougong()   斗拱 / 额枋彩画
 *  latticeWindow() 隔扇窗（自发光窗纸 + 木棂格）
 *  door()      板门（金钉）
 *  lantern()   宫灯
 *  pine()      松树
 *  lion()      石狮
 *  censer()    铜香炉
 */
import { C, tiles } from './palette.js';

/* ---------------- 屋顶 ---------------- */

/** 飞檐翘角：沿对角向外逐级抬升，且每级从檐口高度实心砌上去，避免“浮空碎块” */
function eaveCurl(w, X0, Z0, X1, Z1, y, color, len) {
  const corners = [
    [X0, Z0, -1, -1],
    [X1, Z0, 1, -1],
    [X0, Z1, -1, 1],
    [X1, Z1, 1, 1],
  ];
  for (const [cx, cz, sx, sz] of corners) {
    for (let d = 1; d <= len; d++) {
      const top = y + Math.max(0, Math.round(d * 0.7) - 1); // 0,0,1 -> 缓起翘
      for (let yy = y; yy <= top; yy++) {
        w.set(cx + sx * d, yy, cz + sz * d, color);
        if (d > 1) w.set(cx + sx * d, yy, cz + sz * (d - 1), color);
        if (d > 1) w.set(cx + sx * (d - 1), yy, cz + sz * d, color);
      }
    }
    // 檐口沿边微微起翘，使角部与檐线连续
    w.set(cx + sx, y + 1, cz, color);
    w.set(cx, y + 1, cz + sz, color);
  }
}

/**
 * 屋顶
 * @param {object} o
 *   style      'hip' 庑殿顶 | 'xieshan' 歇山顶   （方形平面即攒尖顶）
 *   ridge      'x' | 'z'     正脊方向
 *   overhang   出檐
 *   step/stepA/stepB  每层收进量（大屋顶用 2 更接近中式缓坡）
 *   layers     只做前 N 层（下檐裙檐用）
 *   tile/tileDark  瓦色；tiles() 可生成瓦垄条纹
 *   trim       檐口瓦当色；curl 翘角长度；beast 正脊吻兽
 */
export function roof(w, x0, z0, x1, z1, y, o = {}) {
  const over = o.overhang ?? 2;
  const stepA = o.stepA ?? o.step ?? 1;
  const stepB = o.stepB ?? o.step ?? 1;
  const style = o.style ?? 'hip';
  const ridgeAxis = o.ridge ?? 'x';
  const tile = o.tile ?? C.TILE_GRAY;
  const trim = o.trim ?? o.tileDark ?? C.TILE_GRAY_D;
  const gableColor = o.gable ?? C.GABLE;
  const ridgeColor = o.ridgeColor ?? C.RIDGE;
  const curlLen = o.curl ?? 3;
  const beast = o.beast !== false;

  const X0 = x0 - over, X1 = x1 + over, Z0 = z0 - over, Z1 = z1 + over;
  const A0 = ridgeAxis === 'x' ? X0 : Z0, A1 = ridgeAxis === 'x' ? X1 : Z1;
  const B0 = ridgeAxis === 'x' ? Z0 : X0, B1 = ridgeAxis === 'x' ? Z1 : X1;
  const isX = ridgeAxis === 'x';

  const fillRect = (a0, b0, a1, b1, yy, c) =>
    isX ? w.fill(a0, yy, b0, a1, yy, b1, c) : w.fill(b0, yy, a0, b1, yy, a1, c);
  const put = (a, b, yy, c) => (isX ? w.set(a, yy, b, c) : w.set(b, yy, a, c));

  const ha = Math.floor((A1 - A0) / 2);
  const hb = Math.floor((B1 - B0) / 2);
  // 屋顶在“短向”收拢即到顶，剩余的长向长度就是正脊
  const needed = Math.max(1, Math.ceil(Math.min(ha / stepA, hb / stepB)));
  const kMax = o.layers != null ? Math.min(o.layers, needed) : needed;
  // 歇山顶：下部为庑殿式四坡，到 breakLayer 后长向停止收进，两端立起山花
  const kB =
    style === 'xieshan'
      ? Math.min(kMax, o.breakLayer ?? Math.max(1, Math.round(kMax * 0.42)))
      : kMax;

  let ia = 0, ib = 0;
  for (let k = 0; k <= kMax; k++) {
    ia = Math.min(k, kB) * stepA;
    ib = Math.min(k * stepB, hb);
    const yy = y + k;
    const a0 = A0 + ia, a1 = A1 - ia, b0 = B0 + ib, b1 = B1 - ib;

    // 檐口一层用瓦当色，上面用瓦垄条纹 —— 形成清晰的水平檐线
    fillRect(a0, b0, a1, b1, yy, k === 0 && o.eaveColor != null ? o.eaveColor : tile);

    // 山花（歇山顶的三角山墙）
    if (style === 'xieshan' && k > kB) {
      for (let b = b0; b <= b1; b++) {
        put(a0, b, yy, gableColor);
        put(a1, b, yy, gableColor);
      }
    }
  }
  const a0 = A0 + ia, a1 = A1 - ia, b0 = B0 + ib, b1 = B1 - ib;

  // 飞檐翘角
  if (curlLen > 0) eaveCurl(w, X0, Z0, X1, Z1, y, o.curlColor ?? trim, curlLen);

  // 尚未收顶 => 局部裙檐（重檐下檐、腰檐）
  if (!(ia >= ha || ib >= hb)) return;

  const yTop = y + kMax + 1;
  const aLen = a1 - a0, bLen = b1 - b0;

  if (aLen === 0 && bLen === 0) {
    /* 攒尖顶：宝顶 + 刹杆 */
    w.fill(a0 - 1, yTop, b0 - 1, a0 + 1, yTop, b0 + 1, C.GOLD);
    w.set(a0, yTop + 1, b0, C.GOLD);
    w.set(a0, yTop + 2, b0, C.TILE_GOLD_D);
    return;
  }

  /* 正脊 */
  const ridge = o.ridgeColor2 ?? ridgeColor;
  fillRect(a0, b0, a1, b1, yTop, ridge);
  // 脊兽
  for (let a = a0 + 3; a <= a1 - 3; a += 4) put(a, b0, yTop + 1, C.GOLD_DARK);

  if (beast) {
    for (const a of [a0, a1]) {
      const s = a === a0 ? -1 : 1;
      for (let b = b0; b <= b1; b++) {
        put(a, b, yTop + 1, C.TILE_GOLD_D);
        put(a, b, yTop + 2, C.GOLD_DARK);
      }
      // 鸱吻外钩
      put(a + s, b0, yTop + 2, C.GOLD);
      put(a + s, b0, yTop + 3, C.GOLD_DARK);
      put(a, b0, yTop + 3, C.GOLD);
    }
  }
}

/* ---------------- 台基 / 栏杆 / 踏道 ---------------- */

export function podium(w, x0, z0, x1, z1, y0, h, o = {}) {
  const skirt = o.skirt ?? 1;
  for (let i = 0; i < h; i++) {
    let e = 0;
    if (i === 0 && skirt) e = skirt;
    if (o.waist != null && i === o.waist) e = -1; // 束腰内收
    const c = i === h - 1 ? (o.top ?? C.STONE) : (o.side ?? C.STONE_SIDE);
    w.fill(x0 - e, y0 + i, z0 - e, x1 + e, y0 + i, z1 + e, c);
  }
}

/**
 * 汉白玉栏杆：望柱 + 栏板
 * edges 控制做哪几面；openings 内的格子跳过（留踏道口）
 */
export function railing(w, x0, z0, x1, z1, yTop, o = {}) {
  const color = o.color ?? C.STONE;
  const post = o.post ?? C.MARBLE_VEIN;
  const openings = o.openings ?? [];
  const e = o.edges ?? { front: true, back: true, left: true, right: true };
  const skip = (x, z) => openings.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  const cells = [];
  if (e.back) for (let x = x0; x <= x1; x++) cells.push([x, z0]);
  if (e.front) for (let x = x0; x <= x1; x++) cells.push([x, z1]);
  if (e.left) for (let z = z0 + 1; z <= z1 - 1; z++) cells.push([x0, z]);
  if (e.right) for (let z = z0 + 1; z <= z1 - 1; z++) cells.push([x1, z]);
  for (const [x, z] of cells) {
    if (skip(x, z)) continue;
    const isPost = (x - x0) % 4 === 0 || (z - z0) % 4 === 0;
    w.set(x, yTop + 1, z, color);
    if (isPost) w.set(x, yTop + 2, z, post);
  }
}

/**
 * 踏道：从台基边缘逐级降到地面
 * axis 'z'：沿 z 方向下行，a0..a1 为 x 范围；axis 'x'：沿 x 下行，a0..a1 为 z 范围
 */
export function stairs(w, a0, a1, edge, dir, yTop, steps, o = {}) {
  const tread = o.tread ?? 2;
  const color = o.color ?? C.STONE_SIDE;
  const axis = o.axis ?? 'z';
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  for (let i = 1; i <= steps; i++) {
    const y = Math.max(0, yTop - i);
    const ea = edge + dir * ((i - 1) * tread + 1);
    const eb = edge + dir * i * tread;
    if (axis === 'z') w.fill(lo, 0, ea, hi, y, eb, color);
    else w.fill(ea, 0, lo, eb, y, hi, color);
    // 御路（中央御道）
    if (o.imperial) {
      const m = Math.round((lo + hi) / 2);
      if (axis === 'z') w.fill(m - 1, 0, ea, m + 1, y, eb, C.GOLD_BRICK);
      else w.fill(ea, 0, m - 1, eb, y, m + 1, C.GOLD_BRICK);
    }
  }
}

/* ---------------- 斗拱 / 彩画 ---------------- */

export function dougong(w, x0, z0, x1, z1, y, o = {}) {
  const fang = o.fang ?? C.PAINT_BLUE;
  w.ring(y, x0, z0, x1, z1, fang); // 额枋（青绿彩画）
  // 斗拱：以 3 为周期跳色，形成均匀的斗拱节奏而非黑白斑马纹
  w.ring(y + 1, x0, z0, x1, z1, (x, yy, z) => ((x + z) % 3 === 0 ? C.GOLD : C.WOOD));
  w.ring(y + 2, x0 - 1, z0 - 1, x1 + 1, z1 + 1, (x, yy, z) => ((x * 2 + z) % 3 === 0 ? C.PAINT_GREEN : C.WOOD_DARK));
  // 角科（转角斗拱加厚）
  for (const cx of [x0, x1]) {
    for (const cz of [z0, z1]) {
      w.set(cx, y + 2, cz, C.GOLD);
      w.set(cx + (cx === x0 ? -1 : 1), y + 2, cz, C.WOOD);
      w.set(cx, y + 2, cz + (cz === z0 ? -1 : 1), C.WOOD);
    }
  }
}

/* ---------------- 装修：窗 / 门 / 匾 ---------------- */

/**
 * 隔扇窗（会替换墙面体素）
 * face: 'z+'|'z-'|'x+'|'x-'
 */
export function latticeWindow(w, a0, a1, y0, y1, fixed, face) {
  const horiz = face === 'z+' || face === 'z-';
  for (let a = a0; a <= a1; a++) {
    for (let y = y0; y <= y1; y++) {
      const edge = a === a0 || a === a1 || y === y0 || y === y1;
      const mullion = (a - a0) % 2 === 0 || (y - y0) % 2 === 0;
      const c = edge || mullion ? C.WOOD_DARK : C.WIN_GLOW;
      const glow = !edge && !mullion;
      if (horiz) w.set(a, y, fixed, c, glow);
      else w.set(fixed, y, a, c, glow);
    }
  }
}

/** 板门：深色门板 + 金钉 + 门框 */
export function door(w, a0, a1, y0, y1, fixed, face) {
  const horiz = face === 'z+' || face === 'z-';
  const put = (a, y, c, g) => (horiz ? w.set(a, y, fixed, c, g) : w.set(fixed, y, a, c, g));
  for (let a = a0; a <= a1; a++) {
    for (let y = y0; y <= y1; y++) {
      const edge = a === a0 || a === a1 || y === y1;
      if (edge) put(a, y, C.WOOD_DARK);
      else if ((y - y0) % 3 === 1 && (a - a0) % 3 === 2) put(a, y, C.GOLD); // 门钉
      else put(a, y, C.BRICK_DARK);
    }
  }
  // 门槛
  for (let a = a0; a <= a1; a++) put(a, y0 - 1, C.STONE_DARK);
}

/** 匾额 */
export function plaque(w, x0, x1, y0, y1, z, face = 'z+') {
  const horiz = face === 'z+' || face === 'z-';
  for (let a = x0; a <= x1; a++) {
    for (let y = y0; y <= y1; y++) {
      const edge = a === x0 || a === x1 || y === y0 || y === y1;
      const c = edge ? C.GOLD : C.PLAQUE_BLUE;
      if (horiz) w.set(a, y, z, c);
      else w.set(z, y, a, c);
    }
  }
  // 字（金色笔画）
  const mx = (x0 + x1) / 2;
  for (const dx of [-2, 0, 2]) {
    const bx = Math.round(mx + dx);
    if (bx > x0 && bx < x1 && y0 + 1 <= y1 - 1) {
      for (let y = y0 + 1; y <= y1 - 1; y++) {
        if (horiz) w.set(bx, y, z, C.GOLD);
        else w.set(z, y, bx, C.GOLD);
      }
    }
  }
}

/* ---------------- 陈设 ---------------- */

export function lantern(w, x, y, z) {
  w.set(x, y, z, C.WOOD_DARK);
  w.set(x, y - 1, z, C.GOLD);
  w.fill(x, y - 3, z, x, y - 2, z, C.LANTERN, true);
  w.set(x, y - 4, z, C.GOLD_DARK);
}

/** 宫灯（大红灯笼，悬挂于檐下） */
export function bigLantern(w, x, y, z, len = 3) {
  w.set(x, y, z, C.WOOD_DARK);
  for (let i = 1; i < len; i++) w.set(x, y - i, z, C.WOOD_DARK);
  const t = y - len;
  w.set(x, t, z, C.GOLD);
  w.fill(x, t - 2, z, x, t - 1, z, C.LANTERN, true);
  w.set(x, t - 3, z, C.GOLD_DARK);
  w.set(x, t - 4, z, C.LANTERN_DIM, true);
}

export function pine(w, x, y, z, h = 9) {
  const top = y + h;
  for (let i = 0; i < h; i++) w.set(x, y + i, z, C.TRUNK);
  // 自下而上收分的圆锥树冠（逐层填充，避免“盘子+杆”的扁平感）
  const base = y + Math.max(2, Math.round(h * 0.32));
  const span = Math.max(1, top - base);
  for (let yy = base; yy <= top; yy++) {
    const t = (yy - base) / span; // 0 底 -> 1 顶
    const r = Math.round((1 - t) * 3.4);
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        w.set(x + dx, yy, z + dz, C.PINE);
      }
  }
  w.set(x, top + 1, z, C.PINE[0]);
}

export function lion(w, x, y, z) {
  // 须弥座
  w.fill(x - 1, y, z - 2, x + 1, y + 1, z + 2, C.STONE_SIDE);
  w.fill(x - 1, y + 2, z - 2, x + 1, y + 2, z + 2, C.STONE);
  // 身
  w.fill(x - 1, y + 3, z - 1, x + 1, y + 4, z + 1, C.STONE);
  // 头 / 鬃
  w.fill(x - 1, y + 5, z - 1, x + 1, y + 5, z + 1, C.STONE);
  w.fill(x - 1, y + 6, z - 2, x + 1, y + 6, z + 1, C.STONE_DARK);
  w.set(x - 1, y + 6, z - 2, C.STONE);
  w.set(x + 1, y + 6, z - 2, C.STONE);
  // 前爪
  w.set(x - 1, y + 3, z - 2, C.STONE_DARK);
  w.set(x + 1, y + 3, z - 2, C.STONE_DARK);
}

export function censer(w, x, y, z) {
  w.fill(x - 2, y, z - 2, x + 2, y + 1, z + 2, C.STONE_SIDE);
  w.fill(x - 1, y + 2, z - 1, x + 1, y + 3, z + 1, C.BRONZE);
  w.fill(x - 2, y + 3, z - 1, x + 2, y + 3, z + 1, C.BRONZE_DARK);
  w.set(x, y + 4, z, C.BRONZE);
  w.set(x, y + 5, z, C.LANTERN_DIM, true); // 香火
  for (const s of [-1, 1]) {
    w.set(x + s * 2, y + 2, z, C.BRONZE_DARK);
    w.set(x + s * 2, y + 3, z, C.BRONZE);
  }
}

export const TILES = tiles;
