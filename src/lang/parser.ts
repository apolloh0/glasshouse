import type {
  Assign, BinOpKind, CallExpr, Definition, EventBlock, EventSpec, Expr,
  FrameBlock, If, LabeledArg, LValue, NameRef, Program, Span, Stmt, TopLevel,
} from "./ast.js";
import type { Token } from "./tokens.js";
import { lex } from "./lexer.js";
import { err, type ChalkError } from "./diagnostics.js";
import { assignNodeIds } from "./nodeIds.js";

/**
 * T2 — Recursive-descent parser: Token[] -> Program (then assignNodeIds).
 * Parse-time rules (each is a ChalkError with learner wording — see tests):
 *  - every call argument must be labeled ("circle needs labels on its
 *    values — try circle(center: ..., radius: ..., fill: ...)");
 *  - `state` only at top level;
 *  - assignment only inside `every frame:` / `when ...:` bodies
 *    ("values can only change inside `every frame:` or `when ...:` blocks");
 *  - blocks are INDENT..DEDENT; `to` bodies end with `end`;
 *  - a lone `if cond: stmt` single-line form is allowed (see examples).
 * Populate Program.setup/defs/frames/events views and Program.source.
 *
 * Span conventions (load-bearing for hover/link/scrub tests):
 *  - every node's span starts at its first token and ends after its last
 *    child/token (composite spans carry the start token's line/col);
 *  - a definition parameter's `name` is its call LABEL; its `span` points at
 *    the internal binding name (`base` in `at: base`) so the evaluator and
 *    hover can recover it from source (decision D30).
 */

type Ctx = "top" | "setup-block" | "frame" | "def";
// "top": directly at top level. "setup-block": inside repeat/for/if nested at
// top level (still setup — no assignment). "frame": inside every frame:/when
// (assignment legal). "def": inside a `to` body (assignment illegal, return
// legal).

class Parser {
  private toks: Token[];
  private pos = 0;
  constructor(private source: string) {
    this.toks = lex(source);
  }

  // ---------- token plumbing ----------

  private peek(ahead = 0): Token { return this.toks[Math.min(this.pos + ahead, this.toks.length - 1)]!; }
  private next(): Token { return this.toks[this.pos++] ?? this.toks[this.toks.length - 1]!; }
  private at(kind: Token["kind"], text?: string): boolean {
    const t = this.peek();
    return t.kind === kind && (text === undefined || t.text === text);
  }
  private atKw(text: string): boolean { return this.at("keyword", text); }
  private atOp(text: string): boolean { return this.at("op", text); }
  private eat(kind: Token["kind"], text?: string): Token | null {
    if (this.at(kind, text)) return this.next();
    return null;
  }
  private expectOp(text: string, what: string): Token {
    const t = this.eat("op", text);
    if (!t) throw this.errAt("I expected `" + text + "` " + what + ".", this.peek().span);
    return t;
  }
  private expectNewline(): void {
    if (this.at("eof") || this.eat("newline")) return;
    const t = this.peek();
    throw this.errAt("I got stuck at `" + (t.text || t.kind) + "` — this line seems to continue past its end.", t.span);
  }

  private span(a: Span, b: Span): Span {
    return { start: a.start, end: b.end, line: a.line, col: a.col };
  }

  /** Diagnostics must point at something visible: synthetic end-of-source
   *  tokens carry empty spans — widen those to the previous character. */
  private errAt(message: string, span: Span): ChalkError {
    if (span.end > span.start) return err(message, span);
    const start = Math.max(0, span.start - 1);
    return err(message, { ...span, start, end: start + 1 });
  }

  // ---------- program ----------

  parse(): Program {
    const items: TopLevel[] = [];
    const setup: Stmt[] = [];
    const defs = new Map<string, Definition>();
    const frames: FrameBlock[] = [];
    const events: EventBlock[] = [];

    while (!this.at("eof")) {
      if (this.eat("newline")) continue;
      if (this.at("indent")) {
        throw this.errAt("This line is indented, but nothing above it asks for an indented block.",
          this.peek().span);
      }
      if (this.atKw("to")) {
        const def = this.parseDefinition();
        if (defs.has(def.name)) {
          throw this.errAt("There are two `to " + def.name + "` blocks — each name can only be taught once.",
            def.span);
        }
        defs.set(def.name, def);
        items.push(def);
      } else if (this.atKw("every")) {
        const fb = this.parseFrameBlock();
        frames.push(fb);
        items.push(fb);
      } else if (this.atKw("when")) {
        const eb = this.parseEventBlock();
        events.push(eb);
        items.push(eb);
      } else {
        const stmt = this.parseStmt("top");
        setup.push(stmt);
        items.push(stmt);
      }
    }

    const program: Program = {
      items, setup, defs, frames, events,
      source: this.source,
      nodeCount: 0,
    };
    return assignNodeIds(program);
  }

  // ---------- top-level blocks ----------

  private parseDefinition(): Definition {
    const toTok = this.next(); // `to`
    const nameTok = this.eat("name");
    if (!nameTok) {
      throw this.errAt("`to` needs a name for what you're teaching — like `to house(at: base):`.",
        this.peek().span);
    }
    this.expectOp("(", "after `to " + nameTok.text + "`");
    const params: { name: string; span: Span; bind?: string }[] = [];
    if (!this.atOp(")")) {
      for (;;) {
        const labelTok = this.at("name") || this.at("keyword") ? this.next() : null;
        if (!labelTok || !this.atOp(":")) {
          throw this.errAt("Each input to `" + nameTok.text + "` looks like `label: name` — for example `to house(at: base):`.",
            (labelTok ?? this.peek()).span);
        }
        this.next(); // `:`
        const bindTok = this.eat("name");
        if (!bindTok) {
          throw this.errAt("`" + labelTok.text + ":` needs a name to call this input inside the block — like `" + labelTok.text + ": p`.",
            this.peek().span);
        }
        // D37: bind is the internal name; span keeps pointing at its token
        // for D30-era readers.
        params.push({ name: labelTok.text, span: bindTok.span, bind: bindTok.text });
        if (this.eat("op", ",")) continue;
        break;
      }
    }
    this.expectOp(")", "to finish the inputs of `to " + nameTok.text + "`");
    this.expectOp(":", "after `to " + nameTok.text + "(...)`");
    const body = this.parseIndentedBlock("`to " + nameTok.text + ":`", "def");
    const endTok = this.eat("keyword", "end");
    if (!endTok) {
      throw this.errAt("This `to " + nameTok.text + "` block needs `end` on its own line after its last line.",
        this.peek().span);
    }
    this.expectNewline();
    return {
      kind: "to", id: -1, name: nameTok.text, params, body,
      span: this.span(toTok.span, endTok.span),
    };
  }

  private parseFrameBlock(): FrameBlock {
    const everyTok = this.next(); // `every`
    if (!this.eat("keyword", "frame")) {
      throw this.errAt("`every` starts the once-per-frame block — write `every frame:`.", this.peek().span);
    }
    this.expectOp(":", "after `every frame`");
    const body = this.parseIndentedBlock("`every frame:`", "frame");
    return {
      kind: "frame", id: -1, body,
      span: this.span(everyTok.span, body[body.length - 1]!.span),
    };
  }

  private parseEventBlock(): EventBlock {
    const whenTok = this.next(); // `when`
    let event: EventSpec;
    if (this.eat("keyword", "pointer")) {
      const which = this.eat("keyword", "pressed") ?? this.eat("keyword", "released") ?? this.eat("keyword", "moved");
      if (!which) {
        throw this.errAt("`when pointer` needs `pressed`, `released`, or `moved` — like `when pointer pressed:`.",
          this.peek().span);
      }
      event = { kind: "pointer", which: which.text as "pressed" | "released" | "moved" };
    } else if (this.eat("keyword", "key")) {
      const keyTok = this.eat("string");
      if (!keyTok) {
        throw this.errAt('`when key` needs the key in quotes — like `when key "a":`.', this.peek().span);
      }
      event = { kind: "key", key: keyTok.strValue };
    } else {
      throw this.errAt("`when` starts an event block — write `when pointer pressed:` or `when key \"a\":`.",
        this.peek().span);
    }
    this.expectOp(":", "after the `when ...` event");
    const body = this.parseIndentedBlock("`when ...:`", "frame");
    return {
      kind: "event", id: -1, event, body,
      span: this.span(whenTok.span, body[body.length - 1]!.span),
    };
  }

  // ---------- statements ----------

  /** An indented (multi-line) block: NEWLINE INDENT stmts DEDENT. */
  private parseIndentedBlock(owner: string, ctx: Ctx): Stmt[] {
    this.expectNewline();
    if (!this.eat("indent")) {
      throw this.errAt(owner + " needs at least one line inside it — indent the next line with two spaces.",
        this.peek().span);
    }
    const body: Stmt[] = [];
    while (!this.at("dedent") && !this.at("eof")) {
      if (this.eat("newline")) continue;
      body.push(this.parseStmt(ctx));
    }
    this.eat("dedent");
    if (body.length === 0) {
      throw this.errAt(owner + " needs at least one line inside it.", this.peek().span);
    }
    return body;
  }

  /** Block after `:` — indented, or (for if/else) a single statement on the
   *  same line. */
  private parseBlockOrInline(owner: string, ctx: Ctx): Stmt[] {
    if (this.at("newline")) return this.parseIndentedBlock(owner, ctx);
    return [this.parseStmt(ctx)];
  }

  private parseStmt(ctx: Ctx): Stmt {
    const t = this.peek();
    if (t.kind === "keyword") {
      switch (t.text) {
        case "state": return this.parseStateDecl(ctx);
        case "repeat": return this.parseRepeat(ctx);
        case "for": return this.parseFor(ctx);
        case "if": return this.parseIf(ctx);
        case "return": return this.parseReturn(ctx);
        case "else":
          throw this.errAt("`else` needs an `if` right above it, at the same indentation.", t.span);
        case "to":
          throw this.errAt("`to` blocks live at the top of the program, not inside another block.", t.span);
        case "every": case "when":
          throw this.errAt("`" + t.text + "` blocks live at the top of the program, not inside another block.", t.span);
        default:
          throw this.errAt("I got stuck on this line — it starts with `" + t.text + "`, which I didn't expect here.", t.span);
      }
    }
    if (t.kind === "name") return this.parseNameStmt(ctx);
    throw this.errAt("I got stuck on this line — I didn't expect `" + (t.text || t.kind) + "` here.", t.span);
  }

  private parseStateDecl(ctx: Ctx): Stmt {
    const stateTok = this.next();
    const nameTok = this.eat("name");
    if (!nameTok) {
      throw this.errAt("`state` needs a name for the value it creates — like `state y = 40`.", this.peek().span);
    }
    this.expectOp("=", "after `state " + nameTok.text + "`");
    const init = this.parseExpr();
    const span = this.span(stateTok.span, init.span);
    if (ctx !== "top") {
      throw this.errAt("`state " + nameTok.text + "` lives at the top of the program, not inside a block — move it up top.",
        span);
    }
    this.expectNewline();
    return { kind: "state", id: -1, name: nameTok.text, init, span };
  }

  private parseRepeat(ctx: Ctx): Stmt {
    const repTok = this.next();
    const count = this.parseExpr();
    let counter: string | null = null;
    if (this.eat("keyword", "as")) {
      const c = this.eat("name");
      if (!c) throw this.errAt("`as` names the counter — like `repeat 5 as i:`.", this.peek().span);
      counter = c.text;
    }
    this.expectOp(":", "after `repeat ...`");
    const body = this.parseIndentedBlock("`repeat ...:`", this.bodyCtx(ctx));
    return {
      kind: "repeat", id: -1, count, counter, body,
      span: this.span(repTok.span, body[body.length - 1]!.span),
    };
  }

  private parseFor(ctx: Ctx): Stmt {
    const forTok = this.next();
    const nameTok = this.eat("name");
    if (!nameTok) throw this.errAt("`for` names its counter first — like `for x from 1 to 5:`.", this.peek().span);
    if (!this.eat("keyword", "from")) {
      throw this.errAt("`for " + nameTok.text + "` needs `from` — like `for " + nameTok.text + " from 1 to 5:`.", this.peek().span);
    }
    const from = this.parseExpr();
    if (!this.eat("keyword", "to")) {
      throw this.errAt("`for " + nameTok.text + "` needs `to` after its starting value — like `for " + nameTok.text + " from 1 to 5:`.", this.peek().span);
    }
    const to = this.parseExpr();
    let step: Expr | null = null;
    if (this.eat("keyword", "step")) step = this.parseExpr();
    this.expectOp(":", "after `for ...`");
    const body = this.parseIndentedBlock("`for ...:`", this.bodyCtx(ctx));
    return {
      kind: "for", id: -1, name: nameTok.text, from, to, step, body,
      span: this.span(forTok.span, body[body.length - 1]!.span),
    };
  }

  private parseIf(ctx: Ctx): If {
    const ifTok = this.next();
    const cond = this.parseExpr();
    this.expectOp(":", "after the `if` question");
    const then = this.parseBlockOrInline("`if ...:`", this.bodyCtx(ctx));
    let else_: Stmt[] | null = null;
    if (this.atKw("else")) {
      this.next();
      if (this.atKw("if")) {
        else_ = [this.parseIf(this.bodyCtx(ctx))];
      } else {
        this.expectOp(":", "after `else`");
        else_ = this.parseBlockOrInline("`else:`", this.bodyCtx(ctx));
      }
    }
    const last = (else_ ?? then)[(else_ ?? then).length - 1]!;
    return {
      kind: "if", id: -1, cond, then, else_,
      span: this.span(ifTok.span, last.span),
    };
  }

  private parseReturn(ctx: Ctx): Stmt {
    const retTok = this.next();
    if (ctx !== "def") {
      throw this.errAt("`return` only makes sense inside a `to` block.", retTok.span);
    }
    let value: Expr | null = null;
    if (!this.at("newline") && !this.at("eof")) value = this.parseExpr();
    this.expectNewline();
    return {
      kind: "return", id: -1, value,
      span: value ? this.span(retTok.span, value.span) : retTok.span,
    };
  }

  /** Nested bodies keep their owner's rules; top-level loops/ifs stay setup. */
  private bodyCtx(ctx: Ctx): Ctx { return ctx === "top" ? "setup-block" : ctx; }

  /** A line starting with a name: assignment or a stand-alone call. */
  private parseNameStmt(ctx: Ctx): Stmt {
    const nameTok = this.next();
    if (this.atOp("(")) {
      const call = this.parseCallAfterName(nameTok);
      this.expectNewline();
      return { kind: "expr", id: -1, expr: call, span: call.span };
    }
    // assignment target: name or name.member...
    let target: LValue = {
      kind: "name", id: -1, name: nameTok.text, span: nameTok.span,
    } as NameRef;
    while (this.atOp(".")) {
      this.next();
      const m = this.eat("name") ?? this.eat("keyword");
      if (!m) throw this.errAt("`.` picks a part of a value — like `" + nameTok.text + ".x`.", this.peek().span);
      target = {
        kind: "member", id: -1, object: target, member: m.text,
        span: this.span(nameTok.span, m.span),
      };
    }
    if (!this.atOp("=")) {
      throw this.errAt("This line doesn't do anything on its own — call something like `circle(...)`, or change a value with `=`.",
        nameTok.span);
    }
    this.next(); // `=`
    const value = this.parseExpr();
    const span = this.span(nameTok.span, value.span);
    if (ctx !== "frame") {
      throw this.errAt("`" + nameTok.text + "` can only change inside an `every frame:` or `when ...:` block.",
        span);
    }
    this.expectNewline();
    const assign: Assign = { kind: "assign", id: -1, target, value, span };
    return assign;
  }

  // ---------- expressions ----------

  private parseExpr(): Expr { return this.parseOr(); }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.atKw("or")) {
      this.next();
      const right = this.parseAnd();
      left = { kind: "binop", id: -1, op: "or", left, right, span: this.span(left.span, right.span) };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.atKw("and")) {
      this.next();
      const right = this.parseNot();
      left = { kind: "binop", id: -1, op: "and", left, right, span: this.span(left.span, right.span) };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.atKw("not")) {
      const notTok = this.next();
      const operand = this.parseNot();
      return { kind: "unary", id: -1, op: "not", operand, span: this.span(notTok.span, operand.span) };
    }
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    let left = this.parseAdd();
    while (this.at("op") && ["<", ">", "<=", ">=", "==", "!="].includes(this.peek().text)) {
      const op = this.next().text as BinOpKind;
      const right = this.parseAdd();
      left = { kind: "binop", id: -1, op, left, right, span: this.span(left.span, right.span) };
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.atOp("+") || this.atOp("-")) {
      const op = this.next().text as BinOpKind;
      const right = this.parseMul();
      left = { kind: "binop", id: -1, op, left, right, span: this.span(left.span, right.span) };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    while (this.atOp("*") || this.atOp("/")) {
      const op = this.next().text as BinOpKind;
      const right = this.parseUnary();
      left = { kind: "binop", id: -1, op, left, right, span: this.span(left.span, right.span) };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.atOp("-")) {
      const minusTok = this.next();
      const operand = this.parseUnary();
      return { kind: "unary", id: -1, op: "-", operand, span: this.span(minusTok.span, operand.span) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    while (this.atOp(".")) {
      this.next();
      const m = this.eat("name") ?? this.eat("keyword");
      if (!m) throw this.errAt("`.` picks a part of a value — like `pointer.x`.", this.peek().span);
      e = { kind: "member", id: -1, object: e, member: m.text, span: this.span(e.span, m.span) };
    }
    return e;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    switch (t.kind) {
      case "number": this.next(); return { kind: "number", id: -1, value: t.value, span: t.span };
      case "angle": this.next(); return { kind: "angle", id: -1, degrees: t.value, span: t.span };
      case "color": this.next(); return { kind: "color", id: -1, rgb: t.value, span: t.span };
      case "string": this.next(); return { kind: "string", id: -1, value: t.strValue, span: t.span };
      case "name": {
        this.next();
        if (this.atOp("(")) return this.parseCallAfterName(t);
        return { kind: "name", id: -1, name: t.text, span: t.span };
      }
      case "keyword":
        if (t.text === "true" || t.text === "false") {
          this.next();
          return { kind: "bool", id: -1, value: t.text === "true", span: t.span };
        }
        if (t.text === "pointer") {
          this.next();
          return { kind: "name", id: -1, name: "pointer", span: t.span };
        }
        throw this.errAt("I didn't expect `" + t.text + "` in the middle of a value.", t.span);
      case "op":
        if (t.text === "(") return this.parseParenOrPoint();
        break;
      default:
        break;
    }
    throw this.errAt("I expected a value here — a number, a color, a name, or a point like (160, 120).", t.span);
  }

  /** `(` expr `)` grouping, or `(` expr `,` expr `)` point literal. */
  private parseParenOrPoint(): Expr {
    const lparen = this.next();
    const first = this.parseExpr();
    if (this.eat("op", ",")) {
      const second = this.parseExpr();
      const rparen = this.eat("op", ")");
      if (!rparen) throw this.errAt("This `(` is missing its closing `)`.", lparen.span);
      return {
        kind: "point", id: -1, x: first, y: second,
        span: this.span(lparen.span, rparen.span),
      };
    }
    if (!this.eat("op", ")")) throw this.errAt("This `(` is missing its closing `)`.", lparen.span);
    return first;
  }

  private parseCallAfterName(nameTok: Token): CallExpr {
    const lparen = this.next(); // `(`
    const args: LabeledArg[] = [];
    if (!this.atOp(")")) {
      for (;;) {
        if (this.at("eof")) {
          throw this.errAt("This `(` is missing its closing `)`.", lparen.span);
        }
        const labelTok = (this.at("name") || this.at("keyword")) && this.peek(1).kind === "op" && this.peek(1).text === ":"
          ? this.next()
          : null;
        if (!labelTok) {
          throw this.errAt("`" + nameTok.text + "` needs labels on its values — try `" + nameTok.text + "(label: value, ...)`.",
            this.peek().span);
        }
        this.next(); // `:`
        const value = this.parseExpr();
        args.push({ label: labelTok.text, labelSpan: labelTok.span, value });
        if (this.eat("op", ",")) continue;
        break;
      }
    }
    const rparen = this.eat("op", ")");
    if (!rparen) {
      throw this.errAt("This `(` is missing its closing `)`.", lparen.span);
    }
    return {
      kind: "call", id: -1, callee: nameTok.text, args,
      span: this.span(nameTok.span, rparen.span),
    };
  }
}

export function parse(source: string): Program {
  return new Parser(source).parse();
}
