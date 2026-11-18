import { describe, expect, it } from "vitest";
import { classifyTurn, etaLabel, nextInstruction, turnAngle } from "./guidance";

const p = (x: number, z: number) => ({ x, y: 0, z });

describe("turn-by-turn guidance", () => {
  it("measures turns as seen from above, right positive", () => {
    // Walking north (−Z) then east (+X) is a right turn.
    expect(turnAngle(p(0, 0), p(0, -2), p(2, -2))).toBeCloseTo(90);
    expect(turnAngle(p(0, 0), p(0, -2), p(-2, -2))).toBeCloseTo(-90);
    expect(classifyTurn(10)).toBe("straight");
    expect(classifyTurn(-35)).toBe("slight-left");
    expect(classifyTurn(150)).toBe("sharp-right");
  });

  it("announces the first real turn and its distance", () => {
    const route = [p(0, 0), p(0, -3), p(0, -4), p(3, -4)];
    const step = nextInstruction(route, 7);
    expect(step.turn).toBe("right");
    expect(step.distance).toBeCloseTo(4);
    expect(step.text).toBe("Turn right in 4 m");
  });

  it("says the destination when no turns are left, and arrival when close", () => {
    expect(nextInstruction([p(0, 0), p(0, -5)], 5).text).toBe("Destination in 5 m");
    expect(nextInstruction([p(0, 0), p(0, -0.5)], 0.5).turn).toBe("arrive");
  });

  it("formats walking time", () => {
    expect(etaLabel(8.8)).toBe("8 s");
    expect(etaLabel(30)).toBe("25 s");
    expect(etaLabel(150)).toBe("2 min");
  });
});
