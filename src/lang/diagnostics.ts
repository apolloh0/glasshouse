// CONTRACT — diagnostics are plain-language and span-anchored (spec §6).
import type { Span } from "./ast.js";

export interface Diagnostic {
  message: string;   // learner-readable; see wording examples in tests
  span: Span;
  severity: "error"; // Phase 0 has no warnings
}

export class ChalkError extends Error {
  constructor(public diagnostic: Diagnostic) {
    super(diagnostic.message);
    this.name = "ChalkError";
  }
}

export function err(message: string, span: Span): ChalkError {
  return new ChalkError({ message, span, severity: "error" });
}
