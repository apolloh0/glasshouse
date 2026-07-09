// CONTRACT (types + mapping rules) — cross-highlighting is two PURE
// functions over (display list, program). No DOM here; src/editor/ and
// apps/studio own presentation.
//
// Definitions (P1-T4):
//   code -> stage: an op is SELECTED by a source span S iff
//     (a) the span of the op's sourceNodeId (the draw call) intersects S, or
//     (b) S intersects a call site whose callee resolves — transitively
//         through user definitions — to the Definition that lexically
//         contains the op's sourceNodeId.
//     (b) is a STATIC approximation, on purpose: selecting one house(...)
//     call site selects every house's ops across all iterations. Attributing
//     ops to one specific call/iteration needs the trace and is Phase 2.
//   stage -> code: the span to highlight for an op is the span of its
//     sourceNodeId (the draw call that emitted it), always a single call.
//
// staticOps (setup drawing, decision D5) participate exactly like frame ops:
// the display list a caller passes in is the FULL per-frame list, with op
// indices matching what renderDisplayList draws.

import type { Definition, NodeId, Program, Span } from "../lang/ast.js";
import { children, visit, type AnyNode } from "../lang/walk.js";
import type { DisplayOp } from "../render/displayList.js";

interface NodeIndex {
  byId: Map<NodeId, AnyNode>;
  parent: Map<NodeId, AnyNode | null>;
}

function indexNodes(program: Program): NodeIndex {
  const byId = new Map<NodeId, AnyNode>();
  const parent = new Map<NodeId, AnyNode | null>();
  visit(program, (node, p) => {
    byId.set(node.id, node);
    parent.set(node.id, p);
  });
  return { byId, parent };
}

const intersects = (a: Span, s: { start: number; end: number }): boolean =>
  a.start < s.end && s.start < a.end;

/** The Definition that lexically contains `node`, or null at top level. */
function containingDef(idx: NodeIndex, node: AnyNode): Definition | null {
  let cur: AnyNode | null = node;
  while (cur) {
    if (cur.kind === "to") return cur;
    cur = idx.parent.get(cur.id) ?? null;
  }
  return null;
}

/** Op indices (into `ops`) that a selection of `span` should light up. */
export function opsForSpan(
  ops: readonly DisplayOp[],
  program: Program,
  span: { start: number; end: number },
): number[] {
  const idx = indexNodes(program);

  // (b) call sites intersecting the selection -> the definitions they reach.
  // A definition's HEADER (`to house(at: base, ...)`) reads as a call site to
  // itself: selecting the signature selects what the definition makes, while
  // selecting inside the body stays per-call (pinned by tests/link.test.ts).
  const selectedDefs = new Set<Definition>();
  const queue: string[] = [];
  visit(program, (node) => {
    if (node.kind === "call" && intersects(node.span, span)) queue.push(node.callee);
    if (node.kind === "to") {
      const headerEnd = node.body[0]!.span.start;
      if (intersects({ ...node.span, end: headerEnd }, span)) queue.push(node.name);
    }
  });
  while (queue.length > 0) {
    const def = program.defs.get(queue.pop()!);
    if (!def || selectedDefs.has(def)) continue;
    selectedDefs.add(def);
    for (const stmt of def.body) {
      visitCalls(stmt, (callee) => queue.push(callee));
    }
  }

  const out: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    const node = idx.byId.get(ops[i]!.sourceNodeId);
    if (!node) continue;
    if (intersects(node.span, span)) { out.push(i); continue; } // (a)
    const def = containingDef(idx, node);
    if (def && selectedDefs.has(def)) out.push(i); // (b)
  }
  return out;
}

/** Every call callee inside a subtree. */
function visitCalls(root: AnyNode, fn: (callee: string) => void): void {
  const stack: AnyNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "call") fn(node.callee);
    stack.push(...children(node));
  }
}

/** Source span to highlight when hovering op `opIndex`; null if the op's
 *  sourceNodeId is unknown to this program (should not happen in Phase 1). */
export function spanForOp(
  ops: readonly DisplayOp[],
  program: Program,
  opIndex: number,
): Span | null {
  const op = ops[opIndex];
  if (!op) return null;
  const idx = indexNodes(program);
  const node = idx.byId.get(op.sourceNodeId);
  return node ? node.span : null;
}

/** All node ids on the path from a node to its top-level item, inclusive.
 *  Helper contract for opsForSpan; implement with walk.ts. */
export function ancestorIds(program: Program, id: NodeId): NodeId[] {
  const idx = indexNodes(program);
  const out: NodeId[] = [];
  let cur: AnyNode | null = idx.byId.get(id) ?? null;
  while (cur) {
    out.push(cur.id);
    cur = idx.parent.get(cur.id) ?? null;
  }
  return out;
}
