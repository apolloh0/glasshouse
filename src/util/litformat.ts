// The D39 literal-drag formatting rule, shared by src/ui/drag.ts (4a cursor
// drags) and src/flow/invert.ts (4b inversion splices). Lives in util because
// the layering map forbids ui<->flow imports, and both need the SAME rule so
// a spliced value reads identically however it was produced.

export type LitStep = 1 | 0.1;

/** Step from a literal's TEXTUAL form (D39): a decimal drags by 0.1, an
 *  integer by 1. */
export function stepForText(text: string): LitStep {
  return text.includes(".") ? 0.1 : 1;
}

/** Round to the step and format without trailing zeros beyond it. */
export function formatStep(v: number, step: LitStep): string {
  const rounded = step === 1 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(rounded);
}
