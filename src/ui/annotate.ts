// CONTRACT (types + geometry rules) — on-canvas argument annotation (plan
// R2: "show the data ON the picture"). PURE geometry: DisplayOp in,
// AnnotationOps out. apps/studio draws them on an overlay canvas; they are
// NEVER part of the program's display list (decision D13).
//
// Geometry rules (P1-T5). Labels always include the live value, formatted by
// fmtNum (integers bare, else 2 decimals, -0 normalized to 0):
//   circle   marker at (cx,cy) "center (cx, cy)";
//            arrow (cx,cy)->(cx+r,cy) "radius R"
//   ellipse  marker at center "center (cx, cy)";
//            arrow center->(cx+rx,cy) "width W" (W = 2*rx);
//            arrow center->(cx,cy+ry) "height H" (H = 2*ry)
//   rect     marker at (x,y) "left X, top Y";
//            arrow (x,y)->(x+w,y) "width W"; arrow (x,y)->(x,y+h) "height H"
//   line     marker at each end: "from (x1, y1)", "to (x2, y2)"
//   triangle marker per corner: "a (ax, ay)", "b (bx, by)", "c (cx, cy)"
// Order within the result array follows the order given above.

import type { DisplayOp } from "../render/displayList.js";

export type AnnotationOp =
  | { kind: "marker"; x: number; y: number; label: string }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; label: string };

const pt = (x: number, y: number): string => "(" + fmtNum(x) + ", " + fmtNum(y) + ")";

/** Annotations for one display op. Pure; exact expected outputs live in
 *  tests/annotate.test.ts. */
export function annotationsFor(op: DisplayOp): AnnotationOp[] {
  switch (op.kind) {
    case "circle":
      return [
        { kind: "marker", x: op.cx, y: op.cy, label: "center " + pt(op.cx, op.cy) },
        { kind: "arrow", x1: op.cx, y1: op.cy, x2: op.cx + op.r, y2: op.cy, label: "radius " + fmtNum(op.r) },
      ];
    case "ellipse":
      return [
        { kind: "marker", x: op.cx, y: op.cy, label: "center " + pt(op.cx, op.cy) },
        { kind: "arrow", x1: op.cx, y1: op.cy, x2: op.cx + op.rx, y2: op.cy, label: "width " + fmtNum(2 * op.rx) },
        { kind: "arrow", x1: op.cx, y1: op.cy, x2: op.cx, y2: op.cy + op.ry, label: "height " + fmtNum(2 * op.ry) },
      ];
    case "rect":
      return [
        { kind: "marker", x: op.x, y: op.y, label: "left " + fmtNum(op.x) + ", top " + fmtNum(op.y) },
        { kind: "arrow", x1: op.x, y1: op.y, x2: op.x + op.w, y2: op.y, label: "width " + fmtNum(op.w) },
        { kind: "arrow", x1: op.x, y1: op.y, x2: op.x, y2: op.y + op.h, label: "height " + fmtNum(op.h) },
      ];
    case "line":
      return [
        { kind: "marker", x: op.x1, y: op.y1, label: "from " + pt(op.x1, op.y1) },
        { kind: "marker", x: op.x2, y: op.y2, label: "to " + pt(op.x2, op.y2) },
      ];
    case "triangle":
      return [
        { kind: "marker", x: op.ax, y: op.ay, label: "a " + pt(op.ax, op.ay) },
        { kind: "marker", x: op.bx, y: op.by, label: "b " + pt(op.bx, op.by) },
        { kind: "marker", x: op.cx, y: op.cy, label: "c " + pt(op.cx, op.cy) },
      ];
  }
}

/** "25" for 25, "12.50" for 12.5, "0" for -0. Shared by all labels. */
export function fmtNum(v: number): string {
  const n = Object.is(v, -0) ? 0 : v;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
