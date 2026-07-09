// CONTRACT — encodes the Chalk v1 grammar (plan Appendix B, minus deferred
// constructs per docs/decisions.md D6). Changes require a decision-log entry.

export type NodeId = number;

export interface Span {
  start: number; // char offset, inclusive
  end: number;   // char offset, exclusive
  line: number;  // 1-based, of start
  col: number;   // 1-based, of start
}

interface BaseNode {
  id: NodeId;
  span: Span;
}

// ---------- Expressions ----------

export interface NumberLit extends BaseNode { kind: "number"; value: number }
export interface AngleLit  extends BaseNode { kind: "angle";  degrees: number }
export interface ColorLit  extends BaseNode { kind: "color";  rgb: number } // 0xRRGGBB (D9)
export interface BoolLit   extends BaseNode { kind: "bool";   value: boolean }
export interface StringLit extends BaseNode { kind: "string"; value: string }
export interface PointLit  extends BaseNode { kind: "point";  x: Expr; y: Expr }
export interface NameRef   extends BaseNode { kind: "name";   name: string }
export interface Member    extends BaseNode { kind: "member"; object: Expr; member: string }

export type BinOpKind =
  | "+" | "-" | "*" | "/"
  | "<" | ">" | "<=" | ">=" | "==" | "!="
  | "and" | "or";

export interface BinOp extends BaseNode { kind: "binop"; op: BinOpKind; left: Expr; right: Expr }
export interface UnaryOp extends BaseNode { kind: "unary"; op: "-" | "not"; operand: Expr }

export interface LabeledArg { label: string; labelSpan: Span; value: Expr }

/** Calls: labels are mandatory for every argument (arity 0 calls have none). */
export interface CallExpr extends BaseNode { kind: "call"; callee: string; args: LabeledArg[] }

export type Expr =
  | NumberLit | AngleLit | ColorLit | BoolLit | StringLit | PointLit
  | NameRef | Member | BinOp | UnaryOp | CallExpr;

// ---------- Statements ----------

export type LValue = NameRef | Member;

export interface StateDecl extends BaseNode { kind: "state";  name: string; init: Expr }
export interface Assign    extends BaseNode { kind: "assign"; target: LValue; value: Expr }
export interface ExprStmt  extends BaseNode { kind: "expr";   expr: CallExpr } // only calls stand alone
export interface Repeat    extends BaseNode { kind: "repeat"; count: Expr; counter: string | null; body: Stmt[] }
export interface ForRange  extends BaseNode { kind: "for";    name: string; from: Expr; to: Expr; step: Expr | null; body: Stmt[] }
export interface If        extends BaseNode { kind: "if";     cond: Expr; then: Stmt[]; else_: Stmt[] | null }
export interface Return    extends BaseNode { kind: "return"; value: Expr | null }

export type Stmt = StateDecl | Assign | ExprStmt | Repeat | ForRange | If | Return;

// ---------- Top level ----------

/** `to name(label1: p1, label2: p2): ... end` — parameter names ARE the call labels. */
export interface Definition extends BaseNode { kind: "to"; name: string; params: { name: string; span: Span }[]; body: Stmt[] }

export type EventSpec =
  | { kind: "pointer"; which: "pressed" | "released" | "moved" }
  | { kind: "key"; key: string };

export interface FrameBlock extends BaseNode { kind: "frame"; body: Stmt[] }
export interface EventBlock extends BaseNode { kind: "event"; event: EventSpec; body: Stmt[] }

export type TopLevel = Stmt | Definition | FrameBlock | EventBlock;

export interface Program {
  /** All items in source order (order matters for setup and event dispatch). */
  items: TopLevel[];
  /** Convenience views, populated by the parser (same node objects). */
  setup: Stmt[];          // top-level statements (StateDecl included)
  defs: Map<string, Definition>;
  frames: FrameBlock[];
  events: EventBlock[];
  source: string;
  nodeCount: number;      // ids are 0..nodeCount-1 (see nodeIds.ts)
}
