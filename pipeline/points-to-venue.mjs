#!/usr/bin/env node
// Turns a coloured point cloud (Scaniverse .ply export: x y z + red green blue) into a venue:
//   points.ply    the cloud turned upright (+Y up), centred, floor at y = 0, outliers dropped
//   collider.glb  walkable geometry generated from the cloud: a floor slab plus one column
//                 per 10 cm grid cell where points sit at body height (walls, beds, tables)
//   venue.json    written only if missing, with a spawn point in the most open spot
//
// Usage: node pipeline/points-to-venue.mjs <scan.ply> <venue folder> [--name "Hostel room"] [--z-up]
// --z-up: the cloud's up axis is Z (Scaniverse point-cloud exports); otherwise Y is up.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const [input, outDir] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] === "--name"));
if (!input || !outDir) {
  console.error('Usage: node pipeline/points-to-venue.mjs <scan.ply> <venue folder> [--name "Hostel room"] [--z-up]');
  process.exit(1);
}
const zUp = args.includes("--z-up");

const CELL = 0.1; // grid cell size, metres
const BAND = [0.25, 1.5]; // heights that block walking: above floor clutter, below a raised arm
const MIN_POINTS = 3; // points in the band before a cell counts as solid

// --- Read the PLY -----------------------------------------------------------------------
const buf = readFileSync(input);
const headerEnd = buf.indexOf("end_header\n") + "end_header\n".length;
const header = buf.toString("ascii", 0, headerEnd);
if (!header.includes("binary_little_endian")) throw new Error("Only binary little-endian PLY files are supported.");
const count = Number(header.match(/element vertex (\d+)/)[1]);
const sizes = { float: 4, uchar: 1, double: 8 };
let stride = 0;
const offset = {};
for (const [, type, name] of header.matchAll(/property (\w+) (\w+)/g)) {
  offset[name] = stride;
  stride += sizes[type];
}
if (offset.red === undefined) throw new Error("This PLY has no colours (red/green/blue); is it a Gaussian splat? Use compress-splat.sh instead.");

const pos = new Float32Array(count * 3);
const col = new Uint8Array(count * 3);
for (let i = 0; i < count; i++) {
  const b = headerEnd + i * stride;
  const x = buf.readFloatLE(b + offset.x);
  const y = buf.readFloatLE(b + offset.y);
  const z = buf.readFloatLE(b + offset.z);
  // Z-up → Y-up is a −90° turn about X: (x, y, z) → (x, z, −y).
  pos.set(zUp ? [x, z, -y] : [x, y, z], i * 3);
  col.set([buf[b + offset.red], buf[b + offset.green], buf[b + offset.blue]], i * 3);
}

// --- Level and centre ------------------------------------------------------------------
const pct = (axis, p) => {
  const v = new Float32Array(count);
  for (let i = 0; i < count; i++) v[i] = pos[i * 3 + axis];
  v.sort();
  return v[Math.floor(p * (count - 1))];
};
const lo = [pct(0, 0.01), pct(1, 0.02), pct(2, 0.01)];
const hi = [pct(0, 0.99), pct(1, 0.99), pct(2, 0.99)];
const shift = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
const margin = 0.3;
const keep = [];
for (let i = 0; i < count; i++) {
  const p = [0, 1, 2].map((k) => pos[i * 3 + k]);
  if (p.every((v, k) => v >= lo[k] - margin && v <= hi[k] + margin)) keep.push(i);
}
const n = keep.length;
const P = new Float32Array(n * 3);
const C = new Uint8Array(n * 3);
keep.forEach((src, j) => {
  for (let k = 0; k < 3; k++) {
    P[j * 3 + k] = pos[src * 3 + k] + shift[k];
    C[j * 3 + k] = col[src * 3 + k];
  }
});
const width = hi[0] - lo[0];
const depth = hi[2] - lo[2];
const height = hi[1] - lo[1];
console.log(`Points  ${count.toLocaleString()} read, ${n.toLocaleString()} kept · room ${width.toFixed(1)} × ${depth.toFixed(1)} m, ${height.toFixed(2)} m tall`);

// --- Occupancy grid → collision columns ---------------------------------------------------
const half = [width / 2 + margin, depth / 2 + margin];
const gx = Math.ceil((half[0] * 2) / CELL);
const gz = Math.ceil((half[1] * 2) / CELL);
const hits = new Uint16Array(gx * gz);
const top = new Float32Array(gx * gz);
for (let j = 0; j < n; j++) {
  const y = P[j * 3 + 1];
  if (y < BAND[0] || y > height - 0.15) continue;
  const cx = Math.floor((P[j * 3] + half[0]) / CELL);
  const cz = Math.floor((P[j * 3 + 2] + half[1]) / CELL);
  if (cx < 0 || cz < 0 || cx >= gx || cz >= gz) continue;
  const c = cz * gx + cx;
  if (y <= BAND[1]) hits[c]++;
  top[c] = Math.max(top[c], y);
}
const solid = new Uint8Array(gx * gz);
for (let c = 0; c < solid.length; c++) solid[c] = hits[c] >= MIN_POINTS ? 1 : 0;
// Drop lone specks: a solid cell needs at least one solid neighbour.
const cleaned = solid.slice();
for (let z = 0; z < gz; z++)
  for (let x = 0; x < gx; x++) {
    const c = z * gx + x;
    if (!solid[c]) continue;
    let near = 0;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dz) && x + dx >= 0 && x + dx < gx && z + dz >= 0 && z + dz < gz && solid[(z + dz) * gx + (x + dx)]) near++;
    if (!near) cleaned[c] = 0;
  }

const tris = [];
const box = (x0, x1, y0, y1, z0, z1) => {
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  for (const f of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]])
    for (const i of f) tris.push(...v[i]);
};
box(-half[0], half[0], -0.1, 0, -half[1], half[1]); // floor slab
// Merge runs of solid cells along X with similar heights into one column each.
const step = 0.25;
let columns = 0;
for (let z = 0; z < gz; z++) {
  let x = 0;
  while (x < gx) {
    const c = z * gx + x;
    if (!cleaned[c]) {
      x++;
      continue;
    }
    const h = Math.max(0.5, Math.ceil(top[c] / step) * step);
    let end = x + 1;
    while (end < gx && cleaned[z * gx + end] && Math.max(0.5, Math.ceil(top[z * gx + end] / step) * step) === h) end++;
    box(x * CELL - half[0], end * CELL - half[0], 0, Math.min(h, height), z * CELL - half[1], (z + 1) * CELL - half[1]);
    columns++;
    x = end;
  }
}

// --- Spawn: an open spot towards the edge of the room, facing across it for the longest view ---
const clearance = (x, z) => {
  let clear = 99;
  for (let dz = -8; dz <= 8; dz++)
    for (let dx = -8; dx <= 8; dx++) {
      const xx = x + dx;
      const zz = z + dz;
      if (xx >= 0 && zz >= 0 && xx < gx && zz < gz && cleaned[zz * gx + xx]) clear = Math.min(clear, Math.hypot(dx, dz));
    }
  return clear * CELL;
};
let best = { score: -Infinity, x: 0, z: 0 };
for (let z = 0; z < gz; z++)
  for (let x = 0; x < gx; x++) {
    if (cleaned[z * gx + x]) continue;
    const wx = (x + 0.5) * CELL - half[0];
    const wz = (z + 0.5) * CELL - half[1];
    const inside = Math.abs(wx) < width / 2 - 0.3 && Math.abs(wz) < depth / 2 - 0.3;
    if (!inside || clearance(x, z) < 0.4) continue; // room for the 0.3 m capsule
    const score = Math.hypot(wx, wz);
    if (score > best.score) best = { score, x: wx, z: wz };
  }
if (best.score === -Infinity) best = { score: 0, x: 0, z: 0 };
// Face the middle of the room: yaw 0 looks along −Z, forward = (−sin yaw, −cos yaw).
const spawnYaw = Math.round((Math.atan2(best.x, best.z) * 180) / Math.PI);

// --- Write outputs ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });

const plyHeader = `ply\nformat binary_little_endian 1.0\ncomment Namma Space: levelled from ${input.split(/[\\/]/).pop()}\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n`;
const body = Buffer.alloc(n * 15);
for (let j = 0; j < n; j++) {
  body.writeFloatLE(P[j * 3], j * 15);
  body.writeFloatLE(P[j * 3 + 1], j * 15 + 4);
  body.writeFloatLE(P[j * 3 + 2], j * 15 + 8);
  body[j * 15 + 12] = C[j * 3];
  body[j * 15 + 13] = C[j * 3 + 1];
  body[j * 15 + 14] = C[j * 3 + 2];
}
writeFileSync(join(outDir, "points.ply"), Buffer.concat([Buffer.from(plyHeader, "ascii"), body]));

const doc = new Document();
const buffer = doc.createBuffer();
const data = new Float32Array(tris);
const accessor = doc.createAccessor().setType("VEC3").setArray(data).setBuffer(buffer);
const prim = doc.createPrimitive().setAttribute("POSITION", accessor);
const mesh = doc.createMesh("collider").addPrimitive(prim);
doc.createScene().addChild(doc.createNode("collider").setMesh(mesh));
await new NodeIO().write(join(outDir, "collider.glb"), doc);
console.log(`Collider ${columns.toLocaleString()} columns from a ${gx} × ${gz} grid (${(data.length / 9).toLocaleString()} triangles)`);

const venuePath = join(outDir, "venue.json");
if (!existsSync(venuePath)) {
  const id = outDir.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  const venue = {
    id,
    name: opt("name") ?? id,
    subtitle: `Point-cloud scan, ${width.toFixed(1)} m × ${depth.toFixed(1)} m`,
    points: { url: "points.ply" },
    collider: { url: "collider.glb" },
    spawn: { position: [Number(best.x.toFixed(2)), 0, Number(best.z.toFixed(2))], yaw: spawnYaw },
    eyeHeight: 1.6,
  };
  writeFileSync(venuePath, JSON.stringify(venue, null, 2) + "\n");
  console.log(`Venue   wrote ${venuePath}`);
}
console.log(`Spawn   (${best.x.toFixed(2)}, ${best.z.toFixed(2)}) facing ${spawnYaw}°`);
