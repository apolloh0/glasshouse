# Phase 2 spec — Follow the flow

Phase 2 makes time visible. The learner can scrub a frame step by step and
watch the picture assemble, read which lines ran in what pattern, slide
through recorded frames, and see motion as onion-skins and trails. It also
retires the project's second-scariest risk: **node identity across edits**,
so everything the timeline attaches to survives typing.

Phase 2 **requires Phases 0 and 1 complete** (gates A–G). The flow tests
call the parser, evaluator, and Session throughout.

## 1. Definitions

**Stable id (D16)** — a second identity layer minted by `IdTracker`
(`src/host/ids.ts`) over per-parse pre-order ids (D7, unchanged). Traces and
goldens never see stable ids; the editor-side panes key on them so a
re-parse doesn't reshuffle the timeline.

**Matching (P2-T2)** — GumTree-lite, two passes, fully specified in the
`src/lang/match.ts` header: fingerprint anchors top-down (biggest subtrees
first, position as tiebreak only), then same-kind positional recovery
bottom-up under matched parents, then honest fresh ids. The invariants —
total, injective, kind-preserving, deterministic — are enforced by test and
are not negotiable: **an honest reset always beats a wrong match.**

**Focused frame** — the frame the scrubber and timeline operate on. Focusing
frame k costs one `Session.traceAt(k)` (two-tier tracing, Phase 0); focusing
a static picture costs one `Session.traceSetup()` (new, D21).

**Scrub position (D20)** — post-state: position `step` shows the world after
step `step` completes. `scrubView` returns the op cutoff for partial
rendering plus the completing node's span for the editor highlight.

**Iteration window (P2-T4)** — the loop's last direct body statement
completes exactly once per iteration; windows are the intervals between
those completions. Grid rows are the statements lexically inside the loop;
a null cell is a branch that didn't run — the pattern the essay wants seen.

**Ghost layer (D19)** — onion-skin frames at pinned alphas 0.30/0.18/0.08
by distance, at most 3 per side, returned in paint order. Trails are
oldest-first display slices at a stride. Ghosts never enter display lists,
traces, or goldens.

## 2. Scope

**In:** fingerprints + subtree/parent indexes (shipped, tested); edit
matching + IdTracker; scrubber model + partial rendering; executed-lines
rows; iteration grid; cross-frame execution pattern; frame slider wiring;
onion-skin + trails; setup tracing (D21); studio integration; perf gates.

**Deferred:** typed value cells, sparklines, table-to-plot, per-node
aggregates, the state panel (Phase 3); attributing loop-called definition
statements to call sites (needs call-tree provenance, Phase 3+); multi-frame
diff highlighting (Phase 3); any browser-automation test harness — flow
logic stays pure and vitest-tested; the studio keeps a manual script (D22).

## 3. Ordered tasks

**P2-T1 — Fingerprints. SHIPPED**: `src/lang/fingerprint.ts` is implemented
and `tests/fingerprint.test.ts` is green. Read both before starting P2-T2;
if matching needs the salient-field definition to change, that's a
decision-log entry, and goldens are unaffected (fingerprints are editor-side).

**P2-T2 — Matching.** Implement `matchPrograms` per its header. Green:
`tests/match.test.ts` (scenarios + invariants). `runSetup`/engine untouched.

**P2-T3 — Scrubber model.** Implement `runSetup` instrumented mode (D21) if
T5 didn't already, `Session.traceSetup`, then `scrubView`/`stepsForSpan`.
Green: `tests/steps.test.ts`.

**P2-T4 — Timeline rows.** Implement `executedStatements`, `iterationGrid`,
`executedInFrames`. Green: `tests/lines.test.ts`.

**P2-T5 — Ghosts.** Implement `onionLayers`, `trailOps`. Green:
`tests/frames.test.ts` (exact deep-equals; pure).

**P2-T6 — Studio wiring.** Frame slider under the stage; scrubber under the
editor (appears when a frame is focused); timeline pane listing executed
rows keyed by STABLE id (IdTracker.advance after every good parse); onion
and trails toggles compositing ghost layers at their pinned alphas. Plan in
`apps/studio/main.ts` (Phase 2 section). Manual script: §6.

**P2-T7 — Flow demonstrations.** Green: `tests/flow-demos.test.ts` (Gate I).

**P2-T8 — Perf.** Green: `bench/perf-flow.test.ts` under `PERF=1` (Gate K).

## 4. Exit gates

**Gate H — full regression.** `npm test` green across Phases 0–2; goldens
byte-identical (nothing in Phase 2 may change program output).

**Gate I — the essay's demos, automated.** `tests/flow-demos.test.ts`:
(a) scrubbing house-row reveals exactly one shape per completing call and
reaches every partial picture; (b) the bouncing-ball clamp lines execute in
exactly the frames where the drawn ball sits on the floor — the conditional's
pattern is real, not cosmetic; (c) trails reconstruct the arc: monotone
fall, exact floor contact, bounce.

**Gate J — identity honesty.** All matching scenarios AND invariants green,
including the wholesale-rewrite reset case.

**Gate K — budgets.** match ≤ 10 ms on a 500-line one-literal edit;
`scrubView` ≤ 2 ms and `iterationGrid` ≤ 15 ms on the ~50k-step trace.
Slider and scrubber must feel like dragging, not requesting.

**Gate L — manual script (§6)** performed and its result recorded in
`docs/decisions.md`.

## 5. Layering additions (enforced by tests/layering.test.ts)

    src/flow    steps, lines, frames — PURE  -> may import: lang, engine,
                                                render, util, host TYPES only
                                                (TraceView; never `new Session`)

`src/flow` is subject to the same DOM and editor-library bans as `src/ui`.
Session construction stays app-level; flow functions receive views.

## 6. Manual acceptance script (P2-T6)

Open `npm run dev:studio`, load bouncing-ball, let it run ~100 frames, pause.
(1) Drag the frame slider: the ball replays its arc; the frame number tracks.
(2) Click a frame to focus it: the scrubber appears; drag it — the stage
shows the partial frame, the editor highlights the completing line, the
statement rows light in completion order. (3) Toggle onion-skin: six ghosts
at three fading alphas bracket the ball. (4) Toggle trails: the arc appears
as a dotted history. (5) Load house-row (static): the scrubber scrubs the
DRAWING, shape by shape; the timeline shows rect/triangle firing five times.
(6) Edit a radius mid-scrub: after the re-parse the timeline rows do NOT
flicker or reorder (stable ids held); the scrubbed step re-anchors sanely.

## 7. Escalation path

If Gate K's match budget fails: memoize fingerprint/size/parent indexes per
parse (compute once in IdTracker.advance), bucket pass-1 candidates by
fingerprint in a Map, and only then consider capping pass-1 to subtrees of
size ≥ 3. If matching QUALITY disappoints (ids churn in the manual script),
prefer strengthening tiebreaks over adding passes — and when in doubt,
reset honestly. If `iterationGrid` misses budget, precompute a per-node
completion index from the trace once per focus, not per query.
