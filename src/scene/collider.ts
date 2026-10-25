import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH } from "three-mesh-bvh";

/**
 * Flattens every mesh under `root` into one world-space, position-only geometry
 * and builds a BVH over it. The result is what the player collides with and what
 * the minimap slices, regardless of whether it came from a scan or the demo.
 */
export function buildCollider(root: THREE.Object3D): THREE.Mesh {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
    g.applyMatrix4(mesh.matrixWorld);
    parts.push(g);
  });
  if (!parts.length) throw new Error("The collision mesh has no geometry.");

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  (merged as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(merged);

  const collider = new THREE.Mesh(
    merged,
    new THREE.MeshBasicMaterial({ color: 0x1d9e75, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  collider.name = "collider";
  return collider;
}

export interface FloorSlice {
  /** Wall segments in world XZ, as [x1, z1, x2, z2]. */
  walls: number[][];
  /** Furniture-height segments, drawn lighter. */
  low: number[][];
  bounds: THREE.Box3;
}

/** Cuts the collider with horizontal planes to get a floor plan for the minimap. */
export function sliceCollider(collider: THREE.Mesh, wallHeight = 1.2, furnitureHeight = 0.35): FloorSlice {
  const pos = collider.geometry.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const walls: number[][] = [];
  const low: number[][] = [];

  const cut = (h: number, out: number[][]) => {
    const pts: number[] = [];
    const edge = (p: THREE.Vector3, q: THREE.Vector3) => {
      if ((p.y - h) * (q.y - h) >= 0 || p.y === q.y) return;
      const t = (h - p.y) / (q.y - p.y);
      pts.push(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t);
    };
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      pts.length = 0;
      edge(a, b);
      edge(b, c);
      edge(c, a);
      if (pts.length === 4) out.push(pts.slice());
    }
  };
  cut(wallHeight, walls);
  cut(furnitureHeight, low);

  collider.geometry.computeBoundingBox();
  return { walls, low, bounds: collider.geometry.boundingBox!.clone() };
}
