import * as THREE from 'three';

/** A surface-fitted accessory for the opt-in reference hairstyle. */
export function buildReferenceHeadband(hair: THREE.Mesh[], refined = false): THREE.Mesh {
  const center = new THREE.Vector3(0, 0.202, -0.015);
  const direction = new THREE.Vector3();
  const rows = 81;
  const columns = 7;
  const points: THREE.Vector3[] = [];
  const directions: THREE.Vector3[] = [];
  const envelopeRadii: number[] = [];
  const radialSamples: {angle: number; forward: number; radius: number}[][] =
    Array.from({length: rows}, () => []);
  const point = new THREE.Vector3();
  // Index the crown once; casting hundreds of rays through the dense source
  // would block the editor while loading a reconstructed head.
  hair.forEach((mesh) => {
    mesh.updateMatrixWorld(true);
    const position = mesh.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).sub(center);
      const angle = Math.atan2(point.x, point.y);
      const radial = Math.hypot(point.x, point.y);
      const forward = point.z / Math.max(radial, 1e-6);
      const row = Math.round((angle + 1.60) / 3.20 * (rows - 1));
      if (row < 0 || row >= rows || forward < 0.12 || forward > 1.2 || radial < 0.05) continue;
      radialSamples[row].push({angle, forward, radius: point.length()});
    }
  });
  for (let row = 0; row < rows; row++) {
    const angle = -1.60 + row / (rows - 1) * 3.20;
    for (let column = 0; column < columns; column++) {
      const across = column / (columns - 1) - 0.5;
      const forward = 0.38 + 0.48 * Math.max(0, Math.cos(angle)) + across * 0.14;
      direction.set(Math.sin(angle), Math.cos(angle), forward).normalize();
      const candidates = radialSamples.slice(Math.max(0, row - 2), row + 3).flat()
        .map((sample) => ({...sample,
          error: (sample.angle - angle) ** 2 + (sample.forward - forward) ** 2}))
        .sort((a, b) => a.error - b.error);
      const samples = candidates.slice(0, 6);
      let radius = samples.length ? samples.reduce((sum, sample) => sum + sample.radius, 0)
        / samples.length : 0.096;
      if (refined) {
        // V2 adds sparse locks outside a dense underlying crown. Averaging
        // nearest vertices biases the band toward that hidden inner layer.
        // A local angular envelope clears both layers without a dense raycast.
        const outerSamples = candidates.filter((sample) =>
          Math.abs(sample.angle - angle) <= 0.055 && Math.abs(sample.forward - forward) <= 0.038,
        );
        const outer = outerSamples.length ? outerSamples : samples;
        if (outer.length) radius = Math.max(...outer.map((sample) => sample.radius));
        directions.push(direction.clone());
        envelopeRadii.push(radius + 0.0012);
      }
      points.push(center.clone().addScaledVector(direction, radius + 0.0012));
    }
  }
  // A band bridges tiny strand grooves instead of copying their jagged edges.
  for (let pass = 0; pass < 2; pass++) {
    if (refined) {
      // Bridge grooves by lifting neighboring spans, never lower a vertex
      // back through the measured envelope. Preserve angular coordinates so
      // chord averaging cannot shrink the band's clearance over the crown.
      const previous = envelopeRadii.slice();
      for (let row = 1; row < rows - 1; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column;
          envelopeRadii[index] = Math.max(previous[index],
            previous[index] * 0.5 + previous[index - columns] * 0.25 + previous[index + columns] * 0.25);
        }
      }
      continue;
    }
    const previous = points.map((point) => point.clone());
    for (let row = 1; row < rows - 1; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        points[index].copy(previous[index]).multiplyScalar(0.5)
          .addScaledVector(previous[index - columns], 0.25)
          .addScaledVector(previous[index + columns], 0.25);
      }
    }
  }
  if (refined) points.forEach((point, index) => point.copy(center).addScaledVector(directions[index], envelopeRadii[index]));
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(
    points.flatMap((point) => point.toArray()), 3,
  ));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({color: '#365c82', roughness: 0.72, side: THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'reference_blue_headband';
  mesh.userData.zoneId = 'hair';
  return mesh;
}
