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
import { TODO } from "../util/todo.js";

export type AnnotationOp =
  | { kind: "marker"; x: number; y: number; label: string }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; label: string };

/** Annotations for one display op. Pure; exact expected outputs live in
 *  tests/annotate.test.ts. */
export function annotationsFor(op: DisplayOp): AnnotationOp[] {
  void op;
  TODO("P1-T5", "geometry per header rules");
}

/** "25" for 25, "12.50" for 12.5, "0" for -0. Shared by all labels. */
export function fmtNum(v: number): string {
  void v;
  TODO("P1-T5");
}
