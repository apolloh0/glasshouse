# Phase 3 spec — See the state

Phase 3 makes data visible. Timeline cells graduate from marks to values
rendered by type; every expression can show every value it took; the state
panel keeps all `state` variables (and inputs — inputs are state) on screen
with per-frame sparklines; volume is handled by aggregates and plots, never
truncation of meaning; and the diff view says what changed between frames.

Phase 3 **requires Phases 0–2 complete** (gates A–L). No new tracing is
added: Phase 0 already records every expression completion with its typed
value — Phase 3 is decoding and presentation (D25).

**Scope change (D23):** transform-frame visualization (`group` blocks) moves
from this phase to the start of Phase 4. Rationale in the decision log; the
language surface stays frozen through Phase 3, which also freezes goldens.

## 1. Definitions

**Canonical value text** — `showValue` (`src/ui/format.ts`): the one string
form per value type. **Glyph** — `valueGlyph` (`src/ui/glyphs.ts`): values
drawn as themselves (swatch / tick / dot / figure). **Thumbnail (D27)** —
exact geometry: `thumbnailFit` scales real display ops into a cell box;
never a re-drawn approximation.

**Cell (D26)** — a statement completion rendered by type: assignments are
`value` cells, op-emitting calls are `ops` cells (thumbnails), control flow
is a `mark`. Expression-level values are NOT cells; they surface on hover
via `valuesForNode`.

**Write event (D25 refinement of T7)** — a write row carries the var name in
`strIdx`, the assign/state-decl node in `nodeId`, the value in
`(valueTag, a, b)`; string-valued writes put the value's intern index in `a`.

**State row** — per var, in declaration order: entering value, writes during
the focused frame, leaving value. A setup trace has null entering values and
initializers as writes: the panel shows variables being born.

**Zoom mode (D26)** — one threshold: cell width >= 28 px shows figures,
below shows the row as a plot. **Sparkline (D29)** — pinned point geometry;
flat series center; nulls gap.

**Diff (D28)** — ops pair by (kind, sourceNodeId, occurrence); stepIndex is
ignored; a moved shape is changed, never removed+added.

## 2. Scope

**In:** value text/glyphs/thumbnails; typed cells + hover values;
aggregates (summary, strided samples) + zoom mode; state panel model
(writes, per-step vars, series, sparklines); `Session.inputsAt` (D24);
display diff; call-stack attribution (`src/flow/stack.ts`); the
scale-spiral example + golden; studio wiring; perf gates.

**Deferred:** `group` blocks + transform visualization (Phase 4, D23);
autocomplete/palette/draggable literals/direct manipulation (Phase 4);
abstraction gestures (Phase 5); cross-frame aggregate caching (escalation
only); thumbnails for multi-op cells beyond bounding-box fit (fine as-is).

## 3. Ordered tasks

**P3-T1 — Presentation primitives.** `showValue`, `valueGlyph`, `opBounds`,
`thumbnailFit`. Green: `tests/format.test.ts`, `tests/glyphs.test.ts` (pure).

**P3-T2 — State model.** `writeEvents`, `varsAtStep`, `stateRows`,
`varSeries`, `sparkline`; `Session.inputsAt`. Green: `tests/state.test.ts`.
Note: this task pins T7's write-row encoding (D25) — if T7 was implemented
differently, reconcile THERE and record it; the encoding in the header of
`src/flow/state.ts` is the contract.

**P3-T3 — Typed cells + aggregates.** `valueCells`, `valuesForNode`,
`numericSummary`, `stridedSamples`, `cellZoomMode`. Green:
`tests/cells.test.ts`.

**P3-T4 — Diff.** `diffDisplay`. Green: `tests/diff.test.ts`.

**P3-T5 — Call attribution.** `callStackAt`, `callSitesFor`. Green:
`tests/stack.test.ts`.

**P3-T6 — Studio wiring.** Plan appended to `apps/studio/main.ts`: the state
panel pane (rows, glyphs, sparklines, write flash), typed cells in the
timeline with the three hover semantics (row -> all values; column -> world
at step via `varsAtStep` + scrubView; cell -> jump canvas to its step),
zoom-driven table-to-plot, diff toggle on the frame slider, "via house(...)"
attribution chips. Manual script: §6.

**P3-T7 — Demonstrations.** Green: `tests/state-demos.test.ts` (Gate N).

**P3-T8 — Perf.** Green: `bench/perf-state.test.ts` under `PERF=1` (Gate O).

## 4. Exit gates

**Gate M — full regression.** `npm test` green across Phases 0–3. Goldens
byte-identical EXCEPT the one intended addition: `scale-spiral` gets a
golden generated at P3-T7 (`npm run test:update`, inspect, commit).

**Gate N — scaleFactor by inspection.** `tests/state-demos.test.ts`: the
three questions answered from the trace of `scale-spiral.chalk` — all
twelve radius values in order; strictly increasing with a correct summary;
constant first differences with a monotone sparkline; and every shape cell
carrying an exact thumbnail.

**Gate O — budgets.** writeEvents+stateRows <= 10 ms @ ~5k writes;
valuesForNode <= 5 ms @ ~50k steps; varSeries <= 80 ms @ 64-frame window;
diffDisplay <= 2 ms @ 500 ops.

**Gate P — the user test.** Three participants answer the three scaleFactor
questions about `scale-spiral.chalk` in under thirty seconds each, by
looking, with no arithmetic — using only the row hover and the state panel.
Record the result in `docs/decisions.md` (as Gates G and L were).

## 5. Layering

No new directories. `src/flow` additions (state, cells, diff, stack) and
`src/ui` additions (format, glyphs) inherit their directories' existing
rules — pure, DOM-free, host TYPES only — already enforced by
`tests/layering.test.ts` unchanged.

## 6. Manual acceptance script (P3-T6)

Open bouncing-ball, run ~60 frames, pause on a floor-contact frame.
(1) The state panel shows y and speed with entering values, the writes of
the focused frame, and sparklines; speed's flash fires on the flip and its
sparkline shows the sawtooth. (2) Hover the `y = y + speed` row: every value
it took this frame (one) and — zoomed out on the frame axis — the arc as a
plot. (3) Hover a column in the timeline: the canvas scrubs to that step
and the panel shows `varsAtStep`. (4) Hover a circle cell: an exact
thumbnail; click: the canvas jumps to that step. (5) Toggle diff while
stepping one frame: the moved circle outlines as CHANGED. (6) Load
house-row: rect rows carry "via house(...)" chips; clicking one highlights
the call site. (7) Load scale-spiral: answer the three questions yourself,
by looking; if you can't do it in thirty seconds, neither can a learner.

## 7. Escalation path

If varSeries misses budget: add a batched `Session.statesRange(from, to)`
that replays each keyframe segment once (contract change — decision entry)
rather than caching in flow code. If valuesForNode misses: add a per-node
row index to StepStore built lazily on first query per trace (engine
change — decision entry; keep the columns append-only). If thumbnails look
cramped for multi-op cells, resist per-op layout; the bounding-box fit is
the contract (D27) — adjust the cell size in the studio instead.
