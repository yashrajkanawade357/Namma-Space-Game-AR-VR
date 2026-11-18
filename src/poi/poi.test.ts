import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePoiFile } from "./loadPois";
import { createSearch } from "./search";
import { PoiIndex, pointInPolygon, polygonArea } from "./spatial";
import type { Poi } from "./types";

const demo = parsePoiFile(JSON.parse(readFileSync("public/venues/demo/pois.json", "utf8")));

describe("spatial index (click-to-reveal)", () => {
  const index = new PoiIndex(demo);

  it("knows which room a floor point is in", () => {
    expect(pointInPolygon(-2, -2, [[-5, -4], [1, -4], [1, 0.6], [-5, 0.6]])).toBe(true);
    expect(polygonArea([[0, 0], [2, 0], [2, 3], [0, 3]])).toBeCloseTo(6);
    expect(index.at(-2.0, -2.0)?.id).toBe("bedroom");
    expect(index.at(4.0, -1.0)?.id).toBe("kitchen");
    // The L-shaped living room includes the hallway strip by the kitchen.
    expect(index.at(3.0, 0.2)?.id).toBe("living-room");
  });

  it("prefers the object under the click to the room around it", () => {
    expect(index.at(-3.5, -2.3)?.id).toBe("bed");
    expect(index.at(1.5, -3.4)?.id).toBe("fridge");
  });

  it("finds nothing outside the venue", () => {
    expect(index.at(20, 20)).toBeNull();
  });
});

describe("fuzzy search", () => {
  const search = createSearch(demo);
  it("matches names, typos, aliases and categories", () => {
    expect(search("kitchn")[0].poi.id).toBe("kitchen");
    expect(search("couch")[0].poi.category).toBe("seating");
    expect(search("almirah")[0].poi.id).toBe("wardrobe");
    expect(search("refrigerator")[0].poi.id).toBe("fridge");
  });
  it("understands natural phrasing", () => {
    expect(search("take me to the bedroom")[0].poi.id).toBe("bedroom");
    expect(search("where is the TV")[0].poi.id).toBe("tv");
  });
  it("lists places when the box is empty", () => {
    expect(search("").length).toBeGreaterThan(5);
  });
});

describe("pois.json validation", () => {
  const ok: Poi = { id: "room-1", name: "Room 1", category: "room", position: [0, 0, 0] };
  it("accepts a valid file", () => {
    expect(parsePoiFile({ version: 1, pois: [ok] })).toHaveLength(1);
  });
  it("rejects bad ids, categories, positions and duplicates", () => {
    expect(() => parsePoiFile({ version: 1, pois: [{ ...ok, id: "Room 1" }] })).toThrow(/slug/);
    expect(() => parsePoiFile({ version: 1, pois: [{ ...ok, category: "lounge" }] })).toThrow(/category/);
    expect(() => parsePoiFile({ version: 1, pois: [{ ...ok, position: [0, 0] }] })).toThrow(/position/);
    expect(() => parsePoiFile({ version: 1, pois: [ok, ok] })).toThrow(/share the id/);
    expect(() => parsePoiFile({ pois: "nope" })).toThrow();
  });
});
