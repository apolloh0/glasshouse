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

export interface DisplayDiff {
  added: number[];              // indices into b
  removed: number[];            // indices into a
  changed: { a: number; b: number }[];
}

/** Occurrence-numbered identity key; stepIndex deliberately excluded. */
function identityKey(op: DisplayOp, seen: Map<string, number>): string {
  const base = op.kind + ":" + op.sourceNodeId;
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return base + "#" + n;
}

/** Every visual field of an op, stepIndex excluded (D28). */
function visualFields(op: DisplayOp): string {
  switch (op.kind) {
    case "circle": return op.cx + "," + op.cy + "," + op.r + "," + op.fill;
    case "ellipse": return op.cx + "," + op.cy + "," + op.rx + "," + op.ry + "," + op.fill;
    case "rect": return op.x + "," + op.y + "," + op.w + "," + op.h + "," + op.fill;
    case "triangle":
      return op.ax + "," + op.ay + "," + op.bx + "," + op.by + "," +
        op.cx + "," + op.cy + "," + op.fill;
    case "line": return op.x1 + "," + op.y1 + "," + op.x2 + "," + op.y2 + "," +
      op.stroke + "," + op.width;
  }
}

export function diffDisplay(
  a: readonly DisplayOp[],
  b: readonly DisplayOp[],
): DisplayDiff {
  const aByKey = new Map<string, number>();
  const aSeen = new Map<string, number>();
  for (let i = 0; i < a.length; i++) aByKey.set(identityKey(a[i]!, aSeen), i);

  const added: number[] = [];
  const removed: number[] = [];
  const changed: { a: number; b: number }[] = [];
  const matchedA = new Set<number>();
  const bSeen = new Map<string, number>();
  for (let j = 0; j < b.length; j++) {
    const key = identityKey(b[j]!, bSeen);
    const i = aByKey.get(key);
    if (i === undefined) {
      added.push(j);
    } else {
      matchedA.add(i);
      if (visualFields(a[i]!) !== visualFields(b[j]!)) changed.push({ a: i, b: j });
    }
  }
  for (let i = 0; i < a.length; i++) {
    if (!matchedA.has(i)) removed.push(i);
  }
  return { added, removed, changed };
}
