// CONTRACT (types + reconstruction rules) — PROVENANCE: where did this
// number come from? A Chain writes a runtime value as an affine combination
// of source literals: value = Σ coeff·lit + c. Phase 4b's entire direct-
// manipulation story stands on this file.
//
// ARCHITECTURE (D43): provenance is POST-HOC. The evaluator and tracer are
// untouched — Phase 0 already recorded every expression completion with its
// value, so chains are reconstructed by a pure bottom-up walk of the AST
// using the trace's recorded operand values to make the affine/opaque
// calls. Zero new tracing; the 3.81 ms instrumented cost stays 3.81 ms.
//
// CHAIN ALGEBRA (implemented below — these ARE the semantics):
//   const(v)                 -> { terms: [], c: v }        (opaque atom)
//   lit(id, v)               -> { terms: [{lit:id, coeff:1}], c: 0 }
//   add / sub                -> merge terms, add c        (drop coeff==0)
//   scale(ch, k)             -> coeff*k, c*k
//   PRODUCT RULE: a*b with BOTH chains carrying terms -> opaque const(a·b).
//     (3 * 3 is opaque on purpose: affine discipline over cleverness.)
//   DIVISION: a/b -> scale(a, 1/b) iff b is opaque; else opaque.
//
// chainAt(program, view, node, atStep) — P4b-T1 — the chain of expression
// `node` for the evaluation whose completion is the LARGEST step <= atStep
// (post-order makes that exactly the right occurrence). Atom rules:
//   NumberLit                -> lit(id, value)
//   Angle/Color/Bool/String  -> const (not draggable axes)
//   NameRef:
//     repeat/for counter     -> const(recorded value)
//     state var              -> const(recorded value)   (cross-frame = 4c)
//     DEFINITION PARAM       -> CHASE THE CALL SITE: callStackAt(view,
//       atStep) gives the innermost open call; its arg whose label matches
//       the param resolves via chainAt(argExpr, step of that callEnter's
//       neighborhood) — the arg completed just before the enter row. THIS
//       is what makes `rect(left: base.x, ...)` inside `to house` carry
//       the caller's `(20 + i * 55, 220)` chain. Recurse through nested
//       calls, innermost outward.
//   random(...)/pointer.*    -> const(recorded value)
//   PointLit                 -> a PAIR of chains (see PointChains)
//   Member .x/.y             -> the component chain of a point-valued
//     object (PointLit / param-chased point); opaque object -> const.
//
// attrChain(program, view, ops, opIndex, attr) — P4b-T2 — the chain of a
// DISPLAY OP's attribute, in WORLD coordinates. Source mapping is the
// pinned ANCHOR_SOURCES table; then compose the active group matrices at
// the op's step (activeGroupsAt, outermost·...·innermost) treating matrix
// entries as CONSTANTS (D44): dragging a rotated blade edits the blade's
// literals, never the rotation angle. world_x = a·chx + c·chy + const(e).
// Lowered rects (triangle ops whose source call is `rect`, D36): the `a`
// corner maps to (left, top).

import type { NodeId, Program } from "../lang/ast.js";
import type { DisplayOp } from "../render/displayList.js";
import type { TraceView } from "../host/run.js";
import { TODO } from "../util/todo.js";

export interface Term { lit: NodeId; coeff: number }
export interface Chain { terms: Term[]; c: number }

export const constChain = (v: number): Chain => ({ terms: [], c: v });
export const litChain = (id: NodeId, v: number): Chain =>
  ({ terms: [{ lit: id, coeff: 1 }], c: (void v, 0) }); // c is 0; the lit itself carries v
export const isOpaque = (ch: Chain): boolean => ch.terms.length === 0;

export function addChains(a: Chain, b: Chain, sign: 1 | -1 = 1): Chain {
  const m = new Map<NodeId, number>();
  for (const t of a.terms) m.set(t.lit, t.coeff);
  for (const t of b.terms) m.set(t.lit, (m.get(t.lit) ?? 0) + sign * t.coeff);
  const terms = [...m.entries()]
    .filter(([, coeff]) => coeff !== 0)
    .map(([lit, coeff]) => ({ lit, coeff }))
    .sort((x, y) => x.lit - y.lit);
  return { terms, c: a.c + sign * b.c };
}

export function scaleChain(ch: Chain, k: number): Chain {
  if (k === 0) return constChain(0);
  return {
    terms: ch.terms.map((t) => ({ lit: t.lit, coeff: t.coeff * k })),
    c: ch.c * k,
  };
}

/** Evaluate a chain against literal values (the consistency identity:
 *  chainValue(chain, litValueOf) must equal the traced value). */
export function chainValue(ch: Chain, litValueOf: (id: NodeId) => number): number {
  let v = ch.c;
  for (const t of ch.terms) v += t.coeff * litValueOf(t.lit);
  return v;
}

export interface PointChains { x: Chain; y: Chain }

export function chainAt(
  program: Program,
  view: TraceView,
  node: NodeId,
  atStep: number,
): Chain | PointChains {
  void program; void view; void node; void atStep;
  TODO("P4b-T1", "post-hoc reconstruction per header rules");
}

/** Pinned mapping: which call argument feeds an op's anchor. */
export const ANCHOR_SOURCES: Readonly<Record<string, string | [string, string]>> = {
  circle: "center",
  ellipse: "center",
  rect: ["left", "top"],
  line: "from",
  triangle: "a",
};

export type OpAttr = "anchor" | "size"; // size: circle radius only in 4b

export function attrChain(
  program: Program,
  view: TraceView,
  ops: readonly DisplayOp[],
  opIndex: number,
  attr: OpAttr,
): PointChains | Chain {
  void program; void view; void ops; void opIndex; void attr;
  TODO("P4b-T2", "ANCHOR_SOURCES + active matrices as constants (D44)");
}
