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

import { TODO } from "../../src/util/todo.js";

TODO("P1-T8", "studio wiring per the plan in this file");

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
