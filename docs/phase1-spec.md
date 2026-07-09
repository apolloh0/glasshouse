# Phase 1 spec — Read the vocabulary

Phase 1 turns the Phase 0 engine into the first learner-facing environment:
a CodeMirror editor beside a live stage where **every token explains itself**.
The plan's requirements R1 (readable vocabulary) and R2 (meaning shown in
context, on the picture) are the whole phase.

Phase 1 **requires Phase 0 complete** (gates A, B, C green). Many Phase 1
tests call the parser and evaluator; they stay red on `TODO(T…)` until then.

## 1. Definitions

**Card** — one entry in the vocabulary registry (`src/meta/cards.ts`): a
title, a one-line plain-language meaning, optional detail and example. Keys:
`builtin:circle`, `param:circle.radius`, `construct:repeat`, `type:angle`.

**Hover resolution** — the pure function `labelAt(program, offset)` mapping a
cursor position to a card plus use-site context ("radius of this circle").
Rules are pinned in the `src/ui/hover.ts` header; the tables in
`tests/hover.test.ts` are ground truth.

**Cross-highlight** — `opsForSpan` (code→stage: which display ops does this
selection own, including everything a selected block produced across all
loop iterations) and `spanForOp` (stage→code: the call that drew this op).
Rules pinned in `src/ui/link.ts`.

**Annotation** — the on-canvas overlay (`annotationsFor`) that draws each
argument of a hovered shape *on the shape*: center markers, radius/width/
height arrows, corner labels, all carrying live values. Geometry pinned in
`src/ui/annotate.ts`; exact numbers in `tests/annotate.test.ts`.

**Two parsers, one truth (D11)** — Lezer parses for the *editor*
(highlighting, error tolerance); the hand-rolled parser remains the only
semantic authority. They must agree at the token level
(`tests/lezer.test.ts` drift guard) and Lezer trees never cross into
`src/engine` (`tests/layering.test.ts`).

## 2. Scope

**In:** vocabulary registry with full coverage; Lezer grammar + syntax
highlighting; hover cards; code↔stage cross-highlighting; on-canvas argument
annotation; plain-language diagnostics surfaced in the editor; the
`apps/studio` shell; editor-loop perf gate.

**Deferred:** node-id stability across edits (Phase 2 — Phase 1 re-parses and
re-runs wholesale, so ids are only consistent within one parse); the step
scrubber, timeline, frame slider (Phase 2); state panel and value
visualization (Phase 3); autocomplete, palette, draggable literals,
direct manipulation (Phase 4); abstraction gestures (Phase 5).

## 3. Ordered tasks

**P1-T1 — Registry content.** Write cards for every key in
`requiredCardKeys()` (the three exemplars in `cards.ts` set the register).
Green: `tests/meta.test.ts` — coverage, length ceilings, jargon ban.

**P1-T2 — Lezer grammar.** Replace the seed `chalk.grammar` with the full
v1 token set (numbers, colors `#RRGGBB`, angles `45°`/`45deg`, strings,
keywords, labels, idents, operators); line-oriented only, no indent tracking
(D12); extend `styleTags`. Regenerate with `npm run grammar` and commit the
output (D14). Green: `tests/lezer.test.ts` — examples parse with zero error
nodes; token spans agree with the hand lexer; broken input still yields a
full-coverage tree.

**P1-T3 — Hover resolution.** Implement `labelAt` per the rules in
`hover.ts`. Green: `tests/hover.test.ts`, including the Gate E sweep.

**P1-T4 — Cross-highlight mapping.** Implement `opsForSpan`, `spanForOp`,
`ancestorIds`. Green: `tests/link.test.ts`.

**P1-T5 — Annotation geometry.** Implement `annotationsFor` + `fmtNum`.
Green: `tests/annotate.test.ts` (exact deep-equals).

**P1-T6 — Diagnostics.** Implement `diagnosticsFor` (parse, else one guarded
fast frame; one diagnostic max). Green: `tests/diagnostics-language.test.ts`
— the broken-program corpus produces friendly messages; the jargon ban holds
over every message the corpus can elicit.

**P1-T7 — Editor extensions.** Implement `chalkHover`, `chalkLint`,
`codeHighlightField`; extend `chalkLanguage.ts` styleTags alongside P1-T2.
Green: `tests/editor-state.test.ts` (EditorState-level; no DOM).

**P1-T8 — Studio shell.** Wire `apps/studio/main.ts` per its header plan.
Verified by the manual script in §6 (no automated gate; keep it thin —
anything worth testing belongs in src/ui as a pure function).

**P1-T9 — Perf.** `bench/perf-editor.test.ts` green under `PERF=1`.

## 4. Exit gates

**Gate D — suite.** `npm test` fully green, including all Phase 0 tests
(Phase 1 must not regress the engine — display-list goldens unchanged).

**Gate E — vocabulary audit (automated hallway proxy).** For every example
program, every number/color/angle literal that is a call argument resolves
via `labelAt` to a `param:` card whose context names its label — i.e. a
learner hovering ANY number in the examples is told what it controls. This
is a sweep in `tests/hover.test.ts`, not a sample.

**Gate F — editor loop budget.** Median over 15 runs, after warmup:
hand-parse + Lezer-parse + fast run + 5 hover resolutions + 1 `opsForSpan`
≤ 50 ms on each example, ≤ 100 ms on the 500-line synthetic program. The
keystroke must never feel like a compile.

**Gate G — the actual hallway test.** Two people who don't program each
state, unprompted, what three numbers in `house-row.chalk` control, using
only hover and annotations. Not automatable; do it anyway and record the
result in `docs/decisions.md`.

## 5. Layering (enforced by tests/layering.test.ts)

    src/meta    cards registry            -> may import: lang, engine (types)
    src/ui      hover, link, annotate,
                diagnose — ALL PURE       -> may import: lang, engine, render, meta, util
    src/editor  Lezer grammar + CM glue   -> may import: ui, meta, lang, util, @codemirror/*, @lezer/*
    apps/*      shells                    -> may import: anything

  Bans: `@codemirror`/`@lezer` imports outside src/editor and apps;
  `document.`/`window.` anywhere in src/ except src/editor (and apps);
  Lezer imports in src/engine, src/lang, src/ui, src/meta.

## 6. Manual acceptance script (P1-T8)

Open `npm run dev:studio`. Load house-row (default doc). (1) Hover `radius`…
every label, keyword, and number: a card appears, correct and jargon-free.
(2) Hover a house on the stage: its `house(...)` call line lights up; the
overlay shows the rect/triangle argument annotations with live values.
(3) Select the `repeat` block: exactly ten shapes stay at full alpha.
(4) Type `radius: red` into a circle call: one friendly diagnostic, stage
keeps the last good picture, hover still works. (5) Paste bouncing-ball: it
animates; hovering `speed` explains state; diagnostics stay quiet.

## 7. Escalation path

If Gate F fails: profile first. Expected fix order — memoize `spanIndex` per
parse; debounce lint separately from reparse; only then consider incremental
hand-parsing (do NOT reach for it early; programs are small by design).
If Lezer's tokenizer can't express a token (the `°` suffix is the likely
culprit), use an `@external tokens` JS tokenizer — do not change the language.
