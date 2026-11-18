import { create } from "zustand";
import { useApp } from "../store";
import type { Poi, PoiCategory } from "./types";

export type EditorMode = "idle" | "place" | "move" | "zone";

interface EditorState {
  mode: EditorMode;
  /** The POI the form is editing. */
  editingId: string | null;
  /** Corners clicked so far while drawing a zone. */
  draftZone: [number, number][];
  set: (patch: Partial<EditorState>) => void;
}

export const useEditor = create<EditorState>((set) => ({
  mode: "idle",
  editingId: null,
  draftZone: [],
  set: (patch) => set(patch),
}));

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "poi";

function uniqueId(base: string, taken: Set<string>) {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const draftKey = (venueId: string) => `doorway:pois:${venueId}`;

/** Saves the work in progress in this browser, so a reload doesn't lose it. */
export function saveDraft(venueId: string, pois: Poi[]) {
  try {
    localStorage.setItem(draftKey(venueId), JSON.stringify({ version: 1, pois }));
  } catch {
    /* storage can be unavailable (private windows); the export buttons still work */
  }
}
export function loadDraft(venueId: string): Poi[] | null {
  try {
    const raw = localStorage.getItem(draftKey(venueId));
    return raw ? (JSON.parse(raw).pois as Poi[]) : null;
  } catch {
    return null;
  }
}
export function clearDraft(venueId: string) {
  try {
    localStorage.removeItem(draftKey(venueId));
  } catch {
    /* nothing to clear */
  }
}

/** Replaces the POI list everywhere (labels, search, picking) and keeps the draft. */
export function setPois(venueId: string, pois: Poi[]) {
  useApp.setState({ pois });
  saveDraft(venueId, pois);
}

export function addPoi(venueId: string, position: [number, number, number], category: PoiCategory = "room"): Poi {
  const { pois } = useApp.getState();
  const n = pois.length + 1;
  const poi: Poi = { id: uniqueId(`point-${n}`, new Set(pois.map((p) => p.id))), name: `Point ${n}`, category, position };
  setPois(venueId, [...pois, poi]);
  return poi;
}

export function updatePoi(venueId: string, id: string, patch: Partial<Poi>) {
  const { pois } = useApp.getState();
  let next = pois.map((p) => (p.id === id ? { ...p, ...patch } : p));
  // Renaming a placeholder also gives it a readable id, as long as nothing else uses it.
  if (patch.name) {
    const poi = next.find((p) => p.id === id)!;
    if (/^point-\d+/.test(poi.id)) {
      const newId = uniqueId(slugify(patch.name), new Set(next.filter((p) => p.id !== id).map((p) => p.id)));
      next = next.map((p) => (p.id === id ? { ...p, id: newId } : p));
      if (useEditor.getState().editingId === id) useEditor.setState({ editingId: newId });
      if (useApp.getState().selectedPoiId === id) useApp.setState({ selectedPoiId: newId });
    }
  }
  setPois(venueId, next);
}

export function deletePoi(venueId: string, id: string) {
  setPois(venueId, useApp.getState().pois.filter((p) => p.id !== id));
  if (useEditor.getState().editingId === id) useEditor.setState({ editingId: null, mode: "idle" });
}

const round = (v: number) => Math.round(v * 100) / 100;

/** pois.json with coordinates rounded to centimetres. */
export function exportJson(pois: Poi[]): string {
  const clean = pois.map((p) => ({
    ...p,
    position: p.position.map(round),
    ...(p.zone ? { zone: p.zone.map(([x, z]) => [round(x), round(z)]) } : {}),
    ...(p.aliases?.length ? { aliases: p.aliases } : { aliases: undefined }),
  }));
  return JSON.stringify({ version: 1, pois: clean }, null, 2) + "\n";
}
