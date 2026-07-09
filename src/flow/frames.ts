// CONTRACT (types + exact geometry of ghosting) — onion-skin and trails
// (plan R3: "see the whole arc"). PURE: these compute WHAT to draw; the
// studio composites. Ghosts never enter display lists, traces, or goldens
// (same principle as D13).
//
// SEMANTICS (P2-T5):
//
//  onionLayers — ghost frames around `current`, alphas pinned by distance
//  (D19): ALPHAS[d-1] for d = 1..3, at most 3 each side. Frames outside
//  [0, frameCount) are skipped; `current` itself is never included (the
//  caller draws it normally, last). RESULT ORDER IS PAINT ORDER: ascending
//  alpha (faintest first), and at equal alpha the BEFORE frame precedes the
//  AFTER frame. So onionLayers(10, 240) is exactly:
//    [ {frame:7,alpha:0.08}, {frame:13,alpha:0.08},
//      {frame:8,alpha:0.18}, {frame:12,alpha:0.18},
//      {frame:9,alpha:0.30}, {frame:11,alpha:0.30} ]
//
//  trailOps — the arc view: slices for frames current - i*stride for
//  i = length..1 (OLDEST FIRST = paint order), skipping frames < 0,
//  excluding `current`. Each slice carries the frame's full ops; the studio
//  chooses trail styling (the model stays data-only).

import type { DisplayList, DisplayOp } from "../render/displayList.js";

export const ALPHAS = [0.30, 0.18, 0.08] as const;

export interface GhostLayer {
  frame: number;
  alpha: number;
}

export function onionLayers(
  current: number,
  frameCount: number,
  before = 3,
  after = 3,
): GhostLayer[] {
  const layers: GhostLayer[] = [];
  // faintest first (descending distance); before precedes after at equal alpha
  for (let d = ALPHAS.length; d >= 1; d--) {
    const alpha = ALPHAS[d - 1]!;
    const b = current - d;
    if (d <= before && b >= 0 && b < frameCount) layers.push({ frame: b, alpha });
    const a = current + d;
    if (d <= after && a >= 0 && a < frameCount) layers.push({ frame: a, alpha });
  }
  return layers;
}

export interface TrailSlice {
  frame: number;
  ops: readonly DisplayOp[];
}

export function trailOps(
  getDisplay: (k: number) => DisplayList,
  current: number,
  length: number,
  stride: number,
): TrailSlice[] {
  const slices: TrailSlice[] = [];
  for (let i = length; i >= 1; i--) { // oldest first = paint order
    const frame = current - i * stride;
    if (frame < 0) continue;
    slices.push({ frame, ops: getDisplay(frame).ops });
  }
  return slices;
}
