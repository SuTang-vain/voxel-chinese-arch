/**
 * 中式屋顶生成器（体素版）
 * ─────────────────────────────────────────────────────────
 * · 举折曲线：屋面下缓上陡（凹曲），以 ins = maxIns · t^0.78 拟合；
 * · 庑殿顶 hip     —— 四坡五脊，正脊沿长轴；
 * · 歇山顶 xieshan —— 下段四坡 + 上段两坡，两端竖向山花（含博风板、悬鱼）；
 * · 攒尖顶 pyramid —— 四面收于一点，顶置宝顶；
 * · 飞檐翘角       —— 檐角向外上方挑起，四角收戗脊（垂脊）、脊端置吻兽。
 *
 * 所有函数都在 (长轴 l, 短轴 s) 局部坐标内计算，再映射回世界坐标，
 * 因此同一套代码可生成任意朝向、任意长宽比的屋顶。
 */

const RUN = 0.78; // 举折指数：<1 即“下缓上陡”

/** 逐层收进量：在 [0, maxIns] 上归一化的凹曲线（0 = 檐口层） */
function insetProfile(h, maxIns, run = RUN) {
  const a = [];
  const strict = maxIns >= h - 1;   // 收进量足够时，逐层必须严格递增（不允许相邻层重合）
  for (let i = 0; i < h; i++) {
    const t = h > 1 ? i / (h - 1) : 1;
    let v = Math.min(maxIns, Math.round(maxIns * Math.pow(t, run)));
    if (strict && i > 0) v = Math.max(v, a[i - 1] + 1);
    a.push(Math.min(v, maxIns));
  }
  return a;
}

/** 屋面主循环 */
function surface(b, o, shape) {
  const { x0, x1, z0, z1, y0, h } = o;
  if (!(h >= 1)) throw new Error(`roof: 层数 h 必须 ≥ 1（收到 ${h}）——避免在 mainRidge/baoding 深处抛无关 TypeError`);
  const tile = o.tile, tile2 = o.tile2 || o.tile;
  const ridge = o.ridge || o.tile2 || o.tile;
  const gable = o.gable || 'plasterWarm';
  const barge = o.barge || 'wood2';
  const W = x1 - x0 + 1, D = z1 - z0 + 1;
  const alongX = W >= D;                 // 正脊方向
  const L = alongX ? W : D, S = alongX ? D : W;
  const put = (l, s, y, key) => (alongX ? b.set(x0 + l, y, z0 + s, key) : b.set(x0 + s, y, z0 + l, key));
  const worldL = (l) => (alongX ? x0 + l : z0 + l);
  const worldS = (s) => (alongX ? z0 + s : x0 + s);
  // 镜像不变量：|x + 0.5| —— 瓦垄与滴水左右同相位（中轴上是同一条垄）
  const mx = (x) => Math.abs(x + 0.5) | 0;

  const maxIns = Math.floor((S - 1) / 2);
  const prof = insetProfile(h, maxIns, o.run ?? RUN);
  const lowerH = shape === 'xieshan' ? Math.max(2, Math.round(h * (o.hipFrac ?? 0.42))) : h;
  const hipIns = prof[Math.min(lowerH - 1, h - 1)];

  const layers = [];
  for (let i = 0; i < h; i++) {
    const sIns = prof[i];
    const lIns = shape === 'xieshan' ? Math.min(sIns, hipIns) : sIns;
    const lA = lIns, lB = L - 1 - lIns, sA = sIns, sB = S - 1 - sIns;
    const y = y0 + i;
    const upper = shape === 'xieshan' && i >= lowerH;
    // 踏步填实：收进量逐层可跳 ≥2（举折曲线在檐口段最平），而被跳过的那几环
    // 若不在本层补上，整列就没有任何屋面体素 —— 从外面看是一道贯穿的镂空缝。
    // 范式与 octRoof 一致：本层从旧环一直铺到新环前一圈。
    const nS = i + 1 < h ? prof[i + 1] : sIns;
    const nL = shape === 'xieshan' ? Math.min(nS, hipIns) : nS;
    const dwS = Math.max(0, nS - sIns - 1), dwL = Math.max(0, nL - lIns - 1);
    layers.push({ y, lA, lB, sA, sB, sIns, lIns, upper, dwS, dwL });

    // ── 瓦面（环带宽度 = 1 + 需补实的格数；檐外沿仍是原来那一圈，外观轮廓不变） ──
    for (let l = lA; l <= lB; l++) {
      for (let s = sA; s <= sB; s++) {
        const edgeL = l === lA || l === lB, edgeS = s === sA || s === sB;
        const onLong = l - lA <= dwL || lB - l <= dwL;
        const onShort = s - sA <= dwS || sB - s <= dwS;
        if (upper ? !onShort : !(onShort || onLong)) continue; // 上段只铺前后两坡
        const stripe = (mx(worldL(l)) & 1) === 0;              // 瓦垄：垂直于正脊，左右同相
        let key = stripe ? tile : tile2;
        if (o.eaveAccent && i === 0 && edgeS && (((mx(worldL(l)) + worldS(s)) & 3) === 0)) key = o.eaveAccent;
        put(l, s, y, key);
      }
    }
    // ── 垂脊跨过踏步：补实的对角格也着脊色，脊线不至在踏步上断开（上段是山面，无垂脊） ──
    if (!upper && (dwL || dwS)) {
      for (let k = 1; k <= Math.max(dwL, dwS); k++) {
        const dl = Math.min(k, dwL), ds = Math.min(k, dwS);
        for (const [l, s] of [[lA + dl, sA + ds], [lB - dl, sA + ds], [lA + dl, sB - ds], [lB - dl, sB - ds]]) put(l, s, y, ridge);
      }
    }
    // ── 山花 + 博风板（歇山上段） ──
    if (upper) {
      for (let s = sA; s <= sB; s++) {
        put(lA, s, y, gable);
        put(lB, s, y, gable);
      }
      put(lA, sA, y, barge); put(lA, sB, y, barge);
      put(lB, sA, y, barge); put(lB, sB, y, barge);
    } else {
      // ── 戗脊 / 垂脊：四角包脊色 ──
      for (const [l, s] of [[lA, sA], [lB, sA], [lA, sB], [lB, sB]]) put(l, s, y, ridge);
    }
  }

  // ── 垂脊走脊：各层角部抬高一格，连成斜向脊线 ──
  for (let i = 0; i < layers.length - 1; i++) {
    const c = layers[i], n = layers[i + 1];
    if (c.upper) break;
    if (c.lIns === n.lIns && c.sIns === n.sIns) continue;
    for (const [l, s] of [[c.lA, c.sA], [c.lB, c.sA], [c.lA, c.sB], [c.lB, c.sB]]) put(l, s, c.y + 1, ridge);
  }

  return { put, alongX, L, S, layers, top: layers[layers.length - 1], hipIns, lowerH, worldL, worldS, o };
}

/** 正脊 + 吻兽 */
function mainRidge(b, info, o) {
  const ridge = o.ridge || o.tile2;
  const { put, top } = info;
  const y = top.y + 1;
  for (let l = top.lA; l <= top.lB; l++) {
    for (let s = top.sA; s <= top.sB; s++) put(l, s, y, ridge);
  }
  for (const [l, dir] of [[top.lA, -1], [top.lB, 1]]) {
    const sMid = Math.round((top.sA + top.sB) / 2);
    put(l, sMid, y + 1, ridge);          // 脊端立起
    put(l + dir, sMid, y, ridge);        // 向外探出
    put(l + dir, sMid, y + 1, ridge);    // 卷尾
  }
  return y;
}

/* ─────────────────────────── 庑殿顶 ─────────────────────────── */

export function hipRoof(b, o) {
  const info = surface(b, o, 'hip');
  const ridgeY = o.ridgeBeam === false ? info.top.y : mainRidge(b, info, o);
  if (o.cornerLift !== false) eaveCorners(b, info, o);
  return { ridgeY, ...info };
}

/* ─────────────────────────── 歇山顶 ─────────────────────────── */

export function xieshanRoof(b, o) {
  const info = surface(b, o, 'xieshan');
  const ridgeY = o.ridgeBeam === false ? info.top.y : mainRidge(b, info, o);
  if (o.cornerLift !== false) eaveCorners(b, info, o);
  // 山花中央的悬鱼惹草
  if (o.suspendedFish !== false) {
    const { put, top, lowerH } = info;
    const sMid = Math.round((top.sA + top.sB) / 2);
    const y = o.y0 + lowerH + 1;
    for (const l of [top.lA, top.lB]) {
      put(l, sMid, y, 'gold');
      put(l, sMid, y - 1, 'wood2');
      put(l, sMid + 1, y, 'wood2');
      put(l, sMid - 1, y, 'wood2');
    }
  }
  return { ridgeY, ...info };
}

/* ─────────────────────────── 攒尖顶 ─────────────────────────── */

export function pyramidRoof(b, o) {
  const info = surface(b, o, 'pyramid');
  const { put, top } = info;
  const sMid = Math.round((top.sA + top.sB) / 2), lMid = Math.round((top.lA + top.lB) / 2);
  const y = top.y + 1;
  put(lMid, sMid, y, o.ridge || o.tile2);
  if (o.baoding !== false) baoding(b, put, lMid, sMid, y);
  if (o.cornerLift !== false) eaveCorners(b, info, o);
  return { ridgeY: y, ...info };
}

/** 宝顶：座 + 金珠 + 尖 */
function baoding(b, put, lC, sC, y) {
  put(lC, sC, y + 1, 'ridgeGold');
  for (const [dl, ds] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(lC + dl, sC + ds, y + 1, 'gold');
  put(lC, sC, y + 2, 'gold');
  put(lC, sC, y + 3, 'ridgeGold');
  put(lC, sC, y + 4, 'gold');
}

/* ─────────────────── 飞檐翘角（四角挑起） ─────────────────── */

export function eaveCorners(b, info, o) {
  const { put, L, S } = info;
  const k = o.tile2 || o.tile;
  const tip = o.ridge || o.tile2 || o.tile;
  const side = o.eaveAccent || k;
  const reach = o.reach ?? 3;
  const y = o.y0;
  for (const [l, s, sl, ss] of [[0, 0, -1, -1], [L - 1, 0, 1, -1], [0, S - 1, -1, 1], [L - 1, S - 1, 1, 1]]) {
    for (let i = 1; i <= reach; i++) {
      const up = Math.max(0, i - 1);            // 翘角逐层上挑
      const dl = l + sl * i, ds = s + ss * i;
      // 注意 put 的签名是 (l, s, y)：初始提交里这四处曾把 s 与 y 传反，
      // 翘角体素因此被发射到 (x0+l, y=ds, z0+(y+up)) —— 落在地下或悬在建筑侧边，
      // 表现为"建筑周围的漂浮物"。断言 roof-eave-attached 现在把这条钉住。
      put(dl, ds, y + up, i >= reach ? tip : k);
      put(dl, ds, y + up - 1, k);             // 垫实，避免翘角悬空
      if (i <= 2) {
        put(l + sl * i, s, y + up, side);     // 沿檐口补块，使起翘连续
        put(l, s + ss * i, y + up, side);
      }
    }
  }
}

/* ─────────────── 腰檐 / 下檐（重檐、塔层间用） ─────────────── */

/**
 * 环形短檐：从外沿逐层收进到 inner 指定的内沿，不封顶。
 * 用于重檐下檐、腰檐、塔檐。
 */
export function skirtRoof(b, o) {
  const { x0, x1, z0, z1, y0, h, inner } = o;
  const tile = o.tile, tile2 = o.tile2 || o.tile, ridge = o.ridge || o.tile2 || o.tile;
  const W = x1 - x0 + 1, D = z1 - z0 + 1;
  const alongX = W >= D;
  const L = alongX ? W : D, S = alongX ? D : W;
  const put = (l, s, y, key) => (alongX ? b.set(x0 + l, y, z0 + s, key) : b.set(x0 + s, y, z0 + l, key));
  const inX0 = alongX ? inner.x0 - x0 : inner.z0 - z0;
  const inX1 = alongX ? inner.x1 - x0 : inner.z1 - z0;
  const inS0 = alongX ? inner.z0 - z0 : inner.x0 - x0;
  const inS1 = alongX ? inner.z1 - z0 : inner.x1 - x0;
  const insAt = (i) => Math.round(Math.min(inX0, inX1) * (i / Math.max(1, h - 1)));
  for (let i = 0; i < h; i++) {
    const ins = insAt(i);
    const lA = ins, lB = L - 1 - ins;
    const sA = Math.round(Math.min(inS0, inS1) * (i / Math.max(1, h - 1))), sB = S - 1 - sA;
    const y = y0 + i;
    // 踏步填实：中层收进会跳 ≥2（t 是均分，取整后不连续），只铺一圈同样会留下贯穿缝
    const dwS = Math.max(0, Math.round(Math.min(inS0, inS1) * ((i + 1) / Math.max(1, h - 1))) - (sA) - 1);
    const dwL = Math.max(0, (i + 1 < h ? insAt(i + 1) : ins) - ins - 1);
    for (let l = lA; l <= lB; l++) {
      for (let s = sA; s <= sB; s++) {
        if (l - lA > dwL && lB - l > dwL && s - sA > dwS && sB - s > dwS) continue;
        const stripe = ((Math.abs((alongX ? x0 + l : z0 + l) + 0.5) | 0) & 1) === 0;
        put(l, s, y, stripe ? tile : tile2);
      }
    }
    for (const [l, s] of [[lA, sA], [lB, sA], [lA, sB], [lB, sB]]) put(l, s, y, ridge);
    // 角部起翘
    for (const [l, s, sl, ss] of [[lA, sA, -1, -1], [lB, sA, 1, -1], [lA, sB, -1, 1], [lB, sB, 1, 1]]) {
      put(l + sl, s + ss, y + (i >= h - 2 ? 1 : 0), ridge);
    }
  }
}

/* ──────────────────── 八角形屋面（宝塔用） ──────────────────── */

/** 八边形判定：正方形切角 */
export const octInside = (dx, dz, r, cut) => {
  const c = cut ?? Math.round(r * 1.28);
  return Math.max(Math.abs(dx), Math.abs(dz)) <= r && Math.abs(dx) + Math.abs(dz) <= c;
};

/**
 * 八条垂脊位置（八角形顶点）。
 * 注意：x 方向以中轴平面 x = -0.5 为中心，故用半整数度量 ax = dx + 0.5；
 * 顶点即边界斜率转折处，随 r / cut 自动求解，不写死公式。
 */
export function octCorners(r, cut) {
  const ok = (dx, dz) => octInside(dx + 0.5, dz, r, cut);
  const inRow = (dz) => !ok(-r, dz) && !ok(r - 1, dz) ? null : true;
  const pts = [];
  const xMax = (dz) => { let d = r - 1; while (d > -r && !ok(d, dz)) d--; return ok(d, dz) ? d : null; };
  const xMin = (dz) => { let d = -r; while (d < r - 1 && !ok(d, dz)) d++; return ok(d, dz) ? d : null; };
  let prevMax = null, prevMin = null, slopeMax = 0, slopeMin = 0;
  for (let dz = -r; dz <= r; dz++) {
    if (inRow(dz) === null) continue;
    const mx = xMax(dz), mn = xMin(dz);
    if (mx === null || mn === null) continue;
    if (prevMax !== null) {
      const s1 = Math.sign(mx - prevMax), s2 = Math.sign(mn - prevMin);
      if (s1 !== slopeMax) pts.push([mx, dz]);
      if (s2 !== slopeMin) pts.push([mn, dz]);
      slopeMax = s1; slopeMin = s2;
    } else {
      pts.push([mx, dz]); pts.push([mn, dz]);
      slopeMax = 0; slopeMin = 0;
    }
    prevMax = mx; prevMin = mn;
  }
  return pts;
}

/** 八角攒尖 / 八角腰檐：中心 (cx,cz)，半径逐层收进 */
export function octRoof(b, o) {
  const { cx, cz, y0, h } = o;
  const r0 = o.r0, rEnd = o.rEnd ?? 1;
  const tile = o.tile, tile2 = o.tile2 || o.tile, ridge = o.ridge || o.tile2 || o.tile;
  const prof = [];
  for (let i = 0; i < h; i++) {
    const t = (i + 1) / h;
    prof.push(r0 - (r0 - rEnd) * Math.pow(t, o.run ?? 0.9));
  }
  let topY = y0;
  for (let i = 0; i < h; i++) {
    const r = Math.round(prof[i]);
    const rPrev = i === 0 ? r0 : Math.round(prof[i - 1]);
    const y = y0 + i;
    topY = y;
    // dx ∈ [-rPrev, rPrev-1] + 半整数度量 ⇒ 关于中轴 x=-0.5 严格对称
    for (let dx = -rPrev; dx <= rPrev - 1; dx++) {
      for (let dz = -rPrev; dz <= rPrev; dz++) {
        if (!octInside(dx + 0.5, dz, rPrev, o.cut)) continue;
        if (i < h - 1 && octInside(dx + 0.5, dz, r - 1, o.cut)) continue; // 掏空内部
        const key = ((Math.abs(cx + dx + 0.5) | 0) & 1) === 0 ? tile : tile2;
        b.set(cx + dx, y, cz + dz, key);
      }
    }
    if (o.hipRidge !== false && rPrev > r) {
      const cut = o.cut ?? Math.round(rPrev * 1.28);
      const edge = new Set();
      for (const [dx, dz] of octCorners(rPrev, cut)) edge.add(dx + ',' + dz);
      for (const key of edge) {
        const [dx, dz] = key.split(',').map(Number);
        b.set(cx + dx, y, cz + dz, ridge);
        // 对角（翼角）起翘：非正方向中轴顶点抬一格
        if (dx !== 0 && dx !== -1) b.set(cx + dx, y + 1, cz + dz, ridge);
      }
    }
  }
  return { topY, lastR: Math.round(prof[h - 1]) };
}
