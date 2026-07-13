# Worklog

## T1 — lexer — 2026-07-08
Done: indent/dedent lexer with paren-aware line joining, packed colors, both
angle suffixes. Tests: 0→4 green (lexer describe).
Surprises/deviations: none — but see the T2 fix below for a latent bug here.
Open questions for Phase 4+: none.

## T2 — parser + node ids — 2026-07-08
Done: full recursive-descent Chalk v1 parser with learner diagnostics and
pre-order ids via walk.visit. Tests: 4→16 green (parser.test.ts 12/12).
Surprises/deviations: (1) `Definition.params` (CONTRACT) has no field for the
internal binding name of `at: base` — resolved without touching the contract
by pointing the param's span at the binding name (decision D30). (2) Lexer
bug found here: after a paren-continuation line, `atLineStart` stayed true,
so the closing line's newline was swallowed as a blank line — fixed.
Open questions for Phase 4+: if params ever need richer metadata (defaults,
types), promote D30's convention to an explicit `bind` field then.

## T3 — valueEquals + encode/decodeValue — 2026-07-08
Done: structural equality + columnar round-trip encoding (tags = VTAG).
Tests: 16→18 green.
Surprises/deviations: none.

## T4 — evaluator fast mode — 2026-07-08
Done: tree-walking evaluator, one finishStep choke point plus finishWrite /
callEnter / callExit accounting that consumes step indices in BOTH modes
(op stepIndex is serialized into goldens, so numbering may never depend on
mode). Tests: 18→22 green (static-picture cases; runSetup implemented early
because every T4 test drives setup).
Surprises/deviations: the step/row accounting model is not fully pinned by
the Phase 0 spec alone — Phase 2/3 tests (steps/lines/stack/state/cells) pin
it. Recorded as D31 before goldens froze it.

## T5 — frame loop, inputs, PRNG — 2026-07-08
Done: evalFrame (frame blocks then matching event blocks, source order),
pointer binding with .down, state mutated in place. Tests: 22→28 green
(evaluator.test.ts 10/10 — the T7 trace case went green here too, since the
tracer wiring shipped with T4's plumbing).
Surprises/deviations: none.

## T6 — history — 2026-07-08
Done: keyframe snapshots every 30 frames (entering state, deep), 600-frame
display ring, defensive input copies. Tests: unchanged (its cases run
through Session and went green at T8).
Surprises/deviations: Session must snapshot the entering state BEFORE
running the frame — History.record receives entering state + the resulting
display in one call, and by then the live state has mutated.

## T7 — instrumented mode + trace store — 2026-07-08
Done: wiring landed with T4/T5 (makeTracer in frame.ts; D25 write-row
encoding: strIdx = name, string values move to `a`). Tests: green within
the T5 delta; the modes-agree determinism case went green at T8.
Surprises/deviations: while eyeballing the FIRST golden run, found binops
double-counted (evalBinOp called finishStep and evalExpr finished again) —
caught by hand-recomputing bouncing-ball's op stepIndex (22 observed vs 19
expected). Fixed before any golden was committed. Lesson: the "eyeball the
goldens" step is not ceremony.

## T8 — Session + golden harness — 2026-07-08
Done: Session (advance, displayAt via ring/keyframe replay, stateAt,
traceAt); goldens generated and verified by hand for all four cases.
Tests: 28→52 green (determinism 7/7, goldens 4/4).
Surprises/deviations: scale-spiral's case file ships in Phase 0 and
golden.test.ts iterates every case file, so its golden must exist NOW for
the suite to be green; P3-T7 will regenerate it and assert byte-identity
(the engine is frozen, so this is a no-op check). Deviation from the
"generated at P3-T7" instruction recorded here deliberately.
Reviewed: deviation approved; P3-T7 becomes a byte-identity re-check.

## T9 — determinism suite — 2026-07-08
Done: whole file passes unmodified (same-seed identity over 240 frames,
scripted replay, keyframe replay on/off keyframes, deep-snapshot guard,
modes agree, seeds diverge). Tests: within T8's delta; suite total 56 green
(all 44 Phase 0 milestone tests + day-one guards), 104 red = Phase 1–3
stubs, by design.

## T10 / Gate C — performance — 2026-07-08
Done: PERF=1 bench green with no optimization work needed.
Numbers (medians, 15 reps after 5 warmups, Node on this machine):
  stress program:        50,007 steps/frame (target ~50k, honesty ±10% ✓)
  parse + fast @50k:     2.14 ms   (budget 100 ms — 47x headroom)
  instrumented @50k:     3.68 ms   (budget 30 ms — 8.2x headroom)
  fast @5k:              0.19 ms   (budget 5 ms — 26x headroom)
Surprises/deviations: the walker beats budget by an order of magnitude;
the compile-to-closures fallback (spec §7) stays unbuilt, as intended.

## Phase 0 gates — 2026-07-08
Gate A ✓ all Phase 0 milestone tests + goldens green (44/44 in Phase 0
files; guards green since day one).
Gate B ✓ determinism suite green unmodified.
Gate C ✓ budgets met, numbers above and in decisions D32.
T11 (debug UI) not built: no Phase 0 gate depends on it and the session
brief scoped Phase 0 to T1–T9 + gates. apps/debug still has its TODO;
revisit if a human wants to feel replay before Phase 2's studio wiring.
Reviewed: T11 skip approved; apps/debug is retired at Phase 4 design.

## P1-T1 — vocabulary registry — 2026-07-09
Done: 60 cards (7 builtins, 23 params, 24 constructs, 6 types) in the
exemplars' register. Tests: 56→58 green (meta describes execute twice via
the JARGON re-import in diagnostics-language.test.ts).
Surprises/deviations: none.

## P1-T2 — Lezer grammar — 2026-07-09
Done: full v1 token set as a line-agnostic token stream (D12); gen/
regenerated and committed (D14); styleTags extended. Tests: 58→61 green.
Surprises/deviations: the predicted ° friction did NOT need @external
tokens — maximal munch plus an in-@tokens @precedence list (LineComment,
Angle, Number, Label, Keyword, BuiltinName, Identifier, Op) settled every
overlap. Label includes its colon (Lezer tokens lack lookahead) — so
`as i:` tints the counter as a label; cosmetic only, drift guard unaffected.
Open questions for Phase 4+: if labels ever need exact spans in the editor,
split Label with an external tokenizer then.

## P1-T3 — hover resolution — 2026-07-09
Done: labelAt per the six header rules; Gate E sweep green on all four
examples. Tests: 61→73 green.
Surprises/deviations: keyword detection generalized from "start of node
span" to "keyword-shaped word under cursor" — safe because the lexer
reserves keywords, and it gives the manual gate full keyword coverage.

## P1-T4 — cross-highlight — 2026-07-09
Done: opsForSpan/spanForOp/ancestorIds. Tests: 73→80 green.
Surprises/deviations: (1) the fixture reads displayAt(0) on a session that
never advanced — Session.displayAt now serves static pictures from the
static layer (D5: setup's display IS every frame). (2) The fixture's
"house(at:" needle lands on the DEFINITION HEADER, not the call site —
rule (b) extended: a definition's header reads as a call site to itself
(selecting a signature selects what it makes; body selections stay
per-call).

## P1-T5 — annotation geometry — 2026-07-09
Done: annotationsFor all five op kinds + fmtNum. Tests: 80→86 green.
Surprises/deviations: none (exact deep-equals matched first run).

## P1-T6 — diagnosticsFor — 2026-07-09
Done: parse, else one guarded fast frame; one diagnostic max (D15).
Tests: 86→98 green.
Surprises/deviations: synthetic end-of-source tokens carry empty spans;
the parser now widens those to the previous character so a diagnostic
always points at something visible ("repeat 5 as i:" case).

## P1-T7 — editor extensions — 2026-07-09
Done: chalkHover (labelAt cards as tooltips off the last good parse),
chalkLint (diagnosticsFor -> CM diagnostics), codeHighlightField (maps
through changes, rebuilds on setCodeHighlight). Tests: unchanged at 98
(editor-state suite was already green at the EditorState level).

## P1-T8 — studio shell — 2026-07-09
Done: editor + live stage glue per the header plan; verified live in a
browser (house-row per goldens; bouncing-ball animates; broken edit ->
friendly diagnostic in #status + lint range with the stage frozen on the
last good picture; fix -> resumes; console clean). Tests: unchanged at 98.
Surprises/deviations: (1) canvas2d.ts (T11's renderer) implemented here —
the studio needs it even with apps/debug retired; added bg-free renderOps
for selection emphasis so the top layer doesn't repaint the background.
(2) tick() must catch frame-time ChalkErrors (parse+setup fine, frame
throws) or the RAF loop dies uncaught — found by driving the live studio.
Manual acceptance (§6) still pending as part of Gate G.

## P1-T9 / Gates D–F — 2026-07-09
Gate D ✓ all Phase 0+1 test files green (98 tests; every remaining red is
a Phase 2/3 stub by design). Goldens byte-identical.
Gate E ✓ the hover sweep is part of hover.test.ts — every call-argument
literal in every example resolves to a param: card.
Gate F ✓ PERF=1 editor-loop numbers (medians, 15 reps after 5 warmups):
  bouncing-ball:   0.16 ms   (budget 50 ms — ~300x headroom)
  house-row:       0.19 ms   (budget 50 ms — ~260x headroom)
  pointer-paint:   0.09 ms   (budget 50 ms — ~550x headroom)
  synthetic-500:   4.83 ms   (budget 100 ms — ~20x headroom)
Phase 0 budgets re-run, no regression: parse+fast @50k 2.37 ms (100);
instrumented @50k 3.77 ms (30); fast @5k 0.19 ms (5); stress 50,007 steps.
perf-flow/perf-state bench files stay skipped-red until their phases.
Session extension for the bench: displayAt(0)/stateAt(0) work on a fresh
session (entering frame 0 = post-setup state, NO_INPUT, not recorded).
Gate G: pending human — hallway script presented, awaiting result.
Reviewed: Gate G PASS recorded in decisions.md; Phase 1 deviations 1–3
approved. Deviation 1 hardened: peek purity asserted by tests/peek.test.ts
(added under the adding-tests-is-allowed ruling).

## P2-T2 — edit matching — 2026-07-09
Done: GumTree-lite matchPrograms (fingerprint anchors big-to-small with
span tiebreaks + bulk subtree pairing; same-kind positional recovery under
matched parents; pre-order fresh minting). Tests: 100→110 green (scenarios
+ invariants, first run).
Surprises/deviations: descending-size processing makes "root unmatched"
imply "subtree unmatched" (proof sketch in the commit); anchor pairing
re-verifies kinds so a fingerprint collision degrades to no-anchor rather
than a lying match (D17).
Open questions for Phase 4+: pass 2 will happily re-purpose a same-kind
slot across a total rewrite (circle line -> rect line keeps the stable id).
The invariants allow it and the timeline reads fine; revisit if Phase 4
attaches heavier state to ids.

## P2-T3 — scrubber model — 2026-07-09
Done: Session.traceSetup (runSetup's instrumented mode was already wired
at T7 — confirmed, not rebuilt, per review note); scrubView post-state op
cutoff; stepsForSpan statement completions. Tests: 110→115 green.
Surprises/deviations: none.

## P2-T4 — timeline rows — 2026-07-09
Done: executedStatements (first-completion order), iterationGrid
(last-direct-body-statement windows, D18 cap), executedInFrames.
Tests: 115→120 green.

## P2-T5 — ghosts — 2026-07-09
Done: onionLayers (pinned alphas, paint order) + trailOps (oldest-first).
Tests: 120→126 green (one flow-demo rode along).

## P2-T7 — flow demonstrations (Gate I) — 2026-07-09 (taken before P2-T6)
Done: Gate I 3/3 after one semantic fix. Tests: 126→127 green.
Surprises/deviations: executedInFrames rows must be LEAF statements
(state/assign/expr/return) — containers complete every frame and their
spans swallow their branches, so demo (b)'s rowFor("y = 220") would find
the `if` row instead of the clamp assign. iterationGrid keeps containers
(its test pins them). Taken ahead of P2-T6 because the fix is flow
semantics, not studio glue.
Reviewed: finding 1 approved; both row policies now documented in the
lines.ts header.

## P2-T6 — studio Phase 2 wiring — 2026-07-09
Done: frame slider (pause-on-drag, resume-at-end), scrubber -> scrubView
render + editor highlight, timeline keyed by stable ids, loop-under-cursor
grid swap, onion/trails compositing. Tests: unchanged at 127.
Surprises/deviations: staticOpsCount is derived from the trace's max
opEnd, one formula for traceAt and traceSetup views. Verified live:
timeline DOM rows are the SAME elements after a literal edit (stable ids
held, §6.6), scrub re-anchors, onion ghosts bracket the ball at three
alphas. Initial-load bug caught live: keepScrubPosition must apply only
to mid-edit refocus, or a fresh static load renders step 0 (blank).
Reviewed: finding 2 approved.

## P2-T8 / Gates H–K — 2026-07-09
Gate H ✓ all Phase 0-2 test files green (127 tests; the only reds are the
seven Phase 3 stub files). Goldens byte-identical (no diff since T8).
Gate I ✓ flow-demos 3/3. Gate J ✓ match scenarios + invariants 10/10.
Gate K ✓ PERF=1 numbers (medians, 15 reps after 5 warmups):
  match 500-line edit:  5.63 ms  (budget 10 ms — 1.8x headroom, tightest
                                  margin in the repo; escalation = memoize
                                  indexes in IdTracker.advance if it slips)
  scrubView @50k:       0.015 ms (budget 2 ms — ~130x headroom)
  iterationGrid @50k:   0.77 ms  (budget 15 ms — ~19x headroom)
Phase 0/1 budgets re-run, no regression: parse+fast @50k 2.40 ms (100);
instrumented @50k 4.00 ms (30); fast @5k 0.20 ms (5); editor loop
0.10-0.22 ms examples, 4.82 ms synthetic-500.
Gate L: pending human — manual script presented, awaiting result.
Reviewed: Gate L PASS recorded in decisions.md; Phase 2 findings 1–2
approved. Follow-through: lines.ts header documents both row policies;
pass 2 tightened per D33 (equal callees for call nodes) with a new
pinning test, tests/match-tightening.test.ts.

## P3-T1 — presentation primitives — 2026-07-09
Done: showValue pinned forms, valueGlyph, opBounds, thumbnailFit (D26/D27).
Tests: 129→138 green.
Surprises/deviations: first CONTRACT edit in the repo (D34): the Glyph tick
field was `degrees` in the type but `deg` in the same file's header rule
AND the pinned test — no implementation satisfied both; renamed to `deg`.

## P3-T2 — state model — 2026-07-09
Done: writeEvents/varsAtStep/stateRows/varSeries/sparkline;
Session.inputsAt (D24). Tests: 138→145 green.
Surprises/deviations: none — T7's write-row encoding matched the state.ts
header exactly (it was implemented FROM D25 in Phase 0), so the "reconcile
in the evaluator" contingency was not needed and goldens were untouched.

## P3-T3 — typed cells + aggregates — 2026-07-09
Done: valueCells/valuesForNode/numericSummary/stridedSamples/cellZoomMode.
Tests: 145→156 green — all four Gate N state-demos rode along.

## P3-T4 — display diff — 2026-07-09
Done: diffDisplay by (kind, sourceNodeId, occurrence), stepIndex excluded
(D28). Tests: 156→161 green.

## P3-T5 — call attribution — 2026-07-09
Done: callStackAt (post-state enter/exit replay), callSitesFor (innermost
open site per completion, -1 at top level). Tests: 161→164 green.
Surprises/deviations: APPROVED TEST-DEFECT FIX — the fixture needle
"house(at:" resolved by first occurrence to the DEFINITION HEADER (line 4),
where no `call` node can exist for any correct parser: the lookup was
unsatisfiable (same first-occurrence needle-collision class as P1-T4's
link-test finding). Implementation was verified against every assertion
via a scratch harness under the intended line-14 call site BEFORE asking;
review approved changing the needle to "house(at: (20" (both uses, nothing
else). Sibling sweep of every pathAt+indexOf+kind lookup across the test
files: no other unsatisfiable needles. One dormant hazard noted:
lines.test.ts's repeatNode uses indexOf("repeat"), which would hit
house-row's line-1 COMMENT if that fixture were ever pointed at house-row
(it currently only sees comment-free synthetic sources — no action).

## P3-T6 — studio Phase 3 wiring — 2026-07-09
Done: state panel (rows/glyphs/sparklines/write-flash + pointer row via
inputsAt), typed cells (figures / exact thumbnails / table-to-plot at the
28px threshold), the three hover semantics, diff toggle outlines,
"via house(…)" chips, and editor expression-value hover (chalkHover gains
an optional ValuesSource; the studio resolves a hover position to the
enclosing argument's value expression). Tests: unchanged at 164.
Surprises/deviations: verified live — post-state varsAtStep swap shows a
written var updated while a not-yet-written one holds its entering value;
scale-spiral's radius hover lists all twelve values.

## P3-T7 — demonstrations + golden identity — 2026-07-09
Done: Gate N's four state-demos went green at P3-T3 (they consume
valuesForNode + the P3-T2 model). Ruling follow-through: goldens
regenerated with npm run test:update — ALL FOUR files byte-identical
(sha1 equal before/after; git status clean), scale-spiral included. The
approved T8 deviation closes as specified: P3-T7 was a byte-identity
re-check, and the engine never drifted.

## P3-T8 / Gates M–O — 2026-07-09
Gate M ✓ npm test fully green: 164 passed / 0 failed across every Phase
0–3 file (15 skipped = PERF-gated dummies). Goldens byte-identical.
Gate N ✓ state-demos 4/4 (all twelve radii in order; strictly increasing
with correct summary; constant first differences with monotone sparkline;
exact thumbnails on every shape cell).
Gate O ✓ PERF=1 numbers (medians):
  writeEvents+stateRows @5k writes: 1.87 ms (budget 10 — 5.3x headroom)
  valuesForNode @50k:               1.02 ms (budget 5 — 4.9x headroom)
  varSeries 64-frame window:        0.50 ms (budget 80 — 160x headroom;
                                    the watched budget; no statesRange
                                    escalation needed)
  diffDisplay @500 ops:             0.27 ms (budget 2 — 7.4x headroom)
Full bench sweep, all phases, one run — no regressions:
  parse+fast @50k 2.90 (100); instrumented @50k 3.96 (30); fast @5k 0.21
  (5); editor loop 0.09–0.20 examples / 4.99 synthetic-500 (50/100);
  match 5.54 (10); scrubView 0.014 (2); iterationGrid 0.76 (15).
Gate P: pending human — script presented, awaiting result.

## P4a-T1 — bind field — 2026-07-10
Done: parser populates params[].bind (D37); hover + evaluator read bind
with the D30 span-slice fallback; tests/bind.test.ts added.
Tests: 162→163 green.

## P4a-T2 — group blocks — 2026-07-10
Done: the Chalk v1.1 extension end to end (parser, evaluator transform
stack + eager emit + rect lowering + diagnostics, D31 rows, 5 cards,
hover, Lezer keyword + gen/). Tests: 163→183 green.
Surprises/deviations: the engine keeps a PRIVATE affine implementation
(CLAUDE.md forbids engine->flow imports); the transform-viz
self-consistency test pins the two copies together. EvalContext stays
contract-clean via a WeakMap transform stack.

## P4a-T3 — transform viz — 2026-07-10
Done: matrixFor (with -0 normalization), activeGroupsAt (lexical
containment + open call sites, latest-arg decode), axesGlyph.
Tests: 183→192 green.

## P4a-T4 — completions + previews — 2026-07-10
Done: completionsAt + previewFor (session-isolated; ChalkErrors as data);
defaultStatementFor exported as the one source of default text.
Tests: 192→202 green. The isolation pin holds.

## P4a-T5 — palette — 2026-07-10
Done: paletteEntries. Tests: 202→203 green.
Surprises/deviations: a zeroed def call (house(at: 0, ...)) errors on
base.x, but Gate R requires every palette preview ok — the header pins
previews as "a program whose display IS the thumbnail", so the PREVIEW
call (only) infers point-vs-number per param from member access on the
binding and fills FALLBACK_DEFAULTS; inserts stay zeroed per D38.
Reviewed (2026-07-10): interpretation call 1 (palette preview type
inference from body member access) APPROVED.

## P4a-T6 — draggable literals — 2026-07-10
Done: numberDragAt, widgetAt, pointHandles per D39. Tests: 203→214 green
(Gate R's drag half landed here — create-demos 2/2 before the studio).

## P4a-T7 — studio wiring — 2026-07-10
Done: plan 17-22 (autocomplete + live preview swap via CM's lazy info
callback; palette pane with drag-drop point rewriting through
pointHandles on the lone statement; number/angle gestures with one undo
step per drag; native color picker; overlay point handles with drag
priority; anchored axes overlay). Tests: unchanged at 214.
Surprises/deviations: (1) @codemirror/autocomplete added (D41). (2) The
manual script pins the axes at the PIVOT (160,120); axesGlyph maps the
local origin, so anchorOf (the matrix's fixed point) was added to
flow/transform and the studio shifts the glyph — placement only, solve
in flow. Verified live end to end; console clean.
Reviewed (2026-07-10): interpretation call 2 (anchorOf axes placement at
the transform fixed point) APPROVED.

## P4a-T8+T9 / Gates Q–S — 2026-07-10
Gate Q ✓ suite 215/215 green; the four pre-existing goldens byte-identical
(sha-checked before/after regeneration); pinwheel's golden generated and
eyeballed numerically — four blades pivot exactly at (160,120), 90°
apart, advancing 3° clockwise per frame. It pinwheels.
Gate R ✓ create-demos 2/2 (blank -> completion -> preview -> commit ->
drag -> bigger circle with 0 fresh / 0 dropped; palette exact and fully
thumbnail-able).
Gate S ✓ PERF=1 (medians): previewFor 0.02–0.11 ms per example (budget
20); completionsAt synthetic-500 0.026 ms (budget 2); drag loop 0.04 ms
(budget 10). Full five-file sweep green, no regressions anywhere:
parse+fast 2.32 (100); instrumented 3.81 (30); fast 0.20 (5); editor
loop 0.08–0.26 / 4.93 (50/100); match 6.01 (10); scrubView 0.017 (2);
iterationGrid 0.74 (15); writeEvents+stateRows 1.90 (10); valuesForNode
1.04 (5); varSeries 0.54 (80); diffDisplay 0.27 (2).
Gates T and U: pending human — scripts presented, awaiting results.
4b designer note: instrumented headroom now 3.81 of 30 ms (spec §8 asked).

## P4b-T0 — trig determinism — 2026-07-10
Done: both trig sites round Math.cos/sin to the 1e-9 grid (D42); the
evaluator's transform layer restructured from a pre-composed affine matrix
to an UNCOMPOSED group-spec stack folded innermost-first, so the natural
R·S·(local-around)+around+move op order is reproduced bit-exact (pinned by
determinism-trig) while nesting still composes. Only pinwheel's golden
regenerated; four trig-free goldens sha-identical. Tests: 217→220 green.
Committed alone per instruction. Surprises: the op ORDER (not just the
rounding) is load-bearing — a pre-baked matrix computes cos*240 which can't
be bit-identical to cos*80.

## P4b-T1 — chainAt — 2026-07-10
Done: post-hoc affine chain reconstruction (D43) — literals unit terms;
counters/state/random/pointer opaque at recorded values; product rule
(both termful -> opaque); param CHASE through callStackAt. Tests: 220→green
(chainAt block). Surprises: none.

## P4b-T2 — attrChain — 2026-07-10
Done: ANCHOR_SOURCES mapping + active matrices as constants (D44).
Tests: provenance 8/8.
Surprises/deviations: the house a.y ground truth pins term order
[lit40(-1), lit220(+1)] — subtracted term first — which the shipped
addChains (id-ascending, guard-pinned) structurally CANNOT produce. Values
are provably correct (chainValue + coeffs match); only order differs. Ran
the test, confirmed it's pure ordering, and reconciled per D48: attrChain
canonicalizes returned anchor/size terms to (coeff, id) order. Term order
is presentation only — inversion ranks by |Δlit|/source order (D45), never
chain order. Recorded D48; flagged for review.

## P4b-T3 — inversion (Gate W) — 2026-07-10
Done: scalarCandidates (per-term Δ/coeff, gentlest-first); dragCandidates
solving from attrChain's WORLD anchor — decoupled axes reduce to Δ/coeff,
coupled (rotated) axes use a joint 2x2 per-literal-pair solve so BOTH world
axes land exactly; opaque axes -> unadjustable; dedup + total-|Δ| rank +
cap 6; applyCandidate descending-span splices with the D39 formatter.
Tests: invert 6/6 (Gate W), drag still 10/10. Surprises: the pinwheel
oracle forced the joint solve — independent per-axis on world chains leaves
a c·(Δ/d) cross-error = 7·tanθ, huge for a 99° blade; the 2x2 solve cancels
it, and the test's 1px tolerance is then purely snapping (|M|·0.5). D39
formatter extracted to src/util/litformat.ts (ui<->flow can't import each
other); drag.ts reuses it.

## P4b-T4 — studio direct manipulation — 2026-07-10
Done: plan 23-27 — every focused-frame op draggable, rank[0] applied live,
TAB cycles (re-based), pointer chip with snapped values + lock/alt hints,
one undo step per gesture, chip lingers 3 s. Tests: unchanged.
Verified live: house two answers (55->65 / TAB 20->50), ball y-lock
(160->185 only), pinwheel blade edits (250,120) through the matrix and
stays a pinwheel; console clean. UX note: committing a drag re-animates
an animated program and clears focus — re-pause to drag again (matches the
manual script).
Reviewed: re-pause-to-drag noted as a Phase 6 polish candidate (keep the
focused frame across a committed drag on animated programs).

## P4b-T5+T6 / Gates V-X — 2026-07-10
Gate V ✓ full suite 232 green (25 skipped = PERF dummies); four trig-free
goldens byte-identical to their phase0-gates shas; pinwheel stable since
its single T0 regeneration.
Gate W ✓ provenance 8/8 + invert 6/6 + determinism-trig 3/3 — the house's
two honest answers with both predictions holding, respread-vs-shift, ball
axis lock, rotated blade landing where pointed.
Gate X ✓ PERF=1 (medians): dragCandidates 0.052 ms/3 (house-row),
0.006 ms/5 (@50k), full drag tick 0.06 ms/12 (bouncing-ball). No cross-
phase regression: parse+fast 2.75/100, instrumented 4.31/30, fast 0.22/5,
match 6.16/10, scrubView 0.014/2, iterationGrid 0.78/15, previewFor
0.06/20, completionsAt 0.021/2, writeEvents+stateRows 2.22/10,
valuesForNode 0.98/5, varSeries 0.55/80, diffDisplay 0.263/2.
Gates Y (manual) and Z (human) pending — scripts presented, awaiting result.

## P5-T0 — synth + oracle fix — 2026-07-13
Done: affineText/pointText/splice per D56. five-houses golden shipped in
the delta already (spec §0 said it wouldn't) — regenerated byte-identical,
all six goldens sha-verified unmoved; eyeballed five brown rects at
20/75/130/185/240. Tests: synth block 2/2.
Surprises/deviations: the samePicture oracle (defined here) used full
serializeDisplayList, which embeds sourceNodeId/stepIndex — provably
unsatisfiable across any gesture (a static program's state decl must
precede the shape reading it, shifting both ids and steps; picture held).
REVIEWED + APPROVED as a real D50 flaw: added serializeVisual (bg +
geometry + fill, provenance columns exempt) in render/displayList.ts,
pointed samePicture at it, amended D50 to two co-required clauses (visual
equality + the IdTracker untouched pin), pinned serializeVisual's
discrimination in tests/visual.test.ts (insensitive to id shift, sensitive
to a 1px move and to reordering). serializeDisplayList untouched.

## P5-T1 — nameThisNumber + validName — 2026-07-13
Done: validName (identifier-shaped, not keyword/builtin/taken); name
ThisNumber emits `state <name> = <value>` after the last state decl (D51)
and rewrites the use site; picture held; Gate AB (untouched ids) green.
Tests: nameThisNumber 2/2 + Gate AB 1/1.
Surprises/deviations: APPROVED TEST-DEFECT FIXES (helpers only, no
assertions touched). (1) litAt did pathAt(indexOf("radius: 20")) landing on
the label, finding no number — rewritten to the first NumberLit with
span.start >= indexOf(needle) via visit. (2) Sweep found a second: stmtAt
did pathAt(indexOf("house(at:"/"hut(at:")) landing on the `to house(at:...`
DEFINITION HEADER (not the call) — rewritten to the first expr statement
whose text begins with the needle. Both same class as the P3-T5/P1-T4
needle collisions. Sweep otherwise clean (stmts, stmtOf, the equal-values
lastIndexOf+len delta all resolve correctly).
