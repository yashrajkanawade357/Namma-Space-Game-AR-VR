#!/usr/bin/env node
// Validates a venue folder before it is deployed.
// Usage: npm run check:venue -- public/venues/home
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "public/venues/demo");
const problems = [];
const notes = [];

const configPath = join(dir, "venue.json");
if (!existsSync(configPath)) {
  console.error(`No venue.json in ${dir}`);
  process.exit(1);
}

let venue;
try {
  venue = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(`venue.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number");
const isRemote = (url) => /^(https?:)?\/\//.test(url);
const mb = (path) => (statSync(path).size / 1024 / 1024).toFixed(1);

if (!venue.id) problems.push("Missing \"id\".");
if (!venue.name) problems.push("Missing \"name\".");
if (!venue.spawn || !isVec3(venue.spawn.position)) problems.push("\"spawn.position\" must be [x, y, z] in metres.");
if (!venue.collider?.url) problems.push("Missing \"collider.url\" (a .glb mesh, or \"demo\").");

for (const [key, asset] of [["splat", venue.splat], ["collider", venue.collider]]) {
  if (!asset || asset.url === "demo") continue;
  for (const t of ["position", "rotation"]) if (asset[t] && !isVec3(asset[t])) problems.push(`"${key}.${t}" must be [x, y, z].`);
  if (isRemote(asset.url)) {
    notes.push(`${key}: remote file, not checked (${asset.url})`);
    continue;
  }
  const path = join(dir, asset.url);
  if (!existsSync(path)) {
    problems.push(`${key}: file not found at ${path}`);
    continue;
  }
  const size = Number(mb(path));
  notes.push(`${key}: ${asset.url} (${size} MB)`);
  if (key === "splat" && /\.ply$/i.test(asset.url)) notes.push("splat: .ply is large; convert to .spz with pipeline/compress-splat.sh");
  if (key === "splat" && size > 60) notes.push("splat: over 60 MB will load slowly on phones; crop or compress further");
  if (key === "collider" && size > 15) notes.push("collider: over 15 MB; decimate the mesh (about 50k triangles is plenty)");
}

console.log(`Venue "${venue.name ?? "?"}" in ${dir}`);
for (const n of notes) console.log(`  · ${n}`);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("  ✓ Ready to deploy");
