// CONTRACT — the vocabulary registry (plan R1/R2: "make meaning transparent";
// phase1-spec P1-T1). Every builtin, every parameter, every language
// construct, and every value type gets a plain-language card. Hover, the
// parts palette (Phase 4), and screen-reader labels (Phase 6) all read from
// THIS registry — there is exactly one source of vocabulary in the system.
//
// Schema and key scheme are pinned. Card CONTENT is task P1-T1; the
// completeness test (tests/meta.test.ts) enumerates what's missing.

import { BUILTINS } from "../engine/stdlib.js";
import { KEYWORDS } from "../lang/tokens.js";

export interface LabelCard {
  /** Registry key, one of:
   *    builtin:circle      param:circle.radius
   *    construct:repeat    type:angle
   */
  key: string;
  /** 1-4 words, shown as the card heading. e.g. "radius" */
  title: string;
  /** One plain sentence, <= 90 chars, no jargon (see banned list in
   *  tests/meta.test.ts). e.g. "Distance from the center to the edge, in
   *  pixels." */
  oneLiner: string;
  /** Optional 1-3 further sentences. */
  detail?: string;
  /** Optional runnable Chalk snippet demonstrating the thing. */
  example?: string;
}

/** Language constructs that need cards: every keyword a learner can hover.
 *  Derived from the lexer's KEYWORDS so the two can never drift. */
export const CONSTRUCT_KEYS: readonly string[] = [...new Set(KEYWORDS)];

/** Value types that need cards (shown in type-mismatch diagnostics too). */
export const TYPE_KEYS = [
  "number", "point", "color", "angle", "boolean", "string",
] as const;

/** The full set of keys the registry must cover. Derived, not hand-listed:
 *  adding a builtin or a parameter automatically demands a card. */
export function requiredCardKeys(): string[] {
  const keys: string[] = [];
  for (const [name, spec] of BUILTINS) {
    keys.push(`builtin:${name}`);
    for (const p of spec.params) keys.push(`param:${name}.${p.label}`);
  }
  for (const c of CONSTRUCT_KEYS) keys.push(`construct:${c}`);
  for (const t of TYPE_KEYS) keys.push(`type:${t}`);
  return keys;
}

/** P1-T1 — fill this in for every key in requiredCardKeys(). The three cards
 *  below are the exemplars that set the register: concrete, short, zero
 *  jargon, always in terms of what the learner SEES. */
export const CARDS: ReadonlyMap<string, LabelCard> = new Map<string, LabelCard>([
  ["builtin:circle", {
    key: "builtin:circle",
    title: "circle",
    oneLiner: "Draws a filled circle on the stage.",
    detail: "You choose where its middle sits, how big it is, and its color.",
    example: "circle(center: (160, 120), radius: 40, fill: #2A76C6)",
  }],
  ["param:circle.radius", {
    key: "param:circle.radius",
    title: "radius",
    oneLiner: "Distance from the center to the edge, in pixels.",
    detail: "Bigger radius, bigger circle. 20 is small; 100 fills most of the stage.",
  }],
  ["construct:repeat", {
    key: "construct:repeat",
    title: "repeat",
    oneLiner: "Runs the indented lines below it again and again.",
    detail:
      "repeat 5: runs them five times. Add `as i` to get a counter that " +
      "goes 1, 2, 3... — useful for placing things in a row.",
    example: "repeat 5 as i:\n  circle(center: (40 * i, 120), radius: 15)",
  }],
]);

export function cardFor(key: string): LabelCard | undefined {
  return CARDS.get(key);
}
