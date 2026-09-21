/**
 * 陈设与点景：石狮、石灯、灯笼、幡杆、香炉。
 * 成对的物件先建在东侧画板，再镜像盖印，保证中轴对称。
 */
import { VoxelBuilder } from '../voxel/VoxelBuilder.js';
import { stoneLion, stoneLamp, lantern, lanternPole, incenseBurner, banner } from '../voxel/detail.js';
import { LAYOUT as L } from './layout.js';

export function buildProps(b) {
  // ── 山门前石狮一对 ──
  const lions = new VoxelBuilder(false);
  stoneLion(lions, { x: 11, z: 58 });
  b.stamp(lions);
  b.stamp(lions, { mirrorX: true });

  // ── 月台石灯一对 ──
  const lamps = new VoxelBuilder(false);
  stoneLamp(lamps, { x: 12, z: -20, y: 5 });
  b.stamp(lamps);
  b.stamp(lamps, { mirrorX: true });

  // ── 前广场灯笼杆 ──
  const poles = new VoxelBuilder(false);
  for (const z of [58, 66, 74]) lanternPole(poles, { x: 8, z, h: 6 });
  b.stamp(poles);
  b.stamp(poles, { mirrorX: true });

  // ── 幡杆一对 ──
  const flags = new VoxelBuilder(false);
  banner(flags, { x: 18, z: 70, h: 20 });
  b.stamp(flags);
  b.stamp(flags, { mirrorX: true });

  // ── 塔院石灯一对（南踏道两侧，骑中轴对称） ──
  const pagodaLamps = new VoxelBuilder(false);
  stoneLamp(pagodaLamps, { x: 7, z: -68, y: 1 });
  b.stamp(pagodaLamps);
  b.stamp(pagodaLamps, { mirrorX: true });

  // ── 塔院外两侧松林中的石灯（各两座，骑 z=-84 中线对称） ──
  const groveLamps = new VoxelBuilder(false);
  stoneLamp(groveLamps, { x: 26, z: -88, y: 1 });
  stoneLamp(groveLamps, { x: 26, z: -80, y: 1 });
  b.stamp(groveLamps);
  b.stamp(groveLamps, { mirrorX: true });

  // ── 香炉（骑中轴） ──
  incenseBurner(b, { x0: -3, x1: 2, z0: -4, z1: 0, y: 1 });

  // ── 山门、主殿悬挂灯笼 ──
  const hang = new VoxelBuilder(false);
  for (const x of [6, 10]) {
    lantern(hang, { x, y: 12, z: L.gate.z1 + 2 });
  }
  lantern(hang, { x: 8, y: 17, z: L.main.z1 + 3 });
  lantern(hang, { x: 16, y: 17, z: L.main.z1 + 3 });
  b.stamp(hang);
  b.stamp(hang, { mirrorX: true });
}
