# Phase 0 spec — the engine spike

Goal: prove the riskiest claim in the Glasshouse design before building any
product UI — that a fully deterministic, replayable, step-instrumented
interpreter for Chalk meets the performance budgets. Everything here exists to
pass three exit gates, restated at the bottom.

## 0. Definitions

**Step.** One step = the completed evaluation of one AST node (statement or
expression), counted in pre-order completion order within a frame, starting at
0 each frame. A `circle(center: (10, 20), radius: 5, fill: #FF0000)` statement
costs roughly 6 steps (two number literals, a point literal, a number, a color,
the call). The stress program in `bench/` is sized by this definition to land
near 50,000 steps per frame.

**Frame.** One evaluation of all `every frame:` blocks (plus any event blocks
whose events fired this frame), given `(state_k, inputs_k)`, producing
`(displayList_k, state_{k+1})`. Frame index is the only clock.

**Output.** The serialized display list (`src/render/displayList.ts`,
`serializeDisplayList`). Byte equality of serialized display lists is the
system's definition of "same output".

**Determinism contract.** `run(source, seed, inputScript)` must produce
byte-identical outputs and byte-identical traces on every execution, on every
machine, in both execution modes.

## 1. Scope

In scope: the Chalk v1 grammar per `docs/decisions.md` D1–D8 (state decls,
assignment, calls with mandatory labels, `repeat`/`for`/`if`, `to ... end`
definitions, `every frame:`, `when pointer ...:`/`when key ...:`, member
access, arithmetic/comparison/boolean operators, number/color/point/angle/
bool/string literals); the stdlib in `src/engine/stdlib.ts`; fast +
instrumented evaluation; frame history with keyframes + replay; the trace
store; golden/determinism/perf suites; the throwaway debug UI.

Out of scope (explicitly deferred): `group(...)` transform blocks, sprites,
provenance tracking, editor integration and Lezer, node-id stability across
edits (ids need only be stable for a given source string — see
`src/lang/nodeIds.ts`), onion-skinning, any styling of the debug UI.

## 2. Tasks, in order

Each task lists the tests that define it. A task is done when its tests pass,
`npm run typecheck` is green, and no earlier task's tests broke.

### T1 — Lexer (`src/lang/lexer.ts`)

Tokenize Chalk source: identifiers, keywords, number/string literals, color
literals (`#RRGGBB`), angle suffix (`°` or `deg`), punctuation, operators,
newlines, and synthetic INDENT/DEDENT tokens computed from leading spaces
(2-space convention; any consistent indent per block accepted; tabs are a
lexer diagnostic). Comments (`//` to end of line) are skipped. Every token
carries a `Span`.
Done when: the lexer cases in `tests/parser.test.ts` (`describe("lexer")`)
pass.

### T2 — Parser + AST + node ids (`src/lang/parser.ts`, `nodeIds.ts`)

Recursive-descent parser producing the `Program` AST in `src/lang/ast.ts`.
Enforce as parse-time diagnostics (never runtime errors): labels mandatory on
all call arguments; `state` only at top level; assignment only inside frame/
event blocks; `else` only after `if`. Diagnostics are plain-language and point
at the offending span (see wording examples in `tests/parser.test.ts`).
Node ids are assigned by `assignNodeIds` in pre-order; parsing the same source
twice yields identical ids (golden traces depend on this).
Done when: all of `tests/parser.test.ts` passes.

### T3 — Values + environment plumbing (`src/engine/values.ts` helpers)

The `Value` union and the `expect*` type-check helpers are already
implemented (CONTRACT — the evaluator catches `ValueTypeError` and rethrows
with the argument's span, spec §6 wording). Implement the T3 section at the
bottom of the file: `valueEquals` and `encodeValue`/`decodeValue` used by the
trace store (tags must match `trace.ts` `VTAG`).
Done when: `tests/values.test.ts` passes.

### T4 — Evaluator, fast mode (`src/engine/evaluator.ts`)

Tree-walking evaluation of one frame: setup handling (staticOps model per
CLAUDE.md), statements, expressions, `repeat`/`for`/`if`, user `to`
definitions with labeled parameters (call-by-value), stdlib calls emitting
display ops via `src/engine/stdlib.ts`, member access on points/colors.
Runtime errors carry the node span and a plain-language message. No tracer
yet — but structure every node-completion site so a tracer hook can be added
in T7 without restructuring (single `finishStep(node, value)` choke point).
Done when: `tests/evaluator.test.ts` (all non-trace cases) passes.

### T5 — Frame loop, inputs, PRNG, virtual clock (`src/engine/frame.ts`)

`evalFrame(program, state, inputs, mode)` per the CONTRACT signature.
`FrameInputs` carries pointer state and this-frame events; `when` blocks run
after the `every frame:` block, in source order, only for matching events.
`random(from:, to:)` consumes the engine PRNG (already implemented,
mulberry32) whose state is part of `EngineState` and therefore snapshotted by
history. No other time or randomness source exists.
Done when: frame-loop cases in `tests/evaluator.test.ts` pass (state persists
across frames, events fire, RNG stream is stable and part of state).

### T6 — History: keyframes + replay (`src/engine/history.ts`)

Record every frame's inputs; snapshot full `EngineState` every
`KEYFRAME_INTERVAL` (30) frames; keep a ring of the last `DISPLAY_RING` (600)
display lists. `deriveFrame(k)` returns the exact display list and exiting
state for any recorded frame, replaying forward from the nearest keyframe when
the ring doesn't have it. Snapshots must be deep (mutating live state must not
corrupt history).
Done when: `tests/determinism.test.ts` cases "replay-from-keyframe" pass.

### T7 — Instrumented mode + trace store (`src/engine/trace.ts` wiring)

The columnar `StepStore` is implemented (CONTRACT). Wire the evaluator's
`finishStep` / write sites to a `Tracer` when `mode === "instrumented"`:
record `(nodeId, kind, value, opStart, opEnd)` per step and a `write` row per
state/local assignment. Both modes must produce byte-identical display lists —
this is asserted, per frame, by the determinism suite.
Done when: trace cases in `tests/evaluator.test.ts` and the "modes-agree"
determinism case pass.

### T8 — Session + golden harness (`src/host/run.ts`, `tests/golden/`)

`Session` ties it together: `load(source, seed)`, `advance(inputs)` /
`advanceFrames(n, script)`, `displayAt(k)`, `traceAt(k)` (re-derives state at
k, re-runs that one frame instrumented), `stateAt(k)`. The golden test runs
each case in `tests/golden/cases/*.case.json` for its configured frames with
its scripted inputs and snapshots serialized display lists (first N frames
full, rest as a rolling FNV-1a hash — helper provided). `UPDATE_GOLDEN=1`
writes snapshots.
Done when: `npm run test:update` generates snapshots for all three example
programs, you have eyeballed them for sanity (does the ball actually move?),
and `npm test` is green thereafter.

### T9 — Determinism suite green (`tests/determinism.test.ts`)

Same seed + script, two fresh Sessions: identical serialized output for all
frames. Replay-from-keyframe equals straight-line run. Instrumented equals
fast. Different seed changes output of the RNG example (guards against a
"deterministic because random is broken" false pass).
Done when: the whole file passes unmodified.

### T10 — Performance (`bench/perf.test.ts`)

Meet the budgets in CLAUDE.md at the medians, warmups excluded. The stress
generator builds a program near 50k steps/frame (assert the actual step count
is within 10% using the trace, so the benchmark measures what it claims).
Optimization order: profile; kill per-step allocation (reuse a scratch Value,
avoid closures in the hot switch); intern names to indices at parse time;
only then consider closure compilation (spec §7). Record what was done in
`docs/decisions.md`.
Done when: `PERF=1 npm run bench` passes on the dev machine; note the numbers
in the decision log.

### T11 — Debug UI (`apps/debug/`)

Deliberately ugly, zero styling effort: a textarea, a Run button, a canvas
rendering via `src/render/canvas2d.ts`, a frame slider over recorded history,
a step slider that (for the focused frame) renders ops `0..s` and prints the
current step's node span + value, and a seed input. Pointer events on the
canvas feed `FrameInputs` live. This exists so a human can *feel* replay and
scrubbing work; it is not the product.
Done when: you can load `examples/bouncing-ball.chalk`, watch it run, drag
both sliders, and see identical replays after reload with the same seed.

## 3. Exit gates (all three, or Phase 0 is not done)

Gate A — `npm test` green including goldens for the three examples.
Gate B — determinism suite green: byte-identical output across runs, across
replay-from-keyframe, and across execution modes.
Gate C — `PERF=1 npm run bench` green at the stated budgets, with measured
numbers recorded in `docs/decisions.md`.

## 4. Chalk quick reference for this phase

    paper(color: #FDF6E3)                 // background; setup only
    state y = 40                          // top level only
    x = 10                                // ILLEGAL at top level (parse error)

    to house(at: base, height: h):        // params are the labels
      rect(left: base.x, top: base.y - h, width: h * 1.2, height: h,
           fill: #C46A3D)
    end

    every frame:
      y = y + 1
      if y > 240: y = 0
      circle(center: (160, y), radius: 12, fill: #2A76C6)

    when pointer pressed:
      y = pointer.y                       // pointer is a builtin point + .down

    repeat 5 as i:                        // i counts 1..5
      house(at: (30 + i * 45, 230), height: 40)

Stage is 320 x 240, origin top-left, y down. `pointer` is a builtin name bound
per frame from `FrameInputs` (a point with an extra `.down` boolean member).

## 5. Stdlib for Phase 0 (already specified in `src/engine/stdlib.ts`)

paper, circle, ellipse, rect, triangle, line — draw ops; random — value
builtin. Parameter labels, types, defaults, and one-line docs live in the
registry; the evaluator resolves labeled args against `params` order-
independently, applies defaults for omitted labels, and rejects unknown
labels with a diagnostic naming the function and the label.

## 6. Error philosophy (applies to every diagnostic you write)

Plain language, name the label or construct, point at the span, suggest the
fix when it is unambiguous. "`radius:` needs a number — right now it's a
color" is the register. Never print an AST dump or a stack trace at a learner.

## 7. Escalation path if the walker misses budget (only after T10 profiling)

Compile each function body once to a JS closure chain (node -> closure
returning Value), keeping the same `finishStep` hook so instrumentation stays
mode-switched, not forked. This typically buys 5–20x. It is more code and
harder to debug — hence last resort, and it must not change a single golden.
