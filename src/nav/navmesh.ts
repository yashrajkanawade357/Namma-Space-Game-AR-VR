import { init, NavMeshQuery, getNavMeshPositionsAndIndices, type NavMesh } from "recast-navigation";
import { generateSoloNavMesh } from "recast-navigation/generators";
import type * as THREE from "three";

export type Point = { x: number; y: number; z: number };

/**
 * Walkable-area settings in metres. Every venue uses the same human-sized agent, so a path
 * that exists on the navmesh is one a visitor can actually walk: wide enough for shoulders,
 * tall enough to stand, and never up onto a bed or a table.
 */
export const AGENT = {
  /**
   * Half a shoulder width (about 45 cm across). The walker's collision capsule uses the same
   * value, so any route the navmesh finds is one the visitor can physically walk, including
   * the tight gaps between classroom benches that people pass by turning sideways.
   */
  radius: 0.22,
  /** Headroom needed above the floor. */
  height: 1.5,
  /** Steps and scan noise up to this height are walkable; beds and tables (40 cm+) are not. */
  climb: 0.2,
  /** Ramps steeper than this are treated as walls. */
  maxSlope: 40,
};

/** Venues put the floor at y = 0; anything walkable within this height of it counts as floor (scan noise, rugs). */
const FLOOR_BAND = 0.25;

/** Grid resolution: 6 cm cells across the floor and 5 cm vertically. */
const CELL = 0.06;
const CELL_HEIGHT = 0.05;

export interface NavWorld {
  navMesh: NavMesh;
  query: NavMeshQuery;
  /** Time spent building, for the loading screen and the Q&A. */
  buildMs: number;
}

let ready: Promise<void> | null = null;
/** Loads the Recast/Detour WebAssembly module once. */
export const initNav = () => (ready ??= init());

/**
 * Builds a navmesh from triangle positions in world space (y up, metres, floor at y = 0).
 * `positions` is a flat x, y, z array; `indices` may be omitted for a plain triangle list.
 */
export async function buildNavWorld(positions: ArrayLike<number>, indices?: ArrayLike<number>, radius = AGENT.radius): Promise<NavWorld> {
  await initNav();
  const start = performance.now();
  const idx = faceUp(positions, indices ?? Uint32Array.from({ length: positions.length / 3 }, (_, i) => i));
  const result = generateSoloNavMesh(positions, idx, {
    cs: CELL,
    ch: CELL_HEIGHT,
    walkableRadius: Math.ceil(radius / CELL),
    walkableHeight: Math.ceil(AGENT.height / CELL_HEIGHT),
    walkableClimb: Math.floor(AGENT.climb / CELL_HEIGHT),
    walkableSlopeAngle: AGENT.maxSlope,
    // Region sizes are cells per side (the library squares them): islands under about 0.5 m²
    // (cupboard tops, scan specks) are dropped and regions under 2 m² are merged.
    minRegionArea: Math.round(Math.sqrt(0.5) / CELL),
    mergeRegionArea: Math.round(Math.sqrt(2) / CELL),
    maxEdgeLen: Math.round(1.2 / CELL),
    maxSimplificationError: 1.1,
    maxVertsPerPoly: 6,
    detailSampleDist: 6,
    detailSampleMaxError: 1,
  });
  if (!result.success) throw new Error(`Couldn't build the walkable area: ${result.error}`);
  const query = new NavMeshQuery(result.navMesh);
  return { navMesh: result.navMesh, query, buildMs: performance.now() - start };
}

/**
 * Recast only walks on triangles that face up. Photogrammetry meshes wind triangles both ways
 * (the viewer draws both sides, so it doesn't show), and a simplified floor made of a few large
 * flipped triangles would otherwise vanish from the walkable area. Flip any triangle that faces
 * down so it faces up; walls stay walls because they are vertical either way.
 */
export function faceUp(positions: ArrayLike<number>, indices: ArrayLike<number>): Uint32Array {
  const out = Uint32Array.from(indices);
  const p = positions;
  for (let t = 0; t < out.length; t += 3) {
    const a = out[t] * 3;
    const b = out[t + 1] * 3;
    const c = out[t + 2] * 3;
    // y component of (b - a) × (c - a)
    const ny = (p[c] - p[a]) * (p[b + 2] - p[a + 2]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    if (ny < 0) {
      out[t + 1] = indices[t + 2];
      out[t + 2] = indices[t + 1];
    }
  }
  return out;
}

/** Builds the navmesh from the viewer's collision mesh (a non-indexed, world-space triangle soup). */
export function buildNavWorldFromCollider(collider: THREE.Mesh): Promise<NavWorld> {
  const pos = collider.geometry.attributes.position.array;
  return buildNavWorld(pos);
}

/**
 * Snaps a point to the walkable floor near it. Searching only a thin band around floor height
 * keeps a POI on a bed or a desk from snapping onto the furniture top.
 */
export function snapToFloor(world: NavWorld, p: Point, reach = 2.5): Point | null {
  const r = world.query.findClosestPoint({ x: p.x, y: 0, z: p.z }, { halfExtents: { x: reach, y: FLOOR_BAND, z: reach } });
  return r.success && r.polyRef ? { ...r.point } : null;
}

export interface Route {
  /** Corner points from start to goal, on the floor. */
  points: Point[];
  /** Walking distance in metres along the corners. */
  length: number;
  /** True when the goal itself was reachable; false when the route stops at the closest reachable spot. */
  complete: boolean;
}

/** Shortest walkable route between two points, both snapped to the floor first. */
export function findRoute(world: NavWorld, from: Point, to: Point): Route | null {
  const a = snapToFloor(world, from);
  const b = snapToFloor(world, to);
  if (!a || !b) return null;
  const r = world.query.computePath(a, b, { maxPathPolys: 1024, maxStraightPathPoints: 256 });
  if (!r.success || r.path.length < 1) return null;
  const points = r.path.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const last = points[points.length - 1];
  const complete = Math.hypot(last.x - b.x, last.z - b.z) < 0.25;
  return { points, length: polylineLength(points), complete };
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return len;
}

/** Triangles of the walkable area, for drawing it as an overlay. */
export function navMeshGeometryData(world: NavWorld) {
  const [positions, indices] = getNavMeshPositionsAndIndices(world.navMesh);
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
