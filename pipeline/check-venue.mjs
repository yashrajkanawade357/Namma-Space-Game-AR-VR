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

// Floor patches and cleanup zones (scan repairs for walking and routing).
const isCorners = (z) => Array.isArray(z) && z.length >= 3 && z.every((c) => Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number"));
const patches = venue.walkableFloor ? [].concat(venue.walkableFloor) : [];
patches.forEach((p, i) => {
  if (!isVec3(p?.position) || !Array.isArray(p?.size) || p.size.length !== 2) problems.push(`walkableFloor #${i + 1}: needs "position" [x, y, z] and "size" [width, depth].`);
});
(venue.cleanup ?? []).forEach((c, i) => {
  if (!isCorners(c?.zone) || typeof c?.below !== "number") problems.push(`cleanup #${i + 1}: needs "zone" (three or more [x, z] corners) and "below" (metres).`);
});
if (patches.length || venue.cleanup?.length) notes.push(`scan repairs: ${patches.length} floor patch(es), ${venue.cleanup?.length ?? 0} cleanup zone(s)`);

// Points of interest (optional): the same rules the viewer enforces when it loads pois.json.
const CATEGORIES = ["room", "seating", "desk", "facility", "storage", "exit", "info", "item"];
const poisPath = join(dir, "pois.json");
if (existsSync(poisPath)) {
  let file;
  try {
    file = JSON.parse(readFileSync(poisPath, "utf8"));
  } catch (err) {
    problems.push(`pois.json is not valid JSON: ${err.message}`);
  }
  if (file && !Array.isArray(file.pois)) problems.push('pois.json must look like { "version": 1, "pois": [ ... ] }.');
  if (file && Array.isArray(file.pois)) {
    const ids = new Set();
    file.pois.forEach((p, i) => {
      const where = `pois.json #${i + 1}${p?.name ? ` ("${p.name}")` : ""}`;
      if (!p?.id || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) problems.push(`${where}: id must be a lowercase slug like "meeting-room-4".`);
      else if (ids.has(p.id)) problems.push(`${where}: duplicate id "${p.id}".`);
      ids.add(p?.id);
      if (!p?.name?.trim()) problems.push(`${where}: name is missing.`);
      if (!CATEGORIES.includes(p?.category)) problems.push(`${where}: category must be one of ${CATEGORIES.join(", ")}.`);
      if (!isVec3(p?.position)) problems.push(`${where}: position must be [x, y, z] in metres.`);
      if (p?.zone && !isCorners(p.zone)) problems.push(`${where}: zone must be three or more [x, z] corners.`);
    });
    const zones = file.pois.filter((p) => p?.zone).length;
    notes.push(`pois: ${file.pois.length} places, ${zones} with a clickable zone`);
  }
} else {
  notes.push("pois: none yet (tag them with ?edit=1, then save pois.json here)");
}

console.log(`Venue "${venue.name ?? "?"}" in ${dir}`);
for (const n of notes) console.log(`  · ${n}`);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("  ✓ Ready to deploy");
