// CONTRACT + full implementation — structural fingerprints for AST subtrees.
// The anchor primitive for Phase 2 edit matching (P2-T2): two subtrees get
// the same fingerprint iff they are structurally identical INCLUDING literal
// values, names, operators, and argument labels — but EXCLUDING node ids and
// spans (position must never affect identity; position is only a tiebreak).
//
// Changing what counts as "salient" here changes which edits preserve stable
// ids — decision-log entry required.

import type { NodeId, Program } from "./ast.js";
import { children, visit, type AnyNode } from "./walk.js";
import { fnv1aString } from "../util/hash.js";

/** The per-kind scalar payload that participates in identity. */
function salient(node: AnyNode): string {
  switch (node.kind) {
    case "number": return String(node.value);
    case "angle":  return String(node.degrees);
    case "color":  return String(node.rgb);
    case "bool":   return String(node.value);
    case "string": return node.value;
    case "name":   return node.name;
    case "member": return node.member;
    case "binop":  return node.op;
    case "unary":  return node.op;
    case "call":   return node.callee + "(" + node.args.map((a) => a.label).join(",") + ")";
    case "point":  return "";
    case "state":  return node.name;
    case "assign": return "";
    case "expr":   return "";
    case "repeat": return node.counter ?? "";
    case "for":    return node.name + (node.step ? "/step" : "");
    case "if":     return node.else_ ? "/else" : "";
    case "group":  return "group(" + node.args.map((a) => a.label).join(",") + ")";
    case "return": return node.value ? "/value" : "";
    case "to":     return node.name + "(" + node.params.map((p) => p.name).join(",") + ")";
    case "frame":  return "";
    case "event":
      return node.event.kind === "pointer"
        ? "pointer/" + node.event.which
        : "key/" + node.event.key;
  }
}

/** Fingerprint of one subtree. Deterministic; ids/spans excluded. */
export function fingerprintNode(node: AnyNode): number {
  const kids = children(node).map(fingerprintNode);
  return fnv1aString(node.kind + "\x1f" + salient(node) + "\x1f" + kids.join(","));
}

/** NodeId -> fingerprint for every node, computed in one bottom-up pass. */
export function fingerprintIndex(program: Program): Map<NodeId, number> {
  const index = new Map<NodeId, number>();
  const rec = (node: AnyNode): number => {
    const kids = children(node).map(rec);
    const fp = fnv1aString(node.kind + "\x1f" + salient(node) + "\x1f" + kids.join(","));
    index.set(node.id, fp);
    return fp;
  };
  for (const item of program.items) rec(item);
  return index;
}

/** NodeId -> number of nodes in its subtree (self included). */
export function subtreeSizes(program: Program): Map<NodeId, number> {
  const sizes = new Map<NodeId, number>();
  const rec = (node: AnyNode): number => {
    let n = 1;
    for (const kid of children(node)) n += rec(kid);
    sizes.set(node.id, n);
    return n;
  };
  for (const item of program.items) rec(item);
  return sizes;
}

/** NodeId -> parent NodeId (top-level items map to -1, the virtual root). */
export function parentIndex(program: Program): Map<NodeId, NodeId> {
  const parents = new Map<NodeId, NodeId>();
  visit(program, (node, parent) => parents.set(node.id, parent ? parent.id : -1));
  return parents;
}
