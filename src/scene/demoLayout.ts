import * as THREE from "three";

/**
 * Procedural stand-in for a scanned home so the viewer, collision and minimap
 * can be developed before the first capture is processed. It is clearly
 * labelled as a demo in the UI and is never submitted as a reconstruction.
 * Layout: a 10 m x 8 m flat with living room, kitchen, bedroom and hallway.
 */
export function buildDemoLayout(): THREE.Group {
  const group = new THREE.Group();
  group.name = "demo-layout";

  const mat = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
  const wallMat = mat(0xf2efe8);
  const H = 2.7;
  const T = 0.12;

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // Walls along X (constant z) and along Z (constant x), given as start/end.
  const wallX = (x1: number, x2: number, z: number) => box(x2 - x1, H, T, (x1 + x2) / 2, 0, z, wallMat);
  const wallZ = (z1: number, z2: number, x: number) => box(T, H, z2 - z1, x, 0, (z1 + z2) / 2, wallMat);

  // Floor and ceiling.
  box(10.4, 0.1, 8.4, 0, -0.1, 0, mat(0xc9b79c, 0.7));
  // Lit from above only, so give the ceiling its own glow instead of a dark underside.
  const ceiling = box(10.4, 0.05, 8.4, 0, H, 0, new THREE.MeshStandardMaterial({ color: 0xfafaf7, emissive: 0xd9d6cf, emissiveIntensity: 0.6 }));
  ceiling.castShadow = false;

  // Outer shell, front door gap at x 3.4..4.4 on the south wall.
  wallX(-5, 5, -4);
  wallX(-5, 3.4, 4);
  wallX(4.4, 5, 4);
  wallZ(-4, 4, -5);
  wallZ(-4, 4, 5);

  // Bedroom (north-west), door gap z -0.6..0.3 into the hallway.
  wallX(-5, -2.2, 0.6);
  wallX(-1.2, 1, 0.6);
  wallZ(-4, 0.6, 1);

  // Kitchen (north-east), open doorway x 2.2..3.4.
  wallX(1, 2.2, -0.2);
  wallX(3.4, 5, -0.2);

  // Living room furniture (south).
  const sofa = mat(0x4a6fa5);
  box(2.2, 0.45, 0.9, -2.6, 0, 3.3, sofa);
  box(2.2, 0.4, 0.22, -2.6, 0.45, 3.65, sofa);
  box(0.9, 0.45, 1.6, -4.3, 0, 2.4, sofa);
  box(1.1, 0.4, 0.6, -2.6, 0, 2.1, mat(0xb08a5e));
  box(1.8, 0.5, 0.4, -2.6, 0, 0.9, mat(0x3a3a38));
  box(1.3, 0.75, 0.15, -2.6, 0.5, 0.82, mat(0x111111, 0.3));
  box(1.4, 0.75, 0.9, 1.8, 0, 2.6, mat(0x8a6a4a));
  for (const [x, z] of [[1.3, 2], [2.3, 2], [1.3, 3.2], [2.3, 3.2]]) box(0.45, 0.45, 0.45, x, 0, z, mat(0x2f2f2d));

  // Kitchen counters and fridge.
  box(3.8, 0.9, 0.6, 3.1, 0, -3.65, mat(0xdedad2));
  box(0.6, 0.9, 2.2, 4.65, 0, -2.4, mat(0xdedad2));
  box(0.7, 1.9, 0.7, 1.45, 0, -3.6, mat(0xb9bec4, 0.4));

  // Bedroom bed and wardrobe.
  box(1.6, 0.5, 2.1, -3.6, 0, -2.6, mat(0xe7e1d6));
  box(1.6, 0.9, 0.12, -3.6, 0, -3.7, mat(0x6b4f38));
  box(0.6, 2.1, 1.8, 0.6, 0, -2.6, mat(0x7a5a3e));

  // Plants as cylinders so the minimap shows round shapes too.
  for (const [x, z] of [[4.4, 3.4], [-4.5, -0.1]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 16), mat(0xb7814f));
    pot.position.set(x, 0.2, z);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), mat(0x4f8a4a));
    leaves.position.set(x, 0.75, z);
    pot.castShadow = leaves.castShadow = true;
    group.add(pot, leaves);
  }

  return group;
}
