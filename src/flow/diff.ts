// CONTRACT (types + matching rule) — what changed between two frames
// (deferred from Phase 2). PURE over op arrays; the studio highlights.
//
// MATCHING RULE (P3-T4, D28): ops pair up by (kind, sourceNodeId,
// occurrence#) — the n-th circle from THIS call in frame A matches the n-th
// circle from the same call in frame B. Matched pairs whose fields differ
// (comparing every field EXCEPT stepIndex — step numbering may shift when
// unrelated code runs; visual identity must not care) are `changed`.
// Unmatched A-ops are `removed`, unmatched B-ops `added`, both ascending.
// A moved shape is therefore CHANGED, never removed+added — motion is
// change, which is exactly what the diff view wants to say.

import type { DisplayOp } from "../render/displayList.js";
import { TODO } from "../util/todo.js";

export interface DisplayDiff {
  added: number[];              // indices into b
  removed: number[];            // indices into a
  changed: { a: number; b: number }[];
}

export function diffDisplay(
  a: readonly DisplayOp[],
  b: readonly DisplayOp[],
): DisplayDiff {
  void a; void b;
  TODO("P3-T4", "match by (kind, sourceNodeId, occurrence); ignore stepIndex");
}
