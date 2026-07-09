# CLAUDE.md — Glasshouse (Phases 0–3)

Phase 0: deterministic, replayable, instrumented interpreter for the Chalk
language (`docs/phase0-spec.md`, tasks T1..T11, gates A–C).
Phase 1: the first learner-facing environment — editor + live stage where
every token explains itself (`docs/phase1-spec.md`, tasks P1-T1..P1-T9,
gates D–G).
Phase 2: follow the flow — step scrubber, executed-lines timeline, frame
slider, onion-skin/trails, and stable node identity across edits
(`docs/phase2-spec.md`, tasks P2-T1..P2-T8, gates H–L).
Phase 3: see the state — typed timeline cells, expression value hover, the
always-on state panel with sparklines, aggregates + table-to-plot, frame
diff, call attribution (`docs/phase3-spec.md`, tasks P3-T1..P3-T8, gates
M–P). The language surface is FROZEN through Phase 3 (D23).
**Phases are strictly ordered**: finish each phase's gates before starting
the next; work each phase's tasks in order.

## Commands

- `npm test` — full suite. The suite is the contract: your job is to make it green.
- `npm run test:update` — regenerate golden snapshots (only when a change to
  goldens is intended; inspect the diff before committing).
- `npm run bench` — perf gates (skipped unless `PERF=1`).
- `npm run typecheck` — must stay green at every commit.
- `npm run dev` — debug UI (T11 only).

## Hard invariants (violating any of these is a bug, even if tests pass)

1. **Determinism.** Nothing in `src/` may read wall-clock time, `Math.random`,
   locale, or any other ambient nondeterminism. All randomness flows through
   `src/engine/prng.ts`; all time is the frame index. `tests/purity.test.ts`
   greps for violations — do not weaken it.
2. **Display-list equality is the definition of output.** Two runs are "the
   same" iff their serialized display lists are byte-identical, frame by frame.
   Never compare pixels; never round numbers to make tests pass.
3. **One evaluator, two modes.** `fast` and `instrumented` must be the same
   code path with tracing behind `if (ctx.tracer)` hooks — never a forked
   implementation. Divergence between modes is the worst class of bug here
   (the environment would show learners a lie).
4. **Do not edit files under `src/` marked `// CONTRACT` without recording
   why in `docs/decisions.md`.** These types encode architecture decisions
   from the design plan; changing them is allowed but must be deliberate.
5. **Tests define done.** Do not delete or loosen an assertion to get green.
   If a test is genuinely wrong, fix it and add a decision-log entry.

## Architecture map and allowed dependencies

    src/lang    lexer, parser, AST, node ids      -> may import: util
    src/engine  values, evaluator, frame, trace,
                history, stdlib, prng             -> may import: lang, render(types), util
    src/render  display list types + Canvas2D     -> may import: util only
    src/host    Session (parse/run/history/trace) -> may import: everything above
    src/meta    vocabulary card registry          -> may import: lang, engine (types)
    src/ui      hover/link/annotate/diagnose,
                ALL PURE, no DOM                  -> may import: lang, engine, render, meta, util
    src/flow    scrubber/timeline/ghost models,
                ALL PURE, no DOM                  -> may import: lang, engine, render, util,
                                                     host TYPES only (never `new Session`)
    src/editor  Lezer grammar + CodeMirror glue   -> may import: ui, meta, lang, util, @codemirror/*, @lezer/*
    apps/debug  throwaway Phase 0 UI              -> may import: host only
    apps/studio Phase 1 shell                     -> may import: anything

The ENGINE stays dependency-free: `@codemirror`/`@lezer` imports are banned
outside `src/editor` and `apps` (enforced by `tests/layering.test.ts`, as is
the no-DOM rule for the rest of `src/`). The Lezer tree is presentation only
— it must never reach `src/engine`, `src/lang`, `src/ui`, or `src/meta` (D11).

## Chalk language notes you cannot infer from the code alone

- Labeled arguments are **mandatory** on every call with arity >= 1. There are
  no positional arguments anywhere in the language.
- Assignment is legal only inside `every frame:` and `when ...:` blocks.
  `state` declarations are legal only at top level. The parser rejects both
  violations with plain-language diagnostics (see T2 tests).
- Blocks are indentation-delimited (Python-style INDENT/DEDENT, 2-space soft
  convention, tabs rejected).
- A program with no `every frame:` block is a static picture: setup draws
  once and that display list is frame 0 (and every frame). Setup draw ops in
  a program *with* frame blocks become constant `staticOps` prepended to every
  frame's ops. Setup cannot read input or assign.
- Angle literals: `30°` or `30deg` (both lex to the same token).

## Performance budgets (measured by `bench/perf.test.ts`, medians)

- parse + fast-mode frame eval of the ~50k-step stress program: <= 100 ms
- instrumented frame eval @ ~50k steps: <= 30 ms
- fast-mode frame eval @ ~5k steps: <= 5 ms
- Phase 1 editor loop (hand-parse + Lezer-parse + fast run + 5 hovers +
  1 opsForSpan, `bench/perf-editor.test.ts`): <= 50 ms on the examples,
  <= 100 ms on the 500-line synthetic program
- Phase 2 (`bench/perf-flow.test.ts`): matchPrograms <= 10 ms on a 500-line
  one-literal edit; scrubView <= 2 ms and iterationGrid <= 15 ms on the
  ~50k-step stress trace
- Phase 3 (`bench/perf-state.test.ts`): writeEvents+stateRows <= 10 ms @ ~5k
  writes; valuesForNode <= 5 ms @ ~50k steps; varSeries <= 80 ms @ 64-frame
  window; diffDisplay <= 2 ms @ 500 ops

If the tree-walker misses budget: profile first, micro-optimize the hot loop
(node-kind switch, no allocation per step, reused Value scratch), and only
then consider the compile-to-closures fallback described in spec section 7.
Do not reach for the compiler before the walker is proven too slow.

## Workflow expectations

- One task per session where possible; finish with `npm test` + `npm run
  typecheck` output pasted into the commit message body.
- Goldens: first successful implementation run uses `npm run test:update`,
  then commit the generated files under `tests/golden/cases/` and eyeball them.
- Keep stubs' `TODO("Tn")`/`TODO("P1-Tn")` markers until the task's tests
  pass, then remove.
- After editing `src/editor/chalk.grammar`, run `npm run grammar` and commit
  the regenerated `src/editor/gen/` files (D14). Never hand-edit gen/.
- Vocabulary lives ONLY in `src/meta/cards.ts`. If a hover, tooltip, or
  error message needs words, they come from a card or the diagnostics
  wording rules — never inline strings scattered through the UI.
- Stable ids (Phase 2) exist ONLY editor-side: panes key on them, the engine
  never sees them, goldens never contain them. When matching is in doubt,
  reset honestly (D17) — never ship a clever match that can mis-attribute.
- Values shown anywhere go through `showValue`/`valueGlyph` (Phase 3). Two
  panes printing one value differently is a bug in src/ui/format.ts, not a
  styling choice. Thumbnails come from thumbnailFit over REAL ops (D27).
- When something in the spec is ambiguous, pick the simplest interpretation,
  implement it, and record the choice in `docs/decisions.md` — do not stall.
