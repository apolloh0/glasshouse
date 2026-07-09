// P2-T3 — the step scrubber model. Bouncing-ball frame 0: one circle op,
// several statements — small enough to assert exactly.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { scrubView, stepCount, stepsForSpan } from "../src/flow/steps.js";

const src = readFileSync("examples/bouncing-ball.chalk", "utf8");

function fixture() {
  const program = parse(src);
  const session = new Session(src, 42);
  session.advanceFrames(3);
  const view = session.traceAt(0);
  return { program, view, ops: view.display.ops };
}

describe("step scrubber (P2-T3)", () => {
  it("reveals the circle exactly when its call completes (post-state)", () => {
    const { program, view, ops } = fixture();
    expect(ops.length).toBe(1); // no setup draws: staticOpsCount is 0
    const emitStep = ops[0]!.stepIndex;
    expect(scrubView(program, 0, view, emitStep - 1).upToOp).toBe(0);
    expect(scrubView(program, 0, view, emitStep).upToOp).toBe(1);
    expect(scrubView(program, 0, view, stepCount(view) - 1).upToOp).toBe(1);
  });

  it("reports the completing node for the editor highlight", () => {
    const { program, view, ops } = fixture();
    const v = scrubView(program, 0, view, ops[0]!.stepIndex);
    expect(v.nodeId).toBe(ops[0]!.sourceNodeId);
    expect(src.slice(v.span.start, v.span.end).startsWith("circle(")).toBe(true);
  });

  it("upToOp is monotone over the whole trace", () => {
    const { program, view } = fixture();
    let prev = 0;
    for (let s = 0; s < stepCount(view); s++) {
      const u = scrubView(program, 0, view, s).upToOp;
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
    }
  });

  it("stepsForSpan snaps to statement completions", () => {
    const { program, view } = fixture();
    const line = "speed = speed + 0.5";
    const start = src.indexOf(line);
    const steps = stepsForSpan(program, view, { start, end: start + line.length });
    expect(steps.length).toBe(1); // that assignment completes once per frame
  });
});
