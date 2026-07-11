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
import { visit, type AnyNode } from "../lang/walk.js";
import { decodeValue } from "../engine/values.js";
import { STEP_KIND } from "../engine/trace.js";
import { activeGroupsAt } from "./transform.js";

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

const isPoint = (c: Chain | PointChains): c is PointChains =>
  (c as PointChains).x !== undefined;

// ---------- trace + AST plumbing (cached per program) ----------

const nodeMaps = new WeakMap<Program, Map<NodeId, AnyNode>>();
function nodeMap(program: Program): Map<NodeId, AnyNode> {
  let m = nodeMaps.get(program);
  if (!m) {
    m = new Map();
    visit(program, (n) => m!.set(n.id, n));
    nodeMaps.set(program, m);
  }
  return m;
}

/** The recorded numeric value at a trace step (opaque atoms use this). */
function recordedNumber(view: TraceView, step: number): number {
  if (step < 0 || step >= view.trace.count) return 0;
  const row = view.trace.row(step);
  const v = decodeValue(row.valueTag, row.a, row.b, row.strIdx, (i) => view.trace.string(i));
  if (v === null) return 0;
  if (v.t === "num") return v.v;
  if (v.t === "angle") return v.deg;
  if (v.t === "bool") return v.v ? 1 : 0;
  return 0;
}

/** Largest expr-completion step of `nodeId` that is <= atStep (post-order
 *  makes this exactly the occurrence being reconstructed). */
function exprStepAtMost(view: TraceView, nodeId: NodeId, atStep: number): number {
  const trace = view.trace;
  const upper = Math.min(atStep, trace.count - 1);
  for (let s = upper; s >= 0; s--) {
    const row = trace.row(s);
    if (row.nodeId === nodeId && row.kind === STEP_KIND.expr) return s;
  }
  return -1;
}

/** The innermost call open at atStep, with the step of its callEnter. */
function innermostOpenCall(view: TraceView, atStep: number): { site: NodeId; enterStep: number } | null {
  const stack: { site: NodeId; enterStep: number }[] = [];
  const trace = view.trace;
  const last = Math.min(atStep, trace.count - 1);
  for (let s = 0; s <= last; s++) {
    const row = trace.row(s);
    if (row.kind === STEP_KIND.callEnter) stack.push({ site: row.nodeId, enterStep: s });
    else if (row.kind === STEP_KIND.callExit) stack.pop();
  }
  return stack.length > 0 ? stack[stack.length - 1]! : null;
}

/** a*b: opaque·termful scales; termful·termful is opaque at the traced value. */
function mulChains(L: Chain, R: Chain, tracedValue: number): Chain {
  const lOpaque = L.terms.length === 0;
  const rOpaque = R.terms.length === 0;
  if (lOpaque && rOpaque) return constChain(L.c * R.c);
  if (lOpaque) return scaleChain(R, L.c);
  if (rOpaque) return scaleChain(L, R.c);
  return constChain(tracedValue); // both carry terms -> opaque (D43)
}

/** a/b: scales by an opaque divisor; else opaque at the traced value. */
function divChains(L: Chain, R: Chain, tracedValue: number): Chain {
  if (R.terms.length === 0 && R.c !== 0) return scaleChain(L, 1 / R.c);
  return constChain(tracedValue);
}

/** The enclosing definition param a NameRef binds to (by `bind`), or null. */
function enclosingParam(program: Program, node: AnyNode, name: string): { label: string } | null {
  for (const def of program.defs.values()) {
    if (def.span.start <= node.span.start && node.span.end <= def.span.end) {
      const p = def.params.find((pp) => (pp.bind ?? "") === name);
      if (p) return { label: p.name };
    }
  }
  return null;
}

export function chainAt(
  program: Program,
  view: TraceView,
  node: NodeId,
  atStep: number,
): Chain | PointChains {
  const n = nodeMap(program).get(node);
  if (!n) return constChain(recordedNumber(view, atStep));

  switch (n.kind) {
    case "number": return litChain(n.id, n.value);
    case "angle": return constChain(n.degrees);
    case "color": return constChain(n.rgb);
    case "bool": return constChain(n.value ? 1 : 0);
    case "string": return constChain(0);

    case "point": {
      const xs = exprStepAtMost(view, n.x.id, atStep);
      const ys = exprStepAtMost(view, n.y.id, atStep);
      return {
        x: chainAt(program, view, n.x.id, xs) as Chain,
        y: chainAt(program, view, n.y.id, ys) as Chain,
      };
    }

    case "unary": {
      if (n.op === "-") {
        const os = exprStepAtMost(view, n.operand.id, atStep);
        return scaleChain(chainAt(program, view, n.operand.id, os) as Chain, -1);
      }
      return constChain(recordedNumber(view, atStep)); // `not` -> bool const
    }

    case "binop": {
      if (n.op === "+" || n.op === "-" || n.op === "*" || n.op === "/") {
        const ls = exprStepAtMost(view, n.left.id, atStep);
        const rs = exprStepAtMost(view, n.right.id, atStep);
        const L = chainAt(program, view, n.left.id, ls) as Chain;
        const R = chainAt(program, view, n.right.id, rs) as Chain;
        if (n.op === "+") return addChains(L, R, 1);
        if (n.op === "-") return addChains(L, R, -1);
        if (n.op === "*") return mulChains(L, R, recordedNumber(view, atStep));
        return divChains(L, R, recordedNumber(view, atStep));
      }
      return constChain(recordedNumber(view, atStep)); // comparison/and/or -> bool
    }

    case "name": {
      const param = enclosingParam(program, n, n.name);
      if (param) {
        const open = innermostOpenCall(view, atStep);
        if (open) {
          const callNode = nodeMap(program).get(open.site);
          if (callNode && callNode.kind === "call") {
            const arg = callNode.args.find((a) => a.label === param.label);
            if (arg) {
              const argStep = exprStepAtMost(view, arg.value.id, open.enterStep);
              return chainAt(program, view, arg.value.id, argStep);
            }
          }
        }
      }
      // counters, state vars, pointer, unresolved -> opaque const at value
      return constChain(recordedNumber(view, atStep));
    }

    case "member": {
      const os = exprStepAtMost(view, n.object.id, atStep);
      const obj = chainAt(program, view, n.object.id, os);
      if (isPoint(obj)) {
        if (n.member === "x") return obj.x;
        if (n.member === "y") return obj.y;
      }
      return constChain(recordedNumber(view, atStep)); // color parts, opaque objects
    }

    case "call": return constChain(recordedNumber(view, atStep)); // random / user value

    default: return constChain(recordedNumber(view, atStep));
  }
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

/** Canonical presentation order for an op-attribute chain's terms: by
 *  coefficient ascending, then lit id (D48). addChains merges by id ascending,
 *  but the attrChain ground truth pins the coefficient order (a subtracted
 *  term like `-h` reads before the term it adjusts). Order is presentation
 *  only — inversion ranks candidates by |Δlit| and source order (D45), never
 *  by this list — so re-presenting the merged terms changes no value. */
function canon(ch: Chain): Chain {
  return {
    terms: [...ch.terms].sort((x, y) => x.coeff - y.coeff || x.lit - y.lit),
    c: ch.c,
  };
}

/** Chain of a call argument (the arg completed just before the op's step). */
function argChain(
  program: Program, view: TraceView, call: { args: { label: string; value: { id: NodeId } }[] },
  label: string, atStep: number,
): Chain | PointChains {
  const arg = call.args.find((a) => a.label === label);
  if (!arg) return constChain(0);
  const step = exprStepAtMost(view, arg.value.id, atStep);
  return chainAt(program, view, arg.value.id, step);
}

export function attrChain(
  program: Program,
  view: TraceView,
  ops: readonly DisplayOp[],
  opIndex: number,
  attr: OpAttr,
): PointChains | Chain {
  const op = ops[opIndex]!;
  const step = op.stepIndex; // the emitting call's completion step in this trace
  const call = nodeMap(program).get(op.sourceNodeId);
  if (!call || call.kind !== "call") return constChain(0);
  // active group matrices as CONSTANTS (D44), outermost first
  const groups = activeGroupsAt(program, view, step);

  if (attr === "size") {
    // circle radius only (D46); scales by the net (constant) matrix scale
    const rch = argChain(program, view, call, "radius", step) as Chain;
    let sc = 1;
    for (const g of groups) sc *= Math.hypot(g.matrix.a, g.matrix.b);
    return canon(sc === 1 ? rch : scaleChain(rch, sc));
  }

  // anchor: map to the source arg(s) per ANCHOR_SOURCES, then apply matrices
  const src = ANCHOR_SOURCES[call.callee];
  let localX: Chain;
  let localY: Chain;
  if (src === undefined) {
    return { x: constChain((op as { cx?: number }).cx ?? 0), y: constChain(0) };
  }
  if (typeof src === "string") {
    const pc = argChain(program, view, call, src, step);
    if (isPoint(pc)) { localX = pc.x; localY = pc.y; }
    else { localX = pc; localY = constChain(0); }
  } else {
    // rect: [left, top] — two scalar args (lowered rect's `a` corner too)
    localX = argChain(program, view, call, src[0], step) as Chain;
    localY = argChain(program, view, call, src[1], step) as Chain;
  }

  // world = M_outer · ... · M_inner · local; apply innermost first (D44)
  let chx = localX;
  let chy = localY;
  for (let i = groups.length - 1; i >= 0; i--) {
    const m = groups[i]!.matrix;
    const nx = addChains(addChains(scaleChain(chx, m.a), scaleChain(chy, m.c)), constChain(m.e));
    const ny = addChains(addChains(scaleChain(chx, m.b), scaleChain(chy, m.d)), constChain(m.f));
    chx = nx;
    chy = ny;
  }
  return { x: canon(chx), y: canon(chy) };
}
