// P4b-T3 — inversion. The scalar block pins the D45 policy with hand
// numbers; the rest solves real drags on real traces, with the prediction
// oracle applied throughout: apply, re-run, land where pointed.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { IdTracker } from "../src/host/ids.js";
import { applyCandidate, dragCandidates, scalarCandidates } from "../src/flow/invert.js";
import type { Chain } from "../src/flow/provenance.js";

const vals = new Map<number, number>([[3, 20], [7, 55], [9, 220]]);
const valueOf = (id: number) => vals.get(id)!;

describe("scalarCandidates (P4b-T3, D45)", () => {
  const chain: Chain = { terms: [{ lit: 3, coeff: 1 }, { lit: 7, coeff: 3 }], c: 0 };

  it("solves per term and ranks by |Δlit| ascending", () => {
    expect(scalarCandidates(chain, valueOf, 30)).toEqual([
      { lit: 7, from: 55, to: 65 },   // Δ10 — the gentle edit first
      { lit: 3, from: 20, to: 50 },   // Δ30
    ]);
  });

  it("ties break by source order; zero delta and opaque chains yield nothing", () => {
    const tie: Chain = { terms: [{ lit: 3, coeff: 2 }, { lit: 7, coeff: 2 }], c: 0 };
    expect(scalarCandidates(tie, valueOf, 10).map((e) => e.lit)).toEqual([3, 7]);
    expect(scalarCandidates(chain, valueOf, 0)).toEqual([]);
    expect(scalarCandidates({ terms: [], c: 9 }, valueOf, 5)).toEqual([]);
  });
});

describe("dragCandidates + applyCandidate (P4b-T3)", () => {
  it("house drag: two honest answers, gentlest first, prediction holds for BOTH", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const ops = view.display.ops;
    const before = (ops[4] as { x: number }).x; // house #3's rect

    const solve = dragCandidates(program, view, ops, 4, 30, 0);
    expect(solve.unadjustable).toEqual([]);
    expect(solve.candidates.length).toBe(2);
    expect(solve.candidates[0]!.edits).toEqual([{ lit: solve.candidates[0]!.edits[0]!.lit, from: 55, to: 65 }]);
    expect(solve.candidates[1]!.edits[0]!.from).toBe(20);

    for (const cand of solve.candidates) {
      const after = applyCandidate(src, program, cand);
      const newOps = new Session(after, 42).traceSetup().display.ops;
      expect((newOps[4] as { x: number }).x).toBeCloseTo(before + 30, 6);
      const t = new IdTracker();
      t.advance(parse(src));
      const r = t.advance(parse(after));
      expect(r.fresh.size + r.dropped.size).toBe(0);
    }
  });

  it("the 55-edit moves every house; the 20-edit moves them all equally", () => {
    const src = readFileSync("examples/house-row.chalk", "utf8");
    const program = parse(src);
    const view = new Session(src, 42).traceSetup();
    const ops = view.display.ops;
    const xs = [0, 2, 4, 6, 8].map((i) => (ops[i] as { x: number }).x);

    const solve = dragCandidates(program, view, ops, 4, 30, 0);
    const spread = applyCandidate(src, program, solve.candidates[0]!); // 55 -> 65
    const sOps = new Session(spread, 42).traceSetup().display.ops;
    const sXs = [0, 2, 4, 6, 8].map((i) => (sOps[i] as { x: number }).x);
    expect(sXs[0]! - xs[0]!).toBeCloseTo(10, 6);   // house 1: Δ55 * 1
    expect(sXs[4]! - xs[4]!).toBeCloseTo(50, 6);   // house 5: Δ55 * 5

    const shift = applyCandidate(src, program, solve.candidates[1]!);  // 20 -> 50
    const hOps = new Session(shift, 42).traceSetup().display.ops;
    for (const i of [0, 2, 4, 6, 8]) {
      expect((hOps[i] as { x: number }).x - (ops[i] as { x: number }).x).toBeCloseTo(30, 6);
    }
  });

  it("opaque axes lock: the ball drags in x only", () => {
    const src = readFileSync("examples/bouncing-ball.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(2);
    const solve = dragCandidates(program, view, view.display.ops, 0, 25, -40);
    expect(solve.unadjustable).toEqual(["y"]);
    expect(solve.candidates.length).toBe(1);
    expect(solve.candidates[0]!.edits).toEqual([
      { lit: solve.candidates[0]!.edits[0]!.lit, from: 160, to: 185 },
    ]);
  });

  it("rotated drag: a pinwheel blade lands where pointed, through the matrix", () => {
    const src = readFileSync("examples/pinwheel.chalk", "utf8");
    const program = parse(src);
    const session = new Session(src, 42);
    session.advanceFrames(3);
    const view = session.traceAt(2);
    const ops = view.display.ops;
    const ci = ops.findIndex((o) => o.kind === "circle");
    const before = ops[ci] as { cx: number; cy: number };

    const solve = dragCandidates(program, view, ops, ci, 12, -7);
    expect(solve.candidates.length).toBeGreaterThan(0);
    const after = applyCandidate(src, program, solve.candidates[0]!);

    const s2 = new Session(after, 42);
    s2.advanceFrames(3);
    const nOp = s2.traceAt(2).display.ops[ci] as { cx: number; cy: number };
    // snapping both literals to step 1 can displace the world point by at
    // most |M|·(0.5,0.5): allow 1.0 px
    expect(Math.abs(nOp.cx - (before.cx + 12))).toBeLessThanOrEqual(1.0);
    expect(Math.abs(nOp.cy - (before.cy - 7))).toBeLessThanOrEqual(1.0);
  });
});
