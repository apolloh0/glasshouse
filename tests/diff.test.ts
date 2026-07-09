// P3-T4 — display diff. Fabricated lists pin the matching rule; the
// integration case checks motion reads as change on real frames.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Session } from "../src/host/run.js";
import { diffDisplay } from "../src/flow/diff.js";
import type { DisplayOp } from "../src/render/displayList.js";

const circle = (cx: number, sourceNodeId: number, stepIndex = 0): DisplayOp =>
  ({ kind: "circle", cx, cy: 10, r: 5, fill: 0, sourceNodeId, stepIndex });

describe("diffDisplay (P3-T4)", () => {
  it("motion is change, not remove+add", () => {
    expect(diffDisplay([circle(10, 7)], [circle(20, 7)])).toEqual({
      added: [], removed: [], changed: [{ a: 0, b: 0 }],
    });
  });

  it("ignores stepIndex differences (visual identity only)", () => {
    expect(diffDisplay([circle(10, 7, 3)], [circle(10, 7, 9)])).toEqual({
      added: [], removed: [], changed: [],
    });
  });

  it("pairs by occurrence within a source node", () => {
    const a = [circle(1, 7), circle(2, 7), circle(3, 7)];
    const b = [circle(1, 7), circle(99, 7)];
    expect(diffDisplay(a, b)).toEqual({
      added: [], removed: [2], changed: [{ a: 1, b: 1 }],
    });
  });

  it("different source nodes never pair", () => {
    expect(diffDisplay([circle(10, 7)], [circle(10, 8)])).toEqual({
      added: [0], removed: [0], changed: [],
    });
  });

  it("adjacent bouncing-ball frames: exactly one changed op", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const session = new Session(src, 42);
    session.advanceFrames(10);
    const d = diffDisplay(session.displayAt(4).ops, session.displayAt(5).ops);
    expect(d).toEqual({ added: [], removed: [], changed: [{ a: 0, b: 0 }] });
  });
});
