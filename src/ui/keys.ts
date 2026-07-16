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

import { TODO } from "../util/todo.js";

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
  void state; void input; void opCount; void candidateCount;
  TODO("P6-T3", "keymap per header; every transition announces");
}
