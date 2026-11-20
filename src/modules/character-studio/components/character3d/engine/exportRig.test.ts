import {TextEncoder} from 'util';
import * as THREE from 'three';
import {createRigExportSnapshot, exportRigGlb} from './exportRig';

const encoderDescriptor = Object.getOwnPropertyDescriptor(global, 'TextEncoder');
beforeAll(() => { Object.defineProperty(global, 'TextEncoder', {value: TextEncoder, configurable: true, writable: true}); });
afterAll(() => {
  if (encoderDescriptor) Object.defineProperty(global, 'TextEncoder', encoderDescriptor);
  else Reflect.deleteProperty(global, 'TextEncoder');
});

function garment(indexed = true) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 1, 0, 1, 1, 0, 0, 2, 0,
    0, 2, 0, 1, 2, 0, 0, 3, 0,
  ], 3));
  geometry.computeVertexNormals();
  if (indexed) geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const morph = new Float32Array(27).fill(.02);
  geometry.morphAttributes.position = [new THREE.BufferAttribute(morph, 3)];
  geometry.morphTargetsRelative = true;
  geometry.setDrawRange(3, 3);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: '#345678'}));
  mesh.name = 'shorts';
  mesh.morphTargetDictionary = {volume: 0};
  mesh.morphTargetInfluences = [.75];
  return mesh;
}

interface GltfDocument {
  accessors: Array<{count: number}>;
  nodes: Array<{name?: string; mesh?: number}>;
  meshes: Array<{weights?: number[]; primitives: Array<{indices: number; targets?: Array<{POSITION: number}>}>}>;
}

async function glbJson(blob: Blob): Promise<GltfDocument> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  expect(new DataView(buffer).getUint32(0, true)).toBe(0x46546c67);
  const length = new DataView(buffer).getUint32(12, true);
  return JSON.parse(Buffer.from(buffer, 20, length).toString('utf8'));
}

test.each([true, false])('real GLB exports only the drawn garment triangle and retains morphs (indexed=%s)', async (indexed) => {
  const source = garment(indexed);
  const indexBefore = source.geometry.index;
  const positionsBefore = source.geometry.getAttribute('position').array.slice();
  const json = await glbJson(await exportRigGlb(source));
  const primitive = json.meshes[0].primitives[0];
  expect(json.accessors[primitive.indices].count).toBe(3);
  expect(primitive.targets).toHaveLength(1);
  expect(json.meshes[0].weights).toEqual([.75]);
  expect(source.geometry.index).toBe(indexBefore);
  expect(source.geometry.drawRange).toEqual({start: 3, count: 3});
  expect(source.geometry.getAttribute('position').array).toEqual(positionsBefore);
});

test('intersects and rebases material groups and snapshots geometry/materials independently', () => {
  const source = garment();
  source.geometry.setDrawRange(3, 6);
  source.geometry.addGroup(0, 6, 0);
  source.geometry.addGroup(6, 3, 1);
  const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  const multi = new THREE.Mesh(source.geometry, materials);
  const disposedOriginal = jest.spyOn(source.geometry, 'dispose');
  const disposedMaterial = jest.spyOn(materials[0], 'dispose');
  const snapshot = createRigExportSnapshot(multi);
  const copy = snapshot.root as THREE.Mesh;
  expect(Array.from(copy.geometry.index?.array ?? [])).toEqual([3, 4, 5, 6, 7, 8]);
  expect(copy.geometry.groups).toEqual([{start: 0, count: 3, materialIndex: 0}, {start: 3, count: 3, materialIndex: 1}]);
  expect(copy.geometry).not.toBe(source.geometry);
  expect((copy.material as THREE.Material[])[0]).not.toBe(materials[0]);
  const disposeCopy = jest.spyOn(copy.geometry, 'dispose');
  snapshot.dispose();
  snapshot.dispose();
  expect(disposeCopy).toHaveBeenCalledTimes(1);
  expect(disposedOriginal).not.toHaveBeenCalled();
  expect(disposedMaterial).not.toHaveBeenCalled();
});

test('empty draw ranges do not resurrect triangles and visible children still export', async () => {
  const root = garment();
  root.name = 'empty';
  root.geometry.setDrawRange(0, 0);
  root.add(garment());
  const hidden = garment();
  hidden.name = 'hidden';
  hidden.visible = false;
  root.add(hidden);
  const json = await glbJson(await exportRigGlb(root));
  expect(json.nodes.find((node) => node.name === 'empty')?.mesh).toBeUndefined();
  expect(json.nodes.find((node) => node.name === 'shorts')?.mesh).toBeDefined();
  expect(json.nodes.find((node) => node.name === 'hidden')).toBeUndefined();
  expect(json.meshes).toHaveLength(1);
});
