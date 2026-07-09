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
import { labelAt } from "../ui/hover.js";
import { diagnosticsFor } from "../ui/diagnose.js";

/** The studio keeps the last GOOD parse here so hover keeps working while
 *  the learner is mid-edit (a broken keystroke must not blank the labels). */
export type ProgramSource = () => Program | null;

/** Hover: call labelAt(program, offset); render the card as
 *  <div class=chalk-card><b>title</b><p>oneLiner</p><p class=ctx>context</p></div>.
 *  Return null when labelAt does. */
export function chalkHover(getProgram: ProgramSource): Extension {
  return hoverTooltip((_view, pos): Tooltip | null => {
    const program = getProgram();
    if (!program) return null;
    const result = labelAt(program, pos);
    if (!result) return null;
    return {
      pos: result.span.start,
      end: result.span.end,
      above: true,
      create: () => {
        const dom = document.createElement("div");
        dom.className = "chalk-card";
        const title = document.createElement("b");
        title.textContent = result.card.title;
        dom.appendChild(title);
        const oneLiner = document.createElement("p");
        oneLiner.textContent = result.card.oneLiner;
        dom.appendChild(oneLiner);
        if (result.card.detail) {
          const detail = document.createElement("p");
          detail.textContent = result.card.detail;
          dom.appendChild(detail);
        }
        if (result.context) {
          const ctx = document.createElement("p");
          ctx.className = "ctx";
          ctx.textContent = result.context;
          dom.appendChild(ctx);
        }
        return { dom };
      },
    };
  });
}

/** Lint: diagnosticsFor(doc) -> CodeMirror diagnostics (severity "error",
 *  from/to from the Chalk span). Debounce is the linter's default. */
export function chalkLint(): Extension {
  return linter((view): CmDiagnostic[] =>
    diagnosticsFor(view.state.doc.toString()).map((d) => ({
      from: d.span.start,
      to: d.span.end,
      severity: d.severity,
      message: d.message,
    })));
}

/** Stage -> code highlight: the studio dispatches setCodeHighlight with the
 *  span from spanForOp (or null to clear); the field holds one mark
 *  decoration with class "chalk-linked". */
export const setCodeHighlight = StateEffect.define<{ start: number; end: number } | null>();

const linkedMark = Decoration.mark({ class: "chalk-linked" });

export const codeHighlightField: StateField<DecorationSet> = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (deco, tr) => {
    let next = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setCodeHighlight)) continue;
      const span = effect.value;
      next = span === null || span.end <= span.start
        ? Decoration.none
        : Decoration.set([linkedMark.range(span.start, span.end)]);
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});
