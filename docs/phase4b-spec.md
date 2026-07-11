# Phase 4b spec — Direct manipulation (provenance and inversion)

The summit. The learner grabs any shape on the stage — including computed,
looped, transformed ones — and drags it; the environment works out which
literals could honestly cause that motion, previews the choices, and edits
the program. Requires Phase 4a complete (gates Q–U recorded).

## 0. What this scaffold changes, and the portability finding

Applying it adds four red milestone files (determinism-trig, provenance,
invert, perf-invert) and two stubs (`src/flow/provenance.ts`,
`src/flow/invert.ts`). It changes NO implemented file. One pre-existing
test is ALREADY red on cross-platform runs: **the pinwheel golden**.
Rotation goldens were machine-pinned — `Math.cos/sin` differ by last-bit
ULPs across libms (found in review: a golden generated on macOS arm64
fails byte-equality on Linux x86). P4b-T0 fixes this for good.

## 1. Definitions

**Chain (D43)** — value = Σ coeff·literal + c, reconstructed POST-HOC from
the trace (no evaluator or tracer change; the 3.81 ms instrumented cost is
untouched). Algebra shipped in `provenance.ts`; reconstruction rules in its
header — the two that carry the phase: **param chasing** (a definition
param's chain is its call-site argument's chain, resolved through
`callStackAt`) and the **product rule** (both sides carrying terms →
opaque; affine discipline over cleverness).

**Matrices are constants (D44)** — an op's world-coordinate chain composes
the active group matrices as numbers. Dragging a rotated blade edits the
blade's literals, never the rotation angle.

**Candidate policy (D45)** — per-axis solve from the anchor chains; opaque
axes reported `unadjustable` (the studio locks the drag); one candidate per
term, `to = from + Δ/coeff`, ranked by |Δlit| ascending (gentlest first),
ties by source order; pairs capped at 6; a literal in both axes joins only
if its two solutions agree within 1e-9 — never average, never lie.
Application snaps per D39 and must preserve identity (0 fresh / 0 dropped).

**The oracle** — prediction consistency: apply any candidate, re-run, and
the dragged attribute sits where the pointer pointed (within snapping).
Every inversion test ends with this check. An edit that lands elsewhere is
a bug, not a ranking problem.

## 2. Ordered tasks

**P4b-T0 — Trig determinism (D42).** Round `Math.cos/sin` outputs to the
1e-9 grid at BOTH sites (the evaluator's affine helper and
`transform.matrixFor`) before use; downstream arithmetic is IEEE-portable.
Then regenerate ONLY the pinwheel golden (the four trig-free goldens must
not move — sha-check) and commit the first portable rotation golden.
Green: `tests/determinism-trig.test.ts`; golden suite green again.

**P4b-T1 — Chains.** Implement `chainAt` per the header rules. Green:
`tests/provenance.test.ts` chainAt block (the algebra guard is already
green — shipped).

**P4b-T2 — Op attribute chains.** `attrChain`: ANCHOR_SOURCES mapping,
lowered-rect corner mapping, active matrices as constants. Green: the
attrChain block, including the load-bearing param-chase case.

**P4b-T3 — Inversion.** `scalarCandidates`, `dragCandidates`,
`applyCandidate` (extract drag.ts's D39 formatter into a shared helper
rather than duplicating). Green: `tests/invert.test.ts` — which IS Gate W.

**P4b-T4 — Studio.** Plan steps 23–27 in `apps/studio/main.ts`: every op
draggable; ring handles remain the literal-anchor affordance (D47);
rank[0] applied live per pointer move via the drag-tick pipeline; TAB
cycles candidates mid-drag (re-based); axis locks visualized; on release,
a 3-second "changed 55 → 65 · alternatives" chip; one undo step per
gesture. Manual: §4.

**P4b-T5 — Gate W green** (invert + provenance suites in full).

**P4b-T6 — Gate X** (`bench/perf-invert.test.ts` under PERF=1).

## 3. Exit gates

**V — regression.** Full suite green; four trig-free goldens byte-identical
to their phase0 shas; pinwheel regenerated once at T0 and stable after.
**W — inversion demos.** The house drag's two honest answers with both
predictions holding; the respread-vs-shift distinction; the ball's axis
lock; the rotated blade landing where pointed. **X — budgets.**
dragCandidates ≤ 3 ms (house-row) / ≤ 5 ms (@50k); full drag tick ≤ 12 ms.
**Y — manual (§4).** **Z — HUMAN.** Three participants, house-row on
screen, two tasks each: "move the third house right" then "now make the
whole row spread out instead — same handle." Pass = both done by dragging
inside 45 s each, and the participant can say in their own words what the
two choices meant ("just this one" vs "the spacing").

## 4. Manual acceptance script (P4b-T4)

Load house-row. (1) Grab house #3: it follows the pointer; a chip names
the edit ("55 → 65"). (2) Same drag, press TAB: the whole row shifts
instead ("20 → 50"); TAB again returns. (3) Release: one undo step; the
chip lingers 3 s offering the alternative. (4) Load bouncing-ball mid-
flight, pause, drag the ball: it moves horizontally only, with the y-lock
affordance visible; the 160 rewrites. (5) Load pinwheel, pause on a frame,
drag a blade's tip circle outward: the blade lengthens; the 250 rewrites;
the picture stays a pinwheel. (6) Drag a scale-spiral circle: the row
hover from Phase 3 confirms the radius literals changed. (7) Undo/redo
across all of it behaves.

## 5. Escalation path

If dragCandidates misses budget: build the per-node row index once per
focused trace (the Phase 3 escalation, now justified — decision entry),
and memoize `activeGroupsAt` matrices per step window. If param chasing
recurses badly on deep call towers, cap depth at 8 with an honest opaque
fallback (decision entry). If the drag FEELS wrong despite green tests,
the bug is in the studio's re-basing math, not in flow — steps 23–27 keep
all solving in `src/flow` for exactly this reason.

## 6. After 4b

Phase 5 (abstraction gestures) designs against 4b's landed inversion; the
"repeat this" gesture will reuse chains to detect the pattern, and D30/
D37's bind field finally pays off in "teach this". Phase 6 (accessibility,
packaging, curriculum) closes. Both are designed later, same rhythm.
