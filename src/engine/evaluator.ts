// CONTRACT — evaluator internals shared by frame.ts (T4/T7).
// ONE code path, two modes: every node-completion site calls finishStep once;
// tracing hides behind `if (ctx.tracer)` (CLAUDE.md invariant 3).
import type {
  BinOp, CallExpr, Expr, LValue, Member, NameRef, NodeId, Span, Stmt,
} from "../lang/ast.js";
import { err } from "../lang/diagnostics.js";
import {
  expectAngle, expectColor, expectNum, expectPoint, typeName, valueEquals,
  ValueTypeError, type Value,
} from "./values.js";
import type { Prng } from "./prng.js";
import { nextInt } from "./prng.js";
import { BUILTINS, type ParamSpec } from "./stdlib.js";
import type { DisplayOp, Rgb } from "../render/displayList.js";
import type { FrameInputs } from "./frame.js";
import type { Program } from "../lang/ast.js";
import { STEP_KIND, type StepKindCode } from "./trace.js";

export interface Tracer {
  /** Record a completed step. `value` null for pure control steps. */
  onStep(nodeId: NodeId, kind: StepKindCode, value: Value | null, opStart: number, opEnd: number): void;
  /** Record a state/local write (its own row, kind = write). */
  onWrite(nodeId: NodeId, name: string, value: Value): void;
}

export interface EvalContext {
  program: Program;
  vars: Map<string, Value>;          // `state` variables
  locals: Map<string, Value>[];      // scope stack: loop counters, params
  rng: Prng;
  inputs: FrameInputs | null;        // null during setup (`pointer` illegal)
  ops: DisplayOp[];                  // this pass's emitted ops
  bg: Rgb | null;                    // mutated by paper() during setup
  inSetup: boolean;
  stepIndex: number;                 // pre-order completion counter
  tracer: Tracer | null;
}

/** The single choke point for step accounting (T4 structure, T7 wiring). */
export function finishStep(ctx: EvalContext, nodeId: NodeId, kind: StepKindCode, value: Value | null, opStart: number): number {
  const step = ctx.stepIndex++;
  if (ctx.tracer) ctx.tracer.onStep(nodeId, kind, value, opStart, ctx.ops.length);
  return step;
}

/** Step accounting for a state/local write. Consumes a step index in BOTH
 *  modes (the trace row seq must equal the op stepIndex numbering), tracing
 *  behind the same mode switch as finishStep. */
export function finishWrite(ctx: EvalContext, nodeId: NodeId, name: string, value: Value): number {
  const step = ctx.stepIndex++;
  if (ctx.tracer) ctx.tracer.onWrite(nodeId, name, value);
  return step;
}

/** Thrown by `return`; caught at the enclosing user-call boundary. */
class ReturnSignal {
  constructor(public value: Value | null) {}
}

// ---------- T4: statements ----------

/** T4 — evaluate a statement list (a block). */
export function execBlock(ctx: EvalContext, body: Stmt[]): void {
  for (const stmt of body) execStmt(ctx, stmt);
}

function execStmt(ctx: EvalContext, s: Stmt): void {
  const op0 = ctx.ops.length;
  switch (s.kind) {
    case "state": {
      const v = evalExpr(ctx, s.init);
      if (ctx.vars.has(s.name)) {
        throw err("`" + s.name + "` was already created — `state " + s.name + "` can only appear once.", s.span);
      }
      ctx.vars.set(s.name, v);
      finishWrite(ctx, s.id, s.name, v);
      finishStep(ctx, s.id, STEP_KIND.stmt, v, op0);
      return;
    }
    case "assign": {
      const v = evalExpr(ctx, s.value);
      if (s.target.kind === "member") {
        throw err("Only whole names can change — change `" +
          rootName(s.target) + "` itself instead of one of its parts.", s.target.span);
      }
      const name = s.target.name;
      const scope = findScope(ctx, name);
      if (scope) {
        scope.set(name, v);
      } else if (ctx.vars.has(name)) {
        ctx.vars.set(name, v);
      } else {
        throw err("There's no `" + name + "` yet — create it at the top of the program with `state " + name + " = ...`.",
          s.target.span);
      }
      finishWrite(ctx, s.id, name, v);
      finishStep(ctx, s.id, STEP_KIND.stmt, v, op0);
      return;
    }
    case "expr": {
      evalCall(ctx, s.expr);
      finishStep(ctx, s.id, STEP_KIND.stmt, null, op0);
      return;
    }
    case "repeat": {
      const countV = evalExpr(ctx, s.count);
      const count = Math.max(0, Math.floor(asNum(countV, s.count, "`repeat` needs a number of times")));
      if (s.counter !== null) {
        const scope = new Map<string, Value>();
        ctx.locals.push(scope);
        for (let i = 1; i <= count; i++) {
          const iv: Value = { t: "num", v: i };
          scope.set(s.counter, iv);
          finishWrite(ctx, s.id, s.counter, iv);
          execBlock(ctx, s.body);
        }
        ctx.locals.pop();
      } else {
        for (let i = 1; i <= count; i++) execBlock(ctx, s.body);
      }
      finishStep(ctx, s.id, STEP_KIND.stmt, null, op0);
      return;
    }
    case "for": {
      const from = asNum(evalExpr(ctx, s.from), s.from, "`from` needs a number");
      const to = asNum(evalExpr(ctx, s.to), s.to, "`to` needs a number");
      const step = s.step === null ? 1
        : asNum(evalExpr(ctx, s.step), s.step, "`step` needs a number");
      if (step === 0) {
        throw err("`step` can't be 0 — the loop would never finish.", s.step!.span);
      }
      const scope = new Map<string, Value>();
      ctx.locals.push(scope);
      for (let k = 0; ; k++) {
        const v = from + k * step;
        if (step > 0 ? v > to : v < to) break;
        const vv: Value = { t: "num", v };
        scope.set(s.name, vv);
        finishWrite(ctx, s.id, s.name, vv);
        execBlock(ctx, s.body);
      }
      ctx.locals.pop();
      finishStep(ctx, s.id, STEP_KIND.stmt, null, op0);
      return;
    }
    case "if": {
      const condV = evalExpr(ctx, s.cond);
      if (condV.t !== "bool") {
        throw err("The `if` question needs a true/false answer — right now it's " + typeName(condV) + ".",
          s.cond.span);
      }
      if (condV.v) execBlock(ctx, s.then);
      else if (s.else_) execBlock(ctx, s.else_);
      finishStep(ctx, s.id, STEP_KIND.stmt, null, op0);
      return;
    }
    case "return": {
      const v = s.value === null ? null : evalExpr(ctx, s.value);
      finishStep(ctx, s.id, STEP_KIND.stmt, v, op0);
      throw new ReturnSignal(v);
    }
  }
}

// ---------- T4: expressions ----------

/** T4 — evaluate an expression to a Value (calls finishStep on completion). */
export function evalExpr(ctx: EvalContext, e: Expr): Value {
  const op0 = ctx.ops.length;
  let v: Value;
  switch (e.kind) {
    case "number": v = { t: "num", v: e.value }; break;
    case "angle": v = { t: "angle", deg: e.degrees }; break;
    case "color": v = { t: "color", rgb: e.rgb }; break;
    case "bool": v = { t: "bool", v: e.value }; break;
    case "string": v = { t: "str", v: e.value }; break;
    case "point": {
      const x = evalExpr(ctx, e.x);
      const y = evalExpr(ctx, e.y);
      if (x.t !== "num" || y.t !== "num") {
        throw err("A point needs numbers for its two parts — like (160, 120).",
          (x.t !== "num" ? e.x : e.y).span);
      }
      v = { t: "point", x: x.v, y: y.v };
      break;
    }
    case "name": v = evalName(ctx, e); break;
    case "member": v = evalMember(ctx, e); break;
    case "binop": v = evalBinOp(ctx, e); break;
    case "unary": {
      const operand = evalExpr(ctx, e.operand);
      if (e.op === "-") {
        if (operand.t === "num") v = { t: "num", v: -operand.v };
        else if (operand.t === "angle") v = { t: "angle", deg: -operand.deg };
        else throw err("`-` flips a number — right now it's " + typeName(operand) + ".", e.operand.span);
      } else {
        if (operand.t !== "bool") {
          throw err("`not` flips true/false — right now it's " + typeName(operand) + ".", e.operand.span);
        }
        v = { t: "bool", v: !operand.v };
      }
      break;
    }
    case "call": {
      const result = evalCall(ctx, e);
      if (result === null) {
        throw err("`" + e.callee + "(...)` draws on the stage — it doesn't hand back a value you can use here.",
          e.span);
      }
      return result; // evalCall already finished the call's step
    }
  }
  finishStep(ctx, e.id, STEP_KIND.expr, v, op0);
  return v;
}

function evalName(ctx: EvalContext, e: NameRef): Value {
  if (e.name === "pointer") {
    if (ctx.inputs === null) {
      throw err("`pointer` isn't available while the picture is being set up — use it inside `every frame:` or `when ...:` blocks.",
        e.span);
    }
    return { t: "point", x: ctx.inputs.pointer.x, y: ctx.inputs.pointer.y };
  }
  const scope = findScope(ctx, e.name);
  if (scope) return scope.get(e.name)!;
  const sv = ctx.vars.get(e.name);
  if (sv !== undefined) return sv;
  throw err("There's nothing called `" + e.name + "` here" + suggestName(ctx, e.name) +
    " — check the spelling, or create it up top with `state " + e.name + " = ...`.", e.span);
}

function evalMember(ctx: EvalContext, e: Member): Value {
  const obj = evalExpr(ctx, e.object);
  // `pointer` carries an extra .down flag that the point value can't hold.
  if (e.object.kind === "name" && e.object.name === "pointer" && e.member === "down") {
    return { t: "bool", v: ctx.inputs!.pointer.down };
  }
  if (obj.t === "point") {
    if (e.member === "x") return { t: "num", v: obj.x };
    if (e.member === "y") return { t: "num", v: obj.y };
    throw err("A point has `.x` and `.y` — there's no `." + e.member + "`.", e.span);
  }
  if (obj.t === "color") {
    if (e.member === "r") return { t: "num", v: (obj.rgb >> 16) & 0xff };
    if (e.member === "g") return { t: "num", v: (obj.rgb >> 8) & 0xff };
    if (e.member === "b") return { t: "num", v: obj.rgb & 0xff };
    throw err("A color has `.r`, `.g`, and `.b` — there's no `." + e.member + "`.", e.span);
  }
  throw err(capitalize(typeName(obj)) + " doesn't have a part called `" + e.member + "` — `.` works on points and colors.",
    e.span);
}

/** Compute a binop's value; the caller (evalExpr) records its completion. */
function evalBinOp(ctx: EvalContext, e: BinOp): Value {
  // and/or short-circuit: the right side only runs (and only counts steps)
  // when it can still change the answer.
  if (e.op === "and" || e.op === "or") {
    const left = evalExpr(ctx, e.left);
    if (left.t !== "bool") {
      throw err("`" + e.op + "` needs true/false on both sides — the left side is " + typeName(left) + ".",
        e.left.span);
    }
    if (e.op === "and" && !left.v) return { t: "bool", v: false };
    if (e.op === "or" && left.v) return { t: "bool", v: true };
    const right = evalExpr(ctx, e.right);
    if (right.t !== "bool") {
      throw err("`" + e.op + "` needs true/false on both sides — the right side is " + typeName(right) + ".",
        e.right.span);
    }
    return { t: "bool", v: right.v };
  }

  const left = evalExpr(ctx, e.left);
  const right = evalExpr(ctx, e.right);
  switch (e.op) {
    case "==": return { t: "bool", v: valueEquals(left, right) };
    case "!=": return { t: "bool", v: !valueEquals(left, right) };
    case "+": case "-": case "*": case "/": {
      if (left.t !== "num") {
        throw err("`" + e.op + "` needs numbers on both sides — the left side is " + typeName(left) + ".", e.left.span);
      }
      if (right.t !== "num") {
        throw err("`" + e.op + "` needs numbers on both sides — the right side is " + typeName(right) + ".", e.right.span);
      }
      let n: number;
      if (e.op === "+") n = left.v + right.v;
      else if (e.op === "-") n = left.v - right.v;
      else if (e.op === "*") n = left.v * right.v;
      else {
        if (right.v === 0) throw err("Can't divide by zero here.", e.right.span);
        n = left.v / right.v;
      }
      return { t: "num", v: n };
    }
    default: { // < > <= >=
      if (left.t !== "num") {
        throw err("`" + e.op + "` compares numbers — the left side is " + typeName(left) + ".", e.left.span);
      }
      if (right.t !== "num") {
        throw err("`" + e.op + "` compares numbers — the right side is " + typeName(right) + ".", e.right.span);
      }
      const r = e.op === "<" ? left.v < right.v
        : e.op === ">" ? left.v > right.v
        : e.op === "<=" ? left.v <= right.v
        : left.v >= right.v;
      return { t: "bool", v: r };
    }
  }
}

// ---------- T4: calls ----------

/** Evaluate a call; null result = a drawing call with nothing to hand back.
 *  Handles arg resolution, the user-def scope, and the call's finishStep. */
function evalCall(ctx: EvalContext, call: CallExpr): Value | null {
  const op0 = ctx.ops.length;
  const builtin = BUILTINS.get(call.callee);
  if (builtin) {
    const args = resolveArgs(ctx, call, builtin.params.map((p) => p.label));
    // fill defaults / check required
    const checked: Record<string, Value> = {};
    for (const p of builtin.params) {
      const got = args.get(p.label);
      if (got !== undefined) {
        checked[p.label] = checkType(got.value, p, got.span);
      } else if (p.dflt !== null) {
        checked[p.label] = p.dflt;
      } else {
        throw err("`" + call.callee + "` needs a `" + p.label + ":` value.", call.span);
      }
    }
    let result: Value | null = null;
    if (builtin.kind === "paper") {
      if (!ctx.inSetup) {
        throw err("`paper(...)` belongs at the top of the program — it sets the stage once, before frames run.",
          call.span);
      }
      ctx.bg = (checked["color"] as { rgb: number }).rgb;
    } else if (builtin.kind === "value") {
      // random(from:, to:) — the engine PRNG is the only randomness source.
      const from = (checked["from"] as { v: number }).v;
      const to = (checked["to"] as { v: number }).v;
      result = { t: "num", v: nextInt(ctx.rng, from, to) };
    } else {
      builtin.emit!(checked, ctx.ops, { sourceNodeId: call.id, stepIndex: ctx.stepIndex });
    }
    finishStep(ctx, call.id, STEP_KIND.expr, result, op0);
    return result;
  }

  const def = ctx.program.defs.get(call.callee);
  if (def) {
    const labels = def.params.map((p) => p.name);
    const args = resolveArgs(ctx, call, labels);
    const values: Value[] = [];
    for (const p of def.params) {
      const got = args.get(p.name);
      if (got === undefined) {
        throw err("`" + call.callee + "` needs a `" + p.name + ":` value.", call.span);
      }
      values.push(got.value);
    }
    finishStep(ctx, call.id, STEP_KIND.callEnter, null, ctx.ops.length);
    const scope = new Map<string, Value>();
    for (let i = 0; i < def.params.length; i++) {
      // D37: `bind` carries the binding name; the span slice remains the
      // D30-era fallback.
      const p = def.params[i]!;
      scope.set(p.bind ?? ctx.program.source.slice(p.span.start, p.span.end), values[i]!);
    }
    ctx.locals.push(scope);
    let result: Value | null = null;
    try {
      execBlock(ctx, def.body);
    } catch (sig) {
      if (!(sig instanceof ReturnSignal)) throw sig;
      result = sig.value;
    } finally {
      ctx.locals.pop();
    }
    finishStep(ctx, call.id, STEP_KIND.callExit, result, ctx.ops.length);
    finishStep(ctx, call.id, STEP_KIND.expr, result, op0);
    return result;
  }

  throw err("There's nothing called `" + call.callee + "` to draw or use" +
    suggestCallee(ctx, call.callee) + ".", call.span);
}

/** Evaluate a call's labeled args in source order; reject unknown and
 *  duplicated labels with the callee's vocabulary. */
function resolveArgs(
  ctx: EvalContext,
  call: CallExpr,
  labels: string[],
): Map<string, { value: Value; span: Span }> {
  const out = new Map<string, { value: Value; span: Span }>();
  for (const arg of call.args) {
    if (!labels.includes(arg.label)) {
      throw err("`" + call.callee + "` doesn't take `" + arg.label + ":` — its values are " +
        labels.map((l) => "`" + l + ":`").join(", ") + ".", arg.labelSpan);
    }
    if (out.has(arg.label)) {
      throw err("`" + call.callee + "` got `" + arg.label + ":` twice — give it just once.", arg.labelSpan);
    }
    out.set(arg.label, { value: evalExpr(ctx, arg.value), span: arg.value.span });
  }
  return out;
}

/** Type-check one argument against its ParamSpec, rethrowing the values.ts
 *  wording with the argument's span (spec §6). */
function checkType(v: Value, p: ParamSpec, span: Span): Value {
  try {
    switch (p.type) {
      case "num": expectNum(v, p.label); break;
      case "point": expectPoint(v, p.label); break;
      case "color": expectColor(v, p.label); break;
      case "angle": expectAngle(v, p.label); break;
      case "string":
        if (v.t !== "str") throw new ValueTypeError(p.label, "some text in quotes", v);
        break;
    }
  } catch (e) {
    if (e instanceof ValueTypeError) throw err(e.message, span);
    throw e;
  }
  return v;
}

// ---------- small helpers ----------

function findScope(ctx: EvalContext, name: string): Map<string, Value> | null {
  for (let i = ctx.locals.length - 1; i >= 0; i--) {
    if (ctx.locals[i]!.has(name)) return ctx.locals[i]!;
  }
  return null;
}

function asNum(v: Value, at: Expr, what: string): number {
  if (v.t !== "num") throw err(what + " — right now it's " + typeName(v) + ".", at.span);
  return v.v;
}

function rootName(lv: LValue): string {
  let e: Expr = lv;
  while (e.kind === "member") e = e.object;
  return e.kind === "name" ? e.name : "it";
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** Edit distance <= 2 suggestion among the names in scope / the registry. */
function nearest(name: string, candidates: Iterable<string>): string | null {
  let best: string | null = null;
  let bestD = 3;
  for (const c of [...candidates].sort()) {
    const d = editDistance(name, c);
    if (d > 0 && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function suggestName(ctx: EvalContext, name: string): string {
  const pool: string[] = [...ctx.vars.keys()];
  for (const scope of ctx.locals) pool.push(...scope.keys());
  const hit = nearest(name, pool);
  return hit ? " — did you mean `" + hit + "`?" : "";
}

function suggestCallee(ctx: EvalContext, name: string): string {
  const pool = [...BUILTINS.keys(), ...ctx.program.defs.keys()];
  const hit = nearest(name, pool);
  return hit ? " — did you mean `" + hit + "`?" : "";
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}
