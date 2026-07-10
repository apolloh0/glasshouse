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
/** Phase 4a (D36): `group` is a construct (auto-included via KEYWORDS), but
 *  its four labeled parameters aren't in BUILTINS — require their cards
 *  explicitly so hover coverage stays total. */
export const GROUP_PARAM_KEYS = [
  "param:group.move", "param:group.rotate", "param:group.scale", "param:group.around",
] as const;

export function requiredCardKeys(): string[] {
  const keys: string[] = [];
  for (const [name, spec] of BUILTINS) {
    keys.push(`builtin:${name}`);
    for (const p of spec.params) keys.push(`param:${name}.${p.label}`);
  }
  for (const c of CONSTRUCT_KEYS) keys.push(`construct:${c}`);
  for (const t of TYPE_KEYS) keys.push(`type:${t}`);
  keys.push(...GROUP_PARAM_KEYS);
  return keys;
}

/** P1-T1 — one card per key in requiredCardKeys(). The circle/radius/repeat
 *  cards are the exemplars that set the register: concrete, short, zero
 *  jargon, always in terms of what the learner SEES. */
const card = (key: string, title: string, oneLiner: string, detail?: string, example?: string): [string, LabelCard] =>
  [key, { key, title, oneLiner, ...(detail !== undefined ? { detail } : {}), ...(example !== undefined ? { example } : {}) }];

export const CARDS: ReadonlyMap<string, LabelCard> = new Map<string, LabelCard>([
  // ---------- builtins ----------
  ["builtin:circle", {
    key: "builtin:circle",
    title: "circle",
    oneLiner: "Draws a filled circle on the stage.",
    detail: "You choose where its middle sits, how big it is, and its color.",
    example: "circle(center: (160, 120), radius: 40, fill: #2A76C6)",
  }],
  card("builtin:paper", "paper",
    "Sets the background color of the whole stage.",
    "Use it once, at the top of the program, before any frames run.",
    "paper(color: #FDF6E3)"),
  card("builtin:ellipse", "ellipse",
    "Draws a filled oval on the stage.",
    "Like a circle you can squash: its width and height can differ.",
    "ellipse(center: (160, 120), width: 100, height: 60, fill: #888888)"),
  card("builtin:rect", "rect",
    "Draws a filled rectangle, measured from its top-left corner.",
    "left and top place that corner; width and height stretch it right and down.",
    "rect(left: 110, top: 90, width: 100, height: 60, fill: #C46A3D)"),
  card("builtin:triangle", "triangle",
    "Draws a filled triangle through three corner points.",
    undefined,
    "triangle(a: (160, 60), b: (110, 160), c: (210, 160), fill: #8A3324)"),
  card("builtin:line", "line",
    "Draws a straight line between two points.",
    undefined,
    "line(from: (60, 120), to: (260, 120), stroke: #333333, width: 2)"),
  card("builtin:random", "random",
    "Picks a whole number between from and to — a new one each time.",
    "The picks look random but replay the same way every run, so your picture is repeatable.",
    "random(from: 0, to: 20)"),

  // ---------- parameters ----------
  card("param:paper.color", "color", "The background color, like #FDF6E3."),
  card("param:circle.center", "center", "The point where the middle of the circle sits."),
  ["param:circle.radius", {
    key: "param:circle.radius",
    title: "radius",
    oneLiner: "Distance from the center to the edge, in pixels.",
    detail: "Bigger radius, bigger circle. 20 is small; 100 fills most of the stage.",
  }],
  card("param:circle.fill", "fill", "The color inside the circle."),
  card("param:ellipse.center", "center", "The point where the middle of the oval sits."),
  card("param:ellipse.width", "width", "Total width of the oval, in pixels."),
  card("param:ellipse.height", "height", "Total height of the oval, in pixels."),
  card("param:ellipse.fill", "fill", "The color inside the oval."),
  card("param:rect.left", "left", "Where the left edge sits, in pixels from the stage's left side."),
  card("param:rect.top", "top", "Where the top edge sits, in pixels down from the stage's top."),
  card("param:rect.width", "width", "How wide the rectangle is, in pixels."),
  card("param:rect.height", "height", "How tall the rectangle is, in pixels."),
  card("param:rect.fill", "fill", "The color inside the rectangle."),
  card("param:triangle.a", "a", "The first corner point."),
  card("param:triangle.b", "b", "The second corner point."),
  card("param:triangle.c", "c", "The third corner point."),
  card("param:triangle.fill", "fill", "The color inside the triangle."),
  card("param:line.from", "from", "The point where the line starts."),
  card("param:line.to", "to", "The point where the line ends."),
  card("param:line.stroke", "stroke", "The line's color."),
  card("param:line.width", "width", "How thick the line is, in pixels."),
  card("param:random.from", "from", "The smallest number the pick can be."),
  card("param:random.to", "to", "The largest number the pick can be."),

  // ---------- constructs ----------
  card("construct:state", "state",
    "Creates a value the program remembers between frames.",
    "Put `state` lines at the very top. Change the value inside `every frame:` or `when ...:` blocks.",
    "state y = 40"),
  card("construct:to", "to",
    "Teaches the program a new thing it can draw or do.",
    "Name it, list its inputs, and close the block with `end`. Then call it like a built-in shape.",
    "to dot(at: p):\n  circle(center: p, radius: 4, fill: #333333)\nend"),
  card("construct:end", "end",
    "Closes a `to` block — the teaching is done."),
  card("construct:every", "every",
    "Begins `every frame:` — the lines below run again for each new frame.",
    "This is what makes things move: each frame draws the stage fresh."),
  card("construct:frame", "frame",
    "One tick of the animation — the stage is drawn fresh each frame."),
  card("construct:when", "when",
    "Starts a block that runs only when something happens.",
    "For example `when pointer pressed:` or `when key \"a\":`."),
  card("construct:pointer", "pointer",
    "Where the finger or mouse is — a point with .x, .y, and .down.",
    "Only available inside `every frame:` and `when ...:` blocks."),
  card("construct:key", "key",
    "Names a keyboard key in a `when` block.",
    "`when key \"a\":` runs its lines the moment that key is pressed."),
  card("construct:pressed", "pressed",
    "The moment the pointer (or a key) goes down."),
  card("construct:released", "released",
    "The moment the pointer button comes back up."),
  card("construct:moved", "moved",
    "The moment the pointer moves to a new spot."),
  ["construct:repeat", {
    key: "construct:repeat",
    title: "repeat",
    oneLiner: "Runs the indented lines below it again and again.",
    detail:
      "repeat 5: runs them five times. Add `as i` to get a counter that " +
      "goes 1, 2, 3... — useful for placing things in a row.",
    example: "repeat 5 as i:\n  circle(center: (40 * i, 120), radius: 15)",
  }],
  card("construct:as", "as",
    "Names the counter in a repeat.",
    "`repeat 5 as i:` counts i = 1, 2, 3, 4, 5 — one number per pass."),
  card("construct:for", "for",
    "Counts a name through a range, running the lines once per count.",
    "`for x from 1 to 5:` runs with x = 1, then 2, up to 5. Add `step` to change the jump."),
  card("construct:from", "from",
    "Where counting starts, in `for` and `random`."),
  card("construct:step", "step",
    "How much a `for` counter jumps each time.",
    "`for x from 1 to 9 step 2:` counts 1, 3, 5, 7, 9."),
  card("construct:if", "if",
    "Runs the lines below only when the question after `if` is true.",
    undefined,
    "if y > 220:\n  y = 220"),
  card("construct:else", "else",
    "What to do instead, when the `if` question was false."),
  card("construct:return", "return",
    "Hands a value back from a `to` block and stops it there."),
  card("construct:and", "and",
    "True only when both sides are true."),
  card("construct:or", "or",
    "True when either side is true."),
  card("construct:not", "not",
    "Flips true to false, and false to true."),
  card("construct:true", "true",
    "The yes answer to a question."),
  card("construct:false", "false",
    "The no answer to a question."),

  // ---------- value types ----------
  card("type:number", "number",
    "A plain number, like 40 or 2.5 — sizes, positions, speeds."),
  card("type:point", "point",
    "A pair of numbers (x, y) naming a spot on the stage.",
    "x counts pixels from the left edge; y counts down from the top. The stage is 320 by 240."),
  card("type:color", "color",
    "A color written as #RRGGBB, like #2A76C6.",
    "Two characters each for red, green, and blue — 00 is none, FF is full."),
  card("type:angle", "angle",
    "A turn amount in degrees, written 30° or 30deg."),
  card("type:boolean", "true/false",
    "A yes-or-no answer: true or false.",
    "Questions like `y > 220` give one, and `if` acts on it."),
  card("type:string", "text",
    "Some text in quotes, like \"a\".",
    "Chalk uses it to name keyboard keys in `when key ...:` blocks."),
]);

export function cardFor(key: string): LabelCard | undefined {
  return CARDS.get(key);
}
