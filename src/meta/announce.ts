// CONTRACT — ANNOUNCEMENTS (Phase 6, D57): every string a screen reader
// speaks. Extends the vocabulary invariant: hovers/tooltips/errors come
// only from cards.ts; announcements come only from HERE, composed from
// cards plus this pinned template set. No inline strings in the studio.
//
// The Phase 1 card schema needs NO new field (the open question from the
// handoff): oneLiner was written jargon-free and <= 90 chars for exactly
// this dual use. Cards describe THINGS; templates describe EVENTS.
//
// Rules (P6-T1):
//  - requiredAnnouncementKeys() is total coverage, like requiredCardKeys.
//  - Slots are typed; rendered text passes the JARGON ban and stays
//    <= 120 chars (tested).
//  - Where an event references a thing with a card, compose the card's
//    title (never restate its meaning — the learner can query it).
//  - Numbers/values render via showValue. One voice everywhere.

import { TODO } from "../util/todo.js";

export const ANNOUNCEMENT_KEYS = [
  "focus.op",          // {kind, index, count} "circle, 3 of 10"
  "focus.none",        // {} "nothing focused"
  "drag.start",        // {kind} "moving the circle — arrows to move, ..."
  "drag.step",         // {x, y} live position
  "drag.candidate",    // {note, index, count} "changing 55 to 65, choice 1 of 2 — TAB for alternatives"
  "drag.locked",       // {axis} "up and down is set by the program here"
  "drag.commit",       // {note} "changed 55 to 65"
  "drag.cancel",       // {}
  "gesture.applied",   // {name, note}
  "gesture.declined",  // {reason} (already learner-worded)
  "completion.preview",// {label} "circle — press enter to add it"
  "diagnostic",        // {message} (already learner-worded)
  "frame.focus",       // {frame}
  "scrub.step",        // {line} "running: circle(...) on line 7"
] as const;

export type AnnouncementKey = (typeof ANNOUNCEMENT_KEYS)[number];

export function requiredAnnouncementKeys(): readonly string[] {
  return ANNOUNCEMENT_KEYS;
}

/** P6-T1 — fill for every key. Two exemplars set the register: plain,
 *  short, present-tense, no jargon, actions named by their keys. */
export const TEMPLATES: ReadonlyMap<string, (slots: Record<string, unknown>) => string> =
  new Map<string, (slots: Record<string, unknown>) => string>([
    ["focus.op", (s) => `${s["kind"]}, ${s["index"]} of ${s["count"]}`],
    ["drag.locked", (s) =>
      `${s["axis"] === "y" ? "up and down" : "left and right"} is set by the program here`],
  ]);

export function announce(key: AnnouncementKey, slots: Record<string, unknown>): string {
  const t = TEMPLATES.get(key);
  if (!t) TODO("P6-T1", "template missing: " + key);
  return t!(slots);
}
