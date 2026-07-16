# Phase 6 spec — Ship it (accessibility, keyboard, packaging, curriculum)

The closer. Everything the environment can do becomes reachable by every
learner (screen reader, keyboard), publishable as a library, and teachable
as a worked sequence. No new engine capability; the three carried threads
resolve.

Requires Phases 0–5 complete (gates A–AE recorded).

## 0. Delta discipline (this scaffold and forever)

**New files only.** This delta ships zero copies of any existing file. All
changes to existing files are the APPEND PAYLOADS in §7 of this spec,
applied by you (CC) verbatim, then verified. This is the permanent fix for
the Phase 5 scaffold-strip class: the designer never again overwrites a
file you have implemented into.

Expected state after applying + payloads: typecheck clean;
`tests/phase6.test.ts` = 9 green guards / 9 red milestones; nothing else
moves.

## 1. The four areas

**Accessibility (P6-T1/T2, D57).** The handoff's open question is answered:
the card schema gains NO field — `oneLiner` was written for dual use.
Cards describe THINGS; the new `src/meta/announce.ts` describes EVENTS,
with total-coverage enforcement mirroring the card registry. The studio
gains one aria-live region fed exclusively by `announce()`; op focus order
is display order; every interactive affordance gets a role and a label
composed from cards. No inline strings, ever — that invariant now covers
speech.

**Keyboard (P6-T3, D58/D59).** `src/ui/keys.ts` is a pure state machine
whose effects call the SAME entry points the pointer uses. The keymap is
pinned in its header; the table tests are ground truth. D59: still no
browser automation — the scriptable surface the handoff anticipated IS
this machine, vitest-covered; end-to-end runs stay in the manual gate.

**Packaging (P6-T4, D60).** One package, three subpath exports —
`./engine` (lang+engine+render+host+flow, dependency-free), `./ui`
(meta+ui), `./editor` (CodeMirror-coupled) — apps stay unpublished. The
boundary is enforced two ways: the existing layering tests, and the new
static import-graph walk in phase6.test.ts proving `./engine`'s graph
never reaches the editor. Build via `tsconfig.build.json` (shipped) into
`dist/`; package.json changes are payload §7.4. Package NAME is the
owner's call (npm availability); structure is pinned.

**Curriculum (P6-T5).** Executable lessons under `curriculum/`:
`lesson-NN-slug/{lesson.json, start.chalk, target.chalk}`. Lesson 1 ships
complete as the exemplar (register: imperative, concrete, one action per
step). Validation is total (phase6.test.ts): every program parses and
runs deterministically, every referenced card exists, every `find` string
is really in the start program, every `say` passes the jargon ban. The
arc (write lessons 2–8):
  2 "Change the numbers" (drag literals, color widget)
  3 "Make your own" (completions, palette)
  4 "Watch it move" (frames, state panel, scrubber)
  5 "Many at once" (repeat, iteration grid)
  6 "Name it, connect it" (gestures 1–2)
  7 "Teach it a part" (teach/open, five-houses)
  8 "Grab and spin" (direct manipulation, group, rotation handle)
Targets are checked by eye at the gate (they are pictures); the suite
checks everything mechanical.

## 2. The three carried threads — resolved

**Rotation handle (P6-T6, D61).** `src/ui/rotate.ts`: literal-rotate
groups get an on-stage arc handle at the group's fixed point (`around`
literal, else anchorOf). It is an angle WIDGET on stage — D44 stands:
inversion never solves through a matrix for an angle; computed rotations
(pinwheel's `spin + i * 90`) get no handle, per D39's literal discipline.

**Re-pause after drag (P6-T6).** Committing a drag while a frame is
focused keeps focus on the SAME frame index after the rerun (studio-level;
manual gate item AH.6).

**serializeVisual oracle.** Already law (D50 amendment). Anything in this
phase that rewrites source — none is planned — uses it plus the
untouched-identity pin. Reaching for serializeDisplayList is a known dead
end.

## 3. Ordered tasks

**P6-T0 — Apply §7 payloads**, verify counts (§7.5), commit alone.
**P6-T1 — Announcements.** Fill TEMPLATES for every key. Green:
announcements block.
**P6-T2 — Studio a11y wiring** (aria-live, roles, focus order). Manual.
**P6-T3 — Keyboard machine + wiring.** Green: keyboard block; then wire
per §7.3's steps 34–37.
**P6-T4 — Packaging.** Apply §7.4; `npm run build` clean; green: package
block.
**P6-T5 — Lessons 2–8.** Green: curriculum block incl. the 8-lesson arc.
**P6-T6 — rotate.ts + re-pause.** Green: rotation block; manual for
re-pause.
**P6-T7 — Gates.**

## 4. Exit gates

**AF — regression.** Full suite green; goldens sha-identical; every prior
PERF gate re-run green (final numbers into the worklog — the project's
closing benchmark table).
**AG — suites + build.** phase6.test.ts fully green; `npm run build`
clean; the import-graph walk holds on dist as well as src (spot-check).
**AH — manual.** (1) VoiceOver on macOS: browse ops with [ / ], hear
"circle, 3 of 10"; start a drag, hear the candidate line; commit, hear
the note. (2) Keyboard-only, no pointer: complete the Gate Z house task
(move house #3; TAB; spread the row). (3) Lesson 1 walked exactly as
written. (4) Rotation handle: drag the arc on a literal-rotate group;
pinwheel shows none. (5) Animated drag keeps its focused frame. (6) Every
lesson target eyeballed.
**AI — HUMAN.** One fresh non-programmer completes lessons 1–3 unaided in
under 20 minutes, thinking aloud; record verbatims. Stretch (record
attempt regardless of result): one screen-reader user, or you with the
screen curtained, completes lesson 1 by audio alone.
**AJ — ship.** Tag v0.1.0. README quickstart tested from a fresh clone.
Final worklog entry: the project-closing summary (all gates A–AJ, the
benchmark table, decision count, test count).

## 5. Escalation path

If VoiceOver reads garbage, the bug is announce() composition, never ad
hoc aria strings in the studio. If keyboard drags feel dead, check that
solveDrag effects are throttled like pointer ticks — the machine is pure;
pacing is the studio's. If the build emits editor types into ./engine,
the import walk failed first — fix the import, not the exports map.

## 6. After Phase 6

Nothing. Tag it, write the closing worklog entry, and hand the repo to
its users. Post-1.0 candidates already logged along the way: cross-frame
provenance (D43's boundary), multi-diagnostic recovery (D15), Playwright
(D59), the D30->bind span convention retirement.

## 7. APPEND PAYLOADS (P6-T0 — apply verbatim; never a file overwrite)

### 7.1 docs/decisions.md — append:

**D57 — Announcements are vocabulary.** Everything a screen reader speaks
comes from src/meta/announce.ts: pinned event templates composing card
titles, values via showValue, total-coverage tested like cards, jargon-
banned, <= 120 chars. The card schema gains no field; cards describe
things, templates describe events. No inline strings in the studio —
the Phase 1 invariant now covers speech.

**D58 — Keyboard manipulation is a pure state machine.** src/ui/keys.ts
maps keys to the same entry points the pointer uses; the keymap is pinned
in its header and table-tested. The studio interprets effects and owns
pacing only.

**D59 — Still no browser automation.** The scriptable surface keyboard
driving creates is the pure machine itself, vitest-covered; end-to-end
runs remain human (gate AH). Post-1.0 revisit stands.

**D60 — One package, three subpaths.** exports: ./engine (dependency-free
core: lang, engine, render, host, flow), ./ui (meta, ui), ./editor
(CodeMirror-coupled). Apps unpublished. Enforced by the layering tests
plus a static import-graph walk from the engine entry. Closes D10.

**D61 — Rotation handles are on-stage angle widgets.** Literal-rotate
groups get an arc handle at their fixed point editing the rotate literal
directly (D39 splice rules, identity pin). D44 stands untouched:
inversion never solves through a matrix for an angle; computed rotations
get no handle.

### 7.2 CLAUDE.md — append to the phase list:

Phase 6: ship it — accessibility from the vocabulary registry, the pure
keyboard machine, packaging (one package, three subpaths), the eight-
lesson curriculum, rotation handles (`docs/phase6-spec.md`, tasks
P6-T0..P6-T7, gates AF–AJ).

And append to the workflow rules:

- Deltas are NEW FILES ONLY, permanently: designer changes to existing
  files arrive as spec append-payloads you apply and verify, never as
  shipped file copies (the Phase 5 strip rule).
- Speech comes only from announce.ts, as words come only from cards.ts
  and emitted text only from synth.ts.

### 7.3 apps/studio/main.ts — append the Phase 6 plan comment:

// P6 wiring (spec §1–2): 34. aria-live region fed ONLY by announce();
// roles + labels composed from cards; op focus order = display order.
// 35. Keyboard: route keydown through kstep(); interpret effects
// (focusOp -> outline + announce; solveDrag -> the 4b drag-tick pipeline
// at the machine's dx/dy/candidate; commit/cancel -> same paths as
// pointer release/esc). 36. Rotation handles: draw arcs from
// rotationHandles(); drag maps pointer angle -> apply(deg), one undo
// step. 37. Re-pause: after committing a drag on an animated program,
// re-focus the SAME frame index. No logic in this file — pacing and
// pixels only.

### 7.4 package.json — apply:

Add scripts: "build": "tsc -p tsconfig.build.json"
Add exports map:
  "exports": {
    "./engine": "./dist/host/run.js",
    "./ui": "./dist/ui/index.js",
    "./editor": "./dist/editor/chalkLanguage.js"
  }
(./ui needs a small new src/ui/index.ts barrel re-exporting the ui
modules — a NEW file, yours to add at P6-T4.)

### 7.5 Verification after payloads:

grep -c '\*\*D' docs/decisions.md        -> 61
grep -cE '^// 3[4-7]\.' is not required; confirm steps 34–37 present.
npm run typecheck                        -> clean
npx vitest run tests/phase6.test.ts      -> 9 green / 9 red
