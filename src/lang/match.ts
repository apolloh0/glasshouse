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
import { TODO } from "../util/todo.js";

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

export function matchPrograms(
  prev: Program | null,
  prevStable: ReadonlyMap<NodeId, StableId>,
  next: Program,
  mintFrom: number,
): MatchResult {
  void prev; void prevStable; void next; void mintFrom;
  TODO("P2-T2", "two-pass matching per this header");
}
