import { P } from './palette.js';
import {
  mainHall, hall, tower, pagoda, gatehouse,
  lion, lanternPost, pine, cypress,
} from './buildings.js';

/** 围墙：高 2 红墙 + 瓦顶压檐，gateGap 为山门豁口（南面中央） */
function courtyardWall(b, x0, z0, x1, z1, gapHalf = 11) {
  const wallLine = (x, z) => {
    b.fill(x, 1, z, x, 2, z, P.enclosing);
    b.set(x, 3, z, P.wallCap);                     // 瓦顶
  };
  for (let x = x0; x <= x1; x++) {
    if (Math.abs(x + 0.5) > gapHalf) wallLine(x, z1);   // 南面留山门豁口
    wallLine(x, z0);
  }
  for (let z = z0 + 1; z <= z1 - 1; z++) { wallLine(x0, z); wallLine(x1, z); }
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {  // 墙角柱
    b.fill(cx, 1, cz, cx, 3, cz, P.columnRed);
    b.set(cx, 4, cz, P.wallCap);
  }
}

/** 地面铺装：主路、横路、广场；草地上的点缀 */
function ground(b) {
  b.fill(-2, 0, -14, 2, 0, 56, P.path);            // 中轴主路（山门→主殿）
  b.fill(-39, 0, -8, 39, 0, -4, P.path);           // 东西横路（通配殿）
  b.fill(-14, 0, -14, 14, 0, -2, P.plaza);         // 主殿前广场
  b.fill(-10, 0, 48, 10, 0, 56, P.plaza);          // 山门外广场
  b.fill(19, 0, 11, 32, 0, 25, P.plaza);           // 钟楼前庭
  b.fill(-32, 0, 11, -19, 0, 25, P.plaza);         // 鼓楼前庭
  // 草地随机点缀（固定种子伪随机，保证每次一致）
  let s = 42;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * 118) - 59, z = Math.floor(rnd() * 110) - 55;
    if (Math.abs(x) < 4 && z > -16 && z < 58) continue;          // 避开主路
    if (Math.abs(z + 6) < 5 && Math.abs(x) < 41) continue;       // 避开横路
    b.set(x, 0, z, rnd() > 0.5 ? P.grassDark : P.grass);
  }
}

/** 整体布局：中轴对称院落，南(+z)为前 */
export function buildScene(b) {
  ground(b);
  courtyardWall(b, -52, -46, 52, 46, 11);

  gatehouse(b, 0, 46);                  // 山门（南端正门）
  mainHall(b, 0, -26);                  // 主殿：重檐庑殿顶，中轴核心

  // 东西配殿：歇山顶，面朝中轴
  hall(b, -30, -6, 10, 16, {            // 西配殿（面朝东）
    platH: 2, wallH: 3, roof: 'xieshan', face: 'E', stairW: 6,
    tile: P.tileGreen, edge: P.tileGreenEdge, ridge: P.ridgeGreen,
  });
  hall(b, 30, -6, 10, 16, {             // 东配殿（面朝西）
    platH: 2, wallH: 3, roof: 'xieshan', face: 'W', stairW: 6,
    tile: P.tileGreen, edge: P.tileGreenEdge, ridge: P.ridgeGreen,
  });

  tower(b, 26, 18, 'bell');             // 东钟楼
  tower(b, -26, 18, 'drum');            // 西鼓楼
  pagoda(b, -40, -32, 5);               // 后院宝塔（五层）

  // 石狮：山门外、主殿台阶前各一对
  lion(b, -6, 51, +1); lion(b, 6, 51, +1);
  lion(b, -7, -10, +1); lion(b, 7, -10, +1);

  // 沿主路灯笼杆（灯挑向路心）
  for (const z of [38, 28, 18, 8, -2]) {
    lanternPost(b, -4, z, +1);
    lanternPost(b, 4, z, -1);
  }

  // 园林
  pine(b, 40, 34); pine(b, -40, 34); pine(b, 18, 34, 5);
  cypress(b, -18, 34); cypress(b, 40, -36, 5); cypress(b, -20, -38, 5);
  pine(b, 20, -38, 5); pine(b, -46, -14, 3); cypress(b, 46, -14, 4);
}
