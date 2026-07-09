// P2-T2 — stable ids across edits. Each scenario is one edit a learner
// actually makes; the invariants block at the bottom is non-negotiable
// (an honest reset always beats a wrong match).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { matchPrograms, type MatchResult } from "../src/lang/match.js";
import { IdTracker } from "../src/host/ids.js";
import { pathAt, visit } from "../src/lang/walk.js";
import type { AnyNode } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";

const ball = readFileSync("examples/bouncing-ball.chalk", "utf8");

/** advance() twice through a tracker; return both results + programs. */
function edit(prevSrc: string, nextSrc: string) {
  const t = new IdTracker();
  const prev = parse(prevSrc);
  const r0 = t.advance(prev);
  const next = parse(nextSrc);
  const r1 = t.advance(next);
  return { prev, next, r0, r1 };
}

function nodeIn(program: Program, source: string, needle: string, kind: string): AnyNode {
  const path = pathAt(program, source.indexOf(needle));
  const hit = [...path].reverse().find((n) => n.kind === kind);
  expect(hit, kind + " at " + JSON.stringify(needle)).toBeTruthy();
  return hit!;
}

describe("stable ids across edits (P2-T2)", () => {
  it("first parse mints pre-order stable ids", () => {
    const t = new IdTracker();
    const p = parse(ball);
    const r = t.advance(p);
    expect(r.stableOf.size).toBe(p.nodeCount);
    expect(r.fresh.size).toBe(p.nodeCount);
    expect(r.dropped.size).toBe(0);
    for (let id = 0; id < p.nodeCount; id++) expect(r.stableOf.get(id)).toBe(id);
  });

  it("editing one literal preserves every stable id, including the literal's", () => {
    const nextSrc = ball.replace("radius: 20", "radius: 35");
    const { prev, next, r0, r1 } = edit(ball, nextSrc);
    expect(r1.fresh.size).toBe(0);
    expect(r1.dropped.size).toBe(0);
    const litPrev = nodeIn(prev, ball, "20, fill", "number");
    const litNext = nodeIn(next, nextSrc, "35, fill", "number");
    expect(r1.stableOf.get(litNext.id)).toBe(r0.stableOf.get(litPrev.id));
  });

  it("inserting a statement is pure addition", () => {
    const nextSrc = ball + "  line(from: (0, 0), to: (10, 10))\n";
    const { prev, r1 } = edit(ball, nextSrc);
    expect(r1.dropped.size).toBe(0);
    expect(r1.stableOf.size - r1.fresh.size).toBe(prev.nodeCount);
  });

  it("deleting a statement drops exactly its subtree", () => {
    const nextSrc = ball.replace("    speed = 0 - speed * 0.85\n", "");
    const { prev, next, r1 } = edit(ball, nextSrc);
    expect(r1.fresh.size).toBe(0);
    expect(r1.dropped.size).toBe(prev.nodeCount - next.nodeCount);
  });

  it("reordering distinct statements preserves both", () => {
    const a = "circle(radius: 9)\nrect(width: 7)\n";
    const b = "rect(width: 7)\ncircle(radius: 9)\n";
    const { prev, next, r0, r1 } = edit(a, b);
    expect(r1.fresh.size).toBe(0);
    const cPrev = nodeIn(prev, a, "circle", "call");
    const cNext = nodeIn(next, b, "circle", "call");
    expect(r1.stableOf.get(cNext.id)).toBe(r0.stableOf.get(cPrev.id));
  });

  it("duplicating a line keeps the original's id; the copy is fresh", () => {
    const a = "circle(radius: 9)\n";
    const b = "circle(radius: 9)\ncircle(radius: 9)\n";
    const { prev, next, r0, r1 } = edit(a, b);
    const origPrev = nodeIn(prev, a, "circle", "call");
    const first = nodeIn(next, b, "circle", "call"); // indexOf finds line 1
    expect(r1.stableOf.get(first.id)).toBe(r0.stableOf.get(origPrev.id));
    expect(r1.fresh.size).toBe(next.nodeCount - prev.nodeCount);
  });

  it("renaming a variable everywhere preserves statement identity", () => {
    const nextSrc = ball.replace(/\by\b/g, "h");
    const { r1 } = edit(ball, nextSrc);
    expect(r1.fresh.size).toBe(0);
    expect(r1.dropped.size).toBe(0);
  });

  it("failed-parse turns are the studio's problem, not the tracker's (mint monotonic)", () => {
    const t = new IdTracker();
    t.advance(parse("circle(radius: 9)\n"));
    const r = t.advance(parse("rect(width: 7)\n")); // total rewrite
    for (const f of r.fresh) expect(r.dropped.has(f)).toBe(false); // no id reuse
  });
});

describe("matching invariants (never negotiable)", () => {
  function kinds(p: Program): Map<number, string> {
    const m = new Map<number, string>();
    visit(p, (n) => m.set(n.id, n.kind));
    return m;
  }

  function checkInvariants(prev: Program, r0: MatchResult, next: Program, r1: MatchResult): void {
    // total
    expect(r1.stableOf.size).toBe(next.nodeCount);
    // injective
    expect(new Set(r1.stableOf.values()).size).toBe(r1.stableOf.size);
    // kind-preserving
    const prevKindOfStable = new Map<number, string>();
    const kPrev = kinds(prev);
    for (const [nid, sid] of r0.stableOf) prevKindOfStable.set(sid, kPrev.get(nid)!);
    const kNext = kinds(next);
    for (const [nid, sid] of r1.stableOf) {
      if (r1.fresh.has(sid)) continue;
      expect(kNext.get(nid), "stable id " + sid + " changed kind").toBe(prevKindOfStable.get(sid));
    }
  }

  it("hold under a wholesale rewrite (honest reset allowed, lies not)", () => {
    const house = readFileSync("examples/house-row.chalk", "utf8");
    const { prev, next, r0, r1 } = edit(ball, house);
    checkInvariants(prev, r0, next, r1);
  });

  it("hold under a small edit, deterministically", () => {
    const nextSrc = ball.replace("0.5", "0.75");
    const { prev, next, r0, r1 } = edit(ball, nextSrc);
    checkInvariants(prev, r0, next, r1);
    const again = matchPrograms(prev, r0.stableOf, next, r0.nextMint);
    expect(again.stableOf).toEqual(r1.stableOf);
    expect(again.fresh).toEqual(r1.fresh);
    expect(again.dropped).toEqual(r1.dropped);
  });
});
