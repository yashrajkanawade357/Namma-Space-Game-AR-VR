#!/usr/bin/env node
// Shrinks a raw scan mesh (RealityScan, Polycam, Scaniverse .glb) for the web viewer:
// welds duplicate vertices, simplifies to a target triangle count, resizes textures,
// and writes one self-contained .glb.
//
// Usage: node pipeline/clean-mesh.mjs <input.glb> <output.glb> [--triangles 120000] [--texture 2048] [--debris 0.005]
// --debris: drop disconnected pieces smaller than this share of all triangles (0 keeps everything).
import { statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compactPrimitive, dedup, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!input || !output) {
  console.error("Usage: node pipeline/clean-mesh.mjs <input.glb> <output.glb> [--triangles 120000] [--texture 2048]");
  process.exit(1);
}
const targetTriangles = flag("triangles", 120000);
const textureSize = flag("texture", 2048);

const countTriangles = (doc) => {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      n += (idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3;
    }
  return n;
};
const mb = (path) => (statSync(path).size / 1024 / 1024).toFixed(1);

/**
 * Drops floating debris: pieces of mesh not connected to anything else and smaller than
 * `minShare` of all triangles. Vertices are joined by position, not index, because UV
 * seams split one surface into several index islands.
 */
function removeDebris(minShare) {
  return (doc) => {
    let removed = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const indices = prim.getIndices();
        if (!indices) continue;
        const idx = indices.getArray();
        const pos = prim.getAttribute("POSITION");
        const n = pos.getCount();
        const parent = new Int32Array(n).map((_, i) => i);
        const find = (i) => {
          while (parent[i] !== i) i = parent[i] = parent[parent[i]];
          return i;
        };
        const union = (a, b) => {
          a = find(a);
          b = find(b);
          if (a !== b) parent[a] = b;
        };
        const byPos = new Map();
        const v = [0, 0, 0];
        for (let i = 0; i < n; i++) {
          pos.getElement(i, v);
          const key = `${Math.round(v[0] * 1e4)},${Math.round(v[1] * 1e4)},${Math.round(v[2] * 1e4)}`;
          const seen = byPos.get(key);
          if (seen === undefined) byPos.set(key, i);
          else union(i, seen);
        }
        for (let t = 0; t < idx.length; t += 3) {
          union(idx[t], idx[t + 1]);
          union(idx[t], idx[t + 2]);
        }
        const size = new Map();
        for (let t = 0; t < idx.length; t += 3) {
          const r = find(idx[t]);
          size.set(r, (size.get(r) ?? 0) + 1);
        }
        const min = Math.max(20, (idx.length / 3) * minShare);
        const kept = [];
        for (let t = 0; t < idx.length; t += 3) {
          if (size.get(find(idx[t])) >= min) kept.push(idx[t], idx[t + 1], idx[t + 2]);
          else removed++;
        }
        indices.setArray(n > 65535 ? new Uint32Array(kept) : new Uint16Array(kept));
        compactPrimitive(prim);
      }
    console.log(`Debris  removed ${removed.toLocaleString()} floating triangles`);
  };
}

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);

const before = countTriangles(doc);
const ratio = Math.min(1, targetTriangles / before);
console.log(`Input  ${input}: ${before.toLocaleString()} triangles (${mb(input)} MB)`);

await doc.transform(
  weld(),
  removeDebris(flag("debris", 0.005)),
  // error is a fraction of the mesh's size; 1% lets the simplifier reach the target on noisy scans.
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }),
  textureCompress({ encoder: sharp, resize: [textureSize, textureSize], quality: 85 }),
  dedup(),
  prune(),
);

await io.write(output, doc);
console.log(`Output ${output}: ${countTriangles(doc).toLocaleString()} triangles (${mb(output)} MB)`);
