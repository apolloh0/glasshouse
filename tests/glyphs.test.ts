// P3-T1 — glyphs and thumbnail fitting. Pure; exact deep-equals.
import { describe, expect, it } from "vitest";
import { opBounds, thumbnailFit, valueGlyph } from "../src/ui/glyphs.js";
import type { DisplayOp } from "../src/render/displayList.js";

const meta = { sourceNodeId: 0, stepIndex: 0 };

describe("valueGlyph (P3-T1)", () => {
  it("maps every value type to its glyph", () => {
    expect(valueGlyph({ t: "num", v: 12.5 })).toEqual({ kind: "figure", text: "12.50" });
    expect(valueGlyph({ t: "bool", v: false })).toEqual({ kind: "figure", text: "false" });
    expect(valueGlyph({ t: "str", v: "hi" })).toEqual({ kind: "figure", text: "\"hi\"" });
    expect(valueGlyph({ t: "color", rgb: 0x7a4ea3 })).toEqual({ kind: "swatch", rgb: 0x7a4ea3 });
    expect(valueGlyph({ t: "angle", deg: 30 })).toEqual({ kind: "tick", deg: 30 });
  });

  it("normalizes point dots to the stage and clamps", () => {
    expect(valueGlyph({ t: "point", x: 160, y: 120 })).toEqual({ kind: "dot", x: 0.5, y: 0.5 });
    expect(valueGlyph({ t: "point", x: -10, y: 500 })).toEqual({ kind: "dot", x: 0, y: 1 });
  });
});

describe("opBounds (P3-T1)", () => {
  it("computes geometric bounds per op kind", () => {
    const circle: DisplayOp = { kind: "circle", cx: 50, cy: 40, r: 10, fill: 0, ...meta };
    expect(opBounds([circle])).toEqual({ x0: 40, y0: 30, x1: 60, y1: 50 });
    const rect: DisplayOp = { kind: "rect", x: 5, y: 6, w: 10, h: 20, fill: 0, ...meta };
    expect(opBounds([circle, rect])).toEqual({ x0: 5, y0: 6, x1: 60, y1: 50 });
    expect(opBounds([])).toBeNull();
  });
});

describe("thumbnailFit (P3-T1)", () => {
  it("fits with uniform scale and centers (pinned math)", () => {
    // rect 0..40 x 0..10 into 24x18 pad 2: s = min(20/40, 14/10) = 0.5
    const op: DisplayOp = { kind: "rect", x: 0, y: 0, w: 40, h: 10, fill: 0, ...meta };
    const fit = thumbnailFit([op], 24, 18, 2)!;
    expect(fit.scale).toBe(0.5);
    expect(fit.dx).toBe(2);            // (24 - 0.5*40)/2 - 0.5*0 = 2
    expect(fit.dy).toBe(6.5);          // (18 - 0.5*10)/2 - 0.5*0 = 6.5
  });

  it("never magnifies (scale capped at 1)", () => {
    const op: DisplayOp = { kind: "rect", x: 10, y: 10, w: 4, h: 4, fill: 0, ...meta };
    const fit = thumbnailFit([op], 24, 18, 2)!;
    expect(fit.scale).toBe(1);
    expect(fit.dx).toBe(0);            // (24 - 4)/2 - 10 = 0
    expect(fit.dy).toBe(-3);           // (18 - 4)/2 - 10 = -3
  });

  it("handles degenerate boxes (a horizontal line)", () => {
    const op: DisplayOp = { kind: "line", x1: 0, y1: 5, x2: 100, y2: 5, stroke: 0, width: 1, ...meta };
    const fit = thumbnailFit([op], 24, 18, 2)!;
    expect(fit.scale).toBe(0.2);       // bh == 0 -> width-only fit: 20/100
    expect(fit.dy).toBe(8);            // (18 - 0)/2 - 0.2*5 = 8
  });

  it("returns null for zero ops", () => {
    expect(thumbnailFit([], 24, 18)).toBeNull();
  });
});
