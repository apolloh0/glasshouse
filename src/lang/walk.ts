// CONTRACT + full implementation — the canonical AST traversal.
//
// This file DEFINES pre-order for Glasshouse: nodeIds.ts (T2) must assign ids
// using visit() so that ids, the trace store's node references, and every UI
// feature that walks the tree agree on one ordering. Child order is source
// order. Changing child order here invalidates node ids and golden traces —
// decision-log entry required.

import type {
  Definition, EventBlock, Expr, FrameBlock, NodeId, Program, Span, Stmt,
} from "./ast.js";

/** Every AST node that carries an id and a span. */
export type AnyNode = Expr | Stmt | Definition | FrameBlock | EventBlock;

/** Pre-order visit of every node in the program, in source order. */
export function visit(
  program: Program,
  fn: (node: AnyNode, parent: AnyNode | null) => void,
): void {
  for (const item of program.items) visitNode(item, null, fn);
}

function visitNode(
  node: AnyNode,
  parent: AnyNode | null,
  fn: (node: AnyNode, parent: AnyNode | null) => void,
): void {
  fn(node, parent);
  const kids = children(node);
  for (const kid of kids) visitNode(kid, node, fn);
}

/** Direct children of a node, in source order. */
export function children(node: AnyNode): AnyNode[] {
  switch (node.kind) {
    // ----- expressions -----
    case "number": case "angle": case "color": case "bool":
    case "string": case "name":
      return [];
    case "point":  return [node.x, node.y];
    case "member": return [node.object];
    case "binop":  return [node.left, node.right];
    case "unary":  return [node.operand];
    case "call":   return node.args.map((a) => a.value);
    // ----- statements -----
    case "state":  return [node.init];
    case "assign": return [node.target, node.value];
    case "expr":   return [node.expr];
    case "repeat": return [node.count, ...node.body];
    case "for":
      return node.step
        ? [node.from, node.to, node.step, ...node.body]
        : [node.from, node.to, ...node.body];
    case "if":
      return node.else_
        ? [node.cond, ...node.then, ...node.else_]
        : [node.cond, ...node.then];
    case "return": return node.value ? [node.value] : [];
    case "group":  return [...node.args.map((a) => a.value), ...node.body];
    // ----- top level -----
    case "to":     return [...node.body];
    case "frame":  return [...node.body];
    case "event":  return [...node.body];
  }
}

/** NodeId -> Span for every node in the program. */
export function spanIndex(program: Program): Map<NodeId, Span> {
  const index = new Map<NodeId, Span>();
  visit(program, (n) => index.set(n.id, n.span));
  return index;
}

/** Nodes whose span contains `offset` (start <= offset < end), outermost
 *  first. The last element is the innermost node under the cursor. Empty if
 *  the offset falls between top-level items (blank lines, etc.). */
export function pathAt(program: Program, offset: number): AnyNode[] {
  const path: AnyNode[] = [];
  visit(program, (n) => {
    if (n.span.start <= offset && offset < n.span.end) path.push(n);
  });
  return path;
}
