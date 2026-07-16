// CONTRACT — ROTATION HANDLES (Phase 6, D61; resolves the 4a §6 / D44
// thread). On-stage manipulation gains angles WITHOUT touching D44:
// inversion still never solves through a matrix for its angle. Instead a
// rotation handle is an on-stage ANGLE WIDGET — it edits a rotate literal
// directly, the same species as 4a's inline angle widget, drawn at the
// group's fixed point.
//
// Rules (P6-T6):
//   A group earns a handle iff its `rotate` arg is a NumberLit or an
//   AngleLit (computed rotate — e.g. pinwheel's `spin + i * 90` — gets NO
//   handle, consistent with D39's literal-only discipline; that's what the
//   4b drag-vs-angle boundary is for). The handle sits at the group's
//   fixed point: `around`'s literal value when present, else the anchor
//   solved by flow/transform's anchorOf for the active matrix.
//   apply(deg) splices per D39/widget rules (suffix style preserved for
//   angle literals; bare numbers stay bare). Identity pin as ever:
//   0 fresh / 0 dropped.

import type { NodeId, Program, Span, Expr, GroupBlock } from "../lang/ast.js";
import type { Value } from "../engine/values.js";
import { visit } from "../lang/walk.js";
import { matrixFor, anchorOf } from "../flow/transform.js";

export interface RotationHandle {
  group: NodeId;
  /** Stage position of the handle (the group's fixed point). */
  x: number;
  y: number;
  deg: number;
  span: Span; // the rotate literal
  apply: (deg: number) => string;
}

/** A group arg that is a bare number, angle, or point-of-literals decodes to
 *  a Value; anything computed returns undefined (and forgoes a handle). */
function literalValue(e: Expr | undefined): Value | undefined {
  if (!e) return undefined;
  if (e.kind === "number") return { t: "num", v: e.value };
  if (e.kind === "angle") return { t: "angle", deg: e.degrees };
  if (e.kind === "point" && e.x.kind === "number" && e.y.kind === "number") {
    return { t: "point", x: e.x.value, y: e.y.value };
  }
  return undefined;
}

function argOf(g: GroupBlock, label: string): Expr | undefined {
  return g.args.find((a) => a.label === label)?.value;
}

/** D39-style number formatting: integers bare, else trimmed of trailing zeros. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
}

/** Rotation handles for every LITERAL-rotate group (D61). A group earns one
 *  iff its `rotate` arg is a plain number or angle literal — a computed
 *  rotate (pinwheel's `spin + i * 90`) gets none, keeping D44's rule that
 *  inversion never solves through a matrix for an angle. The handle sits at
 *  the group's fixed point: `around`'s literal value when present, else the
 *  matrix's anchor (flow/transform.anchorOf). apply(deg) splices ONLY the
 *  rotate literal, suffix style preserved, so the identity pin holds. */
export function rotationHandles(program: Program, source: string): RotationHandle[] {
  const handles: RotationHandle[] = [];
  visit(program, (node) => {
    if (node.kind !== "group") return;
    const rotate = argOf(node, "rotate");
    if (!rotate || (rotate.kind !== "number" && rotate.kind !== "angle")) return;
    const deg = rotate.kind === "number" ? rotate.value : rotate.degrees;

    // Fixed point: literal `around` if given, else the active matrix's anchor.
    const aroundLit = literalValue(argOf(node, "around"));
    let fixed: { x: number; y: number };
    if (aroundLit && aroundLit.t === "point") {
      fixed = { x: aroundLit.x, y: aroundLit.y };
    } else {
      fixed = anchorOf(matrixFor({
        move: literalValue(argOf(node, "move")),
        rotate: literalValue(rotate),
        scale: literalValue(argOf(node, "scale")),
        around: aroundLit,
      }));
    }

    const { span } = rotate;
    const orig = source.slice(span.start, span.end);
    const suffix = rotate.kind === "angle" ? (orig.endsWith("deg") ? "deg" : "°") : "";
    handles.push({
      group: node.id,
      x: fixed.x,
      y: fixed.y,
      deg,
      span,
      apply: (d) => source.slice(0, span.start) + fmt(d) + suffix + source.slice(span.end),
    });
  });
  return handles;
}
