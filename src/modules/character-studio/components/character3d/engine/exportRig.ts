import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter';

export interface RigExportSnapshot {
  root: THREE.Object3D;
  dispose: () => void;
}

/** Freeze the visible triangle subsets without changing the editable rig. */
export function createRigExportSnapshot(source: THREE.Object3D): RigExportSnapshot {
  const root = source.clone(true);
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const cloneMaterial = (material: THREE.Material): THREE.Material => {
    let copy = materials.get(material);
    if (!copy) {
      copy = material.clone();
      materials.set(material, copy);
    }
    return copy;
  };
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const original: THREE.BufferGeometry = object.geometry;
    let geometry = geometries.get(original);
    if (!geometry) {
      geometry = original.clone();
      geometries.set(original, geometry);
      const available = original.index?.count ?? original.getAttribute('position')?.count ?? 0;
      const start = Math.max(0, Math.min(available, Math.floor(original.drawRange.start)));
      const count = Math.max(0, Math.min(available - start, Math.floor(original.drawRange.count)));
      if (count === 0) {
        // Empty indices are treated by GLTFExporter as a non-indexed primitive.
        // No attributes instead means a transform-only node; children survive.
        for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
        geometry.morphAttributes = {};
        geometry.setIndex(null);
        geometry.clearGroups();
      } else if (start !== 0 || count !== available) {
        const indices = new Uint32Array(count);
        for (let offset = 0; offset < count; offset++) {
          indices[offset] = original.index ? original.index.getX(start + offset) : start + offset;
        }
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.clearGroups();
        for (const group of original.groups) {
          const first = Math.max(start, group.start);
          const last = Math.min(start + count, group.start + group.count);
          if (last > first) geometry.addGroup(first - start, last - first, group.materialIndex);
        }
      }
      geometry.setDrawRange(0, Infinity);
    }
    object.geometry = geometry;
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  let disposed = false;
  return {
    root,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}

export async function exportRigGlb(source: THREE.Object3D): Promise<Blob> {
  const snapshot = createRigExportSnapshot(source);
  try {
    const result = await new GLTFExporter().parseAsync(snapshot.root, {binary: true, onlyVisible: true});
    return new Blob([result as ArrayBuffer], {type: 'model/gltf-binary'});
  } finally {
    snapshot.dispose();
  }
}
