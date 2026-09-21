/**
 * 色卡：中国古典建筑常用配色，每色给出 3 个明度档，
 * 体素渲染时按坐标做确定性哈希取档，得到“同一材质、深浅错落”的砖块质感。
 *
 * 字段说明：
 *   c        —— 三个色阶（十六进制）
 *   glossy   —— >0 时使用带高光的材质（琉璃瓦 / 金属），数值为 metalness 参考
 *   emissive —— 自发光强度（灯笼等），黄昏/夜间自动点亮
 *   water    —— 水面材质（半透明 + 反射感）
 */
export const PALETTE = {
  /* ── 琉璃瓦：主殿（黄琉璃） ── */
  tileGold: { c: ['#c9991f', '#d9ac33', '#b98a1b'], glossy: 0.28 },
  tileGold2: { c: ['#a87f16', '#b78d1e', '#997112'], glossy: 0.28 },
  ridgeGold: { c: ['#e8c96a', '#f2d77e', '#dcba58'], glossy: 0.35 },

  /* ── 琉璃瓦：山门 · 钟鼓楼（绿琉璃） ── */
  tileGreen: { c: ['#2f6b52', '#377a5e', '#285f48'], glossy: 0.28 },
  tileGreen2: { c: ['#255843', '#2c634c', '#1f4c3a'], glossy: 0.28 },
  ridgeGreen: { c: ['#519274', '#5c9c81', '#468467'], glossy: 0.35 },

  /* ── 青瓦：配殿 · 宝塔 ── */
  tileGray: { c: ['#637282', '#6e7d8f', '#586673'], glossy: 0.16 },
  tileGray2: { c: ['#48545f', '#515d6a', '#414c57'], glossy: 0.16 },
  ridgeGray: { c: ['#6e7c8a', '#7a8896', '#616f7c'], glossy: 0.25 },

  /* ── 墙体 ── */
  wallRed: { c: ['#9d2b21', '#aa3527', '#8d241b'] },
  wallRed2: { c: ['#7c2018', '#88271e', '#6d1b14'] },
  plaster: { c: ['#ded6c4', '#e7e0d0', '#d2cab8'] },
  plasterWarm: { c: ['#cfc2a6', '#d8ccb2', '#c4b79b'] },

  /* ── 木构 ── */
  wood: { c: ['#7a4a24', '#8a5a30', '#6c4020'] },
  wood2: { c: ['#55351c', '#5f3d20', '#4a2e18'] },
  wood3: { c: ['#a9743a', '#b5834a', '#9a6a33'] },

  /* ── 彩画 ── */
  paintBlue: { c: ['#2b4f7a', '#335c8c', '#24446b'] },
  paintGreen: { c: ['#2f6b4f', '#37795a', '#285d44'] },

  /* ── 石作 ── */
  stone: { c: ['#b6b0a3', '#c2bcaf', '#a9a396'] },
  stone2: { c: ['#989285', '#a29c90', '#8c867a'] },
  marble: { c: ['#e5e1d5', '#efece2', '#dad6ca'] },
  paving: { c: ['#a49e91', '#aea89b', '#9a9488'] },
  paving2: { c: ['#918b7f', '#9b958a', '#878174'] },
  brick: { c: ['#8c8478', '#978f83', '#82796e'] },

  /* ── 环境 ── */
  grass: { c: ['#517338', '#5b7d41', '#48672f'] },
  grass2: { c: ['#44602f', '#4b6834', '#3d5829'] },
  soil: { c: ['#7c6444', '#886f4e', '#715a3c'] },
  leaf: { c: ['#2f6b30', '#397a39', '#28602a'] },
  leaf2: { c: ['#24552a', '#2b6132', '#1f4c25'] },
  leafWarm: { c: ['#7b9a2c', '#8aa838', '#6d8b26'] },
  trunk: { c: ['#5a4028', '#654930', '#4f3822'] },
  water: { c: ['#2b6b8d', '#31789c'], water: true },
  lotus: { c: ['#3f7a3a', '#4a8a44'] },
  blossom: { c: ['#d98aa6', '#e79bb4'] },

  /* ── 器物 ── */
  lanternRed: { c: ['#c9342a', '#d64134'] },
  lanternLite: { c: ['#ffb066', '#ffc98c'], emissive: 0.95 },
  gold: { c: ['#e0b84c', '#eec75e'], glossy: 0.45 },
  bronze: { c: ['#6c6048', '#7a6e53'], glossy: 0.35 },
  black: { c: ['#2b2b30', '#34343a'] },
  cloud: { c: ['#f4f6fa', '#eaeff6', '#ffffff'] },
  banner: { c: ['#c0392f', '#cf4438'] },
  hill: { c: ['#4f6b41', '#577347', '#47603a'] },
};

/** 材质大类 → 渲染分组 */
export function matClassOf(def) {
  if (def.emissive) return 'glow';
  if (def.water) return 'water';
  if (def.glossy) return 'glossy';
  return 'opaque';
}

/** 名字 → 索引，用于哈希取色（保证左右镜像同色） */
const ORDER = Object.keys(PALETTE);
const INDEX = new Map(ORDER.map((k, i) => [k, i + 1]));

export function paletteIndex(key) {
  return INDEX.get(key) ?? 0;
}

/** 确定性哈希：镜像不变（用 |x+0.5| 作为输入） */
export function hash3(x, y, z, salt) {
  const hx = Math.abs(x + 0.5) | 0;
  let h = Math.imul(hx + 1, 374761393) ^ Math.imul(y + 7, 668265263) ^ Math.imul(z + 13, 1274126177) ^ Math.imul(salt, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}
