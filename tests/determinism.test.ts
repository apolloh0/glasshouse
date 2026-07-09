// T6 (history) + T9 (the determinism gate). Uses Session (T8).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Session } from "../src/host/run.js";
import { serializeDisplayList } from "../src/render/displayList.js";
import type { FrameInputs } from "../src/engine/frame.js";

const ex = (name: string): string => readFileSync("examples/" + name, "utf8");

function captureRun(source: string, seed: number, frames: number, script?: Map<number, FrameInputs>): string[] {
  const s = new Session(source, seed);
  const out: string[] = [];
  for (let k = 0; k < frames; k++) {
    const inputs = script?.get(k) ?? { pointer: { x: 0, y: 0, down: false }, events: [] };
    out.push(serializeDisplayList(s.advance(inputs)));
  }
  return out;
}

const paintScript = new Map<number, FrameInputs>([
  [20, { pointer: { x: 50, y: 60, down: true }, events: [{ type: "pointer-pressed", x: 50, y: 60 }] }],
  [60, { pointer: { x: 250, y: 180, down: true }, events: [{ type: "pointer-pressed", x: 250, y: 180 }] }],
]);

describe("T9 — same seed, same script, same everything", () => {
  it("bouncing ball: two fresh runs are byte-identical for 240 frames", () => {
    const a = captureRun(ex("bouncing-ball.chalk"), 42, 240);
    const b = captureRun(ex("bouncing-ball.chalk"), 42, 240);
    expect(a).toEqual(b);
  });

  it("pointer script replays identically and actually moves the dot", () => {
    const a = captureRun(ex("pointer-paint.chalk"), 7, 90, paintScript);
    const b = captureRun(ex("pointer-paint.chalk"), 7, 90, paintScript);
    expect(a).toEqual(b);
    expect(a[19]).not.toEqual(a[21]); // the press changed the output
  });

  it("different seeds change random-driven output (house row)", () => {
    const a = captureRun(ex("house-row.chalk"), 1, 1);
    const b = captureRun(ex("house-row.chalk"), 2, 1);
    expect(a).not.toEqual(b);
  });
});

describe("T6 — replay from keyframes", () => {
  it("displayAt(k) equals the straight-line run at k, on and off keyframes", () => {
    const straight = captureRun(ex("bouncing-ball.chalk"), 42, 240);
    const s = new Session(ex("bouncing-ball.chalk"), 42);
    s.advanceFrames(240);
    for (const k of [0, 1, 29, 30, 31, 37, 100, 239]) {
      expect(serializeDisplayList(s.displayAt(k))).toBe(straight[k]);
    }
  });

  it("history snapshots are deep: mutating live state never corrupts replay", () => {
    const s = new Session(ex("bouncing-ball.chalk"), 42);
    s.advanceFrames(120);
    const at60 = serializeDisplayList(s.displayAt(60));
    s.advanceFrames(120); // keep running (mutates live state)
    expect(serializeDisplayList(s.displayAt(60))).toBe(at60);
  });
});

describe("T7/T9 — execution modes agree", () => {
  it("traceAt(k) re-derives a display identical to the recorded one", () => {
    const s = new Session(ex("bouncing-ball.chalk"), 42);
    s.advanceFrames(150);
    for (const k of [0, 45, 149]) {
      const tv = s.traceAt(k);
      expect(serializeDisplayList(tv.display)).toBe(serializeDisplayList(s.displayAt(k)));
      expect(tv.trace.count).toBeGreaterThan(0);
    }
  });

  it("trace fingerprints are stable across re-derivations", () => {
    const s = new Session(ex("bouncing-ball.chalk"), 42);
    s.advanceFrames(100);
    expect(s.traceAt(70).trace.fingerprint()).toBe(s.traceAt(70).trace.fingerprint());
  });
});
