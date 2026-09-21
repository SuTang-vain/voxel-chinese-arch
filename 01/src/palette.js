/**
 * palette.js — 中式古建色谱（sRGB hex）
 * 取色参考：汉白玉台基 / 朱红宫墙 / 金黄琉璃瓦 / 青瓦 / 青绿彩画
 */
import { hash3 } from './voxel.js';

export const C = {
  /* 地景 */
  GRASS: [0x527f3c, 0x487339, 0x5c8a43, 0x436c35],
  GRASS_DRY: [0x6f8a43, 0x7d9149],
  DIRT: [0x6d5a3c, 0x77643f],
  MOSS: 0x4a6b3a,

  /* 铺装 */
  PAVE: [0x8e9196, 0x82858b, 0x9aa0a6, 0x777b81],
  PAVE_WARM: [0xa79d8c, 0x9b9180, 0xb0a696],
  PAVE_DARK: [0x6d7176, 0x64686d],
  GOLD_BRICK: [0x9c8f74, 0x9c8f74, 0x8d8168],

  /* 石作 */
  STONE: [0xe7e1d3, 0xded7c8, 0xd2caba],
  STONE_DARK: [0xb9af9c, 0xafa593],
  STONE_SIDE: [0xc4baa6, 0xb8ae9a],
  MARBLE_VEIN: 0xcfc7b6,

  /* 墙体 */
  BRICK: [0xa93a30, 0xa1362c, 0xb24438],
  BRICK_DARK: 0x8b2b23,
  BRICK_LIGHT: 0xbb4d40,
  PLASTER: [0xe9e3d5, 0xe2dccd],

  /* 木构 */
  WOOD: [0x7d4a2a, 0x855130, 0x744428],
  WOOD_DARK: [0x53301b, 0x4a2b18],
  WOOD_LIGHT: 0x96633c,
  COLUMN: [0x9c2f28, 0x932b24, 0xa5382f],

  /* 瓦作 */
  TILE_GOLD: [0xd9a63c, 0xd19c33, 0xe2b04c],
  TILE_GOLD_D: 0xb5822a,
  TILE_GREEN: [0x3e6b4a, 0x36603f, 0x457453],
  TILE_GRAY: [0x525b63, 0x475059, 0x5c666e],
  TILE_GRAY_D: 0x39424a,
  RIDGE: [0x343c43, 0x2c333a],
  GABLE: [0xe4dccb, 0xdbd3c1],

  /* 彩画 / 金饰 */
  GOLD: 0xd8a63f,
  GOLD_DARK: 0xa9781f,
  PAINT_BLUE: 0x2b5c8f,
  PAINT_GREEN: 0x2f6b4e,
  PAINT_RED: 0x9c2f28,
  PLAQUE_BLUE: 0x1f3f6b,

  /* 自发光 */
  WIN_GLOW: 0xffcf7a,
  WIN_GLOW_DIM: 0xe8b25c,
  LANTERN: 0xff6a3a,
  LANTERN_DIM: 0xd8452a,

  /* 植被 / 陈设 */
  PINE: [0x2f5d3a, 0x27512f, 0x396b43],
  PINE_DARK: 0x1f4527,
  TRUNK: 0x533a22,
  BRONZE: 0x6f6a3c,
  BRONZE_DARK: 0x4f4b2a,
};

/** 瓦垄条纹：同色系交替，形成成排筒瓦的肌理 */
export function tiles(a, b) {
  const A = Array.isArray(a) ? a : [a];
  const B = Array.isArray(b) ? b : [b];
  return (x, y, z) => {
    const arr = ((x + z) & 1) === 0 ? A : B;
    return arr[(hash3(x, y, z) * arr.length) | 0];
  };
}
