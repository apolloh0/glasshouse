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
import {
  acceptCompletion, autocompletion, completionKeymap, startCompletion,
  type CompletionContext, type CompletionResult,
} from "@codemirror/autocomplete";
import { Transaction } from "@codemirror/state";
import { chalk } from "../../src/editor/chalkLanguage.js";
import {
  chalkHover, chalkLint, codeHighlightField, setCodeHighlight,
} from "../../src/editor/extensions.js";
import { parse } from "../../src/lang/parser.js";
import { ChalkError } from "../../src/lang/diagnostics.js";
import { Session, type TraceView } from "../../src/host/run.js";
import { IdTracker } from "../../src/host/ids.js";
import { renderDisplayList, renderOps } from "../../src/render/canvas2d.js";
import { opsForSpan, spanForOp } from "../../src/ui/link.js";
import { annotationsFor, type AnnotationOp } from "../../src/ui/annotate.js";
import { scrubView, stepCount } from "../../src/flow/steps.js";
import { executedStatements, iterationGrid } from "../../src/flow/lines.js";
import { onionLayers, trailOps } from "../../src/flow/frames.js";
import { stateRows, varsAtStep, varSeries, sparkline } from "../../src/flow/state.js";
import { activeGroupsAt, anchorOf, axesGlyph } from "../../src/flow/transform.js";
import { completionsAt, previewFor } from "../../src/ui/complete.js";
import { paletteEntries } from "../../src/ui/palette.js";
import { numberDragAt, pointHandles, widgetAt } from "../../src/ui/drag.js";
import { applyCandidate, dragCandidates, type DragSolve } from "../../src/flow/invert.js";
import {
  connectNumbers, findRepeatRuns, nameThisNumber, openThisUp, repeatThis, teachThis,
} from "../../src/ui/gestures.js";
import {
  cellZoomMode, numericSummary, stridedSamples, valueCells, valuesForNode,
} from "../../src/flow/cells.js";
import { diffDisplay } from "../../src/flow/diff.js";
import { callSitesFor } from "../../src/flow/stack.js";
import { showValue } from "../../src/ui/format.js";
import { announce, type AnnouncementKey } from "../../src/meta/announce.js";
import { kstep, K_INITIAL, type KState, type KEffect } from "../../src/ui/keys.js";
import { opBounds, thumbnailFit, valueGlyph } from "../../src/ui/glyphs.js";
import { pathAt, children as childrenOf, type AnyNode } from "../../src/lang/walk.js";
import type { Value } from "../../src/engine/values.js";
import type { Program } from "../../src/lang/ast.js";
import type { DisplayList, DisplayOp } from "../../src/render/displayList.js";
import type { FrameInputs, InputEvent } from "../../src/engine/frame.js";
import houseRow from "../../examples/house-row.chalk?raw";

const stage = document.getElementById("stage") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const status = document.getElementById("status")!;
const stageCtx = stage.getContext("2d")!;
const overlayCtx = overlay.getContext("2d")!;
const frameSlider = document.getElementById("frameslider") as HTMLInputElement;
const scrubWrap = document.getElementById("scrubwrap") as HTMLElement;
const scrubber = document.getElementById("scrubber") as HTMLInputElement;
const onionToggle = document.getElementById("onion") as HTMLInputElement;
const trailsToggle = document.getElementById("trails") as HTMLInputElement;
const diffToggle = document.getElementById("diff") as HTMLInputElement;
const timeline = document.getElementById("timeline")!;
const statePanel = document.getElementById("statepanel")!;
const popover = document.getElementById("popover")!;
const palette = document.getElementById("palette")!;
const live = document.getElementById("live")!;

/** The studio's ONE voice (spec §1, D57): every screen-reader utterance is
 *  an announce() template written into the single #live aria-live region.
 *  Nothing else writes #live; no UI string is composed outside announce(). */
function say(key: AnnouncementKey, slots: Record<string, unknown>): void {
  live.textContent = announce(key, slots);
}

// ---------- program / session state ----------

let lastGoodProgram: Program | null = null;
let session: Session | null = null;
let isAnimated = false;
let lastDisplay: DisplayList | null = null;
let rafHandle = 0;
const idTracker = new IdTracker();

// Phase 2: the focused frame (scrubber + timeline operate on it)
let focused: { k: number; view: TraceView; staticOpsCount: number } | null = null;

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

/** One paint pipeline: bg, ghost layers (when focused), then ops [0, upToOp)
 *  — with Phase 1 selection emphasis when a code selection is active. */
function render(display: DisplayList, upToOp: number = display.ops.length): void {
  lastDisplay = display;
  stageCtx.globalAlpha = 1;
  renderDisplayList(stageCtx, display, 0); // bg only
  if (focused && session && isAnimated) {
    if (onionToggle.checked) {
      for (const layer of onionLayers(focused.k, session.frameCount())) {
        stageCtx.globalAlpha = layer.alpha;
        renderOps(stageCtx, session.displayAt(layer.frame).ops);
      }
    }
    if (trailsToggle.checked) {
      for (const slice of trailOps((k) => session!.displayAt(k), focused.k, 8, 4)) {
        stageCtx.globalAlpha = 0.25;
        renderOps(stageCtx, slice.ops);
      }
    }
  }
  const shown = display.ops.slice(0, Math.min(upToOp, display.ops.length));
  if (selectedOps !== null) {
    // full picture faint, selected ops at full alpha (indices preserved so
    // hit-testing keeps working against the full list)
    stageCtx.globalAlpha = 0.25;
    renderOps(stageCtx, shown);
    stageCtx.globalAlpha = 1;
    renderOps(stageCtx, selectedOps.flatMap((i) => (i < shown.length ? [shown[i]!] : [])));
  } else {
    stageCtx.globalAlpha = 1;
    renderOps(stageCtx, shown);
  }
  stageCtx.globalAlpha = 1;
}

function tick(): void {
  if (!session || !isAnimated) return;
  try {
    const display = session.advance(drainInputs());
    render(display);
    status.textContent = "frame " + session.frameCount();
    frameSlider.max = String(Math.max(0, session.frameCount() - 1));
    frameSlider.value = frameSlider.max;
    rafHandle = requestAnimationFrame(tick);
  } catch (e) {
    // A frame-time ChalkError (setup was fine): freeze on the last good
    // picture and say what went wrong; the lint gutter points at the span.
    if (!(e instanceof ChalkError)) throw e;
    status.textContent = e.diagnostic.message;
    say("diagnostic", { message: e.diagnostic.message });
  }
}

// ---------- rebuild on edit ----------

function rebuild(doc: string): void {
  cancelAnimationFrame(rafHandle);
  try {
    const program = parse(doc);
    lastGoodProgram = program;
    idTracker.advance(program); // stable ids survive the re-parse (D16)
    session = new Session(doc, 42);
    isAnimated = program.frames.length > 0 || program.events.length > 0;
    selectedOps = null;
    const wasFocused = focused !== null;
    focused = null;
    if (isAnimated) {
      scrubWrap.style.display = "none";
      rafHandle = requestAnimationFrame(tick);
    } else {
      frameSlider.max = "0";
      frameSlider.value = "0";
      // a static picture is always "focused": the scrubber scrubs the
      // DRAWING; an edit mid-scrub re-anchors instead of jumping to the end
      focusFrame(0, { keepScrubPosition: wasFocused });
    }
    renderPalette();
    refreshGestures();
  } catch (e) {
    if (!(e instanceof ChalkError)) throw e;
    status.textContent = e.diagnostic.message; // stage keeps last good picture
    say("diagnostic", { message: e.diagnostic.message });
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
    chalkHover(() => lastGoodProgram, valuesAtPos),
    chalkLint(),
    lintGutter(),
    autocompletion({ override: [chalkCompletionSource] }),
    keymap.of(completionKeymap),
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

// ---------- Phase 2: focus, scrub, timeline, ghosts ----------

/** Frame ops in a trace = the largest opEnd any row reached; everything
 *  before them in the display is the static prefix (0 for setup traces). */
function staticPrefixOf(view: TraceView): number {
  let frameOps = 0;
  for (let s = 0; s < view.trace.count; s++) {
    const end = view.trace.row(s).opEnd;
    if (end > frameOps) frameOps = end;
  }
  return view.display.ops.length - frameOps;
}

function focusFrame(k: number, opts: { keepScrubPosition?: boolean } = {}): void {
  if (!session || !lastGoodProgram) return;
  const view = isAnimated ? session.traceAt(k) : session.traceSetup();
  focused = { k, view, staticOpsCount: staticPrefixOf(view) };
  scrubWrap.style.display = "";
  const last = Math.max(0, stepCount(view) - 1);
  scrubber.max = String(last);
  scrubber.value = opts.keepScrubPosition
    ? String(Math.min(Number(scrubber.value), last)) // re-anchor sanely
    : String(last); // fresh focus shows the finished frame
  applyScrub();
  renderTimeline();
  renderStatePanel();
}

function unfocus(): void {
  focused = null;
  scrubWrap.style.display = "none";
  timeline.replaceChildren();
  statePanel.replaceChildren();
  popover.style.display = "none";
  view.dispatch({ effects: setCodeHighlight.of(null) });
}

function applyScrub(): void {
  if (!focused || !lastGoodProgram) return;
  const step = Number(scrubber.value);
  const v = scrubView(lastGoodProgram, focused.staticOpsCount, focused.view, step);
  render(focused.view.display, v.upToOp);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  drawHandles();
  drawAxes(step); // plan 21: rotated frames while scrubbing inside a group
  view.dispatch({ effects: setCodeHighlight.of({ start: v.span.start, end: v.span.end }) });
  status.textContent =
    (isAnimated ? "frame " + focused.k + " · " : "") +
    "step " + step + " / " + Math.max(0, stepCount(focused.view) - 1);
}

frameSlider.addEventListener("input", () => {
  if (!session) return;
  cancelAnimationFrame(rafHandle); // dragging pauses playback
  const k = Math.min(Number(frameSlider.value), Math.max(0, session.frameCount() - 1));
  if (isAnimated) {
    render(session.displayAt(k));
    status.textContent = "frame " + k;
    focusFrame(k);
    if (diffToggle.checked) drawDiffOutlines(k); // what changed since k-1
  }
});

frameSlider.addEventListener("change", () => {
  // releasing at the newest frame resumes playback
  if (!session || !isAnimated) return;
  if (frameSlider.value === frameSlider.max) {
    unfocus();
    rafHandle = requestAnimationFrame(tick);
  }
});

scrubber.addEventListener("input", applyScrub);
onionToggle.addEventListener("change", () => { if (focused) applyScrub(); });
trailsToggle.addEventListener("change", () => { if (focused) applyScrub(); });

// ---------- Phase 3: state panel, value hover, diff outlines ----------

/** Values of the most informative expression under `pos`: the enclosing
 *  labeled argument's value if any, else the innermost expression. */
function valuesAtPos(pos: number): string[] | null {
  if (!focused || !lastGoodProgram) return null;
  const path = pathAt(lastGoodProgram, pos);
  let target: AnyNode | null = null;
  for (const node of [...path].reverse()) {
    if (node.kind === "call") {
      const arg = node.args.find((a) => a.value.span.start <= pos && pos < a.value.span.end);
      if (arg) { target = arg.value; break; }
    }
  }
  if (!target) {
    target = [...path].reverse().find((n) =>
      ["number", "angle", "color", "bool", "string", "name", "member",
        "binop", "unary", "point", "call"].includes(n.kind)) ?? null;
  }
  if (!target) return null;
  const values = valuesForNode(focused.view, target.id);
  if (values.length === 0) return null;
  return stridedSamples(values, 12).map(showValue);
}

function glyphSpan(v: Value): HTMLElement {
  const g = valueGlyph(v);
  if (g.kind === "swatch") {
    const el = document.createElement("span");
    el.className = "sp-swatch";
    el.style.background = "#" + g.rgb.toString(16).padStart(6, "0");
    el.title = showValue(v);
    return el;
  }
  const el = document.createElement("span");
  el.className = "sp-val";
  el.textContent = showValue(v);
  return el;
}

function sparkCanvas(values: (number | null)[], w = 72, h = 16): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const spark = sparkline(values, w, h);
  if (spark) {
    const c = canvas.getContext("2d")!;
    c.strokeStyle = "#2a76c6";
    c.beginPath();
    spark.points.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    c.stroke();
  }
  return canvas;
}

let lastFlashFrame = -1;

function renderStatePanel(vars?: ReadonlyMap<string, Value>): void {
  statePanel.replaceChildren();
  if (!focused || !lastGoodProgram || !session) return;
  const entering = isAnimated ? session.stateAt(focused.k).vars : new Map<string, Value>();
  const rows = stateRows(lastGoodProgram, focused.view, entering);
  const flash = focused.k !== lastFlashFrame;
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = "sp-row" + (flash && row.writes.length > 0 ? " flash" : "");
    const name = document.createElement("span");
    name.className = "sp-name";
    name.textContent = row.name;
    el.appendChild(name);
    if (vars) {
      // column hover: the world at a step (varsAtStep)
      const v = vars.get(row.name);
      if (v) el.appendChild(glyphSpan(v));
    } else {
      if (row.entering) {
        el.appendChild(glyphSpan(row.entering));
        el.appendChild(document.createTextNode(" → "));
      }
      el.appendChild(glyphSpan(row.leaving));
      if (isAnimated) {
        const from = Math.max(0, focused.k - 63);
        const frames = Array.from({ length: focused.k - from + 1 }, (_, i) => from + i);
        el.appendChild(sparkCanvas(varSeries((f) => session!.stateAt(f), row.name, frames)));
      }
    }
    statePanel.appendChild(el);
  }
  if (isAnimated && session.frameCount() > focused.k) {
    // inputs are state (D24): the pointer row
    const inputs = session.inputsAt(focused.k);
    const el = document.createElement("div");
    el.className = "sp-row";
    const name = document.createElement("span");
    name.className = "sp-name";
    name.textContent = "pointer";
    el.appendChild(name);
    el.appendChild(glyphSpan({ t: "point", x: inputs.pointer.x, y: inputs.pointer.y }));
    el.appendChild(document.createTextNode(inputs.pointer.down ? " down" : " up"));
    statePanel.appendChild(el);
  }
  lastFlashFrame = focused.k;
}

/** Diff outlines after a frame step: changed amber, added green, removed
 *  red ghosts from the previous frame. */
function drawDiffOutlines(k: number): void {
  if (!session || k <= 0) return;
  const a = session.displayAt(k - 1).ops;
  const b = session.displayAt(k).ops;
  const d = diffDisplay(a, b);
  const outline = (ops: readonly DisplayOp[], idx: number[], color: string): void => {
    stageCtx.strokeStyle = color;
    stageCtx.lineWidth = 1.5;
    for (const i of idx) {
      const bb = opBounds([ops[i]!]);
      if (bb) stageCtx.strokeRect(bb.x0 - 1, bb.y0 - 1, bb.x1 - bb.x0 + 2, bb.y1 - bb.y0 + 2);
    }
  };
  outline(b, d.changed.map((c) => c.b), "#e8a33d");
  outline(b, d.added, "#3da35d");
  outline(a, d.removed, "#d64545");
}

// ---------- Phase 4a: completions, palette, drags, handles, axes ----------

/** Plan 17: completion source with a live preview canvas per HIGHLIGHTED
 *  option (CM calls `info` lazily, which is exactly the throttle we want). */
function chalkCompletionSource(cmCtx: CompletionContext): CompletionResult | null {
  const word = cmCtx.matchBefore(/[A-Za-z_]\w*/);
  if (!word && !cmCtx.explicit) return null;
  const from = word ? word.from : cmCtx.pos;
  const doc = cmCtx.state.doc.toString();
  const comps = completionsAt(lastGoodProgram, doc, cmCtx.pos);
  if (comps.length === 0) return null;
  return {
    from,
    options: comps.map((c) => ({
      label: c.label,
      apply: c.insert,
      type: c.kind === "builtin" ? "function" : c.kind === "definition" ? "method" : "keyword",
      info: () => {
        const candidate = doc.slice(0, from) + c.insert + doc.slice(cmCtx.pos);
        const preview = previewFor(candidate, 42);
        if (!preview.ok) {
          const div = document.createElement("div");
          div.className = "cm-completionPreview";
          div.textContent = preview.error.message;
          return div;
        }
        const canvas = document.createElement("canvas");
        canvas.className = "cm-completionPreview";
        canvas.width = 64;
        canvas.height = 48;
        const c2 = canvas.getContext("2d")!;
        c2.scale(64 / 320, 48 / 240);
        renderDisplayList(c2, preview.display);
        return canvas;
      },
    })),
  };
}

/** Plan 18: the parts palette — thumbnails via previewFor + thumbnailFit;
 *  click inserts at the cursor's statement boundary; dragging onto the
 *  stage inserts with the first point handle rewritten to the drop point. */
function renderPalette(): void {
  palette.replaceChildren();
  const doc = view.state.doc.toString();
  for (const entry of paletteEntries(lastGoodProgram, doc)) {
    const el = document.createElement("div");
    el.className = "pal-entry";
    el.draggable = true;
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 36;
    const preview = previewFor(entry.previewSource, 42);
    if (preview.ok) {
      const fit = thumbnailFit(preview.display.ops, 48, 36, 2);
      if (fit) {
        const c2 = canvas.getContext("2d")!;
        c2.setTransform(fit.scale, 0, 0, fit.scale, fit.dx, fit.dy);
        renderOps(c2, preview.display.ops);
        c2.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    const label = document.createElement("span");
    label.textContent = entry.name;
    el.append(canvas, label);
    el.addEventListener("click", () => insertStatement(entry.insert));
    el.addEventListener("dragstart", (ev) => {
      ev.dataTransfer?.setData("text/chalk-insert", entry.insert);
    });
    palette.appendChild(el);
  }
}

/** Insert a statement at the cursor's line start (one undo step). */
function insertStatement(text: string): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: text + "\n" },
    userEvent: "input.complete",
  });
  view.focus();
}

stage.addEventListener("dragover", (ev) => ev.preventDefault());
stage.addEventListener("drop", (ev) => {
  ev.preventDefault();
  const insert = ev.dataTransfer?.getData("text/chalk-insert");
  if (!insert) return;
  const { x, y } = stagePos(ev as unknown as MouseEvent);
  // rewrite the statement's first literal point to the drop point with the
  // SAME splice rules as drag.ts (pointHandles over the lone statement)
  let text = insert;
  try {
    const mini = insert + "\n";
    const handle = pointHandles(parse(mini), mini)[0];
    if (handle) text = handle.applyBoth(x, y).trimEnd();
  } catch {
    // un-parseable inserts (construct templates) drop in unchanged
  }
  insertStatement(text);
});

/** Plans 19+20: literal drags. One gesture = one undo step: intermediate
 *  moves skip history; the final change replays start->end with history. */
interface Gesture {
  startDoc: string;
  latest: string;
  apply: (dx: number, dy: number) => string;
}
let gesture: Gesture | null = null;

function beginGesture(startDoc: string, apply: Gesture["apply"]): void {
  gesture = { startDoc, latest: startDoc, apply };
}

function moveGesture(dx: number, dy: number): void {
  if (!gesture) return;
  const next = gesture.apply(dx, dy);
  if (next === gesture.latest) return;
  gesture.latest = next;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
    annotations: Transaction.addToHistory.of(false),
  });
}

function endGesture(): void {
  if (!gesture) return;
  const { startDoc, latest } = gesture;
  gesture = null;
  if (latest === startDoc) return;
  // rewind (historyless), then land the whole gesture as ONE history entry
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: startDoc },
    annotations: Transaction.addToHistory.of(false),
  });
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: latest },
    userEvent: "input.drag",
  });
}

view.dom.addEventListener("mousedown", (ev) => {
  if (!lastGoodProgram) return;
  const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY });
  if (pos === null) return;
  const doc = view.state.doc.toString();

  const num = numberDragAt(lastGoodProgram, doc, pos);
  if (num) {
    ev.preventDefault();
    const startX = ev.clientX;
    beginGesture(doc, (dx) => num.apply(num.value + Math.round(dx / 2) * num.step));
    const onMove = (m: MouseEvent): void => moveGesture(m.clientX - startX, 0);
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      endGesture();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return;
  }

  const widget = widgetAt(lastGoodProgram, doc, pos);
  if (widget && widget.kind === "color") {
    ev.preventDefault();
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = "#" + widget.rgb.toString(16).padStart(6, "0");
    picker.style.position = "fixed";
    picker.style.left = ev.clientX + "px";
    picker.style.top = ev.clientY + "px";
    document.body.appendChild(picker);
    picker.addEventListener("input", () => {
      const rgb = parseInt(picker.value.slice(1), 16);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: widget.apply(rgb) },
        userEvent: "input.color",
      });
    });
    picker.addEventListener("change", () => picker.remove());
    picker.click();
    return;
  }
  if (widget && widget.kind === "angle") {
    ev.preventDefault();
    const startX = ev.clientX;
    beginGesture(doc, (dx) => widget.apply(Math.round(widget.deg + dx / 2)));
    const onMove = (m: MouseEvent): void => moveGesture(m.clientX - startX, 0);
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      endGesture();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
});

/** Plan 20: point handles as rings on the overlay; literal coordinates
 *  only (computed/world mismatch is 4b's problem, D39). */
function drawHandles(): void {
  if (!lastGoodProgram) return;
  overlayCtx.strokeStyle = "#2a76c6";
  overlayCtx.lineWidth = 1.5;
  for (const h of pointHandles(lastGoodProgram, view.state.doc.toString())) {
    overlayCtx.beginPath();
    overlayCtx.arc(h.x, h.y, 5, 0, Math.PI * 2);
    overlayCtx.stroke();
  }
}

function handleAt(x: number, y: number): ReturnType<typeof pointHandles>[number] | null {
  if (!lastGoodProgram) return null;
  for (const h of pointHandles(lastGoodProgram, view.state.doc.toString())) {
    if ((x - h.x) ** 2 + (y - h.y) ** 2 <= 64) return h;
  }
  return null;
}

/** Plan 21: rotated axes while the scrubber sits inside a group —
 *  innermost brightest, labelled with the group's header text. */
function drawAxes(step: number): void {
  if (!focused || !lastGoodProgram) return;
  const active = activeGroupsAt(lastGoodProgram, focused.view, step);
  active.forEach((g, i) => {
    const alpha = active.length === 1 ? 1 : 0.4 + (0.6 * i) / (active.length - 1);
    overlayCtx.globalAlpha = alpha;
    // the glyph sits at the transform's fixed point (the pivot), not the
    // transformed local origin — anchorOf does the solve in flow
    const glyph = axesGlyph(g.matrix);
    const origin = glyph[2] as { x: number; y: number };
    const anchor = anchorOf(g.matrix);
    const dx = anchor.x - origin.x;
    const dy = anchor.y - origin.y;
    for (const op of glyph) {
      if (op.kind === "axis") {
        overlayCtx.strokeStyle = op.label === "x" ? "#d64545" : "#2a76c6";
        overlayCtx.lineWidth = 1.5;
        overlayCtx.beginPath();
        overlayCtx.moveTo(op.x1 + dx, op.y1 + dy);
        overlayCtx.lineTo(op.x2 + dx, op.y2 + dy);
        overlayCtx.stroke();
      } else {
        overlayCtx.fillStyle = "#333333";
        overlayCtx.beginPath();
        overlayCtx.arc(op.x + dx, op.y + dy, 2.5, 0, Math.PI * 2);
        overlayCtx.fill();
      }
    }
    overlayCtx.globalAlpha = 1;
  });
  if (active.length > 0) {
    const g = active[active.length - 1]!; // innermost gets the label
    let headerText = "";
    visitGroups(lastGoodProgram, (node) => {
      if (node.id === g.group) headerText = firstLineAt(node.span.start, node.span.end).replace(/:$/, "");
    });
    overlayCtx.font = "10px system-ui, sans-serif";
    overlayCtx.fillStyle = "#333333";
    overlayCtx.fillText(headerText, 4, 234);
  }
}

function visitGroups(program: Program, fn: (node: AnyNode & { kind: "group" }) => void): void {
  const stack: AnyNode[] = [...program.items];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "group") fn(node as AnyNode & { kind: "group" });
    stack.push(...childrenOf(node));
  }
}

// ---------- Phase 2: the timeline pane (rows keyed by STABLE id) ----------

const rowCache = new Map<number, { el: HTMLElement; text: HTMLElement; ticks: HTMLElement }>();

function firstLineAt(spanStart: number, spanEnd: number): string {
  const src = lastGoodProgram!.source;
  const nl = src.indexOf("\n", spanStart);
  const end = nl === -1 ? spanEnd : Math.min(nl, spanEnd);
  return src.slice(spanStart, end).trim();
}

/** The innermost repeat/for under the editor cursor, if any. */
function loopUnderCursor(): number | null {
  if (!lastGoodProgram) return null;
  const pos = view.state.selection.main.head;
  const hit = [...pathAt(lastGoodProgram, pos)].reverse()
    .find((n) => n.kind === "repeat" || n.kind === "for");
  return hit ? hit.id : null;
}

function tickButton(step: number | null): HTMLElement {
  const b = document.createElement("button");
  b.className = step === null ? "tl-tick gap" : "tl-tick";
  if (step !== null) {
    b.title = "step " + step;
    b.addEventListener("click", () => {
      scrubber.value = String(step);
      applyScrub();
    });
  }
  return b;
}

function timelineRow(stableId: number): { el: HTMLElement; text: HTMLElement; ticks: HTMLElement } {
  let entry = rowCache.get(stableId);
  if (!entry) {
    const el = document.createElement("div");
    el.className = "tl-row";
    const text = document.createElement("span");
    text.className = "tl-text";
    const ticks = document.createElement("span");
    ticks.className = "tl-ticks";
    el.append(text, ticks);
    entry = { el, text, ticks };
    rowCache.set(stableId, entry);
  }
  return entry;
}

/** Phase 3 typed cells for one statement row (D26): values as figures,
 *  op-emitting completions as exact 24x18 thumbnails, control as ticks —
 *  or the whole row as a plot when cells would be narrower than 28px. */
function cellElements(nodeId: number): HTMLElement[] {
  if (!focused || !lastGoodProgram) return [];
  const cells = valueCells(lastGoodProgram, focused.view, nodeId);
  if (cells.length === 0) return [];
  const nums = cells.flatMap((c) =>
    c.kind === "value" && c.value.t === "num" ? [c.value.v] : []);
  if (nums.length === cells.length && cellZoomMode(120 / cells.length) === "plot") {
    const canvas = sparkCanvas(nums, 120, 16); // table-to-plot (D26)
    canvas.title = numericSummary(nums).min + " … " + numericSummary(nums).max;
    return [canvas];
  }
  return cells.map((cell) => {
    if (cell.kind === "value") {
      const b = document.createElement("button");
      b.className = "tl-cell";
      b.textContent = showValue(cell.value);
      wireCell(b, cell.step);
      return b;
    }
    if (cell.kind === "ops") {
      const canvas = document.createElement("canvas");
      canvas.className = "tl-thumb";
      canvas.width = 24;
      canvas.height = 18;
      const ops = focused!.view.display.ops.slice(
        focused!.staticOpsCount + cell.opStart, focused!.staticOpsCount + cell.opEnd);
      const fit = thumbnailFit(ops, 24, 18, 2);
      if (fit) {
        const c = canvas.getContext("2d")!;
        c.setTransform(fit.scale, 0, 0, fit.scale, fit.dx, fit.dy);
        renderOps(c, ops);
        c.setTransform(1, 0, 0, 1, 0, 0);
      }
      wireCell(canvas, cell.step);
      return canvas;
    }
    return tickButton(cell.step);
  });
}

/** Cell interactions (plan 13): hover scrubs the canvas to the step and
 *  swaps the panel to varsAtStep; click jumps the scrubber there. */
function wireCell(el: HTMLElement, step: number): void {
  el.addEventListener("click", () => {
    scrubber.value = String(step);
    applyScrub();
  });
  el.addEventListener("mouseenter", () => {
    if (!focused || !lastGoodProgram || !session) return;
    const v = scrubView(lastGoodProgram, focused.staticOpsCount, focused.view, step);
    render(focused.view.display, v.upToOp);
    const entering = isAnimated ? session.stateAt(focused.k).vars : new Map<string, Value>();
    renderStatePanel(varsAtStep(lastGoodProgram, focused.view, entering, step));
  });
  el.addEventListener("mouseleave", () => {
    applyScrub();
    renderStatePanel();
  });
}

/** Row hover popover: every value the statement took this frame, capped
 *  by stridedSamples with a numericSummary header (plan 13). */
function rowPopoverText(nodeId: number): string | null {
  if (!focused || !lastGoodProgram) return null;
  const cells = valueCells(lastGoodProgram, focused.view, nodeId);
  const values = cells.flatMap((c) => (c.kind === "value" ? [c.value] : []));
  if (values.length === 0) return null;
  const nums = values.flatMap((v) => (v.t === "num" ? [v.v] : []));
  let head = values.length + (values.length === 1 ? " value" : " values");
  if (nums.length === values.length && nums.length > 1) {
    const s = numericSummary(nums);
    head += " · min " + s.min + " · max " + s.max + " · mean " + Number(s.mean.toFixed(2));
  }
  return head + "\n" + stridedSamples(values, 16).map(showValue).join(", ");
}

function wireRowHover(entry: { el: HTMLElement; text: HTMLElement }, nodeId: number): void {
  entry.text.onmouseenter = (ev) => {
    const text = rowPopoverText(nodeId);
    if (!text) return;
    popover.textContent = text;
    popover.style.display = "block";
    popover.style.left = Math.min(window.innerWidth - 280, (ev as MouseEvent).clientX + 10) + "px";
    popover.style.top = (ev as MouseEvent).clientY + 12 + "px";
  };
  entry.text.onmouseleave = () => { popover.style.display = "none"; };
}

/** "via house(…)" attribution chips for definition-body rows (plan 15). */
function chipElements(nodeId: number): HTMLElement[] {
  if (!focused || !lastGoodProgram) return [];
  const program = lastGoodProgram;
  const groups = callSitesFor(program, focused.view, nodeId).filter((g) => g.site !== -1);
  return groups.map((g) => {
    let site: AnyNode | null = null;
    const stack: AnyNode[] = [...program.items];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.id === g.site) { site = n; break; }
      stack.push(...childrenOf(n));
    }
    const chip = document.createElement("button");
    chip.className = "tl-chip";
    const callee = site && site.kind === "call" ? site.callee : "?";
    chip.textContent = "via " + callee + "(…)";
    if (site) {
      const span = site.span;
      chip.addEventListener("click", () =>
        view.dispatch({ effects: setCodeHighlight.of({ start: span.start, end: span.end }) }));
    }
    return chip;
  });
}

function renderTimeline(): void {
  if (!focused || !lastGoodProgram) return;
  const seen = new Set<HTMLElement>();
  const loop = loopUnderCursor();
  if (loop !== null) {
    // the loop under the cursor swaps in its iteration grid
    const grid = iterationGrid(lastGoodProgram, focused.view, loop);
    for (const row of grid.rows) {
      const sid = idTracker.stableOf(row.nodeId);
      if (sid === undefined) continue;
      const entry = timelineRow(sid);
      entry.text.textContent = firstLineAt(row.span.start, row.span.end);
      entry.ticks.replaceChildren(...row.cells.map(tickButton));
      wireRowHover(entry, row.nodeId);
      timeline.appendChild(entry.el);
      seen.add(entry.el);
    }
  } else {
    for (const row of executedStatements(lastGoodProgram, focused.view)) {
      const sid = idTracker.stableOf(row.nodeId);
      if (sid === undefined) continue;
      const entry = timelineRow(sid);
      entry.text.textContent = firstLineAt(row.span.start, row.span.end);
      const cells = cellElements(row.nodeId);
      entry.ticks.replaceChildren(
        ...(cells.length > 0 ? cells : row.steps.map(tickButton)),
        ...chipElements(row.nodeId));
      wireRowHover(entry, row.nodeId);
      timeline.appendChild(entry.el);
      seen.add(entry.el);
    }
  }
  for (const child of Array.from(timeline.children)) {
    if (!seen.has(child as HTMLElement)) child.remove();
  }
}

// ---------- code -> stage (selection dimming) ----------

function onSelection(): void {
  if (!lastGoodProgram || !lastDisplay) return;
  const range = view.state.selection.main;
  if (range.empty) {
    if (selectedOps !== null) { selectedOps = null; redraw(); }
  } else {
    const ops = opsForSpan(lastDisplay.ops, lastGoodProgram, { start: range.from, end: range.to });
    selectedOps = ops.length > 0 ? ops : null;
    redraw();
  }
  if (focused) renderTimeline(); // cursor moving in/out of a loop swaps views
  refreshGestures();             // Phase 5: affordances follow the selection
}

function redraw(): void {
  if (lastDisplay) render(lastDisplay);
}

// ---------- Phase 5: abstraction gestures (plan 28-33) ----------

const gesturesEl = document.getElementById("gestures")!;
const gestureChips = document.getElementById("gesturechips")!;

/** Number literal at (or just before) the cursor. */
function numberAt(pos: number): AnyNode | undefined {
  if (!lastGoodProgram) return undefined;
  const here = [...pathAt(lastGoodProgram, pos)].reverse().find((n) => n.kind === "number");
  if (here) return here;
  return pos > 0 ? [...pathAt(lastGoodProgram, pos - 1)].reverse().find((n) => n.kind === "number") : undefined;
}

/** Number literals fully inside a selection range, in source order. */
function numbersInRange(from: number, to: number): AnyNode[] {
  const out: AnyNode[] = [];
  visitAll((n) => { if (n.kind === "number" && n.span.start >= from && n.span.end <= to) out.push(n); });
  out.sort((a, b) => a.span.start - b.span.start);
  return out;
}

/** Top-level statements overlapping a selection, in source order. */
function statementsInRange(from: number, to: number): AnyNode[] {
  const out: AnyNode[] = [];
  if (lastGoodProgram) {
    for (const item of lastGoodProgram.items) {
      const isStmt = ["expr", "assign", "state", "repeat", "for", "if", "return", "group"].includes(item.kind);
      if (isStmt && item.span.start < to && from < item.span.end) out.push(item as AnyNode);
    }
  }
  return out;
}

/** A user-definition call statement at the cursor (for open-this-up). */
function callStmtAt(pos: number): AnyNode | undefined {
  if (!lastGoodProgram) return undefined;
  return [...pathAt(lastGoodProgram, pos)].reverse().find(
    (n) => n.kind === "expr" && n.expr.kind === "call" && lastGoodProgram!.defs.has(n.expr.callee));
}

function visitAll(fn: (n: AnyNode) => void): void {
  if (!lastGoodProgram) return;
  const stack: AnyNode[] = [...lastGoodProgram.items];
  while (stack.length > 0) {
    const n = stack.pop()!;
    fn(n);
    stack.push(...childrenOf(n));
  }
}

function gestureButton(label: string, run: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "gest-btn";
  b.textContent = label;
  b.addEventListener("click", run);
  return b;
}

/** Apply a gesture result as ONE undo step (plan 30); span-splicing keeps
 *  untouched rows' ids (D50). Failures show the friendly reason. */
function applyGesture(r: { ok: true; source: string; note: string } | { ok: false; reason: string }): void {
  if (!r.ok) { status.textContent = r.reason; return; }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: r.source },
    userEvent: "input.gesture",
  });
  status.textContent = r.note;
  view.focus();
}

function refreshGestures(): void {
  gesturesEl.replaceChildren();
  gestureChips.replaceChildren();
  if (!lastGoodProgram) return;
  const doc = view.state.doc.toString();
  const sel = view.state.selection.main;
  const nums = sel.empty ? [] : numbersInRange(sel.from, sel.to);
  const stmts = statementsInRange(sel.from, sel.to);
  const num = numberAt(sel.head);
  const callStmt = callStmtAt(sel.head);

  if (nums.length >= 2) {
    gesturesEl.appendChild(gestureButton("connect these", () => offerConnect(nums[0]!, nums[1]!)));
  } else if (num) {
    gesturesEl.appendChild(gestureButton("name this number", () => {
      const name = window.prompt("Name this number:");
      if (name) applyGesture(nameThisNumber(doc, lastGoodProgram!, num.id, name));
    }));
  }
  if (stmts.length >= 2) {
    const ids = stmts.map((s) => s.id);
    if (repeatThis(doc, lastGoodProgram, ids).ok) {
      gesturesEl.appendChild(gestureButton("repeat this", () => applyGesture(repeatThis(doc, lastGoodProgram!, ids))));
    }
    gesturesEl.appendChild(gestureButton("teach this", () => {
      const name = window.prompt("Name this part:");
      if (name) applyGesture(teachThis(doc, lastGoodProgram!, ids, name));
    }));
  }
  if (callStmt) {
    gesturesEl.appendChild(gestureButton("open this up", () => applyGesture(openThisUp(doc, lastGoodProgram!, callStmt.id))));
  }
}

/** Connect: name litA, then render each candidate as a preview chip (plan 29). */
function offerConnect(litA: AnyNode, litB: AnyNode): void {
  const name = window.prompt("Name the first number:");
  if (!name || !lastGoodProgram) return;
  const doc = view.state.doc.toString();
  const r = connectNumbers(doc, lastGoodProgram, litA.id, litB.id, name);
  gestureChips.replaceChildren();
  if (!r.ok) { status.textContent = r.reason; return; }
  for (const cand of r.candidates) {
    const chipEl = document.createElement("div");
    chipEl.className = "gest-chip";
    const canvas = document.createElement("canvas");
    canvas.width = 48; canvas.height = 36;
    const preview = previewFor(cand.source, 42);
    if (preview.ok) {
      const fit = thumbnailFit(preview.display.ops, 48, 36, 2);
      if (fit) {
        const c2 = canvas.getContext("2d")!;
        c2.setTransform(fit.scale, 0, 0, fit.scale, fit.dx, fit.dy);
        renderOps(c2, preview.display.ops);
        c2.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    const label = document.createElement("span");
    label.textContent = cand.note;
    chipEl.append(canvas, label);
    chipEl.addEventListener("click", () => { applyGesture(cand); gestureChips.replaceChildren(); });
    gestureChips.appendChild(chipEl);
  }
}

/** Run suggestions (plan 31): the spans findRepeatRuns accepts, for the
 *  studio to underline. Kept as a model call; the decoration overlay is a
 *  Phase 6 polish (the "repeat this" affordance already fires on selection). */
function repeatRunSpans(): { from: number; to: number; count: number }[] {
  if (!lastGoodProgram) return [];
  const byId = new Map<number, AnyNode>();
  visitAll((n) => byId.set(n.id, n));
  return findRepeatRuns(lastGoodProgram).map((run) => {
    const nodes = run.stmts.map((id) => byId.get(id)!).filter(Boolean);
    return {
      from: Math.min(...nodes.map((n) => n.span.start)),
      to: Math.max(...nodes.map((n) => n.span.end)),
      count: run.count,
    };
  });
}

// ---------- stage -> code (hit-test, highlight, annotate) ----------

// ---------- op focus (spec §1: focus order IS display order) ----------
// Browsing walks lastDisplay.ops front-to-back — the same array the renderer
// paints and hitTest indexes — so what a sighted user sees on top and what a
// screen-reader user hears last are the one order. Driven by the keyboard
// machine's focusOp effect (P6-T3) and exposed on __studio for the a11y gate.
let focusedOpIndex: number | null = null;

function drawFocusOutline(): void {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (focusedOpIndex === null || !lastDisplay) return;
  const op = lastDisplay.ops[focusedOpIndex];
  if (!op) return;
  const bb = opBounds([op]);
  if (!bb) return;
  overlayCtx.save();
  overlayCtx.strokeStyle = "#2a76c6";
  overlayCtx.lineWidth = 2;
  overlayCtx.strokeRect(bb.x0 - 2, bb.y0 - 2, bb.x1 - bb.x0 + 4, bb.y1 - bb.y0 + 4);
  overlayCtx.restore();
}

/** Set + outline the focused op (no speech); returns it. Speech is a separate
 *  step so the keyboard path can voice it through an announce EFFECT (D58)
 *  while the standalone a11y hook voices it directly. */
function setFocusedOp(i: number): DisplayOp | null {
  const ops = lastDisplay ? lastDisplay.ops : [];
  if (ops.length === 0) { focusedOpIndex = null; return null; }
  focusedOpIndex = ((i % ops.length) + ops.length) % ops.length;
  drawFocusOutline();
  return ops[focusedOpIndex]!;
}

function focusOp(i: number): void {
  const op = setFocusedOp(i);
  const ops = lastDisplay ? lastDisplay.ops : [];
  if (!op) { say("focus.none", {}); return; }
  say("focus.op", { kind: op.kind, index: (focusedOpIndex ?? 0) + 1, count: ops.length });
}

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
  drawHandles();
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
// ---------- Phase 4b: direct manipulation (op drags -> inversion) ----------
// (restored — the Phase 5 scaffold had stripped this shipped P4b-T4 wiring.)

const chip = document.createElement("div");
chip.id = "dragchip";
chip.style.cssText =
  "position:fixed;z-index:20;background:#333;color:#fff;font:11px system-ui;" +
  "padding:3px 7px;border-radius:4px;pointer-events:none;display:none;";
document.body.appendChild(chip);
let chipTimer = 0;

let opDrag: {
  opIndex: number;
  sx: number; sy: number;
  cx: number; cy: number;
  k: number;
  source: string;
  solve: DragSolve | null;
} | null = null;

function beginOpDrag(opIndex: number, sx: number, sy: number): void {
  opDrag = { opIndex, sx, sy, cx: sx, cy: sy, k: 0, source: view.state.doc.toString(), solve: null };
}

function renderEditedAt(source: string): void {
  if (!focused) return;
  const s = new Session(source, 42);
  if (isAnimated) s.advanceFrames(focused.k + 1);
  render(s.displayAt(focused.k));
}

const snap = (from: number, to: number): string =>
  Number.isInteger(from) ? String(Math.round(to)) : String(Math.round(to * 10) / 10);

function describeCand(solve: DragSolve, k: number): string {
  const edits = solve.candidates[k]!.edits;
  const body = edits.map((e) => e.from + " → " + snap(e.from, e.to)).join(", ");
  const more = solve.candidates.length > 1 ? "  ·  TAB: alternatives" : "";
  const lock = solve.unadjustable.length > 0 ? "  ·  " + solve.unadjustable.join("/") + " locked" : "";
  return body + more + lock;
}

function showChip(text: string, cx: number, cy: number): void {
  const rect = stage.getBoundingClientRect();
  chip.textContent = text;
  chip.style.left = rect.left + cx + 12 + "px";
  chip.style.top = rect.top + cy - 8 + "px";
  chip.style.display = "block";
}

function opDragMove(cx: number, cy: number): void {
  if (!opDrag || !focused || !lastGoodProgram) return;
  opDrag.cx = cx;
  opDrag.cy = cy;
  const dx = cx - opDrag.sx;
  const dy = cy - opDrag.sy;
  const ops = focused.view.display.ops;
  const solve = dragCandidates(lastGoodProgram, focused.view, ops, opDrag.opIndex, dx, dy);
  opDrag.solve = solve;
  if (solve.candidates.length === 0) {
    renderEditedAt(opDrag.source);
    showChip(solve.unadjustable.length > 0 ? solve.unadjustable.join("/") + " locked" : "—", cx, cy);
    return;
  }
  const k = opDrag.k % solve.candidates.length;
  const edited = applyCandidate(opDrag.source, lastGoodProgram, solve.candidates[k]!);
  renderEditedAt(edited);
  showChip(describeCand(solve, k), cx, cy);
}

function endOpDrag(): void {
  if (!opDrag || !lastGoodProgram) { opDrag = null; return; }
  const solve = opDrag.solve;
  if (solve && solve.candidates.length > 0) {
    const k = opDrag.k % solve.candidates.length;
    const edited = applyCandidate(opDrag.source, lastGoodProgram, solve.candidates[k]!);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: edited },
      userEvent: "input.drag",
    });
    window.clearTimeout(chipTimer);
    chip.style.display = "block";
    chipTimer = window.setTimeout(() => { chip.style.display = "none"; }, 3000);
  } else {
    chip.style.display = "none";
  }
  opDrag = null;
}

window.addEventListener("keydown", (ev) => {
  if (!opDrag || ev.key !== "Tab" || !opDrag.solve) return;
  ev.preventDefault();
  if (opDrag.solve.candidates.length > 1) {
    opDrag.k = (opDrag.k + 1) % opDrag.solve.candidates.length;
    opDragMove(opDrag.cx, opDrag.cy);
  }
});

stage.addEventListener("mousedown", (ev) => {
  const { x, y } = stagePos(ev);
  // point handles win over program input (plan 20)
  const handle = handleAt(x, y);
  if (handle) {
    ev.preventDefault();
    const doc = view.state.doc.toString();
    beginGesture(doc, (dx, dy) => handle.applyBoth(handle.x + dx, handle.y + dy));
    const startX = ev.clientX;
    const startY = ev.clientY;
    const onMove = (m: MouseEvent): void => moveGesture(m.clientX - startX, m.clientY - startY);
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      endGesture();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return;
  }
  // Phase 4b (plan 23): every op is draggable on a FOCUSED frame — inversion
  // works out which literals honestly cause the motion.
  if (focused && lastGoodProgram) {
    const opIndex = hitTest(x, y);
    if (opIndex >= 0) {
      ev.preventDefault();
      beginOpDrag(opIndex, x, y);
      const onMove = (m: MouseEvent): void => {
        const p = stagePos(m);
        opDragMove(p.x, p.y);
      };
      const onUp = (): void => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        endOpDrag();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }
  }
  pointer.down = true;
  if (isAnimated) pendingEvents.push({ type: "pointer-pressed", x, y });
});
stage.addEventListener("mouseup", (ev) => {
  const { x, y } = stagePos(ev);
  pointer.down = false;
  if (isAnimated) pendingEvents.push({ type: "pointer-released", x, y });
});
stage.addEventListener("mouseleave", clearHover);

// ---------- keyboard (spec §1/§7.3 step 35): keydown -> kstep -> effects ----------
// The pure machine (src/ui/keys.ts, D58) decides every transition; the studio
// only interprets its effects onto the SAME entry points the pointer uses
// (dragCandidates / applyCandidate) and speaks via announce effects. No keymap
// logic lives here. focusOp effects outline; announce effects are the ONE
// voice, enriched with the op kind / count / candidate note the studio holds.
let kbState: KState = K_INITIAL;
let kbDrag: { source: string; solve: DragSolve | null; k: number } | null = null;
const K_KEYS = new Set(["[", "]", "Enter", "Escape", "Tab",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

function spokenNote(solve: DragSolve, k: number): string {
  return solve.candidates[k]!.edits.map((e) => e.from + " to " + snap(e.from, e.to)).join(", ");
}

function kbSolve(opIndex: number, dx: number, dy: number, candidate: number): void {
  if (!focused || !lastGoodProgram) return;
  if (!kbDrag) kbDrag = { source: view.state.doc.toString(), solve: null, k: 0 };
  const ops = focused.view.display.ops;
  const solve = dragCandidates(lastGoodProgram, focused.view, ops, opIndex, dx, dy);
  const k = solve.candidates.length ? candidate % solve.candidates.length : 0;
  kbDrag.solve = solve;
  kbDrag.k = k;
  renderEditedAt(solve.candidates.length
    ? applyCandidate(kbDrag.source, lastGoodProgram, solve.candidates[k]!)
    : kbDrag.source);
  drawFocusOutline();
}

function kbCommit(): void {
  if (!kbDrag || !kbDrag.solve || !lastGoodProgram || kbDrag.solve.candidates.length === 0) return;
  const edited = applyCandidate(kbDrag.source, lastGoodProgram, kbDrag.solve.candidates[kbDrag.k]!);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: edited },
    userEvent: "input.drag",
  });
}

function kbCancel(): void {
  if (kbDrag) renderEditedAt(kbDrag.source);
  drawFocusOutline();
}

/** Enrich an announce effect's slots with what only the studio knows (the op
 *  kind + count, the candidate note), then voice it through say(). */
function sayK(key: string, slots: Record<string, unknown>): void {
  const ops = lastDisplay ? lastDisplay.ops : [];
  const op = focusedOpIndex !== null ? ops[focusedOpIndex] : undefined;
  const s: Record<string, unknown> = { ...slots };
  if (key === "focus.op" && op) {
    s["kind"] = op.kind; s["count"] = ops.length; s["index"] = (focusedOpIndex ?? 0) + 1;
  } else if (key === "drag.start" && op) {
    s["kind"] = op.kind;
  } else if (kbDrag?.solve && kbDrag.solve.candidates.length) {
    if (key === "drag.candidate") {
      s["note"] = spokenNote(kbDrag.solve, kbDrag.k);
      s["index"] = kbDrag.k + 1; s["count"] = kbDrag.solve.candidates.length;
    } else if (key === "drag.commit") {
      s["note"] = "changed " + spokenNote(kbDrag.solve, kbDrag.k);
    }
  }
  say(key as AnnouncementKey, s);
}

function playKEffects(effects: readonly KEffect[]): void {
  for (const e of effects) {
    if (e.kind === "focusOp") setFocusedOp(e.index);
    else if (e.kind === "solveDrag") kbSolve(e.index, e.dx, e.dy, e.candidate);
    else if (e.kind === "commit") kbCommit();
    else if (e.kind === "cancel") kbCancel();
    else if (e.kind === "announce") sayK(e.key, e.slots);
  }
  // Drag session ends when the machine returns to browse (after the batch, so
  // the drag.commit / drag.cancel announce effect above still saw the solve).
  if (kbState.mode === "browse") kbDrag = null;
}

function onKeyDown(ev: KeyboardEvent): void {
  if (!K_KEYS.has(ev.key)) return;
  // Typing in the editor, or a live mouse op-drag, owns the key.
  if (document.activeElement && (document.activeElement as HTMLElement).closest?.("#editor")) return;
  if (opDrag) return;
  const opCount = lastDisplay ? lastDisplay.ops.length : 0;
  const candCount = kbDrag?.solve ? kbDrag.solve.candidates.length : 1;
  const r = kstep(kbState, { key: ev.key, shift: ev.shiftKey }, opCount, candCount);
  if (r.effects.length === 0 && r.state === kbState) return; // nothing to do
  ev.preventDefault();
  kbState = r.state;
  playKEffects(r.effects);
}
window.addEventListener("keydown", onKeyDown);

// ---------- go ----------

rebuild(houseRow);

// Debug handle for smoke tests and the manual acceptance script.
(window as unknown as Record<string, unknown>)["__studio"] = {
  view,
  frameCount: () => session?.frameCount() ?? 0,
  statusText: () => status.textContent,
  valuesAt: (pos: number) => valuesAtPos(pos),
  startCompletion: () => startCompletion(view),
  acceptCompletion: () => acceptCompletion(view),
  // P6-T2 a11y: focus an op by display index, outline + speak it, and read
  // back the one aria-live region (for the AH.1 VoiceOver gate).
  focusOp: (i: number) => { focusOp(i); return { index: focusedOpIndex, live: live.textContent }; },
  liveText: () => live.textContent,
  // 4b op-drag driver (restored): script a drag at stage coords.
  opDrag: (sx: number, sy: number, cx: number, cy: number, tabs = 0) => {
    const opIndex = hitTest(sx, sy);
    if (opIndex < 0 || !focused) return { hit: false };
    beginOpDrag(opIndex, sx, sy);
    opDragMove(cx, cy);
    for (let i = 0; i < tabs; i++) {
      if (opDrag && opDrag.solve && opDrag.solve.candidates.length > 1) {
        opDrag.k = (opDrag.k + 1) % opDrag.solve.candidates.length;
        opDragMove(cx, cy);
      }
    }
    const solve = opDrag?.solve ?? null;
    endOpDrag();
    return { hit: true, unadjustable: solve?.unadjustable ?? [], candidates: solve?.candidates.length ?? 0 };
  },
  // Phase 5 gesture drivers (headless scripting for the manual/smoke checks).
  gesture: (kind: string, arg?: string) => {
    if (!lastGoodProgram) return { ok: false, reason: "no program" };
    const doc = view.state.doc.toString();
    const sel = view.state.selection.main;
    let r: { ok: true; source: string; note: string } | { ok: false; reason: string };
    if (kind === "name") {
      const num = numberAt(sel.head);
      if (!num) return { ok: false, reason: "no number at cursor" };
      r = nameThisNumber(doc, lastGoodProgram, num.id, arg ?? "size");
    } else if (kind === "repeat") {
      r = repeatThis(doc, lastGoodProgram, statementsInRange(sel.from, sel.to).map((s) => s.id));
    } else if (kind === "teach") {
      r = teachThis(doc, lastGoodProgram, statementsInRange(sel.from, sel.to).map((s) => s.id), arg ?? "part");
    } else if (kind === "open") {
      const c = callStmtAt(sel.head);
      if (!c) return { ok: false, reason: "no call at cursor" };
      r = openThisUp(doc, lastGoodProgram, c.id);
    } else {
      return { ok: false, reason: "unknown gesture" };
    }
    if (r.ok) applyGesture(r);
    return r.ok ? { ok: true, note: r.note } : { ok: false, reason: r.reason };
  },
  runSpans: () => repeatRunSpans(),
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

// ---------------------------------------------------------------------------
// P4a-T7 — Phase 4a wiring plan (after gates Q-prerequisites; see spec §6):
//
// 17. Completions: a CM autocomplete source from completionsAt(lastGood,
//     doc, pos); render each option with a 64x48 preview canvas painted
//     from previewFor(docWithCandidate, seed) — throttle to the highlighted
//     option (arrowing swaps previews; never run all candidates at once).
//
// 18. Palette pane (right column, collapsible): paletteEntries thumbnails
//     via previewFor + thumbnailFit at 48x36; click inserts at the cursor's
//     statement boundary; drag onto the stage inserts with `center:`/`at:`
//     rewritten to the drop point via the SAME splice rules as drag.ts.
//
// 19. Number drags: cursor affordance (ew-resize) over NumberLits; pointer
//     capture on mousedown; dx * step per 2px; apply() -> editor dispatch
//     (one undo group per gesture) -> debounced rerun. Color/angle literals
//     open widgetAt-backed inline pickers.
//
// 20. Point handles: pointHandles(lastGood, doc) drawn as ring handles on
//     the overlay; dragging calls applyBoth with the pointer's stage
//     coords; same undo-group rule.
//
// 21. Axes overlay: while the scrubber sits inside a group (activeGroupsAt
//     non-empty), draw axesGlyph for each active group's matrix, innermost
//     brightest; label with the group's arg summary ("rotate 96° around
//     (160, 120)").
//
// 22. As ever: no math in this file. Steps, snapping, matrix work, splice
//     rules — all live in src/ui and src/flow with tests.

// ---------------------------------------------------------------------------
// P4b-T4 — Phase 4b wiring plan (after gates V-prereqs; spec §4):
//
// 23. Every op is draggable (D47): pointerdown on a hit-tested op with no
//     literal ring handle starts a 4b drag; ring handles keep priority
//     (they ARE the rank-0 candidate for pure-literal anchors).
//
// 24. Drag tick: dx,dy from gesture start -> dragCandidates(program, view,
//     ops, opIndex, dx, dy) -> applyCandidate(rank k) -> previewFor swap.
//     Keep `k` (the chosen rank) across ticks; recompute candidates each
//     tick (coefficients can be iteration-dependent only via the FOCUSED
//     occurrence, which is fixed for the gesture — cache the chains, solve
//     fresh).
//
// 25. TAB during drag: k = (k+1) % candidates.length, re-base the preview
//     from the ORIGINAL source (never stack edits). Show the current
//     edit as a chip near the pointer: "55 -> 65 · TAB: move just this one".
//
// 26. Axis locks: solve.unadjustable axes render a lock glyph and the
//     pointer delta is projected onto the live axis before solving.
//
// 27. Release: splice via the editor dispatch (ONE undo step), keep the
//     chip 3 s with an "alternatives" affordance that re-applies a
//     different candidate as a fresh undo step. All solving stays in
//     src/flow — this file moves pixels and dispatches text.

// ---------------------------------------------------------------------------
// P5-T6 — Phase 5 wiring plan (after gates AA-prereqs; spec §5):
//
// 28. Affordances by selection: a number gets "name this" (and, with a
//     second number picked, "connect these"); a multi-statement selection
//     gets "repeat this" (if findRepeatRuns/repeatThis accept) and "teach
//     this"; a call statement to a user def gets "open this up".
//
// 29. Candidate gestures (connect/repeat-decline/teach) surface chips with
//     live previews via previewFor(candidate.source) — same swap machinery
//     as 4a completions; decline reasons render as friendly inline notes.
//
// 30. Apply = ONE editor dispatch of the gesture's source as a single undo
//     group; because gestures span-splice, the timeline's untouched rows
//     keep their DOM elements (D50 identity pin) — verify live, like §6.6.
//
// 31. Run suggestions: underline findRepeatRuns spans faintly; clicking the
//     underline is the same as selecting the run and choosing "repeat this".
//
// 32. teach/open place the cursor in the new definition / at the inlined
//     block so the next gesture (e.g. name a size inside the def) chains.
//
// 33. As ever: no transformation logic here. Unification, placement,
//     folding, synthesis all live in src/ui/{gestures,synth}.ts with tests;
//     this file dispatches text and paints chips.

// P6 wiring (spec §1–2): 34. aria-live region fed ONLY by announce();
// roles + labels composed from cards; op focus order = display order.
// 35. Keyboard: route keydown through kstep(); interpret effects
// (focusOp -> outline + announce; solveDrag -> the 4b drag-tick pipeline
// at the machine's dx/dy/candidate; commit/cancel -> same paths as
// pointer release/esc). 36. Rotation handles: draw arcs from
// rotationHandles(); drag maps pointer angle -> apply(deg), one undo
// step. 37. Re-pause: after committing a drag on an animated program,
// re-focus the SAME frame index. No logic in this file — pacing and
// pixels only.
