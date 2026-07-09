// CONTRACT + full implementation — the columnar step store (plan §5.3).
// One row per step (node completion) or per state/local write. Rows hold only
// numbers; strings are interned. The evaluator (T7) feeds this via the Tracer
// interface in evaluator.ts. Growable structure-of-arrays keeps the hot path
// allocation-free after warmup.

export const STEP_KIND = {
  expr: 0,
  stmt: 1,
  callEnter: 2,
  callExit: 3,
  write: 4,
} as const;
export type StepKindCode = (typeof STEP_KIND)[keyof typeof STEP_KIND];

// Value encoding tags (mirrors values.ts encodeValue — keep in sync):
export const VTAG = {
  none: 0, num: 1, bool: 2, color: 3, point: 4, angle: 5, str: 6,
} as const;

class GrowI32 {
  a = new Int32Array(1024);
  n = 0;
  push(v: number): void {
    if (this.n === this.a.length) {
      const b = new Int32Array(this.a.length * 2); b.set(this.a); this.a = b;
    }
    this.a[this.n++] = v;
  }
}
class GrowU8 {
  a = new Uint8Array(1024);
  n = 0;
  push(v: number): void {
    if (this.n === this.a.length) {
      const b = new Uint8Array(this.a.length * 2); b.set(this.a); this.a = b;
    }
    this.a[this.n++] = v;
  }
}
class GrowF64 {
  a = new Float64Array(1024);
  n = 0;
  push(v: number): void {
    if (this.n === this.a.length) {
      const b = new Float64Array(this.a.length * 2); b.set(this.a); this.a = b;
    }
    this.a[this.n++] = v;
  }
}

export interface StepRow {
  seq: number;
  nodeId: number;
  kind: StepKindCode;
  valueTag: number;
  a: number;        // payload: num value / bool 0|1 / rgb / point x / degrees
  b: number;        // payload: point y; else 0
  strIdx: number;   // index into strings, -1 if none (write rows: name idx)
  opStart: number;  // display ops emitted during this step: [opStart, opEnd)
  opEnd: number;
}

export class StepStore {
  private nodeId = new GrowI32();
  private kind = new GrowU8();
  private valueTag = new GrowU8();
  private a = new GrowF64();
  private b = new GrowF64();
  private strIdx = new GrowI32();
  private opStart = new GrowI32();
  private opEnd = new GrowI32();
  private strings: string[] = [];
  private strMap = new Map<string, number>();

  get count(): number { return this.nodeId.n; }

  intern(s: string): number {
    let i = this.strMap.get(s);
    if (i === undefined) {
      i = this.strings.length;
      this.strings.push(s);
      this.strMap.set(s, i);
    }
    return i;
  }

  string(idx: number): string {
    const s = this.strings[idx];
    if (s === undefined) throw new Error("StepStore: bad string index " + idx);
    return s;
  }

  /** Hot path — numbers only, no allocation. Returns the row's seq. */
  push(
    nodeId: number, kind: StepKindCode, valueTag: number,
    a: number, b: number, strIdx: number, opStart: number, opEnd: number,
  ): number {
    const seq = this.nodeId.n;
    this.nodeId.push(nodeId);
    this.kind.push(kind);
    this.valueTag.push(valueTag);
    this.a.push(a);
    this.b.push(b);
    this.strIdx.push(strIdx);
    this.opStart.push(opStart);
    this.opEnd.push(opEnd);
    return seq;
  }

  row(seq: number): StepRow {
    if (seq < 0 || seq >= this.count) throw new Error("StepStore: bad seq " + seq);
    return {
      seq,
      nodeId: this.nodeId.a[seq]!,
      kind: this.kind.a[seq]! as StepKindCode,
      valueTag: this.valueTag.a[seq]!,
      a: this.a.a[seq]!,
      b: this.b.a[seq]!,
      strIdx: this.strIdx.a[seq]!,
      opStart: this.opStart.a[seq]!,
      opEnd: this.opEnd.a[seq]!,
    };
  }

  /** All rows for one AST node (timeline row), in execution order. */
  rowsForNode(nodeId: number): StepRow[] {
    const out: StepRow[] = [];
    for (let i = 0; i < this.count; i++) {
      if (this.nodeId.a[i] === nodeId) out.push(this.row(i));
    }
    return out;
  }

  /** Deterministic fingerprint of the whole trace (determinism suite). */
  fingerprint(): string {
    let h = 0x811c9dc5;
    const mix = (v: number): void => {
      // fold float64 bits
      f64[0] = v;
      for (let k = 0; k < 8; k++) {
        h ^= u8[k]!;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    };
    const f64 = new Float64Array(1);
    const u8 = new Uint8Array(f64.buffer);
    for (let i = 0; i < this.count; i++) {
      mix(this.nodeId.a[i]!); mix(this.kind.a[i]!); mix(this.valueTag.a[i]!);
      mix(this.a.a[i]!); mix(this.b.a[i]!); mix(this.strIdx.a[i]!);
      mix(this.opStart.a[i]!); mix(this.opEnd.a[i]!);
    }
    return h.toString(16).padStart(8, "0");
  }
}
