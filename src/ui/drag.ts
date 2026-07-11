// CONTRACT (types + rules) — direct adjustment WITHOUT provenance: every
// literal is a control (plan §4.4: draggable numbers, inline color/angle
// widgets, on-stage point handles). PURE: these return SPECS with an
// apply() that splices NEW SOURCE; the studio owns pointer capture and the
// debounced rerun. Provenance-driven dragging of computed values is Phase
// 4b — nothing here inverts arithmetic.
//
// RULES (P4a-T6, D39):
//
//  numberDragAt — offset must sit on a NumberLit. step comes from the
//  literal's TEXTUAL form: contains "." -> 0.1, else 1 (unary minus is
//  part of the enclosing expression, not the literal). apply(v) rounds v
//  to the step's precision, formats WITHOUT trailing zeros beyond it
//  ("35", "0.9"), splices over the literal's span, returns the new source.
//  Splices preserve identity: re-parse + IdTracker across the edit must
//  show 0 fresh / 0 dropped (tested).
//
//  widgetAt — a color literal yields { kind:"color", rgb, apply(rgb) }
//  (apply writes uppercase #RRGGBB); an angle literal yields
//  { kind:"angle", deg, apply(deg) } (apply keeps the literal's suffix
//  style: ° stays °, deg stays deg). Anything else: null.
//
//  pointHandles — every PointLit whose x AND y are both NumberLits and
//  which sits anywhere inside a CALL or GROUP argument, in pre-order: the stage
//  draws a handle at (x, y) and dragging splices BOTH literals via
//  applyBoth (same rounding rule as numberDragAt, per component). Points
//  with computed components have no handle in 4a (that is 4b's job).

import type { NodeId, NumberLit, PointLit, Program, Span } from "../lang/ast.js";
import { pathAt, visit, type AnyNode } from "../lang/walk.js";
import { children } from "../lang/walk.js";
import { formatStep, stepForText, type LitStep } from "../util/litformat.js";

export interface NumberDrag {
  span: Span;
  value: number;
  step: 1 | 0.1;
  apply: (v: number) => string;
}

/** Step from the literal's TEXTUAL form (D39). */
const stepOf = (source: string, span: Span): LitStep =>
  stepForText(source.slice(span.start, span.end));

/** Round to the step and format without trailing zeros beyond it. */
const fmtStep = (v: number, step: LitStep): string => formatStep(v, step);

const splice = (source: string, span: Span, text: string): string =>
  source.slice(0, span.start) + text + source.slice(span.end);

export function numberDragAt(
  program: Program,
  source: string,
  offset: number,
): NumberDrag | null {
  const lit = [...pathAt(program, offset)].reverse()
    .find((n) => n.kind === "number") as NumberLit | undefined;
  if (!lit) return null;
  const step = stepOf(source, lit.span);
  return {
    span: lit.span,
    value: lit.value,
    step,
    apply: (v) => splice(source, lit.span, fmtStep(v, step)),
  };
}

export type Widget =
  | { kind: "color"; span: Span; rgb: number; apply: (rgb: number) => string }
  | { kind: "angle"; span: Span; deg: number; apply: (deg: number) => string };

export function widgetAt(
  program: Program,
  source: string,
  offset: number,
): Widget | null {
  const path = [...pathAt(program, offset)].reverse();
  for (const node of path) {
    if (node.kind === "color") {
      return {
        kind: "color",
        span: node.span,
        rgb: node.rgb,
        apply: (rgb) => splice(source, node.span,
          "#" + (rgb >>> 0).toString(16).padStart(6, "0").toUpperCase()),
      };
    }
    if (node.kind === "angle") {
      const suffix = source.slice(node.span.start, node.span.end).endsWith("°") ? "°" : "deg";
      return {
        kind: "angle",
        span: node.span,
        deg: node.degrees,
        apply: (deg) => splice(source, node.span, String(deg) + suffix),
      };
    }
  }
  return null;
}

export interface PointHandle {
  /** The PointLit node. */
  nodeId: NodeId;
  x: number;
  y: number;
  xSpan: Span;
  ySpan: Span;
  applyBoth: (x: number, y: number) => string;
}

export function pointHandles(program: Program, source: string): PointHandle[] {
  const handles: PointHandle[] = [];
  const seen = new Set<NodeId>();

  const collectFrom = (root: AnyNode): void => {
    const stack: AnyNode[] = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.kind === "point" && node.x.kind === "number" && node.y.kind === "number" &&
          !seen.has(node.id)) {
        seen.add(node.id);
        handles.push(makeHandle(node, source));
      }
      stack.push(...children(node));
    }
  };

  // Points anywhere inside a call or group ARGUMENT, in pre-order (visit
  // yields calls/groups pre-order; a seen-set guards nested-arg overlap).
  visit(program, (node) => {
    if (node.kind !== "call" && node.kind !== "group") return;
    for (const arg of node.args) collectFrom(arg.value);
  });
  handles.sort((a, b) => a.nodeId - b.nodeId); // pre-order overall
  return handles;
}

function makeHandle(point: PointLit, source: string): PointHandle {
  const xLit = point.x as NumberLit;
  const yLit = point.y as NumberLit;
  const xStep = stepOf(source, xLit.span);
  const yStep = stepOf(source, yLit.span);
  return {
    nodeId: point.id,
    x: xLit.value,
    y: yLit.value,
    xSpan: xLit.span,
    ySpan: yLit.span,
    applyBoth: (x, y) => {
      // splice the LATER span first so the earlier offsets stay valid
      const first = splice(source, yLit.span, fmtStep(y, yStep));
      return splice(first, xLit.span, fmtStep(x, xStep));
    },
  };
}
