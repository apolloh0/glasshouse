// CONTRACT — KEYBOARD MANIPULATION (Phase 6, D58): a PURE state machine
// mapping keys to the SAME entry points the pointer uses (dragCandidates,
// applyCandidate, gestures). The studio interprets effects; every rule
// lives here with a table-driven test. This is why browser automation
// still isn't needed (D59): the scriptable surface IS this machine.
//
// KEYMAP (P6-T3, pinned):
//   [ / ]            cycle op focus backward/forward, wrapping; display order
//   Enter (browse)   start dragging the focused op at (0, 0)
//   Arrows           accumulate dx/dy by 1; with shift by 10
//   Tab (dragging)   cycle candidate index (count supplied by the studio)
//   Enter (dragging) commit -> effects [solve, commit, announce]
//   Escape           cancel to browse, announce
// Every transition emits an "announce" effect whose text comes from
// src/meta/announce.ts — never composed here.

export interface KState {
  mode: "browse" | "dragging";
  opIndex: number | null;
  dx: number;
  dy: number;
  candidate: number;
}

export const K_INITIAL: KState = {
  mode: "browse", opIndex: null, dx: 0, dy: 0, candidate: 0,
};

export type KEffect =
  | { kind: "focusOp"; index: number }
  | { kind: "solveDrag"; index: number; dx: number; dy: number; candidate: number }
  | { kind: "commit" }
  | { kind: "cancel" }
  | { kind: "announce"; key: string; slots: Record<string, unknown> };

export interface KInput {
  key: string;       // "ArrowLeft" | "[" | "Tab" | "Enter" | "Escape" | ...
  shift: boolean;
}

export function kstep(
  state: KState,
  input: KInput,
  opCount: number,
  candidateCount: number,
): { state: KState; effects: KEffect[] } {
  const effects: KEffect[] = [];
  const { key } = input;
  const idx = state.opIndex ?? 0;

  if (state.mode === "browse") {
    // [ / ] — cycle op focus in display order, wrapping. From "nothing
    // focused" (null), ] lands on the first op, [ on the last.
    if (key === "]" || key === "[") {
      if (opCount === 0) return { state, effects };
      const next = state.opIndex === null
        ? (key === "]" ? 0 : opCount - 1)
        : (((state.opIndex + (key === "]" ? 1 : -1)) % opCount) + opCount) % opCount;
      effects.push({ kind: "focusOp", index: next });
      effects.push({ kind: "announce", key: "focus.op", slots: { index: next } });
      return { state: { ...state, opIndex: next }, effects };
    }
    // Enter — start dragging the focused op at (0, 0).
    if (key === "Enter") {
      if (state.opIndex === null) return { state, effects };
      effects.push({ kind: "announce", key: "drag.start", slots: {} });
      return { state: { ...state, mode: "dragging", dx: 0, dy: 0, candidate: 0 }, effects };
    }
    return { state, effects };
  }

  // dragging mode
  if (key.startsWith("Arrow")) {
    const s = input.shift ? 10 : 1;
    const dx = state.dx + (key === "ArrowRight" ? s : key === "ArrowLeft" ? -s : 0);
    const dy = state.dy + (key === "ArrowDown" ? s : key === "ArrowUp" ? -s : 0);
    effects.push({ kind: "solveDrag", index: idx, dx, dy, candidate: state.candidate });
    effects.push({ kind: "announce", key: "drag.step", slots: { x: dx, y: dy } });
    return { state: { ...state, dx, dy }, effects };
  }
  // Tab — cycle candidate, wrapping at the studio-supplied count.
  if (key === "Tab") {
    if (candidateCount <= 0) return { state, effects };
    const candidate = (state.candidate + 1) % candidateCount;
    effects.push({ kind: "solveDrag", index: idx, dx: state.dx, dy: state.dy, candidate });
    effects.push({ kind: "announce", key: "drag.candidate", slots: { index: candidate } });
    return { state: { ...state, candidate }, effects };
  }
  // Enter — commit; Escape — cancel. Both return to browse.
  if (key === "Enter") {
    effects.push({ kind: "commit" });
    effects.push({ kind: "announce", key: "drag.commit", slots: {} });
    return { state: { ...state, mode: "browse" }, effects };
  }
  if (key === "Escape") {
    effects.push({ kind: "cancel" });
    effects.push({ kind: "announce", key: "drag.cancel", slots: {} });
    return { state: { ...state, mode: "browse", dx: 0, dy: 0, candidate: 0 }, effects };
  }
  return { state, effects };
}
