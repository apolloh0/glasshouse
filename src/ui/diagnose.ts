// CONTRACT — one pure entry point the editor's lint extension calls on every
// (debounced) edit. Collects parse errors AND setup-time runtime errors into
// plain-language, span-anchored diagnostics. No DOM here.
//
// Rules (P1-T6):
//  - Parse error: report it; do not attempt to run.
//  - Parse ok: run setup + ONE frame (fast mode, seed 0, NO_INPUT) inside
//    try/catch; a ChalkError becomes a diagnostic at its span. Non-Chalk
//    exceptions are bugs: rethrow, never swallow.
//  - At most ONE diagnostic per pass (Chalk stops at the first problem —
//    a learner fixes one thing at a time; a wall of red is noise).
//  - Wording: every message must pass the jargon ban in
//    tests/diagnostics-language.test.ts. Talk about what the learner wrote
//    ("`radius:` needs a number — right now it's a color"), never about the
//    machinery ("unexpected token", "EOF", "identifier").

import type { Diagnostic } from "../lang/diagnostics.js";
import { TODO } from "../util/todo.js";

export function diagnosticsFor(source: string): Diagnostic[] {
  void source;
  TODO("P1-T6", "parse, then one guarded fast frame; header rules");
}
