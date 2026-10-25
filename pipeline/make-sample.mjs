#!/usr/bin/env node
// Writes test/venues/sample/collider.gltf: a small L-shaped room with a table,
// used to test the mesh-loading path end to end without a real capture.
// Usage: node pipeline/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const boxes = [
  // [width, height, depth, centre x, base y, centre z]
  [8, 0.1, 6, 0, -0.1, 0], // floor
  [8, 2.6, 0.12, 0, 0, -3], // north wall
  [0.12, 2.6, 6, -4, 0, 0], // west wall
  [0.12, 2.6, 6, 4, 0, 0], // east wall
  [3, 2.6, 0.12, -2.5, 0, 3], // south wall, left of the door
  [4, 2.6, 0.12, 2, 0, 3], // south wall, right of the door
  [0.12, 2.6, 3, 1, 0, -1.5], // partition making the L
  [1.6, 0.75, 0.9, -2, 0, -1], // table
];

const positions = [];
for (const [w, h, d, cx, by, cz] of boxes) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = by, y1 = by + h, z0 = cz - d / 2, z1 = cz + d / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  for (const f of faces) for (const i of f) positions.push(...v[i]);
}

const data = new Float32Array(positions);
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < data.length; i += 3)
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], data[i + k]);
    max[k] = Math.max(max[k], data[i + k]);
  }

const gltf = {
  asset: { version: "2.0", generator: "namma-space make-sample" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "sample-room" }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  buffers: [{ byteLength: data.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(data.buffer).toString("base64")}` }],
  bufferViews: [{ buffer: 0, byteLength: data.byteLength, target: 34962 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: data.length / 3, type: "VEC3", min, max }],
};

mkdirSync("test/venues/sample", { recursive: true });
writeFileSync("test/venues/sample/collider.gltf", JSON.stringify(gltf));
console.log(`Wrote test/venues/sample/collider.gltf (${data.length / 9} triangles)`);
