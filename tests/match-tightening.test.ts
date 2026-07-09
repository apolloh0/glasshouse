// D33 (reviewed ruling, Phase 2 closure) — pass-2 recovery requires equal
// callees for `call` nodes: a total line rewrite must drop+mint, never
// re-badge an unrelated call with a carried stable id. Added under the
// adding-tests-is-allowed ruling; never weaken.
import { describe, expect, it } from "vitest";
import { parse } from "../src/lang/parser.js";
import { IdTracker } from "../src/host/ids.js";
import { pathAt } from "../src/lang/walk.js";
import type { Program } from "../src/lang/ast.js";
import type { AnyNode } from "../src/lang/walk.js";

function nodeIn(program: Program, source: string, needle: string, kind: string): AnyNode {
  const path = pathAt(program, source.indexOf(needle));
  const hit = [...path].reverse().find((n) => n.kind === kind);
  expect(hit, kind + " at " + JSON.stringify(needle)).toBeTruthy();
  return hit!;
}

describe("D33 — call slots require equal callees", () => {
  it("a circle->rect line rewrite drops and mints the call and its arguments", () => {
    const a = "circle(radius: 9)\n";
    const b = "rect(width: 7)\n";
    const t = new IdTracker();
    const prev = parse(a);
    const r0 = t.advance(prev);
    const next = parse(b);
    const r1 = t.advance(next);

    const prevCall = nodeIn(prev, a, "circle", "call");
    const prevArg = nodeIn(prev, a, "9", "number");
    const nextCall = nodeIn(next, b, "rect", "call");
    const nextArg = nodeIn(next, b, "7", "number");

    // minted fresh in next…
    expect(r1.fresh.has(r1.stableOf.get(nextCall.id)!)).toBe(true);
    expect(r1.fresh.has(r1.stableOf.get(nextArg.id)!)).toBe(true);
    // …and the old identities dropped, not recycled
    expect(r1.dropped.has(r0.stableOf.get(prevCall.id)!)).toBe(true);
    expect(r1.dropped.has(r0.stableOf.get(prevArg.id)!)).toBe(true);
  });

  it("a same-callee argument rewrite still carries the call", () => {
    const a = "circle(radius: 9)\n";
    const b = "circle(fill: #112233)\n";
    const t = new IdTracker();
    const prev = parse(a);
    const r0 = t.advance(prev);
    const next = parse(b);
    const r1 = t.advance(next);
    expect(r1.stableOf.get(nodeIn(next, b, "circle", "call").id))
      .toBe(r0.stableOf.get(nodeIn(prev, a, "circle", "call").id));
  });
});
