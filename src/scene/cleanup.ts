import { pointInPolygon } from "../poi/spatial";
import type { CleanupZone } from "../venue/types";

/**
 * Drops scan artifacts from a world-space triangle soup (x, y, z per vertex, three vertices per
 * triangle): every triangle whose centre lies inside a cleanup zone's outline and that stays
 * entirely below the zone's height. Typical artifacts are humps in a shiny floor, a bag left in an
 * aisle, or the person holding the phone. Walls and furniture outside the zones are untouched.
 */
export function dropArtifacts(positions: Float32Array, zones: CleanupZone[] | undefined): Float32Array {
  if (!zones?.length) return positions;
  const keep: number[] = [];
  const n = positions.length / 9;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const cx = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
    const cz = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
    const top = Math.max(positions[o + 1], positions[o + 4], positions[o + 7]);
    const artifact = zones.some((z) => top < z.below && pointInPolygon(cx, cz, z.zone));
    if (!artifact) keep.push(t);
  }
  if (keep.length === n) return positions;
  const out = new Float32Array(keep.length * 9);
  keep.forEach((t, i) => out.set(positions.subarray(t * 9, t * 9 + 9), i * 9));
  return out;
}
