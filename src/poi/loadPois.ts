import { venueBase } from "../venue/loadVenue";
import { isPoiCategory, type Poi, type PoiFile } from "./types";

const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Checks one POI from pois.json; returns a readable problem, or null when it's fine. */
export function validatePoi(p: Partial<Poi>, index: number): string | null {
  const where = `POI #${index + 1}${p.name ? ` ("${p.name}")` : ""}`;
  if (!p.id || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) return `${where}: id must be a lowercase slug like "meeting-room-4".`;
  if (!p.name?.trim()) return `${where}: name is missing.`;
  if (!isPoiCategory(p.category)) return `${where}: unknown category "${p.category}".`;
  if (!Array.isArray(p.position) || p.position.length !== 3 || !p.position.every(finite)) return `${where}: position must be [x, y, z] in metres.`;
  if (p.zone && (!Array.isArray(p.zone) || p.zone.length < 3 || !p.zone.every((c) => Array.isArray(c) && c.length === 2 && c.every(finite))))
    return `${where}: zone must be at least three [x, z] corners.`;
  return null;
}

export function parsePoiFile(json: unknown): Poi[] {
  const file = json as Partial<PoiFile>;
  if (!file || !Array.isArray(file.pois)) throw new Error('pois.json must look like { "version": 1, "pois": [ ... ] }.');
  const seen = new Set<string>();
  file.pois.forEach((p, i) => {
    const problem = validatePoi(p, i);
    if (problem) throw new Error(problem);
    if (seen.has(p.id)) throw new Error(`Two POIs share the id "${p.id}".`);
    seen.add(p.id);
  });
  return file.pois;
}

/** A venue's POIs. A venue without pois.json simply has none. */
export async function loadPois(venueId: string): Promise<Poi[]> {
  const res = await fetch(`${venueBase(venueId)}pois.json`, { cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Couldn't load the points of interest (HTTP ${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  // Dev servers answer unknown paths with index.html; treat that as "no POIs yet".
  if (type.includes("text/html")) return [];
  return parsePoiFile(await res.json());
}
