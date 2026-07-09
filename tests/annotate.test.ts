// P1-T5 — on-canvas annotation geometry. Pure: no parser, no evaluator.
// Deep-equals on purpose; the overlay is a measured drawing, not a vibe.
import { describe, expect, it } from "vitest";
import { annotationsFor, fmtNum } from "../src/ui/annotate.js";
import type { DisplayOp } from "../src/render/displayList.js";

const meta = { sourceNodeId: 0, stepIndex: 0 };

describe("fmtNum (P1-T5)", () => {
  it("formats integers bare, fractions to 2 places, and tames -0", () => {
    expect(fmtNum(25)).toBe("25");
    expect(fmtNum(12.5)).toBe("12.50");
    expect(fmtNum(1.234)).toBe("1.23");
    expect(fmtNum(-0)).toBe("0");
    expect(fmtNum(-8)).toBe("-8");
  });
});

describe("annotationsFor (P1-T5)", () => {
  it("circle: center marker + radius arrow", () => {
    const op: DisplayOp = { kind: "circle", cx: 60, cy: 80, r: 25, fill: 0x2a76c6, ...meta };
    expect(annotationsFor(op)).toEqual([
      { kind: "marker", x: 60, y: 80, label: "center (60, 80)" },
      { kind: "arrow", x1: 60, y1: 80, x2: 85, y2: 80, label: "radius 25" },
    ]);
  });

  it("rect: anchor marker + width and height arrows along the edges", () => {
    const op: DisplayOp = { kind: "rect", x: 20, y: 30, w: 40, h: 12.5, fill: 0, ...meta };
    expect(annotationsFor(op)).toEqual([
      { kind: "marker", x: 20, y: 30, label: "left 20, top 30" },
      { kind: "arrow", x1: 20, y1: 30, x2: 60, y2: 30, label: "width 40" },
      { kind: "arrow", x1: 20, y1: 30, x2: 20, y2: 42.5, label: "height 12.50" },
    ]);
  });

  it("ellipse: center marker + width/height arrows (full extents, not radii)", () => {
    const op: DisplayOp = { kind: "ellipse", cx: 100, cy: 50, rx: 30, ry: 10, fill: 0, ...meta };
    expect(annotationsFor(op)).toEqual([
      { kind: "marker", x: 100, y: 50, label: "center (100, 50)" },
      { kind: "arrow", x1: 100, y1: 50, x2: 130, y2: 50, label: "width 60" },
      { kind: "arrow", x1: 100, y1: 50, x2: 100, y2: 60, label: "height 20" },
    ]);
  });

  it("line: from/to markers", () => {
    const op: DisplayOp = { kind: "line", x1: 10, y1: 20, x2: 30, y2: 40, stroke: 0, width: 2, ...meta };
    expect(annotationsFor(op)).toEqual([
      { kind: "marker", x: 10, y: 20, label: "from (10, 20)" },
      { kind: "marker", x: 30, y: 40, label: "to (30, 40)" },
    ]);
  });

  it("triangle: one labeled marker per corner", () => {
    const op: DisplayOp = { kind: "triangle", ax: 1, ay: 2, bx: 3, by: 4, cx: 5, cy: 6, fill: 0, ...meta };
    expect(annotationsFor(op)).toEqual([
      { kind: "marker", x: 1, y: 2, label: "a (1, 2)" },
      { kind: "marker", x: 3, y: 4, label: "b (3, 4)" },
      { kind: "marker", x: 5, y: 6, label: "c (5, 6)" },
    ]);
  });
});
