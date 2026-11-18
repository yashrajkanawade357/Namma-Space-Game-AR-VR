import type { Point } from "./navmesh";

/** Within this distance of the goal the visitor has arrived. */
export const ARRIVE_RADIUS = 0.9;
/** Typical indoor walking pace used for time estimates, metres per second. */
export const WALK_PACE = 1.2;

export type Turn = "straight" | "slight-left" | "left" | "sharp-left" | "slight-right" | "right" | "sharp-right" | "arrive";

export interface Instruction {
  turn: Turn;
  /** Metres until the turn (or the goal for "arrive"). */
  distance: number;
  text: string;
}

/** Signed turn angle in degrees at corner b when walking a → b → c; positive turns right (clockwise seen from above). */
export function turnAngle(a: Point, b: Point, c: Point): number {
  const h1 = Math.atan2(b.x - a.x, -(b.z - a.z));
  const h2 = Math.atan2(c.x - b.x, -(c.z - b.z));
  let d = ((h2 - h1) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function classifyTurn(angle: number): Turn {
  const a = Math.abs(angle);
  if (a < 20) return "straight";
  const side = angle > 0 ? "right" : "left";
  if (a < 50) return `slight-${side}` as Turn;
  if (a < 135) return side as Turn;
  return `sharp-${side}` as Turn;
}

const metres = (d: number) => (d < 1 ? "less than a metre" : `${Math.round(d)} m`);

/**
 * The next thing to tell the visitor, Google Maps style. The route starts at the visitor
 * (it is recomputed as they walk), so the first corner after the start is the next decision.
 */
export function nextInstruction(route: Point[], remaining: number): Instruction {
  if (route.length < 2 || remaining <= ARRIVE_RADIUS) return { turn: "arrive", distance: 0, text: "You have arrived" };
  let run = 0;
  for (let i = 1; i < route.length - 1; i++) {
    run += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    const turn = classifyTurn(turnAngle(route[i - 1], route[i], route[i + 1]));
    if (turn === "straight") continue;
    const words: Record<string, string> = {
      "slight-left": "Bear left",
      left: "Turn left",
      "sharp-left": "Turn sharply left",
      "slight-right": "Bear right",
      right: "Turn right",
      "sharp-right": "Turn sharply right",
    };
    return { turn, distance: run, text: run < 1.2 ? words[turn] : `${words[turn]} in ${metres(run)}` };
  }
  return { turn: "straight", distance: remaining, text: `Destination ${remaining < 2 ? "just ahead" : `in ${metres(remaining)}`}` };
}

/** Walking time as a short label, e.g. "20 s" or "2 min". */
export function etaLabel(distance: number): string {
  const s = distance / WALK_PACE;
  if (s < 15) return `${Math.max(1, Math.ceil(s))} s`;
  return s < 60 ? `${Math.round(s / 5) * 5} s` : `${Math.round(s / 60)} min`;
}
