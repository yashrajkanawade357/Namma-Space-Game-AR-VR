#!/usr/bin/env node
// Shrinks a raw scan mesh (RealityScan, Polycam, Scaniverse .glb) for the web viewer:
// welds duplicate vertices, simplifies to a target triangle count, resizes textures,
// and writes one self-contained .glb.
//
// Usage: node pipeline/clean-mesh.mjs <input.glb> <output.glb> [--triangles 120000] [--texture 2048]
import { statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
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

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);

const before = countTriangles(doc);
const ratio = Math.min(1, targetTriangles / before);
console.log(`Input  ${input}: ${before.toLocaleString()} triangles (${mb(input)} MB)`);

await doc.transform(
  weld(),
  // error is a fraction of the mesh's size; 1% lets the simplifier reach the target on noisy scans.
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }),
  textureCompress({ encoder: sharp, resize: [textureSize, textureSize], quality: 85 }),
  dedup(),
  prune(),
);

await io.write(output, doc);
console.log(`Output ${output}: ${countTriangles(doc).toLocaleString()} triangles (${mb(output)} MB)`);
