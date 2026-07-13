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

import type { AnyNode } from "../lang/walk.js";
import type { NodeId, Program } from "../lang/ast.js";
import { visit } from "../lang/walk.js";
import { KEYWORDS } from "../lang/tokens.js";
import { BUILTINS } from "../engine/stdlib.js";
import { numText, splice } from "./synth.js";
import { TODO } from "../util/todo.js";

export interface GestureOk { ok: true; source: string; note: string }
export interface GestureNo { ok: false; reason: string }
export type GestureResult = GestureOk | GestureNo;

const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS);

/** NodeId -> node for the whole program (built per call; programs are small). */
function nodeMap(program: Program): Map<NodeId, AnyNode> {
  const m = new Map<NodeId, AnyNode>();
  visit(program, (n) => m.set(n.id, n));
  return m;
}

/** Position just after the newline ending the line that contains `pos`. */
function lineEndAfter(source: string, pos: number): number {
  const nl = source.indexOf("\n", pos);
  return nl === -1 ? source.length : nl + 1;
}

interface Edit { start: number; end: number; text: string }

/** Apply edits in descending-span order so earlier offsets stay valid. */
function applyEdits(source: string, edits: Edit[]): string {
  let out = source;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = splice(out, e.start, e.end, e.text);
  }
  return out;
}

/** `name + d` / `name - |d|` — a co-varying offset (D52). */
function offsetText(name: string, d: number): string {
  return d < 0 ? name + " - " + numText(-d) : name + " + " + numText(d);
}

/** Where a new `state` decl goes (D51): after the last state decl, else
 *  after the paper line, else the top of the file. */
function stateInsertOffset(source: string, program: Program): number {
  const decls = program.setup.filter((s) => s.kind === "state");
  if (decls.length > 0) return lineEndAfter(source, decls[decls.length - 1]!.span.end);
  const paper = program.setup.find(
    (s) => s.kind === "expr" && s.expr.kind === "call" && s.expr.callee === "paper");
  return paper ? lineEndAfter(source, paper.span.end) : 0;
}

export function validName(program: Program, name: string): true | string {
  if (!/^[A-Za-z_]\w*$/.test(name)) {
    return "A name starts with a letter and uses letters, numbers, or _.";
  }
  if (KEYWORD_SET.has(name)) return "`" + name + "` is a word Chalk already uses.";
  if (BUILTINS.has(name)) return "`" + name + "` is already a shape.";
  for (const s of program.setup) {
    if (s.kind === "state" && s.name === name) return "`" + name + "` is already taken.";
  }
  if (program.defs.has(name)) return "`" + name + "` is already taken.";
  for (const def of program.defs.values()) {
    for (const p of def.params) {
      if (p.name === name || p.bind === name) return "`" + name + "` is already taken.";
    }
  }
  return true;
}

export function nameThisNumber(
  source: string, program: Program, lit: NodeId, name: string,
): GestureResult {
  const check = validName(program, name);
  if (check !== true) return { ok: false, reason: check };
  const node = nodeMap(program).get(lit);
  if (!node || node.kind !== "number") {
    return { ok: false, reason: "Pick a number to give a name." };
  }
  const declOffset = stateInsertOffset(source, program);
  const declText = "state " + name + " = " + numText(node.value) + "\n";
  // Splice the use site first (higher offset), then insert the decl (lower
  // offset stays valid). D51: the picture cannot move — placement after the
  // last state decl keeps evaluation order.
  let out = splice(source, node.span.start, node.span.end, name);
  out = splice(out, declOffset, declOffset, declText);
  return { ok: true, source: out, note: "named " + numText(node.value) + " as " + name };
}

export interface ConnectCandidate extends GestureOk {
  kind: "same" | "scale" | "offset";
}

export function connectNumbers(
  source: string, program: Program, litA: NodeId, litB: NodeId, name: string,
): { ok: true; candidates: ConnectCandidate[] } | GestureNo {
  const check = validName(program, name);
  if (check !== true) return { ok: false, reason: check };
  const nodes = nodeMap(program);
  const a = nodes.get(litA);
  const b = nodes.get(litB);
  if (!a || a.kind !== "number" || !b || b.kind !== "number") {
    return { ok: false, reason: "Pick two numbers to connect." };
  }
  const A = a.value;
  const B = b.value;
  const declOffset = stateInsertOffset(source, program);
  const declText = "state " + name + " = " + numText(A) + "\n";

  // Every candidate: name litA (state decl + use site), then rewrite litB.
  const build = (kind: ConnectCandidate["kind"], litBText: string, note: string): ConnectCandidate => ({
    ok: true, kind, note,
    source: applyEdits(source, [
      { start: declOffset, end: declOffset, text: declText },
      { start: a.span.start, end: a.span.end, text: name },
      { start: b.span.start, end: b.span.end, text: litBText },
    ]),
  });

  let candidates: ConnectCandidate[];
  if (B === A) {
    candidates = [build("same", name, "same as " + name)];
  } else if (A !== 0 && Number.isInteger((2 * B) / A)) {
    const k = B / A;
    const d = B - A;
    candidates = [
      build("scale", name + " * " + numText(k), name + " * " + numText(k)),
      build("offset", offsetText(name, d), offsetText(name, d)),
    ];
  } else {
    const d = B - A;
    candidates = [build("offset", offsetText(name, d), offsetText(name, d))];
  }
  return { ok: true, candidates };
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
