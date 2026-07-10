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

import type {
  CallExpr, Definition, Expr, NameRef, Program, Span, StateDecl,
} from "../lang/ast.js";
import { pathAt, type AnyNode } from "../lang/walk.js";
import { cardFor, type LabelCard } from "../meta/cards.js";
import { KEYWORDS } from "../lang/tokens.js";

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

const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS);
const LITERAL_KINDS = new Set(["number", "color", "angle", "string"]);

export function labelAt(program: Program, offset: number): HoverResult | null {
  const path = pathAt(program, offset);
  const inner = [...path].reverse(); // innermost first

  // (1) argument LABEL under the cursor (calls AND group blocks — D36)
  for (const node of inner) {
    if (node.kind !== "call" && node.kind !== "group") continue;
    const callee = node.kind === "call" ? node.callee : "group";
    for (const arg of node.args) {
      if (contains(arg.labelSpan, offset)) {
        return {
          card: paramCard(callee, arg.label),
          span: arg.labelSpan,
          context: arg.label + " of this " + callee,
        };
      }
    }
  }

  // (2) literal anywhere inside a labeled arg's value -> nearest call's param
  const literal = inner.find((n) => LITERAL_KINDS.has(n.kind)) as Expr | undefined;
  if (literal) {
    const hit = nearestCallArg(inner, literal);
    if (hit) {
      return {
        card: paramCard(hit.callee, hit.label),
        span: literal.span,
        context: hit.label + " of this " + hit.callee,
        literal,
      };
    }
  }

  // (3) callee name
  for (const node of inner) {
    if (node.kind !== "call") continue;
    const calleeEnd = node.span.start + node.callee.length;
    if (offset >= node.span.start && offset < calleeEnd) {
      return {
        card: calleeCard(program, node.callee),
        span: { ...node.span, end: calleeEnd },
      };
    }
  }

  // (4) keyword under the cursor (keywords are not AST nodes; the word under
  // the cursor can only BE a keyword if the lexer reserved it)
  const word = wordAt(program.source, offset);
  if (word && KEYWORD_SET.has(word.text)) {
    const card = cardFor("construct:" + word.text);
    if (card) return { card, span: word.span };
  }

  // (5) name reference -> synthesized card from its declaration
  const innermost = inner[0];
  if (innermost && innermost.kind === "name") {
    return nameCard(program, inner, innermost as NameRef);
  }
  if (innermost && innermost.kind === "member") {
    const card = memberCard(innermost.member);
    if (card) return { card, span: innermost.span };
  }

  // (6) never guess
  return null;
}

// ---------- rule helpers ----------

function contains(span: Span, offset: number): boolean {
  return span.start <= offset && offset < span.end;
}

/** The nearest enclosing call (or group block) of `literal`, plus the label
 *  of the argument whose value subtree contains it. */
function nearestCallArg(
  inner: AnyNode[],
  literal: Expr,
): { callee: string; label: string } | null {
  for (const node of inner) {
    if (node.kind !== "call" && node.kind !== "group") continue;
    for (const arg of node.args) {
      if (arg.value.span.start <= literal.span.start && literal.span.end <= arg.value.span.end) {
        return { callee: node.kind === "call" ? node.callee : "group", label: arg.label };
      }
    }
  }
  return null;
}

/** param:CALLEE.LABEL — registry card for builtins, synthesized for defs. */
function paramCard(callee: string, label: string): LabelCard {
  const key = "param:" + callee + "." + label;
  const fromRegistry = cardFor(key);
  if (fromRegistry) return fromRegistry;
  return {
    key,
    title: label,
    oneLiner: "an input to " + callee + " — see its definition",
  };
}

function calleeCard(program: Program, callee: string): LabelCard {
  const fromRegistry = cardFor("builtin:" + callee);
  if (fromRegistry) return fromRegistry;
  const def = program.defs.get(callee);
  if (def) {
    return {
      key: "def:" + callee,
      title: callee,
      oneLiner: "A shape you taught — defined on line " + def.span.line + ".",
    };
  }
  return {
    key: "def:" + callee,
    title: callee,
    oneLiner: "Not taught yet — there's no `to " + callee + ":` block.",
  };
}

/** The word (name/keyword characters) under the cursor, if any. */
function wordAt(source: string, offset: number): { text: string; span: Span } | null {
  const isWord = (c: string | undefined): boolean =>
    c !== undefined && /[A-Za-z0-9_]/.test(c);
  if (!isWord(source[offset])) return null;
  let start = offset;
  while (start > 0 && isWord(source[start - 1])) start--;
  let end = offset + 1;
  while (end < source.length && isWord(source[end])) end++;
  // line/col are cosmetic here; recover the line for completeness
  const line = source.slice(0, start).split("\n").length;
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  return {
    text: source.slice(start, end),
    span: { start, end, line, col: start - lineStart + 1 },
  };
}

function nameCard(program: Program, inner: AnyNode[], ref: NameRef): HoverResult | null {
  // state variable?
  for (const item of program.setup) {
    if (item.kind === "state" && item.name === ref.name) {
      return {
        card: stateVarCard(program, item),
        span: ref.span,
      };
    }
  }
  // loop counter?
  for (const node of inner) {
    if (node.kind === "repeat" && node.counter === ref.name) {
      return {
        card: {
          key: "counter:" + ref.name,
          title: ref.name,
          oneLiner: "The repeat counter — goes 1, 2, 3… one number per pass.",
        },
        span: ref.span,
      };
    }
    if (node.kind === "for" && node.name === ref.name) {
      return {
        card: {
          key: "counter:" + ref.name,
          title: ref.name,
          oneLiner: "The loop counter — steps through the numbers after `from`.",
        },
        span: ref.span,
      };
    }
  }
  // definition parameter? (D37: `bind` is the field; span slicing is the
  // D30-era fallback for programs parsed before the promotion)
  for (const node of inner) {
    if (node.kind !== "to") continue;
    const def = node as Definition;
    for (const p of def.params) {
      const binding = p.bind ?? program.source.slice(p.span.start, p.span.end);
      if (binding === ref.name) {
        return {
          card: {
            key: "param:" + def.name + "." + p.name,
            title: ref.name,
            oneLiner: "An input to " + def.name + " — it arrives as `" + p.name + ":`.",
          },
          span: ref.span,
        };
      }
    }
  }
  return null;
}

function stateVarCard(program: Program, decl: StateDecl): LabelCard {
  const starts = decl.init.kind === "number" ? " Starts at " + decl.init.value + "."
    : decl.init.kind === "color" ? " Starts as a color."
    : "";
  return {
    key: "var:" + decl.name,
    title: decl.name,
    oneLiner: "A value the program remembers between frames." + starts,
    detail: "Created up top with `state " + decl.name + " = ...`; frame and event blocks may change it.",
  };
}

function memberCard(member: string): LabelCard | null {
  const texts: Record<string, string> = {
    x: "The across part of a point — pixels from the stage's left edge.",
    y: "The down part of a point — pixels from the stage's top.",
    down: "Whether the pointer is currently pressed — true or false.",
    r: "The red part of a color, 0 to 255.",
    g: "The green part of a color, 0 to 255.",
    b: "The blue part of a color, 0 to 255.",
  };
  const oneLiner = texts[member];
  if (!oneLiner) return null;
  return { key: "member:" + member, title: "." + member, oneLiner };
}
