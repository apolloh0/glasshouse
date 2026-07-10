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
import { ChalkError } from "../lang/diagnostics.js";
import { parse } from "../lang/parser.js";
import { evalFrame, NO_INPUT, runSetup } from "../engine/frame.js";
import { BUILTINS } from "../engine/stdlib.js";
import type { Value } from "../engine/values.js";
import { showValue } from "./format.js";

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

/** The full default-args statement for a builtin (D38): stdlib dflt where
 *  present, else FALLBACK_DEFAULTS by type — both via showValue, whose
 *  output is valid Chalk. Shared with the palette (one source of text). */
export function defaultStatementFor(name: string): string | null {
  const spec = BUILTINS.get(name);
  if (!spec || (spec.kind !== "draw" && spec.kind !== "paper")) return null;
  const args = spec.params.map((p) => {
    const v: Value = p.dflt ?? (FALLBACK_DEFAULTS[
      p.type === "num" ? "num"
      : p.type === "point" ? "point"
      : p.type === "color" ? "color"
      : p.type === "angle" ? "angle"
      : "str"] as Value);
    return p.label + ": " + showValue(v);
  });
  return name + "(" + args.join(", ") + ")";
}

/** The word (name characters) ending at `offset`, for prefix filtering. */
function prefixAt(source: string, offset: number): string {
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(source[start - 1]!)) start--;
  return source.slice(start, offset);
}

/** True when the prefix's start sits at the beginning of a line's content. */
function atStatementStart(source: string, offset: number): boolean {
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(source[start - 1]!)) start--;
  for (let i = start - 1; i >= 0; i--) {
    const ch = source[i]!;
    if (ch === "\n") return true;
    if (ch !== " ") return false;
  }
  return true; // start of the document
}

export function completionsAt(
  program: Program | null,
  source: string,
  offset: number,
): Completion[] {
  if (!atStatementStart(source, offset)) return [];
  const prefix = prefixAt(source, offset);

  const out: Completion[] = [];
  for (const [name, spec] of BUILTINS) {
    if (spec.kind !== "draw") continue;
    out.push({ label: name, insert: defaultStatementFor(name)!, kind: "builtin" });
  }
  out.push({ label: "paper", insert: defaultStatementFor("paper")!, kind: "builtin" });
  if (program) {
    for (const item of program.items) {
      if (item.kind !== "to") continue;
      const args = item.params.map((p) => p.name + ": 0").join(", ");
      out.push({ label: item.name, insert: item.name + "(" + args + ")", kind: "definition" });
    }
  }
  for (const t of CONSTRUCT_TEMPLATES) {
    out.push({ label: t.label, insert: t.insert, kind: "construct" });
  }
  return prefix === "" ? out : out.filter((c) => c.label.startsWith(prefix));
}

export type Preview =
  | { ok: true; display: DisplayList }
  | { ok: false; error: Diagnostic };

export function previewFor(source: string, seed: number): Preview {
  // Session-isolated on purpose (D38): engine functions on fresh state — no
  // History, no live Session, nothing shared with the caller's world.
  try {
    const program = parse(source);
    const { state, staticLayer } = runSetup(program, seed);
    if (program.frames.length === 0 && program.events.length === 0) {
      return { ok: true, display: { bg: staticLayer.bg, ops: staticLayer.ops } };
    }
    const result = evalFrame(program, staticLayer, state, NO_INPUT, "fast");
    return { ok: true, display: result.display };
  } catch (e) {
    if (e instanceof ChalkError) return { ok: false, error: e.diagnostic };
    throw e; // non-Chalk exceptions are bugs
  }
}
