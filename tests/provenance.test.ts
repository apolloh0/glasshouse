// P4b-T1/T2 — provenance. The algebra block guards the shipped helpers
// (green day one); everything else reconstructs chains from real traces —
// including THE load-bearing case: param chasing across call boundaries,
// which is what makes dragging a house edit `20 + i * 55`.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import {
  addChains, attrChain, chainAt, chainValue, constChain, isOpaque, litChain,
  scaleChain, type Chain, type PointChains,
} from "../src/flow/provenance.js";
import { pathAt, spanIndex, visit } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";

function litValueOf(program: Program): (id: number) => number {
  const vals = new Map<number, number>();
  visit(program, (n) => { if (n.kind === "number") vals.set(n.id, n.value); });
  return (id) => vals.get(id)!;
}

function litAt(program: Program, source: string, needle: string): number {
  const hit = [...pathAt(program, source.indexOf(needle))].reverse()
    .find((n) => n.kind === "number");
  expect(hit, needle).toBeTruthy();
  return hit!.id;
}

const asChain = (c: Chain | PointChains): Chain => c as Chain;
const asPoint = (c: Chain | PointChains): PointChains => c as PointChains;

describe("chain algebra (P4b-T1 guard — shipped)", () => {
  it("adds, subtracts, scales, and drops zero coefficients", () => {
    const a = addChains(litChain(3, 20), scaleChain(litChain(7, 55), 3));
    expect(a).toEqual({ terms: [{ lit: 3, coeff: 1 }, { lit: 7, coeff: 3 }], c: 0 });
    const gone = addChains(a, scaleChain(litChain(3, 20), 1), -1);
    expect(gone.terms).toEqual([{ lit: 7, coeff: 3 }]);
    expect(scaleChain(a, 0)).toEqual(constChain(0));
    expect(isOpaque(constChain(9))).toBe(true);
  });

  it("chainValue is the consistency identity", () => {
    const ch = { terms: [{ lit: 1, coeff: 3 }], c: 20 };
    expect(chainValue(ch, () => 55)).toBe(185);
  });
});

describe("chainAt (P4b-T1)", () => {
  it("reconstructs arithmetic over a loop counter, per occurrence", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const xExpr = [...pathAt(program, src.indexOf("20 + i * 55"))].reverse()
      .find((n) => n.kind === "binop" && (n as { op: string }).op === "+")!;
    // completions of the x expression, one per iteration
    const steps = view.trace.rowsForNode(xExpr.id)
      .filter((r) => r.kind === 0 /* expr */).map((r) => r.seq);
    expect(steps.length).toBe(5);
    const lit20 = litAt(program, src, "20 + i");
    const lit55 = litAt(program, src, "55, 220");
    for (let i = 0; i < 5; i++) {
      const ch = asChain(chainAt(program, view, xExpr.id, steps[i]!));
      expect(ch.terms).toEqual([
        { lit: lit20, coeff: 1 }, { lit: lit55, coeff: i + 1 },
      ]);
      expect(ch.c).toBe(0);
      expect(chainValue(ch, litValueOf(program))).toBe(20 + (i + 1) * 55);
    }
  });

  it("state vars, random, and lit*lit products are opaque at their values", () => {
    const ball = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const bp = parse(ball);
    const bs = new Session(ball, 42);
    bs.advanceFrames(2);
    const bview = bs.traceAt(1);
    const yRef = [...pathAt(bp, ball.indexOf("(160, y)") + 6)].reverse()
      .find((n) => n.kind === "name")!;
    const yRow = bview.trace.rowsForNode(yRef.id).find((r) => r.kind === 0)!;
    const ych = asChain(chainAt(bp, bview, yRef.id, yRow.seq));
    expect(isOpaque(ych)).toBe(true);

    const prod = "paper(color: #FFFFFF)\ncircle(center: (10, 10), radius: 3 * 3, fill: #112233)\n";
    const pp = parse(prod);
    const pview = new Session(prod, 42).traceSetup();
    const mul = [...pathAt(pp, prod.indexOf("3 * 3"))].reverse()
      .find((n) => n.kind === "binop")!;
    const mrow = pview.trace.rowsForNode(mul.id).find((r) => r.kind === 0)!;
    const mch = asChain(chainAt(pp, pview, mul.id, mrow.seq));
    expect(mch).toEqual(constChain(9)); // both sides carry terms -> opaque
  });
});

describe("attrChain (P4b-T2)", () => {
  it("CHASES PARAMS: a house rect's anchor carries the call site's chain", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const ops = view.display.ops;
    const lit20 = litAt(program, src, "20 + i");
    const lit55 = litAt(program, src, "55, 220");
    const lit220 = litAt(program, src, "220), height");
    const lit40 = litAt(program, src, "40 + random");

    // house #3's rect is ops[4] (r,t interleave); anchor = (base.x, base.y - h)
    const a = asPoint(attrChain(program, view, ops, 4, "anchor"));
    expect(a.x.terms).toEqual([{ lit: lit20, coeff: 1 }, { lit: lit55, coeff: 3 }]);
    expect(a.x.c).toBe(0);
    expect(a.y.terms).toEqual([{ lit: lit40, coeff: -1 }, { lit: lit220, coeff: 1 }]);
    // y's constant is -random(): entering value = traced top
    expect(chainValue(a.y, litValueOf(program)))
      .toBeCloseTo((ops[4] as { y: number }).y, 10);
  });

  it("treats active group matrices as constants (D44)", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(2);
    const ops = view.display.ops;
    const ci = ops.findIndex((o) => o.kind === "circle");
    const a = asPoint(attrChain(program, view, ops, ci, "anchor"));
    // the blade circle's local center is (250, 120): exactly two literals
    // survive into each axis, with rotation coefficients, no angle literals
    const p = parse(src);
    const lit250 = litAt(p, src, "250, 120");
    expect(a.x.terms.map((t) => t.lit)).toContain(lit250);
    expect(a.x.terms.length).toBe(2);
    expect(a.y.terms.length).toBe(2);
    expect(chainValue(a.x, litValueOf(program)))
      .toBeCloseTo((ops[ci] as { cx: number }).cx, 6);
  });

  it("maps circle size to the radius argument", () => {
    const src = readFileSync("examples/scale-spiral.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const ops = view.display.ops;
    const ch = asChain(attrChain(program, view, ops, 7, "size")); // i = 8
    const lit2 = litAt(program, src, "2 + i");
    const lit15 = litAt(program, src, "1.5, fill");
    expect(ch.terms).toEqual([{ lit: lit2, coeff: 1 }, { lit: lit15, coeff: 8 }]);
  });

  it("spanIndex sanity: every chain term is a real literal", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const spans = spanIndex(program);
    const a = asPoint(attrChain(program, view, view.display.ops, 0, "anchor"));
    for (const t of [...a.x.terms, ...a.y.terms]) {
      expect(spans.has(t.lit)).toBe(true);
    }
  });
});
