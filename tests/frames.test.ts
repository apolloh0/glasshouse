// P2-T5 — ghost geometry. Pure: fabricated display lists, exact deep-equals.
import { describe, expect, it } from "vitest";
import { ALPHAS, onionLayers, trailOps } from "../src/flow/frames.js";
import type { DisplayList } from "../src/render/displayList.js";

describe("onionLayers (P2-T5)", () => {
  it("pins alphas and paint order (faintest first; before precedes after)", () => {
    expect(ALPHAS).toEqual([0.30, 0.18, 0.08]);
    expect(onionLayers(10, 240)).toEqual([
      { frame: 7, alpha: 0.08 }, { frame: 13, alpha: 0.08 },
      { frame: 8, alpha: 0.18 }, { frame: 12, alpha: 0.18 },
      { frame: 9, alpha: 0.30 }, { frame: 11, alpha: 0.30 },
    ]);
  });

  it("clamps at history edges and never includes the current frame", () => {
    expect(onionLayers(1, 240)).toEqual([
      { frame: 4, alpha: 0.08 },
      { frame: 3, alpha: 0.18 },
      { frame: 0, alpha: 0.30 }, { frame: 2, alpha: 0.30 },
    ]);
    expect(onionLayers(0, 1)).toEqual([]);
  });

  it("respects narrower windows", () => {
    expect(onionLayers(10, 240, 1, 0)).toEqual([{ frame: 9, alpha: 0.30 }]);
  });
});

describe("trailOps (P2-T5)", () => {
  const get = (k: number): DisplayList => ({
    bg: null,
    ops: [{ kind: "circle", cx: k, cy: 0, r: 1, fill: 0, sourceNodeId: 0, stepIndex: 0 }],
  });

  it("slices oldest-first at the given stride, excluding the current frame", () => {
    const slices = trailOps(get, 89, 8, 4);
    expect(slices.map((s) => s.frame))
      .toEqual([57, 61, 65, 69, 73, 77, 81, 85]);
    for (const s of slices) {
      expect(s.ops.length).toBe(1);
      expect((s.ops[0] as { cx: number }).cx).toBe(s.frame);
    }
  });

  it("clamps below frame 0", () => {
    expect(trailOps(get, 6, 4, 2).map((s) => s.frame)).toEqual([0, 2, 4]);
  });
});
