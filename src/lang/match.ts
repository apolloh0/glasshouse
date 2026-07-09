// CONTRACT (types + algorithm spec) — stable identity across edits, the risk
// Phase 2 exists to retire (plan §8 "Node identity across edits").
//
// TWO ID LAYERS (D16). Per-parse pre-order ids (D7) stay exactly as they
// are — traces, goldens, and the engine never see anything else. StableIds
// are a second, editor-side layer: the timeline pane, scrubber anchors, and
// (Phase 3+) attached widgets key on stable ids so they survive re-parses.
//
// ALGORITHM (P2-T2) — GumTree-lite, two passes over (prev, next):
//
//  Pass 1, anchors (top-down): consider next-subtrees in DESCENDING subtree
//  size (ties: pre-order). For each, the candidate prev-subtrees are those
//  with an IDENTICAL fingerprint (fingerprint.ts) that are still unmatched;
//  pick the one whose span.start is closest to the next node's span.start
//  (ties: the earliest). Matching an anchor matches its ENTIRE subtree
//  pairwise (equal fingerprints => identical traversal shape).
//
//  Pass 2, containers (bottom-up, pre-order over still-unmatched next
//  nodes): let P = the match of the node's parent (top-level items use the
//  virtual root, which always "matches" itself — see parentIndex). Among
//  P's still-unmatched prev-children of the SAME KIND, pick the one with
//  the closest child index (ties: the earliest). Match just that node (not
//  its subtree), then recurse normally into children.
//
//  Everything still unmatched in next gets a FRESH stable id; fresh ids are
//  assigned in pre-order, starting at mintFrom. Prev stable ids that carried
//  to nothing are reported dropped.
//
// INVARIANTS (tests/match.test.ts enforces; violating any is a bug):
//  - total: every node id of `next` has a stable id;
//  - injective: no stable id maps to two next nodes;
//  - kind-preserving: a carried stable id refers to the same node kind in
//    prev and next — an honest full reset (all fresh) is ALWAYS preferred
//    over a cross-kind or otherwise doubtful match;
//  - deterministic: same inputs, same result, always.

import type { NodeId, Program } from "./ast.js";
import { children, visit, type AnyNode } from "./walk.js";
import { fingerprintIndex, subtreeSizes } from "./fingerprint.js";

export type StableId = number;

export interface MatchResult {
  /** Stable id for EVERY node id in `next` (totality). */
  stableOf: Map<NodeId, StableId>;
  /** Stable ids minted by this match. */
  fresh: Set<StableId>;
  /** Prev stable ids that matched nothing in next. */
  dropped: Set<StableId>;
  /** First unused stable id after this match (pass back as next mintFrom). */
  nextMint: number;
}

/** Per-program shape index: node objects, parent ids, child positions, and
 *  the virtual root's children (top-level items). Built once per side. */
interface Shape {
  byId: Map<NodeId, AnyNode>;
  parent: Map<NodeId, NodeId>;          // top-level items -> -1
  childIdx: Map<NodeId, number>;        // index among the parent's children
  childrenOf: Map<NodeId, NodeId[]>;    // -1 holds the top-level items
}

function shapeOf(program: Program): Shape {
  const byId = new Map<NodeId, AnyNode>();
  const parent = new Map<NodeId, NodeId>();
  const childIdx = new Map<NodeId, number>();
  const childrenOf = new Map<NodeId, NodeId[]>();
  visit(program, (node, p) => {
    byId.set(node.id, node);
    parent.set(node.id, p ? p.id : -1);
  });
  childrenOf.set(-1, program.items.map((item) => item.id));
  program.items.forEach((item, i) => childIdx.set(item.id, i));
  for (const node of byId.values()) {
    const kids = children(node);
    childrenOf.set(node.id, kids.map((k) => k.id));
    kids.forEach((kid, i) => childIdx.set(kid.id, i));
  }
  return { byId, parent, childIdx, childrenOf };
}

/** Pre-order node list of one subtree. */
function preorder(root: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  const rec = (n: AnyNode): void => {
    out.push(n);
    for (const kid of children(n)) rec(kid);
  };
  rec(root);
  return out;
}

export function matchPrograms(
  prev: Program | null,
  prevStable: ReadonlyMap<NodeId, StableId>,
  next: Program,
  mintFrom: number,
): MatchResult {
  const stableOf = new Map<NodeId, StableId>();
  const fresh = new Set<StableId>();
  const dropped = new Set<StableId>();
  let mint = mintFrom;

  const nextToPrev = new Map<NodeId, NodeId>();
  const matchedPrev = new Set<NodeId>();

  if (prev !== null) {
    const prevShape = shapeOf(prev);
    const nextShape = shapeOf(next);
    const prevFp = fingerprintIndex(prev);
    const nextFp = fingerprintIndex(next);
    const nextSize = subtreeSizes(next);

    // prev candidates per fingerprint, in pre-order (= ascending span.start)
    const byFp = new Map<number, NodeId[]>();
    for (let id = 0; id < prev.nodeCount; id++) {
      const fp = prevFp.get(id)!;
      const list = byFp.get(fp);
      if (list) list.push(id);
      else byFp.set(fp, [id]);
    }

    // ---- pass 1: fingerprint anchors, biggest next subtrees first ----
    const order: NodeId[] = [];
    for (let id = 0; id < next.nodeCount; id++) order.push(id);
    order.sort((a, b) => nextSize.get(b)! - nextSize.get(a)! || a - b);

    for (const id of order) {
      if (nextToPrev.has(id)) continue; // matched inside an earlier anchor
      const candidates = byFp.get(nextFp.get(id)!);
      if (!candidates) continue;
      const nextNode = nextShape.byId.get(id)!;
      const at = nextNode.span.start;
      // rank still-unmatched candidates by span distance, then position
      const ranked = candidates
        .filter((c) => !matchedPrev.has(c))
        .sort((a, b) => {
          const da = Math.abs(prevShape.byId.get(a)!.span.start - at);
          const db = Math.abs(prevShape.byId.get(b)!.span.start - at);
          return da - db || a - b;
        });
      for (const cand of ranked) {
        const nextNodes = preorder(nextNode);
        const prevNodes = preorder(prevShape.byId.get(cand)!);
        // Equal fingerprints imply identical shape; verify anyway — a hash
        // collision must degrade to "no anchor", never to a lying match.
        if (prevNodes.length !== nextNodes.length) continue;
        let ok = true;
        for (let i = 0; i < nextNodes.length; i++) {
          if (nextNodes[i]!.kind !== prevNodes[i]!.kind) { ok = false; break; }
        }
        if (!ok) continue;
        for (let i = 0; i < nextNodes.length; i++) {
          nextToPrev.set(nextNodes[i]!.id, prevNodes[i]!.id);
          matchedPrev.add(prevNodes[i]!.id);
        }
        break;
      }
    }

    // ---- pass 2: same-kind positional recovery under matched parents ----
    const prevOf = (nid: NodeId): NodeId | undefined =>
      nid === -1 ? -1 : nextToPrev.get(nid); // the virtual root matches itself
    for (let id = 0; id < next.nodeCount; id++) {
      if (nextToPrev.has(id)) continue;
      const prevParent = prevOf(nextShape.parent.get(id)!);
      if (prevParent === undefined) continue; // parent fresh -> node fresh
      const kind = nextShape.byId.get(id)!.kind;
      const myIdx = nextShape.childIdx.get(id)!;
      let best = -1;
      let bestDist = Infinity;
      for (const c of prevShape.childrenOf.get(prevParent) ?? []) {
        if (matchedPrev.has(c)) continue;
        if (prevShape.byId.get(c)!.kind !== kind) continue;
        const dist = Math.abs(prevShape.childIdx.get(c)! - myIdx);
        if (dist < bestDist || (dist === bestDist && (best === -1 || c < best))) {
          best = c;
          bestDist = dist;
        }
      }
      if (best !== -1) {
        nextToPrev.set(id, best);
        matchedPrev.add(best);
      }
    }

    // ---- dropped: prev nodes that carried to nothing ----
    for (let id = 0; id < prev.nodeCount; id++) {
      if (!matchedPrev.has(id)) {
        const s = prevStable.get(id);
        if (s !== undefined) dropped.add(s);
      }
    }
  }

  // ---- carry + mint (fresh ids in pre-order, D16) ----
  for (let id = 0; id < next.nodeCount; id++) {
    const from = nextToPrev.get(id);
    const carried = from === undefined ? undefined : prevStable.get(from);
    if (carried !== undefined) {
      stableOf.set(id, carried);
    } else {
      stableOf.set(id, mint);
      fresh.add(mint);
      mint++;
    }
  }
  return { stableOf, fresh, dropped, nextMint: mint };
}
