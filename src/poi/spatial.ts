import type { Poi } from "./types";

/** Even-odd test: is (x, z) inside the polygon given as [x, z] corners? */
export function pointInPolygon(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}

/** How close (metres, on the floor plan) a click must land to a POI without a zone to pick it. */
export const PICK_RADIUS = 0.9;

/**
 * A uniform grid over the floor plan that maps each cell to the POIs whose zone or pick circle
 * touches it, so clicks and "what is here" lookups don't scan every POI. Cheap to rebuild
 * whenever the POI list changes (the editor does that on every edit).
 */
export class PoiIndex {
  private cells = new Map<string, Poi[]>();
  constructor(
    readonly pois: Poi[],
    private cell = 1,
  ) {
    for (const poi of pois) {
      const [minX, minZ, maxX, maxZ] = bounds(poi);
      for (let cx = Math.floor(minX / cell); cx <= Math.floor(maxX / cell); cx++)
        for (let cz = Math.floor(minZ / cell); cz <= Math.floor(maxZ / cell); cz++) {
          const key = `${cx},${cz}`;
          const list = this.cells.get(key);
          if (list) list.push(poi);
          else this.cells.set(key, [poi]);
        }
    }
  }

  /**
   * The POI at a floor point. A small object right under the click (its pick circle) beats the room
   * around it, and among overlapping zones the smallest wins, so "Desk" wins over "Classroom".
   */
  at(x: number, z: number): Poi | null {
    const near = this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? [];
    let best: Poi | null = null;
    let bestScore = Infinity;
    for (const poi of near) {
      const d = Math.hypot(poi.position[0] - x, poi.position[2] - z);
      let score = Infinity;
      if (d <= PICK_RADIUS) score = d; // 0 .. 0.9
      else if (poi.zone && pointInPolygon(x, z, poi.zone)) score = 1 + polygonArea(poi.zone);
      if (score < bestScore) {
        bestScore = score;
        best = poi;
      }
    }
    return best;
  }
}

function bounds(poi: Poi): [number, number, number, number] {
  const [x, , z] = poi.position;
  let b: [number, number, number, number] = [x - PICK_RADIUS, z - PICK_RADIUS, x + PICK_RADIUS, z + PICK_RADIUS];
  for (const [zx, zz] of poi.zone ?? []) b = [Math.min(b[0], zx), Math.min(b[1], zz), Math.max(b[2], zx), Math.max(b[3], zz)];
  return b;
}
