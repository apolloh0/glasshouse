// P1-T7 — the three CodeMirror extensions that surface src/ui results.
// This file may import @codemirror/view (it is the ONLY layer that may,
// besides apps/ — see tests/layering.test.ts). Keep it thin: every decision
// already lives in src/ui; this file converts results to editor objects.
//
// NOTE ON TESTS: everything interesting here is tested through the pure
// functions it delegates to. The only direct test (tests/editor-state.test.ts)
// builds an EditorState with chalk() — it deliberately avoids constructing
// an EditorView so the suite runs in plain Node.

import { hoverTooltip, type Tooltip } from "@codemirror/view";
import { linter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { Program } from "../lang/ast.js";
import { TODO } from "../util/todo.js";

/** The studio keeps the last GOOD parse here so hover keeps working while
 *  the learner is mid-edit (a broken keystroke must not blank the labels). */
export type ProgramSource = () => Program | null;

/** Hover: call labelAt(program, offset); render the card as
 *  <div class=chalk-card><b>title</b><p>oneLiner</p><p class=ctx>context</p></div>.
 *  Return null when labelAt does. */
export function chalkHover(getProgram: ProgramSource): Extension {
  void getProgram;
  return hoverTooltip((_view, pos): Tooltip | null => {
    void pos;
    TODO("P1-T7", "wire labelAt into a tooltip");
  });
}

/** Lint: diagnosticsFor(doc) -> CodeMirror diagnostics (severity "error",
 *  from/to from the Chalk span). Debounce is the linter's default. */
export function chalkLint(): Extension {
  return linter((_view): CmDiagnostic[] => {
    TODO("P1-T7", "wire diagnosticsFor");
  });
}

/** Stage -> code highlight: the studio dispatches setCodeHighlight with the
 *  span from spanForOp (or null to clear); the field holds one mark
 *  decoration with class "chalk-linked". */
export const setCodeHighlight = StateEffect.define<{ start: number; end: number } | null>();

export const codeHighlightField: StateField<DecorationSet> = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (deco, tr) => {
    void tr;
    TODO("P1-T7", "map through changes; rebuild on setCodeHighlight");
  },
  provide: (f) => EditorView.decorations.from(f),
});
