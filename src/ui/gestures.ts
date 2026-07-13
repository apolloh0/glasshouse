// CONTRACT (types + rules) — THE FIVE ABSTRACTION GESTURES (plan §4.5).
// Each is a PURE source-to-source transformation with one oracle: the
// picture may not change. serializeDisplayList(before) === after, over
// setup AND (for animated programs) a pinned frame run — byte equality,
// same seed (D50). The learner abstracts by pointing at concrete things;
// the program reorganizes; nothing visible moves.
//
// Secondary pin (D50): UNTOUCHED statements keep their stable ids across
// the gesture (IdTracker: fresh/dropped confined to the rewritten region)
// — panes must not flicker for code the gesture didn't touch.
//
// All gestures are STATIC (source + program; no trace needed). Results
// carry the new source plus a chip `note`. Failures return a friendly
// `reason` in diagnostics register (jargon ban applies — tested).
//
// THE RULES:
//
// nameThisNumber (D51) — a literal becomes a named thing. Emits a `state`
//   declaration (Chalk's ONE binding concept; bonus: the name appears in
//   the state panel immediately) directly after the last existing state
//   decl, else after the paper line, else line 1. The literal's use site
//   becomes the name. `name` must pass validName.
//
// connectNumbers (D52) — two literals begin to co-vary. Names litA as
//   `name` (per D51's placement), replaces litA with the name, and offers
//   CANDIDATES for litB, ranked:
//     equal values           -> [ same ]            (litB -> name)
//     ratio k = B/A with 2k an integer
//                            -> [ scale, offset ]   (name * k, name + d)
//     otherwise              -> [ offset ]          (name + d; d = B - A,
//                                                    name - |d| when d < 0)
//   Every candidate is independently oracle-clean by construction.
//
// repeatThis (D53) — k >= 2 SELECTED CONSECUTIVE sibling statements become
//   a loop. Unification: all instances structurally identical up to
//   NUMBER leaves; colors/angles/strings/bools/names/callees must match
//   exactly (friendly reason names the first mismatch). Each number
//   position must be constant, or exactly affine in the instance index:
//   v_j = base + (j-1)*step. Emits `repeat k as i:` with the body's
//   varying numbers rewritten per D56's canonical forms. Non-affine
//   spacing fails with the actual numbers in the message ("the gaps are
//   50, then 60 — repeat needs even steps").
//
// findRepeatRuns — suggestion scan: maximal runs (len >= 3) of consecutive
//   siblings that repeatThis would accept, longest first.
//
// teachThis (D54) — selected consecutive statements become a definition.
//   Requires the FIRST shape's anchor (ANCHOR_SOURCES) to be a pure point
//   literal (bx, by) — else reason. Emits, above the selection's parent
//   scope's first definition (or top of file after state decls):
//     to <name>(at: p):            // label "at", bind "p" — D37 pays off
//       ...body with every point literal (x, y) rewritten to
//          (p.x + dx, p.y + dy), dx = x-bx (dx == 0 -> just p.x)...
//     end
//   and replaces the selection with `<name>(at: (bx, by))`. Scalars are
//   untouched (parameterizing sizes is a follow-up gesture composition:
//   teach, then name inside the definition).
//
// openThisUp (D55) — the inverse: a call statement to a user definition
//   inlines its body with args substituted for binds. v1 requires every
//   argument to be a literal or bare name (else reason: the argument is
//   "too rich to open yet"). Substituting a POINT LITERAL into a member
//   access FOLDS it: p.x with p := (60, 80) becomes 60 — never emit
//   member-on-parenthesized-literal. Round trip is the pinned identity:
//   openThisUp(teachThis(S)) draws byte-identically to S.
//
// validName — a usable new name: identifier-shaped, not a keyword, not a
//   builtin, not already bound (state/def/param) in the program.

import type { NodeId, Program } from "../lang/ast.js";
import { TODO } from "../util/todo.js";

export interface GestureOk { ok: true; source: string; note: string }
export interface GestureNo { ok: false; reason: string }
export type GestureResult = GestureOk | GestureNo;

export function validName(program: Program, name: string): true | string {
  void program; void name;
  TODO("P5-T1");
}

export function nameThisNumber(
  source: string, program: Program, lit: NodeId, name: string,
): GestureResult {
  void source; void program; void lit; void name;
  TODO("P5-T1", "state-decl emission per D51");
}

export interface ConnectCandidate extends GestureOk {
  kind: "same" | "scale" | "offset";
}

export function connectNumbers(
  source: string, program: Program, litA: NodeId, litB: NodeId, name: string,
): { ok: true; candidates: ConnectCandidate[] } | GestureNo {
  void source; void program; void litA; void litB; void name;
  TODO("P5-T2", "candidate policy per D52");
}

export function repeatThis(
  source: string, program: Program, stmtIds: readonly NodeId[],
): GestureResult {
  void source; void program; void stmtIds;
  TODO("P5-T3", "affine unification per D53; forms per D56");
}

export function findRepeatRuns(
  program: Program,
): { stmts: NodeId[]; count: number }[] {
  void program;
  TODO("P5-T3");
}

export function teachThis(
  source: string, program: Program, stmtIds: readonly NodeId[], name: string,
): GestureResult {
  void source; void program; void stmtIds; void name;
  TODO("P5-T4", "anchor relativization per D54; bind = \"p\"");
}

export function openThisUp(
  source: string, program: Program, callStmt: NodeId,
): GestureResult {
  void source; void program; void callStmt;
  TODO("P5-T5", "substitution + point-member folding per D55");
}
