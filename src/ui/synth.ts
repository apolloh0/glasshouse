// CONTRACT + P5-T0 stubs — SOURCE SYNTHESIS: the one place gesture output
// text comes from. Style rules (D56) are pinned so synthesized code is
// indistinguishable from a careful learner's:
//   numbers via showValue; points "(x, y)"; two-space indents; one space
//   after label colons; affine loop forms canonical and SIMPLIFIED:
//     step == 0                 -> "B"            (a plain literal)
//     base == 0, step == 1      -> "i - 1"
//     base == 0                 -> "(i - 1) * S"
//     base == step              -> "i * S"
//     otherwise                 -> "B + (i - 1) * S"
//   (negative step: "B - (i - 1) * |S|").
// exprText covers exactly what gestures emit — it is NOT a general
// pretty-printer; unchanged code is always preserved by span splicing,
// never re-printed (D50's untouched-id pin depends on it).

import { TODO } from "../util/todo.js";

export function affineText(base: number, step: number): string {
  void base; void step;
  TODO("P5-T0", "canonical simplified forms per header");
}

export function pointText(x: number, y: number): string {
  void x; void y;
  TODO("P5-T0");
}

/** Splice replacement of [start, end) with text; the workhorse every
 *  gesture routes edits through (descending-span order for multi-edits). */
export function splice(
  source: string, start: number, end: number, text: string,
): string {
  void source; void start; void end; void text;
  TODO("P5-T0");
}
