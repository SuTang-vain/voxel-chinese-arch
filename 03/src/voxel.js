import * as THREE from 'three';

/**
 * VoxelWorld：体素收集器 + 按颜色合并的 InstancedMesh 渲染。
 * - set/fill/ring 只记录数据，build() 时按「颜色+自发光」分组，
 *   每组一个 InstancedMesh，整个场景仅几十个 draw call。
 * - 同一坐标后写覆盖先写（便于墙面开出门窗）。
 */
export class VoxelWorld {
  constructor() {
    this.cells = new Map(); // "x,y,z" -> { c, e }
  }
  set(x, y, z, color, opts = {}) {
    this.cells.set(`${x},${y},${z}`, { c: color, e: !!opts.emissive });
  }
  fill(x0, y0, z0, x1, y1, z1, color, opts = {}) {
    const [xa, xb] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ya, yb] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [za, zb] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = xa; x <= xb; x++)
      for (let y = ya; y <= yb; y++)
        for (let z = za; z <= zb; z++) this.set(x, y, z, color, opts);
  }
  /** 在 y 高度绘制矩形周圈（中空），x0/x1/z0/z1 为含端点范围 */
  ring(x0, z0, x1, z1, y, color, opts = {}) {
    for (let x = x0; x <= x1; x++) {
      this.set(x, y, z0, color, opts);
      this.set(x, y, z1, color, opts);
    }
    for (let z = z0 + 1; z <= z1 - 1; z++) {
      this.set(x0, y, z, color, opts);
      this.set(x1, y, z, color, opts);
    }
  }
  build(scene) {
    const groups = new Map(); // key -> { color, emissive, list: [x,y,z][] }
    for (const [k, v] of this.cells) {
      const key = v.c + (v.e ? ':e' : '');
      let g = groups.get(key);
      if (!g) { g = { color: v.c, emissive: v.e, list: [] }; groups.set(key, g); }
      const [x, y, z] = k.split(',').map(Number);
      g.list.push(x, y, z);
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4();
    const meshes = [];
    for (const g of groups.values()) {
      const count = g.list.length / 3;
      const mat = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.92, metalness: 0.02 });
      if (g.emissive) {
        mat.emissive = new THREE.Color(g.color);
        mat.emissiveIntensity = 1.1;
      }
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      for (let i = 0; i < count; i++) {
        m.makeTranslation(g.list[i * 3], g.list[i * 3 + 1], g.list[i * 3 + 2]);
        mesh.setMatrixAt(i, m);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
  get count() { return this.cells.size; }
}
