import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import { floorPatches, type Vec3, type VenueConfig } from "../venue/types";
import type { Poi } from "../poi/types";
import { buildCollider, KEEP } from "../scene/collider";
import { buildNavWorldFromCollider, findRoute, navMeshGeometryData, snapToFloor } from "./navmesh";

/**
 * The venue's collision mesh exactly as the viewer builds it: the scan placed by venue.json,
 * plus the optional floor patch, minus the cleanup zones.
 */
async function venueCollider(id: string): Promise<{ venue: VenueConfig; collider: THREE.Mesh }> {
  const dir = `public/venues/${id}/`;
  const venue = JSON.parse(readFileSync(dir + "venue.json", "utf8")) as VenueConfig;
  const doc = await new NodeIO().read(dir + venue.collider.url);
  const source = new THREE.Group();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(prim.getAttribute("POSITION")!.getArray() as Float32Array, 3));
      const idx = prim.getIndices()?.getArray();
      if (idx) g.setIndex(new THREE.BufferAttribute(idx as Uint32Array, 1));
      const m = new THREE.Mesh(g);
      m.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
      source.add(m);
    }
  }
  const t = venue.collider;
  if (t.position) source.position.set(...t.position);
  source.rotation.set(...((t.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad) as Vec3));
  if (t.scale) source.scale.setScalar(t.scale);
  const physics = new THREE.Group().add(source);
  for (const patch of floorPatches(venue)) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(patch.size[0], 0.1, patch.size[1]));
    floor.position.set(...patch.position);
    floor.userData[KEEP] = true;
    physics.add(floor);
  }
  return { venue, collider: buildCollider(physics, venue.cleanup) };
}

function floorArea(positions: Float32Array, indices: Uint32Array) {
  let area = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    a.fromArray(positions, indices[i] * 3);
    b.fromArray(positions, indices[i + 1] * 3);
    c.fromArray(positions, indices[i + 2] * 3);
    if (Math.max(a.y, b.y, c.y) > 0.3) continue;
    area += new THREE.Triangle(a, b, c).getArea();
  }
  return area;
}

for (const id of ["hostel", "classroom"]) {
  describe.runIf(existsSync(`public/venues/${id}/venue.json`))(`navmesh on the ${id} scan`, () => {
    it("builds a walkable floor, and every tagged place can be reached from the entrance", async () => {
      const { venue, collider } = await venueCollider(id);
      const world = await buildNavWorldFromCollider(collider);
      const { positions, indices } = navMeshGeometryData(world);
      const area = floorArea(positions, indices);
      const tris = collider.geometry.attributes.position.count / 3;
      console.log(`${id}: ${tris.toLocaleString()} triangles -> ${area.toFixed(1)} m² walkable floor in ${world.buildMs.toFixed(0)} ms`);
      expect(area).toBeGreaterThan(1.5); // the hostel room is mostly beds and desks

      const [x, , z] = venue.spawn.position;
      const spawn = { x, y: 0, z };
      expect(snapToFloor(world, spawn)).not.toBeNull();

      const poisPath = `public/venues/${id}/pois.json`;
      if (!existsSync(poisPath)) return;
      const pois = (JSON.parse(readFileSync(poisPath, "utf8")) as { pois: Poi[] }).pois;
      const unreachable = pois.filter((p) => !findRoute(world, spawn, { x: p.position[0], y: 0, z: p.position[2] })?.complete).map((p) => p.id);
      expect(unreachable).toEqual([]);
    }, 60_000);
  });
}
