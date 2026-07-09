// T4 (evaluator) + T5 (frame loop, inputs, rng) + T7 (instrumented mode)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { evalFrame, runSetup, NO_INPUT, type FrameInputs } from "../src/engine/frame.js";
import { serializeDisplayList } from "../src/render/displayList.js";
import { STEP_KIND } from "../src/engine/trace.js";
import { ChalkError } from "../src/lang/diagnostics.js";

const ex = (name: string): string => readFileSync("examples/" + name, "utf8");

const press = (x: number, y: number): FrameInputs => ({
  pointer: { x, y, down: true },
  events: [{ type: "pointer-pressed", x, y }],
});

function run(source: string, seed: number, frames: number, script?: Map<number, FrameInputs>) {
  const program = parse(source);
  const { state, staticLayer } = runSetup(program, seed);
  let last = null as ReturnType<typeof evalFrame> | null;
  for (let k = 0; k < frames; k++) {
    last = evalFrame(program, staticLayer, state, script?.get(k) ?? NO_INPUT, "fast");
  }
  return { program, state, staticLayer, last };
}

describe("T4 evaluator — static pictures", () => {
  it("house-row setup emits 10 ops (5 houses x rect+triangle) and a bg", () => {
    const { staticLayer } = run(ex("house-row.chalk"), 42, 0);
    expect(staticLayer.ops.length).toBe(10);
    expect(staticLayer.bg).toBe(0xeaf4fb);
  });

  it("unknown labels are named in the diagnostic", () => {
    expect(() => run("circle(wat: 3)\n", 1, 0)).toThrowError(/circle/);
    expect(() => run("circle(wat: 3)\n", 1, 0)).toThrowError(/wat/);
  });

  it("type mismatches use the learner wording (spec section 6)", () => {
    expect(() => run("circle(radius: #FF0000)\n", 1, 0)).toThrowError(/`radius:` needs a number/);
  });

  it("`pointer` is not available during setup", () => {
    expect(() => run("circle(center: (pointer.x, 0))\n", 1, 0)).toThrowError(ChalkError);
  });
});

describe("T4/T5 — frames, state, control flow", () => {
  it("repeat with a counter: i counts 1..n", () => {
    const src = "state c = 0\nevery frame:\n  repeat 3 as i:\n    c = c + i\n";
    const { state } = run(src, 1, 1);
    expect(state.vars.get("c")).toEqual({ t: "num", v: 6 });
  });

  it("state persists across frames and if clamps the ball", () => {
    const { state } = run(ex("bouncing-ball.chalk"), 42, 120);
    const y = state.vars.get("y")!;
    expect(y.t).toBe("num");
    if (y.t === "num") {
      expect(y.v).toBeGreaterThan(0);
      expect(y.v).toBeLessThanOrEqual(220);
    }
  });

  it("staticOps are prepended to every frame's display", () => {
    const src = "circle(center: (10, 10), radius: 2, fill: #111111)\n" +
      "every frame:\n  circle(center: (20, 20), radius: 2, fill: #222222)\n";
    const { last, staticLayer } = run(src, 1, 3);
    expect(staticLayer.ops.length).toBe(1);
    expect(last!.display.ops.length).toBe(2);
    expect(last!.display.ops[0]!.kind).toBe("circle");
    expect((last!.display.ops[0] as { fill: number }).fill).toBe(0x111111);
  });

  it("event blocks fire on matching events", () => {
    const script = new Map<number, FrameInputs>([[5, press(50, 60)]]);
    const { state } = run(ex("pointer-paint.chalk"), 7, 10, script);
    expect(state.vars.get("x")).toEqual({ t: "num", v: 50 });
    expect(state.vars.get("y")).toEqual({ t: "num", v: 60 });
  });

  it("rng is seeded, stable, and part of engine state", () => {
    const src = "state r = 0\nevery frame:\n  r = random(from: 0, to: 1000000)\n";
    const a = run(src, 5, 3).state.vars.get("r");
    const b = run(src, 5, 3).state.vars.get("r");
    const c = run(src, 6, 3).state.vars.get("r");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("T7 — instrumented mode", () => {
  it("traces writes and agrees with fast mode byte-for-byte", () => {
    const src = "state c = 0\nevery frame:\n  repeat 3 as i:\n    c = c + i\n  circle(center: (10, 10), radius: 2, fill: #111111)\n";
    const program = parse(src);

    const fastRun = runSetup(program, 9);
    const fast = evalFrame(program, fastRun.staticLayer, fastRun.state, NO_INPUT, "fast");
    expect(fast.trace).toBeNull();

    const instRun = runSetup(program, 9);
    const inst = evalFrame(program, instRun.staticLayer, instRun.state, NO_INPUT, "instrumented");
    expect(inst.trace).not.toBeNull();
    expect(serializeDisplayList(inst.display)).toBe(serializeDisplayList(fast.display));

    const trace = inst.trace!;
    expect(trace.count).toBeGreaterThan(10);
    let writesToC = 0;
    let sawCircleOpSpan = false;
    for (let s = 0; s < trace.count; s++) {
      const row = trace.row(s);
      if (row.kind === STEP_KIND.write && trace.string(row.strIdx) === "c") writesToC++;
      if (row.opEnd - row.opStart === 1) sawCircleOpSpan = true;
    }
    expect(writesToC).toBe(3);
    expect(sawCircleOpSpan).toBe(true); // some step emitted exactly the circle
  });
});
