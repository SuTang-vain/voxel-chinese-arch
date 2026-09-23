#!/usr/bin/env node
/**
 * 体素场景自检（`npm run selftest`）
 * ─────────────────────────────────────────────────────────
 * 把「我认为做完了」换成「可被检验的完成定义」：
 * 每条断言都是可以 FALSE 的陈述，失败时打印坐标级别的证据。
 * 断言只依赖 src/ 的装配代码，不需要浏览器 —— 因此可以在
 * 任何一次浏览器验证之前先跑，成本约 0.5 秒。
 *
 * 退出码：0 = 全绿；1 = 存在失败断言（可直接作为 subagent gate 命令）。
 */
import { VoxelBuilder, keyOf, neighborsOf, cullVerdict } from '../src/voxel/VoxelBuilder.js';
import { SkyRig, SKIES } from '../src/scene/sky.js';
import { hipRoof, xieshanRoof, pyramidRoof, skirtRoof, octRoof } from '../src/voxel/roof.js';
import { assembleWorld } from '../src/scene/assemble.js';
import { LAYOUT } from '../src/scene/layout.js';
import { PALETTE } from '../src/voxel/palette.js';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ────────────── 断言框架 ────────────── */
const results = [];
const fmt = (n) => n.toLocaleString('en-US');

function check(name, claim, fn) {
  const t0 = performance.now();
  let ok = false, detail = '';
  try {
    const r = fn();
    ok = !!r.ok;
    detail = r.detail ?? '';
  } catch (e) {
    ok = false;
    detail = `EXCEPTION: ${e.message}`;
  }
  results.push({ name, claim, ok, detail, ms: +(performance.now() - t0).toFixed(1) });
}

/* ────────────── 装配（与渲染同一条流水线） ────────────── */
const t0 = performance.now();
const world = await assembleWorld(new VoxelBuilder(true));
const buildMs = +(performance.now() - t0).toFixed(0);
const blocks = [...world.map.values()];
// 渲染产物的唯一实例：剔除与预算两条断言都绑在它身上，
// 避免「自算一遍谓词」式的自证（自算为绿 ≠ 渲染路径真的裁剪了）
const built = world.toObject3D({ blockScale: 0.985, ao: true });
const byKey = new Map();
for (const b of blocks) byKey.set(b.k, (byKey.get(b.k) ?? 0) + 1);
const count = (k) => byKey.get(k) ?? 0;

/**
 * 人工营造 vs 自然生长：
 * 中轴对称是对「营造部分」的硬要求。水面/荷叶/池底由 mirrorSide 显式镜像，属确定性营造，
 * 因此必须纳入断言；只有「自然随机」的地被与林木（以及云）不参与。
 */
const NATURAL = new Set(['grass', 'grass2', 'leaf', 'leaf2', 'leafWarm', 'trunk', 'cloud']);

/**
 * 登记在案的有意差异（不是漏洞，是设计）：例外必须写明理由，并逐个条目计数上报，
 * 这样「豁免」既不能静默扩大，也不能吞掉整块检查区域。
 * 盒宽按「乐器实际足迹」定尺寸，不外扩：
 *   铃 = x 29..33 / y 16..20 / z 13..17（含 carve 边界）；鼓 = x 30..32 同层同 z。
 * 曾经的外扩盒为 2970 格（实际需 250 格，12×），会把斗拱/平座栏杆/角柱一并免掉。
 */
const INTENTIONAL = [
  {
    id: '东钟西鼓',
    reason: '东钟西鼓：两楼形制对称，而楼内乐器（铜钟 / 立鼓）不同',
    in: (b) => b.y >= 16 && b.y <= 20
      && ((b.x >= 29 && b.x <= 33) || (b.x >= -34 && b.x <= -30))
      && b.z >= 13 && b.z <= 17
      && INTENTIONAL_KEYS.includes(b.k),
  },
];
const INTENTIONAL_KEYS = ['gold', 'bronze', 'wood2', 'wallRed'];

/* ────────────── 1. 中轴镜像对称 ────────────── */
check(
  'axis-symmetry',
  '每个营造体素 (x,y,z) 都存在镜像体素 (-1-x,y,z)，且色卡同名（铺装肌理也在内）',
  () => {
    const bad = [];
    const hist = new Map();          // 按「位置差异类型」分组，避免前 8 条掩盖全貌
    let checked = 0;
    const exemptPer = new Map(INTENTIONAL.map((e) => [e.id, 0]));
    for (const b of blocks) {
      if (NATURAL.has(b.k)) continue;
      const hit = INTENTIONAL.find((e) => e.in(b));
      if (hit) { exemptPer.set(hit.id, exemptPer.get(hit.id) + 1); continue; }
      checked++;
      const m = world.get(-1 - b.x, b.y, b.z);
      // 色卡名 + 明度档都必须一致：取色哈希的镜像不变性（README §3.1）由此被断言覆盖
      const same = m && m.k === b.k && (m.s ?? 0) === (b.s ?? 0);
      if (!same) {
        const kind = `${b.k}${m ? '↔' + m.k : '↔空'}${m && m.k === b.k ? '(色阶异)' : ''}`;
        bad.push(`(${b.x},${b.y},${b.z}) ${b.k}#${b.s ?? 0} ↔ ${m ? `${m.k}#${m.s ?? 0}` : '空'}`);
        hist.set(kind, (hist.get(kind) ?? 0) + 1);
      }
    }
    const top = [...hist.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`);
    const ex = [...exemptPer.entries()].map(([k, v]) => `${k} ${v}`).join('；');
    return {
      ok: bad.length === 0,
      detail: bad.length
        ? `${bad.length} 处不对称（共 ${fmt(checked)} 个营造体素）｜按类型：${top.join(', ')}｜前几处：${bad.slice(0, 4).join(' | ')}`
        : `检查 ${fmt(checked)} 个营造体素（色卡 + 明度档），全部镜像一致；逐条豁免计数：${ex}`,
    };
  }
);

/* ────────────── 2. 剔除不得误删可见体素 ────────────── */
check(
  'cull-safety',
  '谓词不变量（mutation-guard）：cullVerdict 对「顶面外露」恒返回 false —— 它能抓住谓词被改写（如 belowEmpty 取反），但几何/数据回归不会触发它，因此不得被引用为场景证据',
  () => {
    let exposed = 0, wrongly = 0, example = '';
    for (const b of blocks) {
      const nb = neighborsOf(world.map, b.x, b.y, b.z);
      if (!nb.topEmpty) continue;
      exposed++;
      if (cullVerdict(nb, true)) {
        wrongly++;
        if (!example) example = `(${b.x},${b.y},${b.z}) ${b.k} 顶面外露却被剔除`;
      }
    }
    return {
      ok: wrongly === 0,
      detail: wrongly
        ? `${wrongly}/${exposed} 个顶面外露体素被误剔除，例如 ${example}`
        : `${fmt(exposed)} 个顶面外露体素：谓词全部返回「保留」（几何上恒真 ⇒ 只在谓词被改写时报警）`,
    };
  }
);

/* ────────────── 3. 剔除确实生效（不是关掉裁剪换来的全绿） ────────────── */
check(
  'cull-effective',
  '裁剪真的发生在渲染产物上：重算谓词的剔除数 === stats.total − stats.visible（关掉裁剪或传 ao:false 会立刻失败），且剔除率 > 0 且 < 50%',
  () => {
    let culled = 0;
    for (const b of blocks) if (cullVerdict(neighborsOf(world.map, b.x, b.y, b.z), true)) culled++;
    const rendered = built.stats.total - built.stats.visible;
    const ratio = culled / blocks.length;
    const tied = rendered === culled;
    const band = culled > 0 && ratio < 0.5;
    return {
      ok: tied && band,
      detail: `谓词剔除 ${fmt(culled)}（${(ratio * 100).toFixed(1)}%）· 渲染产物剔除 ${fmt(rendered)}${tied ? ' ✓ 一致' : ' ✗ 不一致（裁剪未接到渲染路径？）'}`,
    };
  }
);

/* ────────────── 4. 中轴动线：逐段净空 + 跨 z 连通 + 门洞贯通 ────────────── */
check(
  'axis-walkable',
  '中轴动线真实连通：z ∈ [-13,50] 逐段存在 ≥4 格宽可行带，且 z=50 与 z=-13 之间存在 4-邻接连通路；地面须为铺装/石作（草地与水面不算路）；山门中央门洞 y ∈ [4,9] 为空洞',
  () => {
    const FLOOR = new Set(['paving', 'paving2', 'stone', 'stone2', 'marble', 'brick']);
    const walkable = (x, z) => {
      let floor = null;
      for (let y = 4; y >= 0; y--) if (world.has(x, y, z)) { floor = y; break; }
      if (floor === null || floor === 0) return false;
      if (!FLOOR.has(world.get(x, floor, z).k)) return false;
      for (let y = floor + 1; y <= floor + 5; y++) if (world.has(x, y, z)) return false;
      return true;
    };
    const X0 = -9, X1 = 8, Z0 = -13, Z1 = 50;
    const bad = [];
    for (let z = Z0; z <= Z1; z++) {
      let lane = 0, best = 0, start = null, bestSpan = null;
      for (let x = X0; x <= X1; x++) {
        if (walkable(x, z)) {
          if (lane === 0) start = x;
          lane++;
          if (lane > best) { best = lane; bestSpan = [start, x]; }
        } else lane = 0;
      }
      if (best < 4) bad.push(`z=${z} 最宽可行段 ${best} 格${bestSpan ? `（x ${bestSpan[0]}..${bestSpan[1]}）` : '（无可行格）'}`);
    }
    const seen = new Set();
    const queue = [];
    for (let x = X0; x <= X1; x++) if (walkable(x, Z1)) { seen.add(`${x},${Z1}`); queue.push([x, Z1]); }
    let reached = false;
    while (queue.length) {
      const [x, z] = queue.shift();
      if (z === Z0) { reached = true; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < X0 || nx > X1 || nz < Z0 || nz > Z1) continue;
        const key = `${nx},${nz}`;
        if (seen.has(key) || !walkable(nx, nz)) continue;
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
    const blocked = [];
    for (let z = 41; z <= 51; z++) {
      for (let x = -3; x <= 2; x++) {
        for (let y = 4; y <= 9; y++) if (world.has(x, y, z)) blocked.push(`(${x},${y},${z}) ${world.get(x, y, z).k}`);
      }
    }
    const fails = [];
    if (bad.length) fails.push(`通道不足：${bad.slice(0, 3).join(' | ')}${bad.length > 3 ? ` …共 ${bad.length} 段` : ''}`);
    if (!reached) fails.push(`z=${Z1} 与 z=${Z0} 之间无 4-邻接连通路（逐层有段但跨层断开，或起点被堵）`);
    if (blocked.length) fails.push(`门洞堵塞：${blocked.slice(0, 3).join(' | ')}`);
    return {
      ok: fails.length === 0,
      detail: fails.length ? fails.join('；') : `z ∈ [${Z0},${Z1}] 逐段 ≥4 格、跨 z 连通（flood fill 可达 ${fmt(seen.size)} 格）、门洞 6×11×6 贯通`,
    };
  }
);

/* ────────────── 5. 主次关系（绝对锚点 + 相对比较） ────────────── */
/**
 * 分区 AABB 与下限（下限 = 2026-09-19 实测的 85% 高度 / 60% 体量）。
 * 下限是**绝对锚点**：没有它时，AABB 与 LAYOUT 脱节（分区落到草地上）或整体等比缩小
 * 都会让"相对比较"照样成立而静默通过——reviewer 审计指出的一点。
 * 统计只算营造体素（NATURAL 之外），地形/林木不算建筑。
 */
const ZONES = {
  主殿: { x0: -23, x1: 22, z0: -56, z1: -30, minY: 33, minN: 5900 },
  山门: { x0: -14, x1: 13, z0: 37, z1: 55, minY: 22, minN: 1900 },
  宝塔: { x0: -13, x1: 12, z0: -97, z1: -71, minY: 53, minN: 3300 },
  配殿: { x0: 30, x1: 48, z0: -34, z1: 8, minY: 24, minN: 2600 },
  钟楼: { x0: 24, x1: 38, z0: 8, z1: 22, minY: 29, minN: 900 },
};
const zoneStats = {};
for (const [name, z] of Object.entries(ZONES)) {
  let maxY = -Infinity, n = 0;
  for (const b of blocks) {
    if (NATURAL.has(b.k)) continue;
    if (b.x >= z.x0 && b.x <= z.x1 && b.z >= z.z0 && b.z <= z.z1) { n++; if (b.y > maxY) maxY = b.y; }
  }
  zoneStats[name] = { maxY, n };
}
/** 紧凑摘要；withBox=true 时附 AABB（失败时用，便于判断分区是否与 LAYOUT 脱节） */
const zoneBrief = (withBox = false) => Object.entries(zoneStats)
  .map(([k, v]) => {
    const z = ZONES[k];
    const box = withBox ? ` [x ${z.x0}..${z.x1} z ${z.z0}..${z.z1}]` : '';
    return `${k} maxY=${Number.isFinite(v.maxY) ? v.maxY : '空'}/${z.minY} n=${fmt(v.n)}/${fmt(z.minN)}${box}`;
  })
  .join(' · ');

check(
  'hierarchy-height',
  '每个分区都过绝对下限（maxY ≥ 各自 minY，且分区非空），且 宝塔 > 主殿 > 配殿/钟楼、山门低于主殿（逐项报告哪一项不成立）',
  () => {
    const fails = [];
    for (const [k, v] of Object.entries(zoneStats)) {
      if (v.n === 0) fails.push(`${k} 分区无营造体素（AABB 与 LAYOUT 脱节？）`);
      else if (!(v.maxY >= ZONES[k].minY)) fails.push(`${k} maxY=${v.maxY} < 下限 ${ZONES[k].minY}`);
    }
    const { 主殿: m, 山门: g, 宝塔: p, 配殿: s2, 钟楼: t } = zoneStats;
    for (const [label, ok] of [['宝塔>主殿', p.maxY > m.maxY], ['主殿>配殿', m.maxY > s2.maxY], ['主殿>钟楼', m.maxY > t.maxY], ['主殿>山门', m.maxY > g.maxY]]) {
      if (!ok) fails.push(`不成立：${label}`);
    }
    return { ok: fails.length === 0, detail: fails.length ? `${fails.join('；')}｜${zoneBrief(true)}` : zoneBrief() };
  }
);

check(
  'hierarchy-mass',
  '每个分区体量都过绝对下限（n ≥ 各自 minN），且主殿体素量最大、≥ 配殿 1.5 倍（打印比值与下限）',
  () => {
    const fails = [];
    for (const [k, v] of Object.entries(zoneStats)) {
      if (v.n < ZONES[k].minN) fails.push(`${k} n=${fmt(v.n)} < 下限 ${fmt(ZONES[k].minN)}`);
    }
    const m = zoneStats.主殿.n, s2 = zoneStats.配殿.n, g = zoneStats.山门.n, p = zoneStats.宝塔.n;
    const ratio = m / s2;
    if (!(m > s2 && m > g && m > p)) fails.push('主殿不是体量最大者');
    if (ratio < 1.5) fails.push(`主殿/配殿 = ${ratio.toFixed(2)}× < 1.5`);
    return {
      ok: fails.length === 0,
      detail: fails.length ? fails.join('；') : `主殿 ${fmt(m)}/≥${fmt(ZONES.主殿.minN)} · 配殿 ${fmt(s2)}/≥${fmt(ZONES.配殿.minN)}（比值 ${ratio.toFixed(2)}×）· 山门 ${fmt(g)} · 宝塔 ${fmt(p)} · 钟楼 ${fmt(zoneStats.钟楼.n)}`,
    };
  }
);

/* ────────────── 6. 点景与材质齐备（阈值必须被基线锁死） ────────────── */
/**
 * 实测基线（阈值的唯一锚点）。
 * 2026-09-19 更新：修复「屋顶踏步未填实导致贯穿镂空」（roof.js 的 surface/skirtRoof）后
 * 屋面新增 ~1,400 体素，装配 94,899 → 96,363；瓦作四项随之上移（tileGold 798→1108、
 * tileGold2 662→1070、tileGray 3106→3204、ridgeGold 216→228），其余不动。
 * 2026-09-19 二次更新：飞檐参数传反、水池被台基吃掉两处修完，并把放生池改为
 * x[12,27] z[26,34]（避开山门台基/北踏道/钟鼓楼台基）+ 池沿矮石栏 + 荷叶加密：
 * water 364→264（水面 208→144/池）、marble 5,864→5,998（新增石栏）、gold 1,374→1,386。
 * 2026-09-19 三次更新（用户选定「贴中轴路 + 与钟鼓楼对中」）：池再改 x[7,19] z[15,23]，
 * 台明外缘距御路 2 格、池心 z=19 与楼心 z=15 对中、池东沿贴楼西踏道；
 * water 264→214（水面 144→117/池）、marble 5,998→5,990。
 * 2026-09-19 四次更新：按用户要求长宽对调为 x[7,15] z[13,25]（9×13，长轴与御路平行，
 * 西缘仍距路 2 格、池心仍 z=19）；水面格数不变（117/池），石栏周长 47→43 ⇒ marble 5,990→5,980。
 * 2026-09-19 五次更新（塔院补景：石灯/四角松柏与树池/碑亭/铺装纹样/两侧松林与沿墙甬道）：
 * lanternLite 32→44（石灯共 6 座）、gold 1,386→1,442、marble 5,980→6,102、
 * tileGray 3,204→3,230、ridgeGold 228→232，tileGray2/tileGold/tileGold2/paintBlue/banner/bronze/water 不变。
 * 只改数字，不改口径：阈值仍为 60% 基线，仍被 0.5×–1.0× 基线区间锁死；
 * 水面的精确不变量由 pond-intact 逐格断言承担（阈值只是粗护栏）。
 */
const BASELINE = {
  lanternLite: 44, water: 214, gold: 1442, marble: 6102, tileGold: 1108, tileGold2: 1070,
  tileGray: 3230, paintBlue: 272, banner: 40, bronze: 277, ridgeGold: 232,
};
/** 阈值 = 60% 基线（回归护栏而非配额）；断言会额外检查它落在 50%–100% 基线之间 */
const NEED = Object.fromEntries(Object.entries(BASELINE).map(([k, v]) => [k, Math.floor(v * 0.6)]));

check(
  'props-and-materials',
  '点景与材质齐备，且阈值被基线锁死：0.5×基线 ≤ 阈值 ≤ 基线（AGENTS.md §1「禁止悄悄放宽」由此可机检），实测 ≥ 阈值；成功日志打印全部 11 项的 实测/阈值/基线',
  () => {
    const fails = [];
    for (const [k, v] of Object.entries(NEED)) {
      const base = BASELINE[k];
      if (base === undefined) { fails.push(`${k} 缺基线`); continue; }
      const lo = Math.floor(base * 0.5);
      if (v < lo || v > base) fails.push(`${k} 阈值 ${v} 越界（基线 ${base}，允许 ${lo}–${base}）`);
      if (count(k) < v) fails.push(`${k} 实测 ${count(k)} < 阈值 ${v}`);
    }
    const table = Object.keys(NEED).map((k) => `${k} ${count(k)}/${NEED[k]}(基线${BASELINE[k]})`).join(' · ');
    return { ok: fails.length === 0, detail: fails.length ? fails.join('；') : table };
  }
);

/* ────────────── 7. 预算护栏（绑定渲染产物，不靠肉眼感觉） ────────────── */
check(
  'voxel-budget',
  '总量 ≤ 120,000、可见量 ≤ 100,000、材质批次恰好 4（4 类材质都在用：哑光/高光/自发光/水面——少一类说明某类体素整体消失）',
  () => {
    const { stats } = built;
    const fails = [];
    if (stats.total > 120000) fails.push(`total ${fmt(stats.total)} > 120,000（超 ${fmt(stats.total - 120000)}）`);
    if (stats.visible > 100000) fails.push(`visible ${fmt(stats.visible)} > 100,000（超 ${fmt(stats.visible - 100000)}）`);
    if (stats.calls !== 4) fails.push(`批次 ${stats.calls} ≠ 4`);
    return { ok: fails.length === 0, detail: fails.length ? fails.join('；') : `总 ${fmt(stats.total)} · 可见 ${fmt(stats.visible)} · 批次 ${stats.calls}` };
  }
);

/* ────────────── 8. 屋顶生成器的参数扫描（纯数学，不含体素） ────────────── */
check(
  'roof-generators',
  'h ∈ [1,6] × 短边 ∈ [2,14] × 两种脊向 × 三种屋顶：不抛错、层数非空、收进量充足(maxIns ≥ h-1)时逐层严格递增、触及收进上限时顶层面收敛到 ≤2 格；h<1 必须给出口径明确的报错',
  () => {
    const b = new VoxelBuilder(false);
    const base = { y0: 0, tile: 'tileGray', tile2: 'tileGray2', ridge: 'ridgeGray', cornerLift: false };
    const fails = [];
    let cases = 0, forced = 0, alongZ = 0;
    const makers = [
      ['hip', (o) => hipRoof(b, o)],
      ['xieshan', (o) => xieshanRoof(b, { ...o, suspendedFish: false })],
      ['pyramid', (o) => pyramidRoof(b, { ...o, baoding: false })],
    ];
    // 两种脊向都要覆盖：alongX（主殿/山门）、alongZ（配殿/宝塔）
    for (const ridge of ['alongX', 'alongZ']) {
      for (const [name, make] of makers) {
        for (let h = 1; h <= 6; h++) {
          for (let S = 2; S <= 14; S++) {
            const o = ridge === 'alongX'
              ? { ...base, x0: 0, x1: S + 2, z0: 0, z1: S, h }
              : { ...base, x0: 0, x1: S, z0: 0, z1: S + 2, h };
            cases++;
            if (ridge === 'alongZ') alongZ++;
            let res;
            try { res = make(o); } catch (e) { fails.push(`${name}/${ridge} h=${h} S=${S} 抛错 ${e.message.slice(0, 40)}`); continue; }
            const ins = res.layers.map((l) => l.sIns);
            if (!ins.length) { fails.push(`${name}/${ridge} h=${h} S=${S} 无层`); continue; }
            const maxIns = Math.max(...ins);
            if (maxIns >= h - 1 && new Set(ins).size !== ins.length) fails.push(`${name}/${ridge} h=${h} S=${S} 收进量充足却相邻层重合 ins=[${ins}]`);
            if (maxIns < h - 1) forced++;
            // 收敛判据（可达子句）：收进触到上限时，顶层面短边必须 ≤2 格
            const cap = Math.floor(Math.min(o.x1 - o.x0, o.z1 - o.z0) / 2);
            if (maxIns === cap && res.top.sB - res.top.sA > 1) {
              fails.push(`${name}/${ridge} h=${h} S=${S} 触及收进上限但顶层面未收敛（短边 ${res.top.sB - res.top.sA + 1} 格）`);
            }
          }
        }
      }
    }
    let guard = '';
    try { hipRoof(b, { ...base, x0: 0, x1: 5, z0: 0, z1: 5, h: 0 }); } catch (e) { guard = e.message; }
    if (!/h\s*必须\s*≥\s*1/.test(guard)) fails.push(`h=0 未给出口径明确的报错（实际：${guard || '未抛错'}）`);
    return {
      ok: fails.length === 0,
      detail: fails.length
        ? `${fails.length} 项失败：${fails.slice(0, 3).join(' | ')}`
        : `${cases} 组参数全部通过（含 alongZ ${alongZ} 组；${forced} 组因 maxIns<h-1 属几何必然重复，已豁免）；h=0 报错清晰`,
    };
  }
);

/* ────────────── 9. 屋面不得逐层留缝（平面投影必须铺满） ────────────── */
/**
 * 由来（2026-09-19）：主殿/配殿屋顶出现肉眼可见的"镂空"。
 * 根因是 roof.js 的 `insetProfile` 允许逐层收进量跳 ≥2（举折在檐口段最平，跳步最大：
 * 主殿上檐 s=[0,2,4,5,6,8,…] 跳掉 1、3、7；配殿跳掉 2），而 `surface()` / `skirtRoof()`
 * 每层只铺一圈 1 体素宽的环 —— 被跳过的收进量整列没有任何屋面体素，从外面看是一排平行缝。
 * 同文件的 `octRoof`（宝塔）本来就是"从上一圈填到本圈"，所以塔没有洞，这就是正确范式。
 *
 * 口径：把一座屋顶的所有层投到平面上，**檐口范围内的每一列都必须被铺到**。
 * 单看某一条断言（层数／递增／顶部收敛）都抓不到它 —— 这就是它必须独立存在的原因。
 */
check(
  'roof-no-gap',
  '屋面不得逐层留缝：hip/xieshan/pyramid 的平面投影必须铺满整个檐口矩形，skirt 必须铺满外檐到 inner 的环带，oct 必须铺满八边形（收进量跳 ≥2 时必须在到达下一环前把中间各环补实）',
  () => {
    const cellsOf = (fn, o) => {
      const cells = [];
      const stub = { set: (x, y, z) => cells.push({ x, y, z }) };
      fn(stub, o);
      return cells;
    };
    const audit = (fn, o, region) => {
      const W = o.x1 - o.x0 + 1, D = o.z1 - o.z0 + 1, alongX = W >= D;
      const L = alongX ? W : D, S = alongX ? D : W;
      const seen = new Set();
      for (const c of cellsOf(fn, o)) {
        const l = alongX ? c.x - o.x0 : c.z - o.z0;
        const s = alongX ? c.z - o.z0 : c.x - o.x0;
        if (l >= 0 && l < L && s >= 0 && s < S) seen.add(`${l},${s}`);
      }
      const bad = [];
      for (let l = 0; l < L; l++) for (let s = 0; s < S; s++) {
        if (region(l, s) && !seen.has(`${l},${s}`)) bad.push(`(${l},${s})`);
      }
      return { L, S, bad };
    };
    const tile = { tile: 'tileGray', tile2: 'tileGray2', ridge: 'ridgeGray' };
    const fails = [];
    let cases = 0;
    // 参数扫描：两种脊向 × 短边 6..30 × 层数 2..12（跳步在高瘦屋顶才消失，必须覆盖扁而阔的）
    for (const alongX of [true, false]) {
      for (let S = 6; S <= 30; S += 2) {
        for (let h = 2; h <= 12; h += 2) {
          const L = S + 12;
          const o = alongX
            ? { x0: 0, x1: L - 1, z0: 0, z1: S - 1, y0: 0, h, cornerLift: false, ...tile }
            : { x0: 0, x1: S - 1, z0: 0, z1: L - 1, y0: 0, h, cornerLift: false, ...tile };
          const makers = [
            ['hip', hipRoof],
            ['xieshan', (b, oo) => xieshanRoof(b, { ...oo, suspendedFish: false })],
            ['pyramid', (b, oo) => pyramidRoof(b, { ...oo, baoding: false })],
          ];
          for (const [name, fn] of makers) {
            cases++;
            const r = audit(fn, o, () => true);
            if (r.bad.length) fails.push(`${name} ${r.L}×${r.S} h=${h} 缺 ${r.bad.length} 列，例如 ${r.bad.slice(0, 3).join(' ')}`);
          }
        }
      }
    }
    // 真实参数（取自 buildings.js，含主殿上檐 46×27 h=11）
    const REAL = [
      ['hip 主殿上檐', hipRoof, { x0: 0, x1: 45, z0: 0, z1: 26, h: 11 }],
      ['xieshan 山门', xieshanRoof, { x0: 0, x1: 35, z0: 0, z1: 20, h: 11, hipFrac: 0.4, suspendedFish: false }],
      ['xieshan 配殿', xieshanRoof, { x0: 0, x1: 18, z0: 0, z1: 40, h: 11, hipFrac: 0.42, suspendedFish: false }],
      ['pyramid 钟鼓楼', pyramidRoof, { x0: 0, x1: 12, z0: 0, z1: 12, h: 8, baoding: false }],
    ];
    for (const [name, fn, o] of REAL) {
      cases++;
      const r = audit(fn, { y0: 0, cornerLift: false, ...tile, ...o }, () => true);
      if (r.bad.length) fails.push(`${name} ${r.L}×${r.S} h=${o.h} 缺 ${r.bad.length} 列，例如 ${r.bad.slice(0, 3).join(' ')}`);
    }
    // 围脊／腰檐：只查外檐到 inner 之间的环带（中空是设计，不算缝）
    for (const [name, o] of [
      ['主殿下檐', { x0: 0, x1: 53, z0: 0, z1: 34, inner: { x0: 5, x1: 48, z0: 5, z1: 29 } }],
      ['钟鼓楼腰檐', { x0: 0, x1: 12, z0: 0, z1: 12, inner: { x0: 2, x1: 10, z0: 2, z1: 10 } }],
    ]) {
      for (const h of [3, 4, 5]) {
        cases++;
        const oo = { y0: 0, h, cornerLift: false, ...tile, ...o };
        const r = audit(skirtRoof, oo, (l, s) => {
          const W = oo.x1 - oo.x0 + 1, D = oo.z1 - oo.z0 + 1, alongX = W >= D;
          const L = alongX ? W : D, S = alongX ? D : W;
          const inL = alongX ? oo.inner.x0 - oo.x0 : oo.inner.z0 - oo.z0;
          const inS = alongX ? oo.inner.z0 - oo.z0 : oo.inner.x0 - oo.x0;
          return l < inL || l > L - 1 - inL || s < inS || s > S - 1 - inS;
        });
        if (r.bad.length) fails.push(`${name} ${r.L}×${r.S} h=${h} 环带缺 ${r.bad.length} 列，例如 ${r.bad.slice(0, 3).join(' ')}`);
      }
    }
    // 八角檐（宝塔）：控制组 —— 这份写法本来就把踏步填实，必须同样是 0 缺列
    for (const [r0, rEnd, h] of [[13, 10, 4], [11, 8, 4], [7, 1, 6]]) {
      cases++;
      const cut = Math.round(r0 * 1.28);
      const o = { cx: 0, cz: 0, r0, rEnd, y0: 0, h, hipRidge: false, ...tile };
      const r = audit(octRoof, o, (l, s) => Math.abs(l + 0.5) <= r0 && Math.abs(s) <= r0 && Math.abs(l + 0.5) + Math.abs(s) <= cut);
      if (r.bad.length) fails.push(`oct r0=${r0}→${rEnd} h=${h} 缺 ${r.bad.length} 列，例如 ${r.bad.slice(0, 3).join(' ')}`);
    }
    return {
      ok: fails.length === 0,
      detail: fails.length ? `${fails.length} 项失败：${fails.slice(0, 3).join(' | ')}` : `${cases} 组屋顶（含主殿上檐/下檐、山门、配殿、钟鼓楼、宝塔）平面投影全部铺满，无贯穿缝`,
    };
  }
);

/* ────────────── 10. 翘角必须紧贴屋面（不得发射到别处） ────────────── */
/**
 * 由来（2026-09-19）：用户看到山门周围有漂浮物。根因是 `eaveCorners` 把
 * `put(l, s, y, key)` 的 s 与 y 传反（初始提交即如此）：每个翘角体素都被发射到
 * (x0+l, y=ds, z0+(y+up)) —— 本该在檐口高度的那几格落到 y≈0（地下）或 y≈S（悬在半空），
 * 从外面看就是建筑周围一圈游离的单格。
 *
 * 口径：翘角是“从檐口斜着挑出去的台阶”，所以要求**从屋面出发能沿切比雪夫 ≤1 的步子走到每一个翘角格**
 * （允许斜向台阶，但不允许飞到别处）。传反参数时翘角会落在 y≈0 的地下或 y≈S 的半空，
 * 从屋面永远走不到 —— 这就是断言的判据。围脊/腰檐的角部起翘拆不出来，
 * 就退一步要求：每个格子都能在自己的输出里找到 ≤1 的邻居（不允许有孤立格）。
 */
check(
  'roof-cornerlift-attached',
  '翘角（飞檐）必须挂在檐口上：从屋面格出发沿切比雪夫 ≤1 的步子必须能走到每一个翘角格；围脊角部起翘的每一格必须能走到同一次输出里的其它格',
  () => {
    const NEAR = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) NEAR.push([dx, dy, dz]);
    const key = (c) => `${c.x},${c.y},${c.z}`;
    /** 从 seed 出发沿切比雪夫 ≤1 扩散，返回走不到的 lift 格 */
    const unreachable = (seed, lift) => {
      const all = new Map();
      for (const c of seed) all.set(key(c), c);
      for (const c of lift) all.set(key(c), c);
      const seen = new Set(seed.map(key));
      const queue = [...seed];
      while (queue.length) {
        const c = queue.pop();
        for (const [dx, dy, dz] of NEAR) {
          const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
          if (seen.has(k) || !all.has(k)) continue;
          seen.add(k);
          queue.push(all.get(k));
        }
      }
      return lift.filter((c) => !seen.has(key(c)));
    };
    const tile = { tile: 'tileGray', tile2: 'tileGray2', ridge: 'ridgeGray', eaveAccent: 'gold' };
    const fails = [];
    let cases = 0, liftCells = 0;
    // 真实参数（主殿上檐、山门、配殿、钟鼓楼）+ 参数扫描
    const REAL = [
      ['hip 主殿上檐', hipRoof, { x0: 0, x1: 45, z0: 0, z1: 26, y0: 27, h: 11, reach: 3 }],
      ['xieshan 山门', xieshanRoof, { x0: 0, x1: 35, z0: 0, z1: 20, y0: 15, h: 11, hipFrac: 0.4, reach: 3 }],
      ['xieshan 配殿', xieshanRoof, { x0: 0, x1: 18, z0: 0, z1: 40, y0: 17, h: 11, hipFrac: 0.42, reach: 3 }],
      ['pyramid 钟鼓楼', pyramidRoof, { x0: 0, x1: 12, z0: 0, z1: 12, y0: 23, h: 8, reach: 3 }],
    ];
    for (let S = 5; S <= 20; S += 5) {
      for (const h of [3, 6, 11]) REAL.push([`hip 扫描 ${S}×${S + 12}`, hipRoof, { x0: 0, x1: S + 11, z0: 0, z1: S - 1, y0: 20, h, reach: 3 }]);
    }
    for (const [name, fn, base] of REAL) {
      cases++;
      // 注意：eaveCorners 用的是 info.put（绑在调用方 builder 上），所以不能给它另传 stub ——
      // 翘角格只能从“开/关 cornerLift 两次输出的差集”里取（否则会收到 0 格而空转）。
      const build = (extra) => {
        const cells = [];
        fn({ set: (x, y, z, k) => cells.push({ x, y, z, k }) }, { ...tile, ...base, suspendedFish: false, baoding: false, ...extra });
        return cells;
      };
      const surf = build({ cornerLift: false });
      const set = new Set(surf.map((c) => `${c.x},${c.y},${c.z}`));
      const corner = build({ cornerLift: true }).filter((c) => set.has(`${c.x},${c.y},${c.z}`) === false);
      liftCells += corner.length;
      if (corner.length === 0) { fails.push(`${name}: 未产生任何翘角格（断言会空转，必须先修取样方式）`); continue; }
      const stray = unreachable(surf, corner);
      if (stray.length) fails.push(`${name}: ${stray.length}/${corner.length} 个翘角格从屋面走不到，例如 ${stray.slice(0, 3).map((c) => `(${c.x},${c.y},${c.z})`).join(' ')}`);
    }
    for (const [name, o] of [
      ['主殿下檐', { x0: 0, x1: 53, z0: 0, z1: 34, inner: { x0: 5, x1: 48, z0: 5, z1: 29 } }],
      ['钟鼓楼腰檐', { x0: 0, x1: 12, z0: 0, z1: 12, inner: { x0: 2, x1: 10, z0: 2, z1: 10 } }],
    ]) {
      for (const h of [3, 4]) {
        cases++;
        const cells = [];
        skirtRoof({ set: (x, y, z, k) => cells.push({ x, y, z, k }) }, { ...tile, ...o, y0: 19, h, cornerLift: false });
        liftCells += cells.length;
        const idx = new Map(cells.map((c, i) => [`${c.x},${c.y},${c.z}`, i]));
        const stray = cells.filter((c, i) => {
          for (const [dx, dy, dz] of NEAR) {
            const j = idx.get(`${c.x + dx},${c.y + dy},${c.z + dz}`);
            if (j !== undefined && j !== i) return false;
          }
          return true;
        });
        if (stray.length) fails.push(`${name} h=${h}: ${stray.length}/${cells.length} 格是游离的，例如 ${stray.slice(0, 3).map((c) => `(${c.x},${c.y},${c.z})`).join(' ')}`);
      }
    }
    return {
      ok: fails.length === 0,
      detail: fails.length ? `${fails.length} 项失败：${fails.slice(0, 3).join(' | ')}` : `${cases} 组屋顶、${fmt(liftCells)} 个翘角/起翘格全部贴住屋面（切比雪夫 ≤1）`,
    };
  }
);

/* ────────────── 11. 不许有薄的悬空碎片 ────────────── */
/**
 * 由来（2026-09-19）：用户先看到山门周围的漂浮物（翘角参数传反），又看到水池边的两个悬浮物
 * （钟鼓楼槛窗 axis 用错，整块格栅被发射到塔外半空）。两次都是"肉眼先发现、断言全绿"。
 *
 * 口径：按切比雪夫连通分组，凡是不与地面（y ≤ 1）连通的组：
 *   · 三个方向都 ≥3 格的实体部件 —— 放过（例：钟鼓楼上层的斗拱+攒顶是一整层实体）；
 *   · 登记在案的悬吊饰物 —— 放过并逐条计数（塔檐风铃，gold+bronze 成对）；
 *   · 其余（薄片 5×4×1、单点 1×1×1）—— 一律失败。
 * 这条判据同时能抓住那个格栅 bug 与香炉金耳那类"探出 2 格但中间没连接格"的写法。
 */
check(
  'no-airborne-fragments',
  '不许有薄的悬空碎片：不与地面连通的体素组，要么三向尺寸都 ≥3（实体部件），要么是登记在案的悬吊饰物（风铃，逐条计数）；薄片/单点的悬空物一律判失败',
  () => {
    const SKIP = new Set(['cloud']);
    const CHEB = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) CHEB.push([dx, dy, dz]);
    const seen = new Set();
    const fails = [];
    let solid = 0, suspended = 0;
    const suspendedPer = new Map();
    for (const [k0, c0] of world.map) {
      if (seen.has(k0) || SKIP.has(c0.k)) continue;
      const queue = [c0];
      const comp = [];
      seen.add(k0);
      let minY = Infinity;
      while (queue.length) {
        const c = queue.pop();
        comp.push(c);
        if (c.y < minY) minY = c.y;
        for (const [dx, dy, dz] of CHEB) {
          const k = keyOf(c.x + dx, c.y + dy, c.z + dz);
          if (seen.has(k)) continue;
          const v = world.map.get(k);
          if (!v || SKIP.has(v.k)) continue;
          seen.add(k);
          queue.push(v);
        }
      }
      if (minY <= 1) continue;                       // 与地面连通 = 落地
      const xs = comp.map((c) => c.x), ys = comp.map((c) => c.y), zs = comp.map((c) => c.z);
      const dims = [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1, Math.max(...zs) - Math.min(...zs) + 1];
      if (Math.min(...dims) >= 3) { solid++; continue; }   // 实体部件
      const keys = [...new Set(comp.map((c) => c.k))].sort();
      // 登记在案的悬吊饰物：塔檐风铃 —— 必须是 gold + bronze 成对（各一格），且落在塔檐范围内。
      // 豁免盒刻意收窄：否则“单格 gold 悬空”这种真缺陷会被当成风铃放过（实测漏过一次）。
      const inPagoda = (c) => c.x >= -17 && c.x <= 16 && c.z >= -98 && c.z <= -70 && c.y >= 4;
      if (comp.length === 2 && keys.join('+') === 'bronze+gold' && comp.every(inPagoda)) {
        suspended++;
        const id = '塔檐风铃 bronze+gold';
        suspendedPer.set(id, (suspendedPer.get(id) ?? 0) + 1);
        continue;
      }
      fails.push(`${comp.length} 格 ${dims.join('×')} @ x[${Math.min(...xs)},${Math.max(...xs)}] y[${Math.min(...ys)},${Math.max(...ys)}] z[${Math.min(...zs)},${Math.max(...zs)}] ${keys.join(',')}`);
    }
    const ex = [...suspendedPer.entries()].map(([k, v]) => `${k} ${v} 组`).join('；');
    return {
      ok: fails.length === 0,
      detail: fails.length
        ? `${fails.length} 处薄片/单点悬空：${fails.slice(0, 3).join(' | ')}`
        : `落地连通域之外的构件：${solid} 组实体部件（三向 ≥3）+ 逐条计数豁免 ${ex || '无'}`,
    };
  }
);

/* ────────────── 12. 两块放生池不得被别的构件吃掉 ────────────── */
/**
 * 由来（2026-09-19）：水池原先取 x[7,22] z[26,38]，南缘越过了山门台基线（z=37）、
 * 西缘落在山门北踏道的 x 带内（x ≤ 8）——水面 22 格 + 台明 52 格被台基/踏道覆写，
 * 大理石台阶真的压在池水上方。现在矩形改为 x[12,27] z[26,34]（四向留 ≥1 格净距），
 * 这条断言就是它的机检形式：水面/台明/池沿的每一格都必须还是水池自己的东西。
 */
check(
  'pond-intact',
  '两块放生池不得被其它构件吃掉：水面格必须是 water/lotus（y=1）、台明格必须是 stone2/stone（y=1）、池沿格必须是 stone 或栏板/望柱的 marble（y=2）；东池与镜像西池都查，被台基/踏道/铺装覆写的格子一律算失败',
  () => {
    const P = LAYOUT.pond;
    const fails = [];
    let checked = 0, water = 0, lotus = 0, blossom = 0;
    for (const mirror of [false, true]) {
      const tag = mirror ? '西' : '东';
      const X = (x) => (mirror ? -1 - x : x);
      for (let x = P.x0 - 2; x <= P.x1 + 2; x++) {
        for (let z = P.z0 - 2; z <= P.z1 + 2; z++) {
          const inner = x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1;
          const onRim = x === P.x0 - 2 || x === P.x1 + 2 || z === P.z0 - 2 || z === P.z1 + 2;
          const gx = X(x);
          if (inner) {
            const w = world.get(gx, 1, z);
            checked++;
            if (!w || (w.k !== 'water' && w.k !== 'lotus')) fails.push(`${tag}池水面 (${gx},1,${z}) 被 ${w ? w.k : '清空'} 占用`);
            else { if (w.k === 'lotus') lotus++; else water++; }
            const b2 = world.get(gx, 2, z);
            if (b2 && b2.k === 'blossom') blossom++;
          } else {
            const a = world.get(gx, 1, z);
            checked++;
            if (!a || (a.k !== 'stone2' && a.k !== 'stone')) fails.push(`${tag}池台明 (${gx},1,${z}) 被 ${a ? a.k : '清空'} 占用`);
            if (onRim) {
              const r = world.get(gx, 2, z);
              checked++;
              if (!r || (r.k !== 'stone' && r.k !== 'marble')) fails.push(`${tag}池沿 (${gx},2,${z}) 被 ${r ? r.k : '清空'} 占用`);
            }
          }
        }
      }
    }
    const size = (P.x1 - P.x0 + 1) * (P.z1 - P.z0 + 1);
    return {
      ok: fails.length === 0,
      detail: fails.length
        ? `${fails.length} 格被占（共查 ${fmt(checked)}）：${fails.slice(0, 3).join(' | ')}`
        : `东+西两池共查 ${fmt(checked)} 格完好：每池水面 ${size} 格（荷叶 ${lotus / 2}・莲花 ${blossom / 2}）+ 台明 + 池沿矮石栏`,
    };
  }
);

/* ────────────── 13. 塔院的「绕塔」必须可行 ────────────── */
/**
 * 由来（2026-09-19）：塔院原本是一片 39×41 的空石板，补景（回纹带 / 十字甬道 / 四角松柏 / 北角碑亭 /
 * 石灯）全部只贴在院边与院角，就是为了不堵“绕塔”。这条断言把这个约定变成可机检的：
 *   ① 贴塔基八角外一圈的地面必须可站立（无构筑物/树池压在环上）；
 *   ② 从南侧空地 4-连通能走到北侧空地（院内可通行地面不得被补景切断）。
 * “可站立”的口径：塔基八角之外、院内、脚下是铺装/石作、且上方留出高度（1 格台阶算可上）。
 */
check(
  'pagoda-circumambulation',
  '塔院绕塔必须可行：贴塔基八角外一圈地面均可站立，且从南侧空地 4-连通可走到北侧空地（补景不得侵入环道或切断院内通行）',
  () => {
    const P = LAYOUT.pagoda, R = P.r + 3, cut = Math.round(R * 1.28);
    const inside = (x, z) => {
      const dx = x - P.cx + 0.5, dz = z - P.cz;
      return Math.max(Math.abs(dx), Math.abs(dz)) <= R && Math.abs(dx) + Math.abs(dz) <= cut;
    };
    const FLOOR = new Set(['paving', 'paving2', 'brick', 'stone', 'stone2', 'marble']);
    const stand = (x, z) => {
      if (x < -20 || x > 19 || z < -104 || z > -64) return false;
      if (inside(x, z)) return false;
      if (world.has(x, 3, z)) return false;                       // 上方 2 格必须留空
      const top = world.get(x, 2, z);
      if (top && !FLOOR.has(top.k)) return false;                 // 1 格台阶（铺装/石作）算可上
      const f = world.get(x, 1, z);
      return !!(f && FLOOR.has(f.k));
    };
    // ① 贴塔基一圈（八边形外侧 1 格）
    const ring = [];
    for (let x = -20; x <= 19; x++) {
      for (let z = -104; z <= -64; z++) {
        if (inside(x, z)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => inside(x + dx, z + dz))) ring.push([x, z]);
      }
    }
    const blocked = ring.filter(([x, z]) => !stand(x, z));
    // ② 南岸 → 北岸 4-连通。取样带必须**紧贴院的最南/最北两行**：
    //    第一版取 z -70..-64，结果种子同时落在障碍两侧（例如 z=-67 的一道墙），
    //    断言就成了空转 —— 跨不过任何一道墙才算真的连通。
    const seeds = [], targets = [];
    for (let x = -20; x <= 19; x++) {
      for (let z = -65; z <= -64; z++) if (stand(x, z)) seeds.push(`${x},${z}`);
      for (let z = -103; z <= -102; z++) if (stand(x, z)) targets.push(`${x},${z}`);
    }
    const seen = new Set(seeds);
    const queue = [...seeds];
    while (queue.length) {
      const [x, z] = queue.pop().split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
        if (seen.has(k) || !stand(nx, nz)) continue;
        seen.add(k);
        queue.push(k);
      }
    }
    const hit = targets.filter((k) => seen.has(k)).length;
    const fails = [];
    if (blocked.length) fails.push(`环道被堵 ${blocked.length} 格：${blocked.slice(0, 3).map(([x, z]) => `(${x},${z})`).join(' ')}`);
    if (!hit) fails.push(`南侧走不到北侧（可站立 ${seen.size} 格，北岸种子 ${targets.length} 个均未连通）`);
    return {
      ok: fails.length === 0,
      detail: fails.length ? fails.join('；') : `贴塔基环道 ${ring.length} 格全部可站立；南→北 4-连通（可通行地面 ${fmt(seen.size)} 格，北岸命中 ${hit}/${targets.length}）`,
    };
  }
);

/* ────────────── 14. 围墙完整性（不得被后来的构件压掉/挖穿） ────────────── */
/**
 * 由来（2026-09-19）：用户看出塔院碑亭与围墙重叠 —— 亭子原先放在院北两角，
 * 檐口/台明北沿正好落在后墙那一行（z=-104），把墙的 wallRed/压顶换成了亭子的石作。
 * 这种“后来者压墙”不影响任何其它断言，所以单独设一条：院墙 footprint 的每一列
 * （y=1..8）必须仍然是墙自己的色卡。列的范围直接由 LAYOUT.wall / LAYOUT.gate 推出，
 * 与 site.js 的 enclosure() 同口径（但不去调用它，避免自己抄自己）。
 */
check(
  'wall-intact',
  '围墙不得被后来的构件侵占：东西墙、后墙、前墙两段的每一列（y=1..8）都必须是墙自身的色卡（wallRed/wallRed2/brick/tileGray/tileGray2）',
  () => {
    const W = LAYOUT.wall, G = LAYOUT.gate;
    const RUNS = [
      { x0: W.x0, x1: W.x0 + 1, z0: W.zBack, z1: W.zFront + 1 },
      { x0: W.x1 - 1, x1: W.x1, z0: W.zBack, z1: W.zFront + 1 },
      { x0: W.x0, x1: W.x1, z0: W.zBack, z1: W.zBack + 1 },
      // 前墙两段只检查到山门台基之外（台基含 stretch 外扩，端头与之相接，那段有意覆盖）
      { x0: W.x0, x1: G.x0 - 5, z0: W.zFront, z1: W.zFront + 1 },
      { x0: G.x1 + 5, x1: W.x1, z0: W.zFront, z1: W.zFront + 1 },
    ];
    const ALLOWED = new Set(['wallRed', 'wallRed2', 'brick', 'tileGray', 'tileGray2']);
    // 前墙上的两座掖门（site.js 的 sideDoor(b, -40/39, zFront)）是**有意开口**：
    // 门洞 3 格宽、自带门楣与瓦顶，外框共 7 格宽（x-3..x+3）—— 从 footprint 里剔除。
    const door = (x) => Math.abs(x + 40) <= 3 || Math.abs(x - 39) <= 3;
    const fails = [];
    let checked = 0;
    // 压顶外挑一圈（y=7..8）不得被其它构件占用：墙顶比墙身四周各宽 1 格，
    // 后来者（如塔院碑亭的檐口/翘角）压上来就与围墙重叠了 —— 原先没有任何断言管这件事。
    // 树冠属于自然物（leaf/trunk…），允许搭在墙头上，不算侵占。
    const NATURAL = new Set(['grass', 'grass2', 'leaf', 'leaf2', 'leafWarm', 'trunk', 'cloud']);
    const capBad = new Set();
    for (const r of RUNS) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
          if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) continue;
          for (let y = 7; y <= 8; y++) {
            const v = world.get(x, y, z);
            if (v && !ALLOWED.has(v.k) && !NATURAL.has(v.k)) capBad.add(`(${x},${y},${z}) 是 ${v.k}`);
          }
        }
      }
    }
    for (const r of RUNS) {
      for (let x = r.x0; x <= r.x1; x++) {
        for (let z = r.z0; z <= r.z1; z++) {
          const frontWall = z >= W.zFront;   // 前墙两段才含掖门（zFront 属于 wall，不是 gate）
          if (frontWall && door(x)) continue;
          for (let y = 1; y <= 8; y++) {
            const v = world.get(x, y, z);
            checked++;
            if (!v || !ALLOWED.has(v.k)) {
              if (fails.length < 6) fails.push(`(${x},${y},${z}) 是 ${v ? v.k : '空'}`);
              else if (fails.length === 6) fails.push('…');
            }
          }
        }
      }
    }
    if (capBad.size) fails.push(`压顶外挑一圈被占：${[...capBad].slice(0, 4).join(' | ')}`);
    return {
      ok: fails.length === 0,
      detail: fails.length
        ? `围墙 footprint 被侵占（共查 ${fmt(checked)} 格）：${fails.slice(0, 4).join(' | ')}`
        : `五段院墙 footprint 共 ${fmt(checked)} 格（y=1..8）全部保持墙自身的色卡；压顶外挑一圈无占用`,
    };
  }
);

/* ────────────── 15. 院墙边甬道必须畅通 ────────────── */
/**
 * 由来（2026-09-19）：给院墙边加了两条三格宽甬道 + 塔院入口的横向连接段，围出环塔院的动线。
 * 风险很具体：外围林带是**随机**落的（forest/treeBelt），可能正好长在路上。
 * 口径：四条带每一格 y=1 必须是铺装/石作、y=2..3 必须空，且每条带自己 4-连通（首尾可达）。
 */
check(
  'walk-paths-clear',
  '院墙边甬道与入口连接段必须畅通：四段带子逐格核对（y=1 铺装、y=2..3 空）且各自 4-连通，随机林木不得长在路上',
  () => {
    const BANDS = [
      { tag: '西侧沿墙', x0: -53, x1: -51, z0: -103, z1: 8 },
      { tag: '东侧沿墙', x0: 50, x1: 52, z0: -103, z1: 8 },
      { tag: '西入口连接', x0: -51, x1: -21, z0: -64, z1: -62 },
      { tag: '东入口连接', x0: 20, x1: 50, z0: -64, z1: -62 },
    ];
    const FLOOR = new Set(['paving', 'paving2', 'stone', 'stone2', 'brick']);
    // 树冠搭在甬道**上方**是自然的（路在树下），所以 y=2..3 只禁非自然物；
    // 树干/其它构件长在路上会直接毁掉 y=1 的铺装，由第一句拦下。
    const NATURAL = new Set(['grass', 'grass2', 'leaf', 'leaf2', 'leafWarm', 'trunk', 'cloud']);
    const blocked = (x, z) => {
      for (const y of [2, 3]) {
        const v = world.get(x, y, z);
        if (v && !NATURAL.has(v.k)) return `(${x},${y},${z}) 被 ${v.k} 占`;
      }
      return null;
    };
    const fails = [];
    let cells = 0;
    for (const bd of BANDS) {
      const bad = [];
      for (let x = bd.x0; x <= bd.x1; x++) {
        for (let z = bd.z0; z <= bd.z1; z++) {
          cells++;
          const f = world.get(x, 1, z);
          if (!f || !FLOOR.has(f.k)) bad.push(`(${x},1,${z}) 是 ${f ? f.k : '空'}`);
          const hit = blocked(x, z);
          if (hit) bad.push(hit);
        }
      }
      // 4-连通：从带子的起点格出发，应能走到终点格（只看 y=1 与上方有无非自然物）
      const inside = (x, z) => x >= bd.x0 && x <= bd.x1 && z >= bd.z0 && z <= bd.z1;
      const open = (x, z) => inside(x, z) && FLOOR.has(world.get(x, 1, z)?.k ?? '') && !blocked(x, z);
      const start = [bd.x0, bd.z0], goal = [bd.x1, bd.z1];
      const seen = new Set([`${start[0]},${start[1]}`]);
      const q = [start];
      let reached = false;
      while (q.length) {
        const [x, z] = q.pop();
        if (x === goal[0] && z === goal[1]) { reached = true; break; }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
          if (seen.has(k) || !open(nx, nz)) continue;
          seen.add(k); q.push([nx, nz]);
        }
      }
      if (bad.length) fails.push(`${bd.tag} 被阻 ${bad.length} 格：${bad.slice(0, 2).join(' ')}`);
      if (!reached) fails.push(`${bd.tag} 首尾不连通（可通行 ${seen.size} 格）`);
    }
    return {
      ok: fails.length === 0,
      detail: fails.length ? `${fails.length} 项失败：${fails.slice(0, 3).join('；')}` : `四段共 ${fmt(cells)} 格全部畅通（y=1 铺装、上方无非自然物，树冠遮荫不计），且各自首尾 4-连通`,
    };
  }
);

/* ────────────── 16. 日轨与阴影方向 ────────────── */
/**
 * 由来（2026-09-19，用户报「阴影方向相反」）：
 * `SkyRig.dirOf` 把 z 写成 `+cos(el)cos(az)`，将整条日轨镜像到了 **北**半空间：
 * 正午 az=205/el=62 算出 z=-0.425 ⇒ 太阳在北边 ⇒ 阴影朝南。用户只注意到正午（黎明/黄昏
 * 的 z 分量仅∓0.22，东西向主导，看着“还行”），这恰好是这条断言要卡的点。
 * 口径：① 三个预设的太阳都必须在 +z（南）半空间；② 正午必须是最偏南且最高的那个；
 * ③ 晨曦与黄昏分居东西两半（太阳由东向西跑）；④ 正午阴影方向 = −dir 必须指北。
 */
check(
  'noon-shadow-north',
  '日轨必须在南半空间：三个预设 dirOf().z > 0、正午最偏南且最高、晨曦/黄昏分居东西，且正午阴影（−dir）朝北',
  () => {
    const dirs = Object.fromEntries(Object.entries(SKIES).map(([k, p]) => [k, SkyRig.dirOf(p.sun)]));
    const bad = [];
    for (const [k, d] of Object.entries(dirs)) {
      if (!(d.z > 0)) bad.push(`${k} 太阳偏北（z=${d.z.toFixed(3)}，应为正）—— 阴影会朝南`);
    }
    if (!(dirs.noon.z >= dirs.dawn.z && dirs.noon.z >= dirs.dusk.z)) bad.push('正午不是最偏南的预设');
    if (!(dirs.noon.y >= dirs.dawn.y && dirs.noon.y >= dirs.dusk.y)) bad.push('正午不是最高的预设');
    if (!(dirs.dawn.x * dirs.dusk.x < 0)) bad.push('晨曦与黄昏不在东西两侧（太阳没有横穿天空）');
    const noonShadow = dirs.noon.clone().multiplyScalar(-1);
    if (!(noonShadow.z < 0)) bad.push(`正午阴影不朝北（−dir.z=${noonShadow.z.toFixed(3)}）`);
    const fmtV = (d) => `x=${d.x.toFixed(2)} y=${d.y.toFixed(2)} z=${d.z.toFixed(2)}`;
    return {
      ok: bad.length === 0,
      detail: bad.length
        ? bad.join('；')
        : `晨曦 ${fmtV(dirs.dawn)} / 正午 ${fmtV(dirs.noon)} / 黄昏 ${fmtV(dirs.dusk)} —— 三者 z>0 且正午最偏南，正午阴影朝北（−z）`,
    };
  }
);

/* ────────────── 17. 渲染证据（render-smoke） ────────────── */
/**
 * 由来（2026-09-23）：两个 P0 在 17/17 全绿的情况下发布，
 * 因为它们只坏在 **WebGL 渲染产物**上，而前 17 条断言只覆盖装配流水线的体素数据。
 *
 *   1. `onBeforeCompile` 注入的 `totalEmissiveRadiance *= vColor` —— three 0.186 启用
 *      instanceColor 时 `vColor` 是 **vec4**，vec3 *= vec4 ⇒ GLSL 编译失败，
 *      灯笼（glow）材质批次整个不渲染。体素数据一个不少，17 条全绿。
 *   2. `toObject3D()` 内 `makeMaterials()` 每次新建材质，`setGlowIntensity()`
 *      改的是模块级 `MATS` ⇒ 灯笼 emissiveIntensity 恒 0。同样全绿。
 *
 * 这与 README 对 `cull-safety` 的自我批评是同一条：**自算一遍 ≠ 渲染路径真的如此**。
 * 因此这里把「渲染产物」本身变成可机检事实：起无头 Chrome 打开构建产物，
 * 收集 console/异常 + three 的 program 诊断 + 自发光强度传导 + GL 错误码。
 *
 * 环境无 Chrome/Chromium 时记为 **skipped**（不计失败、不影响退出码），
 * 保证任何环境都能跑自检；`VCC_SKIP_RENDER=1` 可显式跳过。
 */
const RENDER_CLAIM =
  '构建产物在真实 WebGL 下：无 console 错误/未捕获异常、program 全部 runnable（无 shader 编译失败）、' +
  'gl.getError() 为 0、自发光强度真的传到 glow 网格（setGlowIntensity 生效）、且渲染调用数与体素数与装配流水线一致';

// 探针：注入到被服务的 index.html 里，跑完后把结果 POST 回自检进程。
// 用 page 级 console/uncaught 钩子而非浏览器 Log，避免把 favicon 404 之类
// 的网络层日志算成页面错误。
const PROBE = `
<script>
(() => {
  const errs = [];
  const ce = console.error.bind(console);
  console.error = (...a) => { errs.push(a.map(String).join(' ')); ce(...a); };
  addEventListener('error', (e) => errs.push('uncaught: ' + (e.message || (e.error && e.error.message) || e.error)));
  addEventListener('unhandledrejection', (e) => errs.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
  const post = (body) => fetch('/__vcc_report__', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (typeof window.__vcc !== 'undefined' && !document.getElementById('boot')) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (typeof window.__vcc === 'undefined') { post({ fatal: 'window.__vcc 未就绪：装配失败或启动超时', errs }); return; }
    await new Promise((r) => setTimeout(r, 3000));   // 让渲染循环跑几帧，setGlowIntensity 至少执行一次
    try {
      const v = window.__vcc, info = v.renderer.info;
      const broken = [];
      info.programs.forEach((p, i) => {
        if (p.diagnostics && !p.diagnostics.runnable) broken.push('#' + i + ' ' + String(p.diagnostics.programLog || '').slice(0, 160));
      });
      const glow = v.voxelGroup.children.find((c) => c.material && c.material.emissive && c.material.emissive.getHexString() === 'ffffff');
      post({
        errs,
        programs: info.programs.length, broken,
        calls: info.render.calls, triangles: info.render.triangles,
        glError: v.renderer.getContext().getError(),
        glowInstances: glow ? glow.count : 0,
        glowEmissiveI: glow ? glow.material.emissiveIntensity : null,
        visible: v.stats.visible, total: v.stats.total,
      });
    } catch (e) { post({ fatal: String((e && e.stack) || e), errs }); }
  })();
})();
</script>
`;

async function renderSmoke() {
  const t0 = performance.now();
  const done = (ok, detail) => ({ ok, detail, ms: +(performance.now() - t0).toFixed(1) });
  const skip = (why) => ({ ok: true, skipped: true, detail: why, ms: +(performance.now() - t0).toFixed(1) });

  if (process.env.VCC_SKIP_RENDER) return skip(`已跳过（VCC_SKIP_RENDER=${process.env.VCC_SKIP_RENDER}）`);

  const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
  if (!existsSync(join(distDir, 'index.html'))) return skip('dist/ 不存在 —— 先 npm run build 即可启用本断言');

  // 找浏览器
  let bin = null;
  for (const b of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium']) {
    try { if (spawnSync(b, ['--version'], { stdio: 'ignore' }).status === 0) { bin = b; break; } } catch { /* 下一个 */ }
  }
  if (!bin) return skip('未找到 Chrome/Chromium —— 渲染证据缺失（不阻塞自检，但发布前应手动验证）');

  let report = null;
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && u.pathname === '/__vcc_report__') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { try { report = JSON.parse(body); } catch { /* 由超时兜底 */ } res.writeHead(200).end('ok'); });
      return;
    }
    const rel = (u.pathname === '/' ? '/index.html' : u.pathname).replace(/\.\./g, '');
    try {
      const data = await readFile(join(distDir, rel));
      const html = rel.endsWith('.html');
      res.writeHead(200, { 'content-type': html ? 'text/html; charset=utf-8' : 'application/javascript' });
      res.end(html ? data.toString('utf8').replace('</body>', `${PROBE}</body>`) : data);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const profile = join(tmpdir(), `vcc-smoke-${process.pid}-${Date.now()}`);
  const child = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    `--remote-debugging-port=${port + 1}`, `--user-data-dir=${profile}`,
    '--window-size=1280,800', `http://127.0.0.1:${port}/`,
  ], { stdio: 'ignore', detached: true });

  const deadline = Date.now() + 120000;
  try {
    while (!report && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* 已退出 */ } }
    server.close();
    rmSync(profile, { recursive: true, force: true });
  }

  if (!report) return done(false, `无头 Chrome 未在 120 s 内回报（页面未启动或装配卡住）；bin=${bin}`);
  if (report.fatal) return done(false, `${report.fatal}${report.errs?.length ? `｜console: ${report.errs.slice(0, 3).join(' / ')}` : ''}`);

  const bad = [];
  if (report.errs?.length) bad.push(`console 错误 ${report.errs.length} 条：${report.errs.slice(0, 2).join(' / ').slice(0, 200)}`);
  if (report.broken?.length) bad.push(`shader 编译失败 ${report.broken.length}/${report.programs}：${report.broken[0].slice(0, 160)}`);
  if (report.glError) bad.push(`gl.getError()=${report.glError}`);
  if (!(report.calls > 0)) bad.push(`渲染调用数为 ${report.calls}（画面没画出来）`);
  if (!(report.triangles > 0)) bad.push(`三角形数为 ${report.triangles}`);
  if (!(report.glowEmissiveI > 0)) bad.push(`glow emissiveIntensity=${report.glowEmissiveI} —— setGlowIntensity 没传到网格（材质对象被换掉）`);
  if (!(report.glowInstances > 0)) bad.push(`glow 批次实例数 ${report.glowInstances}`);
  if (report.visible !== built.stats.visible) bad.push(`渲染可见体素 ${report.visible} ≠ 装配 ${built.stats.visible}`);

  return done(bad.length === 0, bad.length
    ? bad.join('；')
    : `${fmt(report.total)} 体素 / 可见 ${fmt(report.visible)} · program ${report.programs}/${report.programs} runnable · `
      + `glow ${report.glowInstances} 格 emissive=${report.glowEmissiveI} · draw call ${report.calls} · 三角形 ${fmt(report.triangles)} · gl.error 0 · console 0 条`);
}

results.push({ name: 'render-smoke', claim: RENDER_CLAIM, ...(await renderSmoke()) });

/* ────────────── 输出 ────────────── */
const failed = results.filter((r) => !r.ok);
const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

console.log(`\n体素场景自检 · 装配 ${buildMs} ms · ${fmt(blocks.length)} 体素\n${'─'.repeat(78)}`);
for (const r of results) {
  const tag = r.skipped ? '  SKIP' : (r.ok ? '  PASS' : '  FAIL');
  console.log(`${tag}  ${pad(r.name, 20)} ${r.detail}`);
}
console.log('─'.repeat(78));
const ran = results.filter((r) => !r.skipped);
console.log(`${results.length - failed.length}/${results.length} 通过${failed.length ? ` —— 失败：${failed.map((f) => f.name).join(', ')}` : ' —— 全部断言为真'}`
  + `（实跑 ${ran.length} 条，跳过 ${results.length - ran.length} 条）`);
console.log(`\n检查清单（这些都是必须为真的陈述）：`);
for (const r of results) console.log(`  · [${r.ok ? 'x' : ' '}] ${r.claim}`);

process.exit(failed.length ? 1 : 0);
