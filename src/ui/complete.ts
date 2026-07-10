// CONTRACT (types + rules) — create by reacting, part 1 (plan §4.4):
// completions are COMPLETE RUNNABLE STATEMENTS with every argument
// pre-filled, and each is speculatively executed for a live stage preview
// BEFORE the learner commits. PURE; src/editor + studio wire it into
// CodeMirror autocomplete.
//
// RULES (P4a-T4, D38):
//
//  completionsAt(program, source, offset) — offered when the cursor sits in
//  a statement position (start of line content; mid-word extends left).
//  The word prefix filters case-sensitively by name start. Candidates:
//    - every "draw" builtin and `paper`, as a full call: each param becomes
//      `label: TEXT` where TEXT = showValue(dflt) when the stdlib has one,
//      else showValue(FALLBACK_DEFAULTS[type]). showValue output is valid
//      Chalk for every value type — the vocabulary is its own syntax.
//    - every user definition in `program` (null program -> none), args
//      defaulted to `0` (types unknown; the preview may error — listed
//      anyway, the learner reacts to the error message too).
//    - the constructs in CONSTRUCT_TEMPLATES.
//  Order: draw builtins (stdlib order), paper, user defs (source order),
//    constructs. `label` is the bare name; `insert` the full text.
//
//  previewFor(source, seed) — parse + setup + (exactly one NO_INPUT frame
//  iff the program has frame/event blocks). Fully session-isolated: fresh
//  state, no History, no live Session touched, ChalkErrors returned as
//  { error }, non-Chalk exceptions rethrown (bugs). The studio calls this
//  with the CANDIDATE INSERTED to live-swap previews while arrowing.

import type { Program } from "../lang/ast.js";
import type { DisplayList } from "../render/displayList.js";
import type { Diagnostic } from "../lang/diagnostics.js";
import { TODO } from "../util/todo.js";

/** Per-type argument fallbacks (D38) — the plan's own example values. */
export const FALLBACK_DEFAULTS = {
  num: { t: "num", v: 40 },
  point: { t: "point", x: 160, y: 120 },
  color: { t: "color", rgb: 0x888888 },
  angle: { t: "angle", deg: 45 },
  bool: { t: "bool", v: true },
  str: { t: "str", v: "" },
} as const;

/** Construct templates (D38). \n and two-space indents; cursor placement is
 *  an editor concern, not encoded here. */
export const CONSTRUCT_TEMPLATES: readonly { label: string; insert: string }[] = [
  { label: "repeat", insert: "repeat 5 as i:\n  " },
  { label: "if", insert: "if i > 3:\n  " },
  { label: "every frame", insert: "every frame:\n  " },
  { label: "when pointer", insert: "when pointer pressed:\n  " },
  { label: "state", insert: "state x = 0" },
  { label: "to", insert: "to part(at: p):\n  \nend" },
  { label: "group", insert: "group(rotate: 45°, around: (160, 120)):\n  " },
];

export interface Completion {
  label: string;
  insert: string;
  kind: "builtin" | "definition" | "construct";
}

export function completionsAt(
  program: Program | null,
  source: string,
  offset: number,
): Completion[] {
  void program; void source; void offset;
  TODO("P4a-T4", "candidates + prefix filter per header");
}

export type Preview =
  | { ok: true; display: DisplayList }
  | { ok: false; error: Diagnostic };

export function previewFor(source: string, seed: number): Preview {
  void source; void seed;
  TODO("P4a-T4", "session-isolated setup + <=1 frame per header");
}
