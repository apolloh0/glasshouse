// Gate N — the essay's scaleFactor questions ("what values does it take?
// how does it change? faster or slower?"), answered by INSPECTION of the
// trace on examples/scale-spiral.chalk. If these pass, the data a learner
// needs is sitting in the pipeline — the studio only has to draw it.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { numericSummary, valueCells, valuesForNode } from "../src/flow/cells.js";
import { sparkline } from "../src/flow/state.js";
import { thumbnailFit } from "../src/ui/glyphs.js";
import { pathAt } from "../src/lang/walk.js";

const src = readFileSync("examples/scale-spiral.chalk", "utf8");

function fixture() {
  const program = parse(src);
  const view = new Session(src, 42).traceSetup();
  const path = pathAt(program, src.indexOf("2 + i"));
  const radiusExpr = [...path].reverse().find((n) => n.kind === "binop")!;
  return { program, view, radiusExpr };
}

describe("Gate N — scaleFactor by inspection", () => {
  it("Q1: what values does the radius take? — all twelve, in order", () => {
    const { view, radiusExpr } = fixture();
    const values = valuesForNode(view, radiusExpr.id)
      .map((v) => (v as { v: number }).v);
    expect(values.length).toBe(12);
    expect(values[0]).toBeCloseTo(3.5, 10);   // i runs 1..12
    expect(values[11]).toBeCloseTo(20, 10);
  });

  it("Q2: how does it change? — strictly increasing, and the summary says so", () => {
    const { view, radiusExpr } = fixture();
    const values = valuesForNode(view, radiusExpr.id)
      .map((v) => (v as { v: number }).v);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
    const s = numericSummary(values);
    expect(s.count).toBe(12);
    expect(s.min).toBeCloseTo(3.5, 10);
    expect(s.max).toBeCloseTo(20, 10);
    expect(s.first).toBe(s.min);
    expect(s.last).toBe(s.max);
  });

  it("Q3: faster or slower? — the first differences are constant (linear)", () => {
    const { view, radiusExpr } = fixture();
    const values = valuesForNode(view, radiusExpr.id)
      .map((v) => (v as { v: number }).v);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]! - values[i - 1]!).toBeCloseTo(1.5, 10);
    }
    // and the plot a learner sees is monotone (y-down: bigger value, smaller y)
    const spark = sparkline(values, 120, 24)!;
    for (let i = 1; i < spark.points.length; i++) {
      expect(spark.points[i]!.y).toBeLessThan(spark.points[i - 1]!.y);
    }
  });

  it("shape cells carry exact thumbnails of what was drawn", () => {
    const { program, view } = fixture();
    const circleStmt = [...pathAt(program, src.indexOf("circle(center"))]
      .reverse().find((n) => n.kind === "expr")!;
    const cells = valueCells(program, view, circleStmt.id);
    expect(cells.length).toBe(12);
    for (const c of cells) {
      expect(c.kind).toBe("ops");
      if (c.kind !== "ops") continue;
      const ops = view.display.ops.slice(c.opStart, c.opEnd);
      expect(ops.length).toBe(1);
      const fit = thumbnailFit(ops, 24, 18, 2)!;
      expect(fit.scale).toBeLessThanOrEqual(1);
      expect(fit.scale).toBeGreaterThan(0);
    }
  });
});
