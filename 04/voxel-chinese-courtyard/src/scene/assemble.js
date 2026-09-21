/**
 * 场景装配（唯一入口）
 * ─────────────────────────────────────────────────────────
 * 浏览器主程序与 `npm run selftest` 都走这里，保证「自检的对象」
 * 与「渲染的对象」永远是同一份装配流程。
 */
import { VoxelBuilder } from '../voxel/VoxelBuilder.js';
import { buildSite } from './site.js';
import { buildComplex } from './buildings.js';
import { buildProps } from './props.js';

/** 三个阶段：与启动遮罩的进度提示一一对应 */
export const STAGES = [
  { key: 'site', label: '铺地砖、植草木…', run: buildSite },
  { key: 'buildings', label: '立柱、架梁、铺瓦…', run: buildComplex },
  { key: 'props', label: '陈设点景…', run: buildProps },
];

/**
 * 按 STAGES 顺序装配。
 * @param {VoxelBuilder} builder
 * @param {{onStage?: (i:number, stage:{key:string,label:string}) => void, yieldTo?: () => Promise<any>}} [opts]
 *        yieldTo 用于浏览器端在阶段之间让出一帧，更新启动遮罩
 */
export async function assembleWorld(builder = new VoxelBuilder(true), opts = {}) {
  const { onStage, yieldTo } = opts;
  for (let i = 0; i < STAGES.length; i++) {
    onStage?.(i, STAGES[i]);
    if (yieldTo) await yieldTo();
    STAGES[i].run(builder);
  }
  return builder;
}
