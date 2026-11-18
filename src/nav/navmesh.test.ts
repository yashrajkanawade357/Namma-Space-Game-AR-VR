import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { buildCollider } from "../scene/collider";
import { buildDemoLayout } from "../scene/demoLayout";
import { AGENT, buildNavWorldFromCollider, findRoute, snapToFloor, type NavWorld, type Point } from "./navmesh";

// The demo flat: living room (south), hallway, bedroom (north-west, door gap x -2.2..-1.2 at z 0.6),
// kitchen (north-east, doorway x 2.2..3.4 at z -0.2). Front door gap at x 3.4..4.4 on the south wall.
let world: NavWorld;
let collider: THREE.Mesh;

beforeAll(async () => {
  collider = buildCollider(buildDemoLayout());
  world = await buildNavWorldFromCollider(collider);
});

/** True when a straight walk from a to b at hip height would hit the collision mesh. */
function blocked(a: Point, b: Point, height = 0.6): boolean {
  const bvh = (collider.geometry as THREE.BufferGeometry & { boundsTree: MeshBVH }).boundsTree;
  const from = new THREE.Vector3(a.x, height, a.z);
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  const len = dir.length();
  if (len < 1e-4) return false;
  const ray = new THREE.Ray(from, dir.normalize());
  const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
  return !!hit && hit.distance < len;
}

const LIVING = { x: 3.9, y: 0, z: 3.2 };
const BEDROOM = { x: -3.6, y: 0, z: -1.0 };
const KITCHEN = { x: 3.0, y: 0, z: -2.6 };

describe("navmesh on the demo flat", () => {
  it("builds quickly", () => {
    expect(world.buildMs).toBeLessThan(5000);
  });

  it("routes from the living room into the bedroom through its door", () => {
    const route = findRoute(world, LIVING, BEDROOM)!;
    expect(route).not.toBeNull();
    expect(route.complete).toBe(true);
    // The wall between them forces a detour longer than the straight line.
    expect(route.length).toBeGreaterThan(Math.hypot(LIVING.x - BEDROOM.x, LIVING.z - BEDROOM.z) + 0.3);
    // It must cross the bedroom's south wall (z = 0.6) inside the door gap.
    const crossing = route.points.findIndex((p, i) => i > 0 && (route.points[i - 1].z - 0.6) * (p.z - 0.6) <= 0);
    expect(crossing).toBeGreaterThan(0);
    const a = route.points[crossing - 1];
    const b = route.points[crossing];
    const x = a.x + ((0.6 - a.z) / (b.z - a.z || 1e-9)) * (b.x - a.x);
    expect(x).toBeGreaterThan(-2.2);
    expect(x).toBeLessThan(-1.2);
  });

  it("never walks through walls or furniture", () => {
    for (const goal of [BEDROOM, KITCHEN, { x: -2.6, y: 0, z: 2.6 }]) {
      const route = findRoute(world, LIVING, goal)!;
      expect(route).not.toBeNull();
      for (let i = 1; i < route.points.length; i++) expect(blocked(route.points[i - 1], route.points[i])).toBe(false);
    }
  });

  it("keeps the agent's clearance from walls", () => {
    const route = findRoute(world, LIVING, KITCHEN)!;
    const bvh = (collider.geometry as THREE.BufferGeometry & { boundsTree: MeshBVH }).boundsTree;
    const target = { point: new THREE.Vector3(), distance: Infinity, faceIndex: 0 };
    for (const p of route.points) {
      bvh.closestPointToPoint(new THREE.Vector3(p.x, 0.6, p.z), target as never);
      expect(target.distance).toBeGreaterThan(AGENT.radius * 0.8);
    }
  });

  it("snaps a POI on a bed to the floor beside it, not onto the mattress", () => {
    const bed = { x: -3.6, y: 0.5, z: -2.6 };
    const p = snapToFloor(world, bed)!;
    expect(p).not.toBeNull();
    expect(p.y).toBeLessThan(0.15);
  });

  it("reports a partial route when the goal is outside the flat", () => {
    const route = findRoute(world, LIVING, { x: 12, y: 0, z: 0 });
    expect(route === null || route.complete === false).toBe(true);
  });
});
