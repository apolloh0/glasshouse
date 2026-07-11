// CONTRACT (types + policy) — INVERSION: turn a drag on the stage into
// candidate literal edits, honestly. The policy below (D45) is the whole
// disambiguation story; the correctness oracle is PREDICTION CONSISTENCY:
// apply a candidate, re-run, and the dragged attribute sits where the
// pointer pointed (within snapping). Never a clever edit that lands
// elsewhere.
//
// POLICY (D45):
//  scalarCandidates(chain, valueOf, delta) — one candidate per term with
//    coeff != 0: to = from + delta/coeff. Sorted by |to - from| ASCENDING
//    (the gentlest edit first), ties by source order (lit node id).
//    Opaque chain -> []. delta == 0 -> [].
//  dragCandidates(...) — solve x and y independently from attrChain
//    "anchor"; an axis with an opaque chain is reported in `unadjustable`
//    and produces no edits (the studio locks the drag to the live axis).
//    Zero-delta axes contribute no edits. Candidates = the per-axis
//    solutions cross-paired, capped at 6, ranked by TOTAL |Δlit| ascending
//    (ties: x's source order, then y's). A literal appearing in BOTH axes'
//    chains joins a candidate only if its two solved values agree within
//    1e-9; otherwise that pairing is skipped (never average, never lie).
//  applyCandidate(source, program, cand) — splice every edit (descending
//    span order) with drag.ts's D39 formatting rules (extract the shared
//    formatter rather than duplicating it); the result must parse and must
//    preserve identity: IdTracker across the edit shows 0 fresh /
//    0 dropped (tested, same pin as 4a's drags).
//
// The dragged shape may not be the only thing that moves — editing the 55
// in `20 + i * 55` re-spreads every house. That is the point: the learner
// watches the PROGRAM change, disambiguating "this one" (the 20) from
// "all of them" (the 55) by seeing both previews.

import type { NodeId, Program } from "../lang/ast.js";
import type { DisplayOp } from "../render/displayList.js";
import { spanIndex, visit } from "../lang/walk.js";
import type { TraceView } from "../host/run.js";
import { attrChain, isOpaque, type Chain, type PointChains } from "./provenance.js";
import { formatStep, stepForText } from "../util/litformat.js";

export interface LitEdit { lit: NodeId; from: number; to: number }

export function scalarCandidates(
  chain: Chain,
  valueOf: (lit: NodeId) => number,
  delta: number,
): LitEdit[] {
  if (delta === 0) return [];
  const cands: LitEdit[] = [];
  for (const t of chain.terms) {
    if (t.coeff === 0) continue;
    const from = valueOf(t.lit);
    cands.push({ lit: t.lit, from, to: from + delta / t.coeff });
  }
  // gentlest edit first; ties by source order (lit node id)
  cands.sort((a, b) =>
    Math.abs(a.to - a.from) - Math.abs(b.to - b.from) || a.lit - b.lit);
  return cands;
}

export interface DragCandidate { edits: LitEdit[] }

export interface DragSolve {
  candidates: DragCandidate[];
  unadjustable: ("x" | "y")[];
}

const coeffOf = (chain: Chain, lit: NodeId): number =>
  chain.terms.find((t) => t.lit === lit)?.coeff ?? 0;

/** One literal-pair solved so the WORLD anchor moves by exactly (dx, dy).
 *  Decoupled axes reduce to Δ/coeff; coupled (rotated) axes need the joint
 *  2x2 solve so both land — the oracle: apply, re-run, land where pointed. */
function solvePair(
  xChain: Chain, yChain: Chain, litX: NodeId, litY: NodeId,
  dx: number, dy: number, valueOf: (lit: NodeId) => number,
): LitEdit[] | null {
  if (litX === litY) {
    // one literal feeding both axes: its two solutions must agree (D45)
    const cx = coeffOf(xChain, litX);
    const cy = coeffOf(yChain, litX);
    if (cx === 0 || cy === 0) return null;
    const sx = dx / cx;
    const sy = dy / cy;
    if (Math.abs(sx - sy) > 1e-9 || sx === 0) return null; // disagree / no-op
    const from = valueOf(litX);
    return [{ lit: litX, from, to: from + sx }];
  }
  const a = coeffOf(xChain, litX);
  const c = coeffOf(xChain, litY);
  const b = coeffOf(yChain, litX);
  const d = coeffOf(yChain, litY);
  const det = a * d - c * b;
  if (Math.abs(det) < 1e-12) return null; // singular pairing
  const dX = (dx * d - c * dy) / det;
  const dY = (a * dy - b * dx) / det;
  const fromX = valueOf(litX);
  const fromY = valueOf(litY);
  const edits: LitEdit[] = [];
  if (dX !== 0) edits.push({ lit: litX, from: fromX, to: fromX + dX });
  if (dY !== 0) edits.push({ lit: litY, from: fromY, to: fromY + dY });
  return edits.length > 0 ? edits : null;
}

const litValueMaps = new WeakMap<Program, Map<NodeId, number>>();
function litValueMap(program: Program): Map<NodeId, number> {
  let m = litValueMaps.get(program);
  if (!m) {
    m = new Map();
    visit(program, (n) => { if (n.kind === "number") m!.set(n.id, n.value); });
    litValueMaps.set(program, m);
  }
  return m;
}

export function dragCandidates(
  program: Program,
  view: TraceView,
  ops: readonly DisplayOp[],
  opIndex: number,
  dx: number,
  dy: number,
): DragSolve {
  const anchor = attrChain(program, view, ops, opIndex, "anchor") as PointChains;
  const xChain = anchor.x;
  const yChain = anchor.y;
  const valueOf = (lit: NodeId): number => litValueMap(program).get(lit) ?? 0;

  const unadjustable: ("x" | "y")[] = [];
  if (isOpaque(xChain)) unadjustable.push("x");
  if (isOpaque(yChain)) unadjustable.push("y");

  const xActive = dx !== 0 && !isOpaque(xChain);
  const yActive = dy !== 0 && !isOpaque(yChain);

  let raw: LitEdit[][] = [];
  if (xActive && yActive) {
    // both axes move and both carry literals -> joint per-pair solve (D45)
    for (const tx of xChain.terms) {
      for (const ty of yChain.terms) {
        const edits = solvePair(xChain, yChain, tx.lit, ty.lit, dx, dy, valueOf);
        if (edits) raw.push(edits);
      }
    }
  } else if (xActive) {
    raw = scalarCandidates(xChain, valueOf, dx).map((e) => [e]);
  } else if (yActive) {
    raw = scalarCandidates(yChain, valueOf, dy).map((e) => [e]);
  }

  // dedup identical edit sets, rank by total |Δlit| ascending (ties: source
  // order, x's lit then y's), cap at 6 (D45)
  const seen = new Set<string>();
  const deduped: LitEdit[][] = [];
  for (const edits of raw) {
    const sig = [...edits].map((e) => e.lit + ":" + e.to).sort().join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(edits);
  }
  const totalDelta = (edits: LitEdit[]): number =>
    edits.reduce((s, e) => s + Math.abs(e.to - e.from), 0);
  deduped.sort((A, B) =>
    totalDelta(A) - totalDelta(B) ||
    (A[0]?.lit ?? 0) - (B[0]?.lit ?? 0) ||
    (A[1]?.lit ?? 0) - (B[1]?.lit ?? 0));

  return {
    candidates: deduped.slice(0, 6).map((edits) => ({ edits })),
    unadjustable,
  };
}

export function applyCandidate(
  source: string,
  program: Program,
  cand: DragCandidate,
): string {
  const spans = spanIndex(program);
  const edits = cand.edits
    .map((e) => ({ span: spans.get(e.lit)!, to: e.to }))
    .filter((e) => e.span !== undefined)
    .sort((a, b) => b.span.start - a.span.start); // descending: keep offsets valid
  let out = source;
  for (const { span, to } of edits) {
    const step = stepForText(source.slice(span.start, span.end));
    out = out.slice(0, span.start) + formatStep(to, step) + out.slice(span.end);
  }
  return out;
}
