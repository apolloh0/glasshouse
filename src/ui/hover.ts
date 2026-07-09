// CONTRACT (types + resolution rules) — hover resolution is a PURE function
// from (program, offset) to a card. No DOM in this directory (layering test).
// The CodeMirror wiring that displays the result lives in src/editor/.
//
// Resolution rules (P1-T3), innermost match wins:
//   1. Offset inside a call's argument LABEL (LabeledArg.labelSpan)
//        -> param:CALLEE.LABEL card. context: "radius of this circle".
//        User-defined callees synthesize a card from the `to` definition
//        (title = param name, oneLiner = "an input to NAME — see its
//        definition"), key "param:NAME.LABEL".
//   2. Offset inside a literal (number/color/angle/string) nested ANYWHERE
//        inside a labeled arg's value expression
//        -> the param card of the NEAREST enclosing call's arg (the 0 in
//           random(from: 0) inside house(height: ...) belongs to random.from,
//           not house.height). context names the label and callee; `literal`
//           carries the node so the editor can show its value.
//   3. Offset inside a callee name -> builtin:NAME card, or a synthesized
//        card for user definitions ("a shape you taught — defined on line N").
//   4. Offset on a keyword token (repeat/if/state/...) — keywords are not AST
//        nodes; detect via program.source at the START of the corresponding
//        block/stmt node's span -> construct:KEYWORD card.
//   5. Offset on a NameRef -> synthesized card: state var ("a number the
//        program remembers between frames — starts at 40"), repeat counter,
//        or parameter, depending on the declaration found.
//   6. Otherwise null. Never guess.
//
// (The rules above are the spec; the two example tables in tests/hover.test.ts
//  are the ground truth.)

import type { Expr, Program, Span } from "../lang/ast.js";
import type { LabelCard } from "../meta/cards.js";
import { TODO } from "../util/todo.js";

export interface HoverResult {
  card: LabelCard;
  /** Span the editor should underline while the card is up. */
  span: Span;
  /** One clause tying the card to THIS use site, e.g. `radius of this
   *  circle` or `height of this house`. Omit when the card alone is exact. */
  context?: string;
  /** For rule (2): the literal node under the cursor. */
  literal?: Expr;
}

export function labelAt(program: Program, offset: number): HoverResult | null {
  void program; void offset;
  TODO("P1-T3", "hover resolution per rules in this file header");
}
