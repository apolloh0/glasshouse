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
import { children, visit } from "../lang/walk.js";
import { maskedFingerprintNode } from "../lang/fingerprint.js";
import { KEYWORDS } from "../lang/tokens.js";
import { BUILTINS } from "../engine/stdlib.js";
import { affineText, numText, pointText, splice } from "./synth.js";
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

/** Pre-order number-literal nodes of a subtree. */
function numbersOf(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  const rec = (n: AnyNode): void => {
    if (n.kind === "number") out.push(n);
    for (const c of children(n)) rec(c);
  };
  rec(node);
  return out;
}

/** The first non-number difference between two structurally-similar nodes,
 *  named in learner words — or null if they differ only in numbers. */
function firstDiff(a: AnyNode, b: AnyNode): string | null {
  if (a.kind !== b.kind) return "the shapes are built differently";
  switch (a.kind) {
    case "number": return null; // numbers are allowed to vary
    case "color": return a.rgb !== (b as typeof a).rgb ? "the color" : null;
    case "angle": return a.degrees !== (b as typeof a).degrees ? "the angle" : null;
    case "string": return a.value !== (b as typeof a).value ? "the text" : null;
    case "bool": return a.value !== (b as typeof a).value ? "the true/false" : null;
    case "name": return a.name !== (b as typeof a).name ? "the name `" + a.name + "`" : null;
    case "member":
      if (a.member !== (b as typeof a).member) return "the `." + a.member + "` part";
      break;
    case "call": {
      const bc = b as typeof a;
      if (a.callee !== bc.callee) return "the shape `" + a.callee + "`";
      if (a.args.length !== bc.args.length ||
          a.args.some((x, i) => x.label !== bc.args[i]!.label)) return "the labels";
      break;
    }
    case "binop":
      if (a.op !== (b as typeof a).op) return "the `" + a.op + "`";
      break;
    case "unary":
      if (a.op !== (b as typeof a).op) return "the `" + a.op + "`";
      break;
    default: break;
  }
  const ak = children(a), bk = children(b);
  if (ak.length !== bk.length) return "the shapes are built differently";
  for (let i = 0; i < ak.length; i++) {
    const d = firstDiff(ak[i]!, bk[i]!);
    if (d) return d;
  }
  return null;
}

/** Unify k statements up to numbers, returning the rewritten single body
 *  (numbers replaced by their affine/constant forms) or a friendly decline. */
function analyzeRun(stmts: AnyNode[], source: string): { ok: true; body: string } | GestureNo {
  const k = stmts.length;
  if (k < 2) return { ok: false, reason: "Pick at least two shapes to repeat." };
  const fp0 = maskedFingerprintNode(stmts[0]!);
  for (let j = 1; j < k; j++) {
    if (maskedFingerprintNode(stmts[j]!) !== fp0) {
      const what = firstDiff(stmts[0]!, stmts[j]!) ?? "the shapes";
      return { ok: false, reason: "These shapes aren't all the same — " + what +
        " changes. Repeat needs them identical except for numbers." };
    }
  }
  const numberLists = stmts.map(numbersOf); // equal length (masked-fp identical)
  const L = numberLists[0]!.length;
  const forms: string[] = [];
  for (let p = 0; p < L; p++) {
    const values = numberLists.map((nl) => (nl[p]! as { value: number }).value);
    const base = values[0]!;
    const step = values[1]! - base;
    let affine = true;
    for (let j = 0; j < k; j++) {
      if (Math.abs(values[j]! - (base + j * step)) > 1e-9) { affine = false; break; }
    }
    if (!affine) {
      const gaps: string[] = [];
      for (let j = 1; j < k; j++) gaps.push(numText(values[j]! - values[j - 1]!));
      return { ok: false, reason: "These aren't evenly spaced — the gaps are " +
        gaps.join(", then ") + ". Repeat needs even steps." };
    }
    forms.push(affineText(base, step));
  }
  const start = stmts[0]!.span.start;
  let body = source.slice(start, stmts[0]!.span.end);
  const edits = numberLists[0]!.map((n, p) => ({
    start: n.span.start - start, end: n.span.end - start, text: forms[p]!,
  }));
  for (const e of edits.sort((x, y) => y.start - x.start)) {
    body = splice(body, e.start, e.end, e.text);
  }
  return { ok: true, body };
}

export function repeatThis(
  source: string, program: Program, stmtIds: readonly NodeId[],
): GestureResult {
  const nodes = nodeMap(program);
  const stmts = stmtIds.map((id) => nodes.get(id)).filter((n): n is AnyNode => n !== undefined);
  if (stmts.length !== stmtIds.length) return { ok: false, reason: "Pick shapes to repeat." };
  const sorted = [...stmts].sort((a, b) => a.span.start - b.span.start);
  const r = analyzeRun(sorted, source);
  if (!r.ok) return r;
  const k = sorted.length;
  const indented = r.body.split("\n").map((l) => "  " + l).join("\n");
  const loopText = "repeat " + k + " as i:\n" + indented;
  return {
    ok: true,
    source: splice(source, sorted[0]!.span.start, sorted[k - 1]!.span.end, loopText),
    note: "rolled " + k + " shapes into a loop",
  };
}

/** Every list of consecutive statement siblings (top level + each block). */
function siblingLists(program: Program): AnyNode[][] {
  const lists: AnyNode[][] = [program.items as AnyNode[]];
  visit(program, (n) => {
    if (n.kind === "frame" || n.kind === "event" || n.kind === "to" ||
        n.kind === "group" || n.kind === "repeat" || n.kind === "for") {
      lists.push(n.body);
    } else if (n.kind === "if") {
      lists.push(n.then);
      if (n.else_) lists.push(n.else_);
    }
  });
  return lists;
}

export function findRepeatRuns(
  program: Program,
): { stmts: NodeId[]; count: number }[] {
  const source = program.source;
  const runs: { stmts: NodeId[]; count: number }[] = [];
  for (const sibs of siblingLists(program)) {
    let i = 0;
    while (i < sibs.length) {
      const fp = maskedFingerprintNode(sibs[i]!);
      let j = i + 1;
      while (j < sibs.length && maskedFingerprintNode(sibs[j]!) === fp) j++;
      const run = sibs.slice(i, j);
      if (run.length >= 3 && analyzeRun(run, source).ok) {
        runs.push({ stmts: run.map((n) => n.id), count: run.length });
      }
      i = j;
    }
  }
  runs.sort((a, b) => b.count - a.count); // longest first
  return runs;
}

// D46/D54: which call argument(s) anchor each shape (mirrors provenance's
// ANCHOR_SOURCES; src/ui may not import src/flow, so it is pinned here too).
const ANCHOR_SOURCES: Readonly<Record<string, string | [string, string]>> = {
  circle: "center", ellipse: "center", rect: ["left", "top"], line: "from", triangle: "a",
};

/** The first shape's literal anchor (bx, by), or null if it isn't a plain
 *  point of number literals (D54 requires one). */
function shapeAnchor(call: AnyNode & { kind: "call" }): { bx: number; by: number } | null {
  const src = ANCHOR_SOURCES[call.callee];
  if (src === undefined) return null;
  const argVal = (label: string): AnyNode | null =>
    call.args.find((a) => a.label === label)?.value ?? null;
  if (typeof src === "string") {
    const pt = argVal(src);
    if (!pt || pt.kind !== "point" || pt.x.kind !== "number" || pt.y.kind !== "number") return null;
    return { bx: pt.x.value, by: pt.y.value };
  }
  const lx = argVal(src[0]);
  const ty = argVal(src[1]);
  if (!lx || lx.kind !== "number" || !ty || ty.kind !== "number") return null;
  return { bx: lx.value, by: ty.value };
}

/** `p.axis`, `p.axis + d`, or `p.axis - |d|` (dx == 0 folds to `p.axis`). */
const memberText = (axis: "x" | "y", d: number): string =>
  d === 0 ? "p." + axis : d > 0 ? "p." + axis + " + " + numText(d) : "p." + axis + " - " + numText(-d);

/** Literal points (both coords are number leaves) inside a subtree, pre-order. */
function litPointsOf(node: AnyNode): AnyNode[] {
  const out: AnyNode[] = [];
  const rec = (n: AnyNode): void => {
    if (n.kind === "point" && n.x.kind === "number" && n.y.kind === "number") { out.push(n); return; }
    for (const c of children(n)) rec(c);
  };
  rec(node);
  return out;
}

/** The def-placement offset: above the first existing definition, else after
 *  the last state decl / paper (D54). */
function defPlacement(source: string, program: Program): number {
  if (program.defs.size > 0) {
    let min = Infinity;
    for (const d of program.defs.values()) min = Math.min(min, d.span.start);
    return source.lastIndexOf("\n", min - 1) + 1;
  }
  return stateInsertOffset(source, program);
}

export function teachThis(
  source: string, program: Program, stmtIds: readonly NodeId[], name: string,
): GestureResult {
  const check = validName(program, name);
  if (check !== true) return { ok: false, reason: check };
  const nodes = nodeMap(program);
  const stmts = stmtIds.map((id) => nodes.get(id)).filter((n): n is AnyNode => n !== undefined);
  if (stmts.length === 0) return { ok: false, reason: "Pick shapes to teach." };
  const sorted = [...stmts].sort((a, b) => a.span.start - b.span.start);
  const first = sorted[0]!;
  const call = first.kind === "expr" ? first.expr : null;
  if (!call || call.kind !== "call") return { ok: false, reason: "Teach a group of shapes." };
  const anchor = shapeAnchor(call);
  if (!anchor) {
    return { ok: false, reason: "The first shape needs a plain point to anchor to — give it numbers, not a computed spot." };
  }

  // Each body statement, with every literal point relativized to `p` (D54).
  const relativize = (stmt: AnyNode): string => {
    const start = stmt.span.start;
    let text = source.slice(start, stmt.span.end);
    const edits = litPointsOf(stmt).map((pt) => {
      const p = pt as AnyNode & { kind: "point"; x: { value: number }; y: { value: number } };
      const rep = "(" + memberText("x", p.x.value - anchor.bx) + ", " +
        memberText("y", p.y.value - anchor.by) + ")";
      return { start: pt.span.start - start, end: pt.span.end - start, text: rep };
    });
    for (const e of edits.sort((a, b) => b.start - a.start)) text = splice(text, e.start, e.end, e.text);
    return text;
  };

  const body = sorted.map((s) => "  " + relativize(s)).join("\n");
  const defText = "to " + name + "(at: p):\n" + body + "\nend\n";
  const callText = name + "(at: " + pointText(anchor.bx, anchor.by) + ")";
  const placement = defPlacement(source, program);
  // replace the selection (higher offset) first, then insert the def (lower)
  let out = splice(source, sorted[0]!.span.start, sorted[sorted.length - 1]!.span.end, callText);
  out = splice(out, placement, placement, defText);
  return { ok: true, source: out, note: "taught " + name };
}

export function openThisUp(
  source: string, program: Program, callStmt: NodeId,
): GestureResult {
  const nodes = nodeMap(program);
  const stmt = nodes.get(callStmt);
  const call = stmt && stmt.kind === "expr" ? stmt.expr : null;
  if (!stmt || !call || call.kind !== "call") return { ok: false, reason: "Open up a shape you taught." };
  const def = program.defs.get(call.callee);
  if (!def) return { ok: false, reason: "`" + call.callee + "` isn't something you taught." };

  // bind -> arg; v1 only opens plain-value arguments (D55)
  const subst = new Map<string, AnyNode>();
  for (const param of def.params) {
    const arg = call.args.find((a) => a.label === param.name)?.value;
    const plain = arg && (
      arg.kind === "number" || arg.kind === "color" || arg.kind === "angle" ||
      arg.kind === "string" || arg.kind === "bool" || arg.kind === "name" ||
      (arg.kind === "point" && arg.x.kind === "number" && arg.y.kind === "number"));
    if (!plain) {
      return { ok: false, reason: "This `" + call.callee +
        "` has an input that's too rich to open yet — open works when the inputs are plain values." };
    }
    subst.set(param.bind ?? param.name, arg!);
  }

  // Inline each body statement with binds substituted; a point-literal bind
  // FOLDS through a member (`p.x` -> its component value), never emitting a
  // member on a parenthesized literal (D55).
  const inlineStmt = (bodyStmt: AnyNode): string => {
    const start = bodyStmt.span.start;
    let text = source.slice(start, bodyStmt.span.end);
    const edits: Edit[] = [];
    const rec = (n: AnyNode): void => {
      if (n.kind === "member" && n.object.kind === "name" && subst.has(n.object.name)) {
        const arg = subst.get(n.object.name)!;
        if (arg.kind === "point") {
          const comp = n.member === "x" ? arg.x : n.member === "y" ? arg.y : null;
          if (comp && comp.kind === "number") {
            edits.push({ start: n.span.start - start, end: n.span.end - start, text: numText(comp.value) });
            return;
          }
        }
      }
      if (n.kind === "name" && subst.has(n.name)) {
        const arg = subst.get(n.name)!;
        const repl = arg.kind === "point" && arg.x.kind === "number" && arg.y.kind === "number"
          ? pointText(arg.x.value, arg.y.value)
          : source.slice(arg.span.start, arg.span.end);
        edits.push({ start: n.span.start - start, end: n.span.end - start, text: repl });
        return;
      }
      for (const c of children(n)) rec(c);
    };
    rec(bodyStmt);
    for (const e of edits.sort((a, b) => b.start - a.start)) text = splice(text, e.start, e.end, e.text);
    return text;
  };

  const bodyText = def.body.map(inlineStmt).join("\n");
  const edits: Edit[] = [{ start: stmt.span.start, end: stmt.span.end, text: bodyText }];
  // If this was the definition's LAST call site, remove the now-unused def
  // (so open is the exact inverse of teach — the round-trip pin).
  let otherCalls = 0;
  visit(program, (n) => {
    if (n.kind === "call" && n.callee === call.callee && n.id !== call.id) otherCalls++;
  });
  if (otherCalls === 0) {
    edits.push({ start: def.span.start, end: lineEndAfter(source, def.span.end), text: "" });
  }
  return { ok: true, source: applyEdits(source, edits), note: "opened " + call.callee };
}
