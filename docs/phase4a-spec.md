# Phase 4a spec — Create by reacting (transforms, completions, palette, draggable literals)

Phase 4 is split (D35). **4a**, this spec, delivers everything creation-
shaped that does NOT require provenance: the `group` transform extension
(moved here by D23), statement completions with live previews, the parts
palette, and literal-level direct adjustment — draggable numbers, inline
color/angle widgets, on-stage point handles. **4b** — provenance recording,
inversion of computed values, drag disambiguation — is deliberately NOT
designed yet; see §8. Do not implement anything from §8.

Phase 4a **requires Phases 0–3 complete** (gates A–P recorded).

## 0. What applying this scaffold does to a green repo

The Phase 0–3 suite was 164/164. This scaffold adds red MILESTONES on
purpose. Expected reds after applying, before any 4a work: the six new test
files (group, transform-viz, complete, drag, create-demos, + Gate S bench
skipped); `meta.test.ts` (five new required cards: construct:group +
param:group.{move,rotate,scale,around}); `lezer.test.ts` and
`hover.test.ts` example sweeps and `golden.test.ts` (pinwheel parses only
once P4a-T2 lands; its golden is generated at the gate). Everything else —
including every Phase 0–3 milestone — must stay green throughout; goldens
for the four existing examples stay byte-identical (Gate Q).

## 1. Definitions

**group (D36)** — `group(move: P, rotate: A, scale: N, around: P):` + an
indented body; a lexical transform scope, legal wherever a statement is.
At least one arg; only those four labels; `rotate` accepts an angle or a
plain number of degrees; `scale` a positive number (uniform only).
Composition pinned in `src/flow/transform.ts`: T(move)·T(around)·R·S·
T(-around), parent·child nesting, positive rotation clockwise on screen.
**Transforms apply EAGERLY at emit**: ops carry world coordinates; the
display-list format, serializer, renderer, differ, and bounds code are all
untouched. Radii and stroke widths scale by `scale`. Under nonzero
rotation, `rect` lowers to two exact triangles (corners ABC + ACD, one
step index) and `ellipse` is a friendly diagnostic. Existing programs
contain no groups, so existing goldens cannot move.

**Step accounting (D31 extension)** — a group completes as ONE statement
row after its body (like `repeat`); its args complete as ordinary expr rows
before the body, re-evaluated on every execution. Groups are containers
for `executedInFrames` (excluded, leaf rule) and rows for
`executedStatements`/`iterationGrid` (included, like repeat). No new trace
surface: the transform viz derives matrices from the args' traced values.

**Completion (D38)** — a full runnable statement, every argument
pre-filled: stdlib `dflt` where present, else `FALLBACK_DEFAULTS[type]`,
both rendered by `showValue` (whose output is valid Chalk for every type).
User definitions default all args to `0`. Previews (`previewFor`) run
parse + setup + at most one NO_INPUT frame, fully session-isolated.

**Drag spec (D39)** — a literal's control surface: step from TEXTUAL form
(`.` present → 0.1, else 1), splice over the literal's span, and the
identity pin: re-parse + IdTracker across any splice shows 0 fresh /
0 dropped. Point handles exist only where both coordinates are literals;
computed coordinates wait for 4b.

## 2. Scope

**In:** the group language extension end to end (lexer keyword shipped;
parser, evaluator transform stack, lowering, diagnostics, cards, hover,
Lezer grammar keyword, pinwheel example + golden); transform-frame viz
model + axes overlay; completions + previews; palette model; draggable
numbers, color/angle widgets, point handles; studio wiring; Gate R and S.

**Out (4b, §8):** provenance, inversion, dragging computed values, drag
disambiguation, output-preserving abstraction machinery. **Out (still):**
browser automation (D40 reaffirms D22); non-uniform scale; rotated
ellipses; `bind`-field-dependent features beyond populating it (P4a-T1).

## 3. Ordered tasks

**P4a-T1 — bind field (closes D30/D37).** Parser populates
`Definition.params[].bind`; `span` keeps pointing at the binding token.
Hover's synthesized user-param cards read `bind` instead of slicing.
Green: no dedicated file — typecheck + existing hover tests stay green;
ADD one test asserting `bind === "base"` for house-row (adding is allowed).

**P4a-T2 — group blocks.** Lexer already knows the keyword (shipped).
Parser (arg-list reuse from calls; ≥1 arg; label whitelist), evaluator
transform stack + eager emit application + rect lowering + ellipse/scale
diagnostics, D31-extension rows, cards (5 new), hover for group labels,
Lezer grammar keyword + regen, flow-layer kind lists (lines.ts containers).
Green: `tests/group.test.ts`, `meta.test.ts`, `lezer.test.ts`,
`hover.test.ts` sweeps; pinwheel golden generated at the gate.

**P4a-T3 — transform viz.** `matrixFor`, `activeGroupsAt`, `axesGlyph`.
Green: `tests/transform-viz.test.ts`.

**P4a-T4 — completions + previews.** `completionsAt`, `previewFor`.
Green: `tests/complete.test.ts` (the isolation pin especially).

**P4a-T5 — palette.** `paletteEntries`. Green: palette half of
`tests/create-demos.test.ts`.

**P4a-T6 — draggable literals.** `numberDragAt`, `widgetAt`,
`pointHandles`. Green: `tests/drag.test.ts`.

**P4a-T7 — studio wiring.** Plan appended to `apps/studio/main.ts`
(steps 17–22): CM autocomplete with live preview swap, palette pane with
thumbnails + click/drag insert, cursor drag affordances on literals, stage
point handles, axes overlay while scrubbing inside a group. Manual: §6.

**P4a-T8 — Gate R.** `tests/create-demos.test.ts` fully green.

**P4a-T9 — Gate S.** `bench/perf-create.test.ts` green under PERF=1.

## 4. Exit gates

**Gate Q — regression.** Everything green (suite ≈ 210+); the four
pre-existing goldens byte-identical; pinwheel's golden generated,
eyeballed (the pinwheel must actually pinwheel), committed.

**Gate R — creation demos.** Blank → completion → preview → commit →
drag → adjusted shape, with program identity preserved; palette exact and
fully thumbnail-able.

**Gate S — budgets.** previewFor ≤ 20 ms per example; completionsAt ≤ 2 ms
@ synthetic-500; drag loop ≤ 10 ms (60fps with rendering headroom).

**Gate T — manual script (§6)** performed; result recorded.

**Gate U — HUMAN.** Three participants, blank editor, one instruction:
"make a circle, then make it bigger, without me helping." Pass = all three
succeed inside 60 seconds using completions/palette + a drag. Present the
script, wait, record (as Gates G/L/P were).

## 5. Layering

No new directories. `src/flow/transform.ts` inherits flow rules;
`src/ui/{complete,palette,drag}.ts` inherit ui rules (pure, DOM-free —
`previewFor` uses engine functions directly, never Session). `apps/debug`
is deleted (D40).

## 6. Manual acceptance script (P4a-T7)

Blank program. (1) Type `ci` → completion card with a live preview canvas;
arrow between candidates → previews swap; Enter → circle appears. (2) Click
the radius number, drag right → circle grows live, releases cleanly, undo
works (one undo step per drag gesture). (3) Click the fill color → swatch
picker splices uppercase hex. (4) Drag the circle's center handle on the
stage → the point literal rewrites, the circle follows the pointer.
(5) Open the palette → thumbnails for five builtins; paste house-row →
`house` joins with an exact thumbnail; click to insert. (6) Load pinwheel →
it spins; pause, scrub into a blade's steps → the rotated axes overlay
appears at (160,120) and turns with the blade; hover `rotate:` → the new
card. (7) Type `group(` on a fresh line → completion offers the template.

## 7. Escalation path

If the drag loop misses budget: reuse the last good Program for
`numberDragAt` (don't re-parse to build the spec — only the rerun needs the
new source), and debounce PREVIEW rendering, never the splice. If
completions feel laggy in the editor, the model is not the problem at
these numbers — profile the CM plugin. If rect lowering under rotation
produces visible seams at blade edges, overlap the two triangles by half a
device pixel in the RENDERER only (never in the ops — goldens).

## 8. Phase 4b outlook — NOT designed, do not implement

4b is provenance and inversion: record affine chains (value ← literal ⊕
constants, through arithmetic AND group transforms — eager application
makes the transform part of the chain), invert a drag on any computed
coordinate back to candidate literal edits, disambiguate multiple
candidates (the `20 + i * 55` drag has two honest answers), and keep the
whole gesture output-preserving. It will be designed against 4a's landed
evaluator, its measured instrumented headroom (3.8→? ms of the 30 ms
budget), and D30/D37's completed bind promotion. Open questions logged for
it: per-step chain recording vs. on-demand re-execution of the focused
frame; candidate ranking UX; whether point handles and 4b drags unify.
