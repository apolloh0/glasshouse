# Glasshouse — Phases 0–4b

The deterministic execution engine for **Glasshouse**, a learnable programming
system in the spirit of Bret Victor's *Learnable Programming*, and **Chalk**,
its small co-designed language. Phase 0 exists to kill the project's biggest
risk before any UI is built: prove that a fully instrumented, deterministic,
replayable interpreter meets the performance budgets.

**Phase 0 delivers no product features.** It delivers an engine that:

1. parses and runs Chalk programs (see `examples/`),
2. reproduces any frame exactly (seeded RNG, virtual clock, recorded inputs),
3. traces every step of a focused frame within budget (<= 30 ms @ ~50k steps),
4. proves it, continuously, via the test suites in `tests/` and `bench/`.

**Phase 1 delivers the first learner-facing feature set** on top of that
engine: a CodeMirror editor beside a live stage where every token explains
itself — hover cards from a single vocabulary registry, code<->stage
cross-highlighting, argument annotation drawn on the shapes themselves, and
diagnostics in plain language. Spec: `docs/phase1-spec.md`. Phase 1 tasks
require Phase 0's exit gates first.

**Phase 2 makes time visible**: a step scrubber that assembles the picture
one completing call at a time, an executed-lines timeline with the essay's
iteration-gap patterns, a frame slider over recorded history, onion-skin and
trails — and stable node identity across edits so none of it flickers while
you type. Spec: `docs/phase2-spec.md`.

**Phase 3 makes data visible**: timeline cells become typed values (figures,
swatches, ticks, exact shape thumbnails), any expression shows every value
it took, the state panel keeps all `state` variables and inputs on screen
with sparklines, aggregates turn tables into plots instead of truncating,
and a diff view says what changed between frames. Spec:
`docs/phase3-spec.md`.

**Phase 4a starts creation**: the `group` transform extension (Chalk v1.1),
statement completions that preview live before you commit, a parts palette
of exact thumbnails, and every literal as a control — draggable numbers,
color and angle widgets, on-stage point handles. Provenance-driven direct
manipulation is Phase 4b. Spec: `docs/phase4a-spec.md`.

**Phase 4b is the summit**: grab any shape — computed, looped, rotated —
and drag it. Affine provenance chains reconstructed from the existing
trace say which literals could honestly cause the motion; the candidates
preview live ("just this house" vs "the spacing between houses"); the
edit snaps, preserves program identity, and lands where you pointed.
Spec: `docs/phase4b-spec.md`.

## Quickstart

    npm install
    npm test           # red until implemented — the suite IS the spec
    npm run bench      # perf gates (PERF=1), Phase 0 + editor loop
    npm run grammar    # regenerate the Lezer parser after editing chalk.grammar
    npm run dev        # ugly three-pane debug UI (Phase 0, task T11)
    npm run dev:studio # the Phase 1 studio (task P1-T8)

## Where things live

    docs/phase0-spec.md   Phase 0 spec: tasks T1..T11 in order, gates A-C
    docs/phase1-spec.md   Phase 1 spec: tasks P1-T1..P1-T9, gates D-G
    docs/phase2-spec.md   Phase 2 spec: tasks P2-T1..P2-T8, gates H-L
    docs/phase3-spec.md   Phase 3 spec: tasks P3-T1..P3-T8, gates M-P
    docs/phase4a-spec.md  Phase 4a spec: tasks P4a-T1..P4a-T9, gates Q-U
    docs/phase4b-spec.md  Phase 4b spec: tasks P4b-T0..P4b-T6, gates V-Z
    docs/decisions.md     ADR-lite log of decisions already made
    CLAUDE.md             working agreement for Claude Code
    src/lang              lexer, parser, AST (Chalk)
    src/engine            values, evaluator, frame loop, trace, history, stdlib
    src/render            display list (the definition of "output") + Canvas2D
    src/host              Session: ties parse -> run -> history -> trace together
    src/meta              the vocabulary registry (every hover card lives here)
    src/ui                hover/link/annotate/diagnose — pure, DOM-free
    src/editor            Lezer grammar (+ gen/) and CodeMirror glue
    src/flow              scrubber / timeline / ghost models — pure, DOM-free
    apps/studio           the studio (apps/debug retired, D40)
    examples/             Chalk programs used by golden + determinism tests
    tests/                the executable definition of done
    bench/                performance budget gates

## Status

Contracts (types, stdlib metadata, trace store, PRNG, AST walker, card
schema, seed grammar + language support, AST fingerprints, IdTracker) are
implemented. Everything marked
`TODO("Tn")` (Phase 0) or `TODO("P1-Tn")` (Phase 1) is open work. The guard
tests (purity, layering, grammar tolerance, card quality) are green from day
one; milestone tests go green task by task. Work `docs/phase0-spec.md` fully,
then `docs/phase1-spec.md`.
