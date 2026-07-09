// P1-T8 — the Phase 1 studio: editor left, live stage right, vocabulary
// everywhere. This app is the exit-gate artifact for the hallway test.
//
// Wiring plan (implement top to bottom; everything hard is already a pure
// function — this file is glue):
//
// 1. EditorView with: chalk() language support, chalkHover(getProgram),
//    chalkLint(), codeHighlightField, a light theme, and doc preloaded from
//    ../../examples/house-row.chalk?raw (Vite raw import).
//
// 2. On doc change (debounced ~60ms): try parse(doc). On success, stash as
//    lastGoodProgram, build a fresh Session (seed 42), advance 1 frame if the
//    program has frame/event blocks, and render displayAt(latest) to #stage
//    via renderDisplayList. On ChalkError: keep the last good picture (the
//    lint gutter reports the problem; the stage never flashes blank).
//    Static programs (no frames): render the setup picture, no RAF loop.
//    Animated programs: requestAnimationFrame loop calling session.advance
//    with pointer input captured from #stage mouse events (this is the ONE
//    place ambient input enters; it is converted to FrameInputs immediately).
//
// 3. Stage -> code: mousemove over #stage hit-tests ops back-to-front
//    (simple contains checks per op kind are fine at Phase 1 scale), then
//    (a) dispatch setCodeHighlight(spanForOp(...)),
//    (b) draw annotationsFor(op) on #overlay (markers: 4px dot + label;
//        arrows: line + arrowhead + label at midpoint; 11px sans, #333,
//        white 2px halo so labels read over any fill).
//    mouseleave clears both.
//
// 4. Code -> stage: on selection change, compute opsForSpan(...) and redraw
//    #stage with non-selected ops at 25% alpha (renderDisplayList already
//    supports upToOp; here instead redraw twice: full at low alpha, selected
//    subset at full alpha via a filtered list KEEPING original indices in a
//    side array so hit-testing still works).
//
// 5. #status shows: empty when idle — show the current diagnostic's message, or
//    "frame N" while animating. Keep it boring.
//
// Definition of done for P1-T8 is the manual script in phase1-spec §6 plus
// all automated gates green.

import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { chalk } from "../../src/editor/chalkLanguage.js";
import {
  chalkHover, chalkLint, codeHighlightField, setCodeHighlight,
} from "../../src/editor/extensions.js";
import { parse } from "../../src/lang/parser.js";
import { ChalkError } from "../../src/lang/diagnostics.js";
import { Session } from "../../src/host/run.js";
import { renderDisplayList, renderOps } from "../../src/render/canvas2d.js";
import { opsForSpan, spanForOp } from "../../src/ui/link.js";
import { annotationsFor, type AnnotationOp } from "../../src/ui/annotate.js";
import type { Program } from "../../src/lang/ast.js";
import type { DisplayList, DisplayOp } from "../../src/render/displayList.js";
import type { FrameInputs, InputEvent } from "../../src/engine/frame.js";
import houseRow from "../../examples/house-row.chalk?raw";

const stage = document.getElementById("stage") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const status = document.getElementById("status")!;
const stageCtx = stage.getContext("2d")!;
const overlayCtx = overlay.getContext("2d")!;

// ---------- program / session state ----------

let lastGoodProgram: Program | null = null;
let session: Session | null = null;
let isAnimated = false;
let lastDisplay: DisplayList | null = null;
let rafHandle = 0;

// pointer input, converted to FrameInputs immediately (the ONE ambient input)
const pointer = { x: 0, y: 0, down: false };
let pendingEvents: InputEvent[] = [];

// current editor selection, as op indices to keep at full alpha (null = all)
let selectedOps: number[] | null = null;

function drainInputs(): FrameInputs {
  const events = pendingEvents;
  pendingEvents = [];
  return { pointer: { ...pointer }, events };
}

// ---------- rendering ----------

function render(display: DisplayList): void {
  lastDisplay = display;
  stageCtx.globalAlpha = 1;
  if (selectedOps !== null) {
    // full picture faint, selected ops at full alpha (indices preserved so
    // hit-testing keeps working against the full list)
    renderDisplayList(stageCtx, display, 0); // bg only
    stageCtx.globalAlpha = 0.25;
    renderOps(stageCtx, display.ops);
    stageCtx.globalAlpha = 1;
    renderOps(stageCtx, selectedOps.flatMap((i) => display.ops[i] ?? []));
  } else {
    renderDisplayList(stageCtx, display);
  }
}

function tick(): void {
  if (!session || !isAnimated) return;
  try {
    const display = session.advance(drainInputs());
    render(display);
    status.textContent = "frame " + session.frameCount();
    rafHandle = requestAnimationFrame(tick);
  } catch (e) {
    // A frame-time ChalkError (setup was fine): freeze on the last good
    // picture and say what went wrong; the lint gutter points at the span.
    if (!(e instanceof ChalkError)) throw e;
    status.textContent = e.diagnostic.message;
  }
}

// ---------- rebuild on edit ----------

function rebuild(doc: string): void {
  cancelAnimationFrame(rafHandle);
  try {
    const program = parse(doc);
    lastGoodProgram = program;
    session = new Session(doc, 42);
    isAnimated = program.frames.length > 0 || program.events.length > 0;
    selectedOps = null;
    if (isAnimated) {
      rafHandle = requestAnimationFrame(tick);
    } else {
      render(session.displayAt(0));
      status.textContent = "";
    }
  } catch (e) {
    if (!(e instanceof ChalkError)) throw e;
    status.textContent = e.diagnostic.message; // stage keeps last good picture
  }
}

let debounce = 0;
const view = new EditorView({
  parent: document.getElementById("editor")!,
  doc: houseRow,
  extensions: [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxHighlighting(defaultHighlightStyle),
    chalk(),
    chalkHover(() => lastGoodProgram),
    chalkLint(),
    lintGutter(),
    codeHighlightField,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => rebuild(update.state.doc.toString()), 60);
      }
      if (update.selectionSet) onSelection();
    }),
  ],
});

// ---------- code -> stage (selection dimming) ----------

function onSelection(): void {
  if (!lastGoodProgram || !lastDisplay) return;
  const range = view.state.selection.main;
  if (range.empty) {
    if (selectedOps !== null) { selectedOps = null; redraw(); }
    return;
  }
  const ops = opsForSpan(lastDisplay.ops, lastGoodProgram, { start: range.from, end: range.to });
  selectedOps = ops.length > 0 ? ops : null;
  redraw();
}

function redraw(): void {
  if (lastDisplay) render(lastDisplay);
}

// ---------- stage -> code (hit-test, highlight, annotate) ----------

function hitTest(x: number, y: number): number {
  if (!lastDisplay) return -1;
  const ops = lastDisplay.ops;
  for (let i = ops.length - 1; i >= 0; i--) {
    if (opContains(ops[i]!, x, y)) return i;
  }
  return -1;
}

function opContains(op: DisplayOp, x: number, y: number): boolean {
  switch (op.kind) {
    case "circle": {
      const dx = x - op.cx, dy = y - op.cy;
      return dx * dx + dy * dy <= op.r * op.r;
    }
    case "ellipse": {
      if (op.rx <= 0 || op.ry <= 0) return false;
      const dx = (x - op.cx) / op.rx, dy = (y - op.cy) / op.ry;
      return dx * dx + dy * dy <= 1;
    }
    case "rect":
      return x >= op.x && x <= op.x + op.w && y >= op.y && y <= op.y + op.h;
    case "triangle": {
      const sign = (ax: number, ay: number, bx: number, by: number): number =>
        (x - bx) * (ay - by) - (ax - bx) * (y - by);
      const d1 = sign(op.ax, op.ay, op.bx, op.by);
      const d2 = sign(op.bx, op.by, op.cx, op.cy);
      const d3 = sign(op.cx, op.cy, op.ax, op.ay);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(hasNeg && hasPos);
    }
    case "line": {
      const lenSq = (op.x2 - op.x1) ** 2 + (op.y2 - op.y1) ** 2;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
        ((x - op.x1) * (op.x2 - op.x1) + (y - op.y1) * (op.y2 - op.y1)) / lenSq));
      const px = op.x1 + t * (op.x2 - op.x1), py = op.y1 + t * (op.y2 - op.y1);
      const distSq = (x - px) ** 2 + (y - py) ** 2;
      const r = Math.max(op.width / 2, 3);
      return distSq <= r * r;
    }
  }
}

function drawAnnotations(annotations: AnnotationOp[]): void {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.font = "11px system-ui, sans-serif";
  overlayCtx.textBaseline = "bottom";
  const label = (text: string, x: number, y: number): void => {
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeStyle = "#ffffff";
    overlayCtx.strokeText(text, x, y);
    overlayCtx.fillStyle = "#333333";
    overlayCtx.fillText(text, x, y);
  };
  for (const a of annotations) {
    if (a.kind === "marker") {
      overlayCtx.fillStyle = "#333333";
      overlayCtx.beginPath();
      overlayCtx.arc(a.x, a.y, 2, 0, Math.PI * 2);
      overlayCtx.fill();
      label(a.label, a.x + 5, a.y - 3);
    } else {
      overlayCtx.strokeStyle = "#333333";
      overlayCtx.lineWidth = 1;
      overlayCtx.beginPath();
      overlayCtx.moveTo(a.x1, a.y1);
      overlayCtx.lineTo(a.x2, a.y2);
      overlayCtx.stroke();
      // arrowhead
      const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
      overlayCtx.beginPath();
      overlayCtx.moveTo(a.x2, a.y2);
      overlayCtx.lineTo(a.x2 - 5 * Math.cos(angle - 0.4), a.y2 - 5 * Math.sin(angle - 0.4));
      overlayCtx.lineTo(a.x2 - 5 * Math.cos(angle + 0.4), a.y2 - 5 * Math.sin(angle + 0.4));
      overlayCtx.closePath();
      overlayCtx.fillStyle = "#333333";
      overlayCtx.fill();
      label(a.label, (a.x1 + a.x2) / 2 + 4, (a.y1 + a.y2) / 2 - 3);
    }
  }
}

function clearHover(): void {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  view.dispatch({ effects: setCodeHighlight.of(null) });
}

function stagePos(ev: MouseEvent): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

stage.addEventListener("mousemove", (ev) => {
  const { x, y } = stagePos(ev);
  pointer.x = x;
  pointer.y = y;
  if (isAnimated) pendingEvents.push({ type: "pointer-moved", x, y });

  const hit = hitTest(x, y);
  if (hit >= 0 && lastGoodProgram && lastDisplay) {
    const span = spanForOp(lastDisplay.ops, lastGoodProgram, hit);
    if (span) view.dispatch({ effects: setCodeHighlight.of({ start: span.start, end: span.end }) });
    drawAnnotations(annotationsFor(lastDisplay.ops[hit]!));
  } else {
    clearHover();
  }
});
stage.addEventListener("mousedown", (ev) => {
  const { x, y } = stagePos(ev);
  pointer.down = true;
  if (isAnimated) pendingEvents.push({ type: "pointer-pressed", x, y });
});
stage.addEventListener("mouseup", (ev) => {
  const { x, y } = stagePos(ev);
  pointer.down = false;
  if (isAnimated) pendingEvents.push({ type: "pointer-released", x, y });
});
stage.addEventListener("mouseleave", clearHover);

// ---------- go ----------

rebuild(houseRow);

// Debug handle for smoke tests and the manual acceptance script.
(window as unknown as Record<string, unknown>)["__studio"] = {
  view,
  frameCount: () => session?.frameCount() ?? 0,
  statusText: () => status.textContent,
};

// ---------------------------------------------------------------------------
// P2-T6 — Phase 2 wiring plan (do AFTER P1-T8 is done and gates D–G pass):
//
// 6. Frame slider under the stage: range input 0..session.frameCount()-1.
//    While the program animates it tracks the newest frame; dragging pauses
//    playback and renders session.displayAt(k). Releasing at the end resumes.
//
// 7. Focus: clicking the slider's current frame (or pausing) focuses frame k
//    -> view = session.traceAt(k) (traceSetup() for static programs). Show
//    the step scrubber: range 0..stepCount(view)-1; on input, use
//    scrubView(program, staticOpsCount, view, step) to (a) render the stage
//    with renderDisplayList(ctx, display, upToOp) and (b) dispatch
//    setCodeHighlight(span). staticOpsCount = displayAt(k).ops.length -
//    frame-op count; 0 for setup traces.
//
// 8. Timeline pane (right column, under the stage): executedStatements rows;
//    each row shows the source line text + a tick per completion; clicking a
//    tick jumps the scrubber to that step. KEY ROWS BY STABLE ID:
//    idTracker.advance(program) after every good parse; rows carry
//    stableOf(nodeId) so edits don't reshuffle the pane (manual script §6.6).
//    For a repeat under the cursor, swap in iterationGrid's columns view.
//
// 9. Ghost toggles: [onion] composites onionLayers(k, frameCount) — render
//    each ghost frame's display at its alpha (ctx.globalAlpha), faintest
//    first, then the real frame. [trails] composites trailOps slices the
//    same way at a fixed 0.25 alpha before the real frame.
//
// 10. Keep ALL of the above as calls into src/flow — if this file grows an
//     if/else about steps, windows, or alphas, the logic is in the wrong
//     place and belongs in src/flow with a test.

// ---------------------------------------------------------------------------
// P3-T6 — Phase 3 wiring plan (after P2-T6; gates H–L green):
//
// 11. State panel (right column, above the timeline): one row per StateRow
//     from stateRows(program, focusedView, session.stateAt(k).vars) —
//     name, entering -> leaving rendered via valueGlyph/showValue, a
//     sparkline from varSeries over the visible frame window (<= 64 frames,
//     the slider's neighborhood). Add a pointer row from session.inputsAt.
//     Flash a row (200ms CSS class) when its var was written this frame.
//
// 12. Typed cells: timeline rows render valueCells — "value" cells as
//     showValue figures (or the row as one sparkline when
//     cellZoomMode(cellWidth) === "plot"), "ops" cells as 24x18 canvas
//     thumbnails drawn with thumbnailFit over view.display.ops slices,
//     "mark" cells as the Phase 2 tick.
//
// 13. Hover semantics: row hover -> popover listing valuesForNode (cap the
//     list with stridedSamples(values, 16) + numericSummary header);
//     column hover -> scrub canvas to that step AND swap the state panel to
//     varsAtStep; cell hover/click -> jump scrubber to cell.step.
//
// 14. Diff toggle: when frame-stepping (slider +/-1), outline changed ops
//     (diffDisplay of k-1 vs k) in amber, added in green, removed as red
//     ghosts from the previous frame.
//
// 15. Attribution chips: definition-body rows get "via <callee>(...)" chips
//     from callSitesFor; clicking highlights the call site span (reuse
//     setCodeHighlight).
//
// 16. As before: NO step/window/threshold logic in this file — if a number
//     or an if lives here, it belongs in src/flow or src/ui with a test.
