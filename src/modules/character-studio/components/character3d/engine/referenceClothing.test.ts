import * as THREE from 'three';
import {createReferencePolo} from './referenceClothing';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected fixture value');
  return value;
}

function shirt(): {geometry: THREE.BufferGeometry; neckline: number[]} {
  const segments = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  // Enough topology for an actual opening; no sphere/collar stand-in.
  for (let ring = 0; ring <= 24; ring++) {
    const y = 1.45 - ring * 0.017;
    const blend = Math.min(1, ring / 7);
    const rx = 0.06 + blend * 0.12;
    const rz = 0.047 + blend * 0.062;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      positions.push(rx * Math.sin(angle), y, rz * Math.cos(angle));
      if (ring) {
        const a = (ring - 1) * segments + segment;
        const b = (ring - 1) * segments + (segment + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  }
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    for (let ring = 0; ring < 11; ring++) {
      for (let segment = 0; segment < 16; segment++) {
        const angle = segment / 16 * Math.PI * 2;
        positions.push(side * (0.23 + ring * 0.02), 1.31 + Math.sin(angle) * 0.05, Math.cos(angle) * 0.05);
        if (ring) {
          const a = start + (ring - 1) * 16 + segment;
          const b = start + (ring - 1) * 16 + (segment + 1) % 16;
          indices.push(a, b, a + 16, b, b + 16, a + 16);
        }
      }
    }
    const cap = positions.length / 3;
    positions.push(side * 0.23, 1.31, 0);
    for (let segment = 0; segment < 16; segment++) indices.push(cap, start + segment, start + (segment + 1) % 16);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return {geometry, neckline: Array.from({length: segments}, (_, i) => i)};
}

function build() {
  const {geometry, neckline} = shirt();
  const material = new THREE.MeshStandardMaterial({color: '#20354e', side: THREE.DoubleSide});
  const polo = required(createReferencePolo(geometry, neckline, required(geometry.index).count, material));
  return {geometry, neckline, material, polo};
}

test('cuts a real front V, keeps the chest below it and preserves original triangle/vertex IDs', () => {
  const {geometry, material, polo} = build();
  const original = required(geometry.index);
  const originalValues = Array.from(original.array);
  const mesh = new THREE.Mesh(geometry, material);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.405, 1), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)[0].point.z).toBeGreaterThan(0);
  geometry.setIndex(polo.index);
  expect(ray.intersectObject(mesh)[0].point.z).toBeLessThan(0);
  ray.ray.origin.y = 1.28;
  expect(ray.intersectObject(mesh)[0].point.z).toBeGreaterThan(0);
  expect(polo.index.count).toBeLessThan(original.count);
  for (let triangle = 0; triangle < polo.sourceTriangleIndices.length; triangle++) {
    const source = polo.sourceTriangleIndices[triangle];
    for (let corner = 0; corner < 3; corner++) {
      expect(polo.index.getX(triangle * 3 + corner)).toBe(original.getX(source * 3 + corner));
    }
  }
  geometry.setIndex(original);
  expect(Array.from(original.array)).toEqual(originalValues);
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('creates folded collar, light edging, fitted placket, buttons and both sleeve cuffs', () => {
  const {geometry, material, polo} = build();
  const collar = required(polo.meshes.find((mesh) => mesh.name === 'polo_folded_collar'));
  const trim = required(polo.meshes.find((mesh) => mesh.name === 'polo_collar_trim'));
  expect(collar.material).toBe(material);
  expect((trim.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ece8df');
  expect(polo.meshes.filter((mesh) => mesh.name.startsWith('polo_button_'))).toHaveLength(3);
  expect(polo.meshes.filter((mesh) => mesh.name.startsWith('polo_cuff_'))).toHaveLength(2);
  expect(polo.meshes.filter((mesh) => mesh.name.startsWith('polo_placket_'))).toHaveLength(2);
  expect(polo.meshes.some((mesh) => mesh.name.startsWith('polo_opening_facing_'))).toBe(true);
  const collarPosition = collar.geometry.getAttribute('position');
  expect(collarPosition.getY(1)).toBeGreaterThan(collarPosition.getY(0));
  expect(collarPosition.getY(3)).toBeLessThan(collarPosition.getY(0));
  polo.meshes.forEach((mesh) => {
    expect(mesh.userData.zoneId).toBe('clothing_top');
    expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(mesh.geometry.boundingSphere?.radius ?? 1).toBeGreaterThan(0);
  });
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('the smooth opening facing covers triangle teeth and the front collar sits above the chest', () => {
  const {geometry, material, polo} = build();
  const collar = required(polo.meshes.find((mesh) => mesh.name === 'polo_folded_collar'));
  const originalShirt = new THREE.Mesh(geometry, material);
  const collarPosition = collar.geometry.getAttribute('position');
  const ray = new THREE.Raycaster();
  // Sample front leaves away from their edges. A buried radial collar used to
  // pass every finite-buffer test while being hidden by the rounded chest.
  for (const row of [1, 2, 62, 63]) {
    const point = new THREE.Vector3().fromBufferAttribute(collarPosition, row * 4 + 3);
    ray.set(new THREE.Vector3(point.x, point.y, 1), new THREE.Vector3(0, 0, -1));
    const sourceHit = ray.intersectObject(originalShirt)[0];
    if (sourceHit) expect(point.z).toBeGreaterThan(sourceHit.point.z);
  }
  geometry.setIndex(polo.index);
  const scene = new THREE.Group();
  scene.add(originalShirt, polo.group);
  scene.updateMatrixWorld(true);
  for (const y of [1.415, 1.425, 1.435]) {
    const idealHalfWidth = 0.12 * 0.34 * (y - (1.45 - 0.12 * 0.55)) / (0.12 * 0.55);
    for (const side of [-1, 1]) {
      ray.set(new THREE.Vector3(side * (idealHalfWidth + 0.002), y, 1), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(scene, true)[0];
      expect(hit?.point.z).toBeGreaterThan(0);
    }
  }
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('polo sleeves stop on the upper arm, with cuffs following the new cut', () => {
  const {geometry, material, polo} = build();
  const position = geometry.getAttribute('position');
  const sourceIndex = required(geometry.index);
  const reach = (index: THREE.BufferAttribute) => {
    let maximum = 0;
    for (let i = 0; i < index.count; i++) maximum = Math.max(maximum, Math.abs(position.getX(index.getX(i))));
    return maximum;
  };
  expect(reach(polo.index)).toBeLessThan(reach(sourceIndex) * 0.75);
  expect(reach(polo.index)).toBeGreaterThan(0.25);
  const cuffs = polo.meshes.filter((mesh) => mesh.name.startsWith('polo_cuff_'));
  expect(cuffs).toHaveLength(2);
  for (const cuff of cuffs) {
    const cuffPosition = cuff.geometry.getAttribute('position');
    for (let i = 0; i < cuffPosition.count; i += 2) {
      expect(Math.abs(cuffPosition.getX(i))).toBeCloseTo(reach(polo.index), 2);
    }
  }
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('hem facing overlaps a jagged waist boundary and closes the gap above the trousers', () => {
  const {geometry, neckline} = shirt();
  const position = geometry.getAttribute('position');
  // Reproduce alternating all-in triangle cut heights around the waist.
  for (let vertex = 24 * 64; vertex < 25 * 64; vertex++) {
    position.setY(vertex, position.getY(vertex) + (vertex % 3) * 0.006);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({side: THREE.DoubleSide});
  const polo = required(createReferencePolo(geometry, neckline, required(geometry.index).count, material));
  const hem = required(polo.meshes.find((mesh) => mesh.name === 'polo_hem_facing'));
  const seam = hem.geometry.getAttribute('position');
  const shading = hem.geometry.getAttribute('normal');
  const sourceNormal = geometry.getAttribute('normal');
  const bottom = seam.getY(1);
  expect(bottom).toBeLessThan(1.45 - 24 * 0.017);
  for (let vertex = 1; vertex < seam.count; vertex += 2) expect(seam.getY(vertex)).toBe(bottom);
  // Matching upper-edge normals avoids a bright zig-zag band even when the
  // geometry spans different source cut heights.
  for (let row = 0; row < 64; row++) {
    const normal = new THREE.Vector3().fromBufferAttribute(shading, row * 2);
    let closest = 0;
    for (let vertex = 24 * 64; vertex < 25 * 64; vertex++) {
      closest = Math.max(closest, normal.dot(new THREE.Vector3().fromBufferAttribute(sourceNormal, vertex)));
    }
    expect(closest).toBeGreaterThan(0.9999);
  }
  geometry.setIndex(polo.index);
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material), polo.group);
  scene.updateMatrixWorld(true);
  for (const angle of [-0.7, -0.3, 0, 0.3, 0.7]) {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(Math.sin(angle), bottom + 0.006, Math.cos(angle)),
      new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
    );
    expect(ray.intersectObject(scene, true)[0]?.object).toBe(hem);
  }
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('follows changed chest, neck scale and translation without reallocating detail buffers', () => {
  const {geometry, material, polo} = build();
  const collar = required(polo.meshes.find((mesh) => mesh.name === 'polo_folded_collar'));
  const before = required(collar.geometry.boundingBox).clone();
  const buttons = polo.meshes.filter((mesh) => mesh.name.startsWith('polo_button_'));
  const oldButtonPositions = buttons.map((mesh) => mesh.position.clone());
  const attributes = polo.meshes.map((mesh) => mesh.geometry.getAttribute('position'));
  const position = geometry.getAttribute('position');
  for (let vertex = 0; vertex < position.count; vertex++) {
    position.setXYZ(vertex, position.getX(vertex) * 1.2, position.getY(vertex) + 0.3, position.getZ(vertex) * 1.5);
  }
  geometry.computeVertexNormals();
  material.color.set('#d26040');
  polo.update();
  const after = required(collar.geometry.boundingBox);
  expect(after.max.x - after.min.x).toBeGreaterThan((before.max.x - before.min.x) * 1.1);
  expect(after.min.y).toBeGreaterThan(before.min.y + 0.28);
  buttons.forEach((mesh, i) => {
    expect(mesh.position.y).toBeCloseTo(oldButtonPositions[i].y + 0.3, 2);
    expect(mesh.position.z).toBeGreaterThan(oldButtonPositions[i].z * 1.3);
  });
  const buttonMaterial = buttons[0].material as THREE.MeshStandardMaterial;
  expect(buttonMaterial.color.r).toBeCloseTo(material.color.r * 0.67);
  polo.meshes.forEach((mesh, i) => {
    expect(mesh.geometry.getAttribute('position')).toBe(attributes[i]);
    expect(Array.from(attributes[i].array).every(Number.isFinite)).toBe(true);
  });
  polo.dispose(); geometry.dispose(); material.dispose();
});

test('repeated edits and reset produce the same detail surface and release only owned resources', () => {
  const {geometry, material, polo} = build();
  const original = Float32Array.from(geometry.getAttribute('position').array);
  const baseline = polo.meshes.map((mesh) => Array.from(mesh.geometry.getAttribute('position').array));
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (const scale of [0.75, 1.3, 0.9]) {
    for (let vertex = 0; vertex < position.count; vertex++) {
      position.setXYZ(vertex, original[vertex * 3] * scale, original[vertex * 3 + 1], original[vertex * 3 + 2] * scale);
    }
    geometry.computeVertexNormals(); polo.update();
  }
  position.copyArray(original); geometry.computeVertexNormals(); polo.update();
  polo.meshes.forEach((mesh, i) => expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(baseline[i]));
  const fabricDispose = jest.spyOn(material, 'dispose');
  const sourceDispose = jest.spyOn(geometry, 'dispose');
  const detailDispose = polo.meshes.map((mesh) => jest.spyOn(mesh.geometry, 'dispose'));
  polo.dispose(); polo.dispose(); polo.update();
  expect(fabricDispose).not.toHaveBeenCalled();
  expect(sourceDispose).not.toHaveBeenCalled();
  detailDispose.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  geometry.dispose(); material.dispose();
});

test('declines missing or degenerate neck topology without changing the source shirt', () => {
  const {geometry} = shirt();
  const material = new THREE.MeshStandardMaterial();
  const index = geometry.index;
  expect(createReferencePolo(geometry, [], required(index).count, material)).toBeNull();
  expect(createReferencePolo(geometry, [0, 0, 0, 0, 0, 0], required(index).count, material)).toBeNull();
  expect(geometry.index).toBe(index);
  geometry.dispose(); material.dispose();
});
