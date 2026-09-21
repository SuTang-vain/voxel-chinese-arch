/**
 * 构建期检查脚本（不依赖浏览器）：
 *   node tools/inspect-world.mjs
 * 输出体素数量、暴露面数、三角形数与耗时，并做基本断言。
 */
import { VoxelWorld, buildGeometry } from '../src/voxel.js';
import { buildTemple } from '../src/temple.js';

const t0 = performance.now();
const w = new VoxelWorld();
buildTemple(w);
const t1 = performance.now();
const s = w.stats();
const g = buildGeometry(w);
const t2 = performance.now();

const tris = (g.solid.index.count + g.glow.index.count) / 3;
console.log('体素        :', s.voxels.toLocaleString());
console.log('自发光体素  :', s.glow.toLocaleString());
console.log('暴露面      :', g.faces.toLocaleString());
console.log('三角形      :', tris.toLocaleString());
console.log('建造 / 烘焙 :', `${(t1 - t0).toFixed(0)}ms / ${(t2 - t1).toFixed(0)}ms`);

const fail = [];
if (s.voxels < 20000) fail.push('体素过少，建筑群可能未生成');
if (g.faces < 5000) fail.push('暴露面过少，几何烘焙可能异常');
if (!Number.isFinite(tris) || tris > 400000) fail.push('三角形数异常');
if (fail.length) {
  console.error('检查未通过：', fail.join('；'));
  process.exit(1);
}
console.log('检查通过 ✓');
