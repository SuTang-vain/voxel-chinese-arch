/** 体素云：成簇白色方块，随时间缓慢飘移 */
import * as THREE from 'three';
import { VoxelBuilder } from '../voxel/VoxelBuilder.js';
import { mulberry } from '../voxel/detail.js';

export function makeClouds(scene, count = 8) {
  const rnd = mulberry(20240918);
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const b = new VoxelBuilder(false);
    const w = 12 + Math.round(rnd() * 16), d = 8 + Math.round(rnd() * 10), h = 2 + Math.round(rnd() * 3);
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const tx = 1 - Math.abs((x / (w - 1)) * 2 - 1) * 0.85;
        const tz = 1 - Math.abs((z / (d - 1)) * 2 - 1) * 0.85;
        const hh = Math.max(1, Math.round(h * tx * tz));
        for (let y = 0; y < hh; y++) if (rnd() > 0.14) b.set(x, y, z, 'cloud');
      }
    }
    const { group } = b.toObject3D({ blockScale: 1, ao: false });
    group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
      // 云自下而上看仍是亮的（补一点自发光）
      if (o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0xcddbec);
        o.material.emissiveIntensity = 0.85;
      }
    });
    const ang = rnd() * Math.PI * 2, rad = 130 + rnd() * 330;
    group.position.set(Math.cos(ang) * rad, 92 + rnd() * 42, Math.sin(ang) * rad - 20);
    group.userData.speed = 0.7 + rnd() * 1.4;
    scene.add(group);
    clouds.push(group);
  }
  return clouds;
}
