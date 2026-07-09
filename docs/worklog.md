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
