// Guards the P2-T1 fingerprint contract: identity is structure + values,
// never ids or spans. Nodes are built by hand so this is green from day one
// (no parser dependency) — it is a guard, not a milestone.
import { describe, expect, it } from "vitest";
import type {
  BinOp, CallExpr, ExprStmt, NumberLit, Program, Span,
} from "../src/lang/ast.js";
import {
  fingerprintIndex, fingerprintNode, parentIndex, subtreeSizes,
} from "../src/lang/fingerprint.js";

let nextId = 0;
const sp = (start = 0, end = 1): Span => ({ start, end, line: 1, col: 1 });
const num = (value: number, span = sp()): NumberLit =>
  ({ kind: "number", id: nextId++, span, value });
const call = (callee: string, label: string, value: NumberLit): CallExpr =>
  ({ kind: "call", id: nextId++, span: sp(), callee,
     args: [{ label, labelSpan: sp(), value }] });
const stmt = (expr: CallExpr): ExprStmt =>
  ({ kind: "expr", id: nextId++, span: sp(), expr });
const bin = (op: BinOp["op"], left: NumberLit, right: NumberLit): BinOp =>
  ({ kind: "binop", id: nextId++, span: sp(), op, left, right });

describe("fingerprints (P2-T1 guard)", () => {
  it("ignores ids and spans", () => {
    expect(fingerprintNode(num(20, sp(0, 2))))
      .toBe(fingerprintNode(num(20, sp(90, 92))));
  });

  it("distinguishes values, kinds, labels, and child order", () => {
    expect(fingerprintNode(num(20))).not.toBe(fingerprintNode(num(21)));
    expect(fingerprintNode(call("circle", "radius", num(20))))
      .not.toBe(fingerprintNode(call("circle", "fill", num(20))));
    expect(fingerprintNode(call("circle", "radius", num(20))))
      .not.toBe(fingerprintNode(call("rect", "radius", num(20))));
    expect(fingerprintNode(bin("-", num(1), num(2))))
      .not.toBe(fingerprintNode(bin("-", num(2), num(1))));
  });

  it("indexes a whole program consistently with per-node fingerprints", () => {
    nextId = 0;
    const s = stmt(call("circle", "radius", num(20)));
    const program: Program = {
      items: [s], setup: [s], defs: new Map(), frames: [], events: [],
      source: "circle(radius: 20)", nodeCount: nextId,
    };
    const index = fingerprintIndex(program);
    expect(index.size).toBe(3);
    expect(index.get(s.id)).toBe(fingerprintNode(s));
    expect(index.get(s.expr.id)).toBe(fingerprintNode(s.expr));

    const sizes = subtreeSizes(program);
    expect(sizes.get(s.id)).toBe(3);
    expect(sizes.get(s.expr.id)).toBe(2);

    const parents = parentIndex(program);
    expect(parents.get(s.id)).toBe(-1); // virtual root
    expect(parents.get(s.expr.id)).toBe(s.id);
  });
});
