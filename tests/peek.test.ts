// Reviewed ruling (Phase 1 closure): the fresh-session frame-0 peek
// (Session.displayAt(0)/stateAt(0)/traceAt(0) before any advance) must be
// PURE — no PRNG consumption, no live-state mutation — and is superseded by
// the recorded frame once advance() runs. Added under the adding-tests-is-
// allowed ruling; never weaken.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Session } from "../src/host/run.js";
import { serializeDisplayList } from "../src/render/displayList.js";

const ball = readFileSync("examples/bouncing-ball.chalk", "utf8");
// random() in the frame body makes any PRNG leakage from the peek visible.
const rngSrc = [
  "state r = 0",
  "every frame:",
  "  r = r + random(from: 0, to: 1000000)",
  "  circle(center: (160, 120), radius: 5, fill: #112233)",
  "",
].join("\n");

function run(source: string, frames: number, peekFirst: boolean): string[] {
  const s = new Session(source, 42);
  if (peekFirst) {
    s.displayAt(0); // the peek under test
    s.traceAt(0);   // and the instrumented flavor of it
  }
  const out: string[] = [];
  for (let k = 0; k < frames; k++) {
    out.push(serializeDisplayList(s.advance({ pointer: { x: 0, y: 0, down: false }, events: [] })));
  }
  return out;
}

describe("fresh-session frame-0 peek is pure", () => {
  it("peek-then-advance history is byte-identical to advance-without-peek", () => {
    for (const src of [ball, rngSrc]) {
      expect(run(src, 40, true)).toEqual(run(src, 40, false));
    }
  });

  it("the peeked frame 0 equals the recorded frame 0 (NO_INPUT run)", () => {
    const s = new Session(rngSrc, 42);
    const peek = serializeDisplayList(s.displayAt(0));
    const peekTrace = s.traceAt(0).trace.fingerprint();
    s.advance({ pointer: { x: 0, y: 0, down: false }, events: [] });
    expect(serializeDisplayList(s.displayAt(0))).toBe(peek);
    expect(s.traceAt(0).trace.fingerprint()).toBe(peekTrace);
  });
});
