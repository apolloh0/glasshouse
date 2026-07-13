# Phase 5 spec — Create by abstracting

The last learning move from the essay: the learner points at concrete
things and the program reorganizes to say what they mean — a magic number
becomes named, two numbers begin to co-vary, three repeated shapes fold
into a loop, a cluster becomes a reusable part, a part opens back up. Five
gestures, one law: **the picture never changes.**

Requires Phases 0–4b complete (gates A–Z recorded). Phase 5 is pure
source-to-source transformation over the parser and the provenance chains
4b built; no evaluator change, no new trace surface.

## 0. What applying this scaffold does

Adds three red milestone files (gestures, plus the perf bench skipped) and
two stubs (`src/ui/synth.ts`, `src/ui/gestures.ts`). Changes no implemented
file. The chain-algebra and matcher pins it leans on are already green.
Existing goldens do not move (gestures are oracle-checked to preserve
output; the four+pinwheel goldens are untouched).

## 1. The law and the two pins

**Output oracle (D50).** Every gesture is verified by
`serializeDisplayList(before) === serializeDisplayList(after)` over setup
and, for animated programs, a pinned 60-frame run at the same seed. This is
the entire correctness story — a gesture that changes a pixel is a bug, not
a preference. Route gesture UI through a pre-commit oracle re-run so a
failing transform is never shown.

**Untouched-identity pin (D50).** Statements the gesture did not rewrite
keep their stable ids across it (IdTracker: fresh/dropped confined to the
rewritten region). Unchanged code is preserved by SPAN SPLICING, never
re-printed — which is why synthesis (`synth.ts`) covers only what gestures
emit and is not a general pretty-printer.

## 2. The gestures

Full rules live in the `src/ui/gestures.ts` header; the ground truth is
`tests/gestures.test.ts`. Summary and decisions:

- **nameThisNumber (D51)** — literal → `state` decl (Chalk's one binding
  concept; the name also appears in the state panel) placed after the last
  state decl; use site becomes the name.
- **connectNumbers (D52)** — name litA, then rank litB candidates: equal →
  `same`; clean ratio (2k integer) → `scale` then `offset`; else `offset`.
  Each candidate is oracle-clean by construction.
- **repeatThis (D53)** — k≥2 consecutive siblings → `repeat k as i:`.
  Unify up to NUMBER leaves (everything else must match exactly, friendly
  reason names the first mismatch); each number constant or affine in the
  index (v_j = base+(j-1)·step), else decline with the actual gaps.
- **teachThis (D54)** — consecutive statements → `to name(at: p):` with the
  first shape's literal anchor as origin and body points relativized to
  `p.x+dx, p.y+dy`. `bind` = "p" — the field D37 added finally carries a
  gesture. Scalars stay literal (parameterize by composing with
  nameThisNumber inside the definition).
- **openThisUp (D55)** — inverse of teach: inline a user-definition call,
  substituting args for binds, FOLDING point-literal members (`p.x` with
  `p := (60,80)` → `60`). Round trip is pinned: `open(teach(S))` draws
  byte-identically to S.

## 3. Ordered tasks

**P5-T0 — Synthesis.** `affineText` (D56 canonical forms), `pointText`,
`splice`. Green: synth block of `tests/gestures.test.ts`. ALSO first:
`examples/five-houses.chalk` and its `.case.json` ship in this delta but its
GOLDEN does not — the golden suite iterates every case file and requires
one. Run `npm run test:update` once (five-houses is static and trig-free,
so it is portable), eyeball the five brown houses, and commit
`tests/golden/cases/five-houses.golden.json`. The existing six goldens must
not move — sha-check them (pinwheel included).

**P5-T1 — nameThisNumber + validName.** Green: nameThisNumber block +
Gate AB.

**P5-T2 — connectNumbers.** Green: connectNumbers block.

**P5-T3 — repeatThis + findRepeatRuns.** The hard one: affine unification.
Reuse the shape of the matcher's fingerprinting (structural-up-to-numbers
is fingerprint equality with number leaves masked) — do NOT re-derive from
scratch. Green: repeatThis block.

**P5-T4 — teachThis.** Green: teach half of the T4/T5 block.

**P5-T5 — openThisUp.** Green: round-trip + rich-arg decline.

**P5-T6 — Studio.** Plan steps 28–33 in `apps/studio/main.ts`: gutter/
selection affordances (number → "name this"; multi-select → "repeat"/
"teach"; call → "open up"; two picked numbers → "connect"); candidate
chips for connect/repeat/teach with live previews; every applied gesture a
single identity-preserving edit (one undo step); the run-suggestion
underline from findRepeatRuns. Manual: §5.

**P5-T7 — Gate AC** (`bench/perf-gesture.test.ts`, PERF=1).

**P5-T8 — Gate AD/AE** (below).

## 4. Exit gates

**AA — regression.** Full suite green; all goldens byte-identical.

**AB — gesture demos + identity.** `tests/gestures.test.ts` fully green:
every gesture oracle-clean on its fixture, the decline cases friendly and
jargon-free, the teach/open round trip byte-identical, and untouched rows
keeping their ids.

**AC — budgets.** Each gesture + its oracle re-run ≤ 15 ms on-fixture.

**AD — manual (§5).**

**AE — HUMAN.** Three participants, house-row's five hand-written circles
on screen (a de-abstracted variant supplied as `examples/five-houses.chalk`).
Task: "make this shorter without changing the picture." Pass = each finds
`repeat this`, applies it, SEES the picture hold, and can say why the loop
means the same drawing. Then: "now pull one house out as its own thing" →
`teach this`. Record as G/L/P/U/Z were.

## 5. Manual acceptance script (P5-T6)

(1) Load bouncing-ball; click the `20` radius → "name this number", type
`size` → a `state size = 20` appears, the ball is unchanged, the state
panel now lists size. (2) Two circles of radius 20 and 40; select both
numbers → "connect" → chips "same size (×2)" / "offset (+20)"; pick ×2,
preview holds. (3) Five hand-placed circles → the run underlines; "repeat
this" → a `repeat 5 as i:` with `20 + (i-1)*50`; picture identical. (4)
Select a rect+triangle → "teach this", name `hut` → a `to hut(at: p)` and a
call; drag the call's point handle (4a) → the whole hut moves. (5) Click a
`hut(...)` call → "open this up" → the two shapes return inline, members
folded; picture identical. (6) Undo steps are one-per-gesture throughout.

## 6. Escalation path

If repeatThis unification is slow or fragile, lean harder on
`fingerprintNode` with number leaves masked (one pass, structural) before
per-position affine checks; do not hand-walk trees. If a gesture's oracle
fails on animated programs only, the bug is almost always a state-decl
placement changing evaluation order (D51 places after the last decl for
exactly this reason) — check placement before the transform. If synthesis
drifts from learner style, fix `synth.ts` (one source), never the call
sites.

## 7. After Phase 5

Phase 6 closes the project: accessibility (screen-reader vocabulary from
the Phase 1 registry; keyboard-drivable manipulation and gestures),
packaging, and the worked curriculum. It is designed last, same rhythm.
Two carried threads for it: the re-pause-after-drag polish (4b worklog) and
the point-handle/rotation-handle unification question (4a §6). The language
freezes again at the end of Phase 5 — no gesture emits novel syntax (all
five stay within Chalk v1.1), so no new goldens are introduced by Phase 5
itself beyond fixtures.
