// CONTRACT (types + geometry) — values drawn AS THEMSELVES (plan §4.3):
// colors are swatches, angles are oriented ticks, points are position dots,
// numbers/strings/bools are figures. Plus exact thumbnail fitting for
// shape-producing cells: thumbnails are computed from the display list ops
// (D27) — real geometry scaled down, never a re-drawn approximation.
//
// Pinned rules (P3-T1):
//   valueGlyph
//     num/bool/string -> { kind:"figure", text: showValue(v) }
//     color           -> { kind:"swatch", rgb }
//     angle           -> { kind:"tick", deg }
//     point           -> { kind:"dot", x, y } with x,y STAGE-NORMALIZED to
//                        0..1 (x/STAGE_WIDTH, y/STAGE_HEIGHT), clamped.
//   opBounds — geometric bounding box of ops (stroke width ignored, pinned):
//     circle cx±r / cy±r; ellipse cx±rx / cy±ry; rect x..x+w, y..y+h;
//     triangle and line: min/max of their points. null for zero ops.
//   thumbnailFit(ops, w, h, pad=2) — uniform scale
//     s = min((w-2*pad)/bw, (h-2*pad)/bh), CAPPED AT 1 (never magnify);
//     degenerate boxes: bw==0 -> use bh alone (and vice versa); both zero
//     -> s=1. dx/dy center the scaled box: dx = (w - s*bw)/2 - s*x0.
//     Render as: opX' = op.x * s + dx.

import type { Value } from "../engine/values.js";
import type { DisplayOp } from "../render/displayList.js";
import { TODO } from "../util/todo.js";

export type Glyph =
  | { kind: "figure"; text: string }
  | { kind: "swatch"; rgb: number }
  | { kind: "tick"; degrees: number }
  | { kind: "dot"; x: number; y: number };

export function valueGlyph(v: Value): Glyph {
  void v;
  TODO("P3-T1", "glyph mapping per header");
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function opBounds(ops: readonly DisplayOp[]): Bounds | null {
  void ops;
  TODO("P3-T1");
}

export interface ThumbFit { scale: number; dx: number; dy: number }

export function thumbnailFit(
  ops: readonly DisplayOp[],
  w: number,
  h: number,
  pad = 2,
): ThumbFit | null {
  void ops; void w; void h; void pad;
  TODO("P3-T1", "uniform fit per header");
}
