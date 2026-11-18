import type { Vec3 } from "../venue/types";

export type PoiCategory = "room" | "seating" | "desk" | "facility" | "storage" | "exit" | "info" | "item";

/**
 * A point of interest, stored per venue in public/venues/<id>/pois.json.
 * Units and axes match venue.json: metres, +Y up, floor at y = 0.
 */
export interface Poi {
  /** Stable slug, used in links (?poi=<id>). */
  id: string;
  name: string;
  category: PoiCategory;
  /** Other words visitors might search for, e.g. ["cot", "sleep"] for a bed. */
  aliases?: string[];
  description?: string;
  /** Where the label sits, on or near the object. Navigation goes to the walkable floor beside it. */
  position: Vec3;
  /** Floor outline of the room or zone as [x, z] corners; clicking anywhere inside it reveals the POI. */
  zone?: [number, number][];
}

export interface PoiFile {
  version: 1;
  pois: Poi[];
}

export const CATEGORIES: Record<PoiCategory, { label: string; color: string }> = {
  room: { label: "Room", color: "#0f6e56" },
  seating: { label: "Seating", color: "#185fa5" },
  desk: { label: "Desk", color: "#7a4fb3" },
  facility: { label: "Facility", color: "#b5521b" },
  storage: { label: "Storage", color: "#8a6a2a" },
  exit: { label: "Entrance / exit", color: "#c0392b" },
  info: { label: "Information", color: "#2c7a9a" },
  item: { label: "Item", color: "#5d655f" },
};

export const isPoiCategory = (c: unknown): c is PoiCategory => typeof c === "string" && c in CATEGORIES;
