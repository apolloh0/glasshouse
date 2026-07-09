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
import { STAGE_HEIGHT, STAGE_WIDTH, type DisplayOp } from "../render/displayList.js";
import { showValue } from "./format.js";

export type Glyph =
  | { kind: "figure"; text: string }
  | { kind: "swatch"; rgb: number }
  | { kind: "tick"; deg: number } // field name fixed to match this header
                                  // and tests/glyphs.test.ts (decision D34)
  | { kind: "dot"; x: number; y: number };

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function valueGlyph(v: Value): Glyph {
  switch (v.t) {
    case "num": case "bool": case "str":
      return { kind: "figure", text: showValue(v) };
    case "color":
      return { kind: "swatch", rgb: v.rgb };
    case "angle":
      return { kind: "tick", deg: v.deg };
    case "point":
      return { kind: "dot", x: clamp01(v.x / STAGE_WIDTH), y: clamp01(v.y / STAGE_HEIGHT) };
  }
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function opBounds(ops: readonly DisplayOp[]): Bounds | null {
  if (ops.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (ax: number, ay: number, bx: number, by: number): void => {
    if (ax < x0) x0 = ax;
    if (ay < y0) y0 = ay;
    if (bx > x1) x1 = bx;
    if (by > y1) y1 = by;
  };
  for (const op of ops) {
    switch (op.kind) {
      case "circle": grow(op.cx - op.r, op.cy - op.r, op.cx + op.r, op.cy + op.r); break;
      case "ellipse": grow(op.cx - op.rx, op.cy - op.ry, op.cx + op.rx, op.cy + op.ry); break;
      case "rect": grow(op.x, op.y, op.x + op.w, op.y + op.h); break;
      case "triangle":
        grow(Math.min(op.ax, op.bx, op.cx), Math.min(op.ay, op.by, op.cy),
          Math.max(op.ax, op.bx, op.cx), Math.max(op.ay, op.by, op.cy));
        break;
      case "line":
        grow(Math.min(op.x1, op.x2), Math.min(op.y1, op.y2),
          Math.max(op.x1, op.x2), Math.max(op.y1, op.y2));
        break;
    }
  }
  return { x0, y0, x1, y1 };
}

export interface ThumbFit { scale: number; dx: number; dy: number }

export function thumbnailFit(
  ops: readonly DisplayOp[],
  w: number,
  h: number,
  pad = 2,
): ThumbFit | null {
  const b = opBounds(ops);
  if (!b) return null;
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  let scale: number;
  if (bw === 0 && bh === 0) scale = 1;
  else if (bw === 0) scale = (h - 2 * pad) / bh;
  else if (bh === 0) scale = (w - 2 * pad) / bw;
  else scale = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  if (scale > 1) scale = 1; // never magnify (D27)
  return {
    scale,
    dx: (w - scale * bw) / 2 - scale * b.x0,
    dy: (h - scale * bh) / 2 - scale * b.y0,
  };
}
