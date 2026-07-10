// P3-T5 — call attribution. house-row: five house(...) invocations from one
// call site; rect/triangle completions inside the definition attribute back
// to it.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "../src/lang/parser.js";
import { Session } from "../src/host/run.js";
import { callSitesFor, callStackAt } from "../src/flow/stack.js";
import { pathAt } from "../src/lang/walk.js";

const src = readFileSync("examples/house-row.chalk", "utf8");

function fixture() {
  const program = parse(src);
  const view = new Session(src, 42).traceSetup();
  const at = (needle: string, kind: string) => {
    const hit = [...pathAt(program, src.indexOf(needle))].reverse()
      .find((n) => n.kind === kind);
    expect(hit, needle).toBeTruthy();
    return hit!.id;
  };
  return { program, view, at };
}

describe("call attribution (P3-T5)", () => {
  it("attributes definition-body completions to the call site", () => {
    const { program, view, at } = fixture();
    const rectStmt = at("rect(left:", "expr");
    const houseSite = at("house(at: (20", "call");
    const groups = callSitesFor(program, view, rectStmt);
    expect(groups.length).toBe(1);
    expect(groups[0]!.site).toBe(houseSite);
    expect(groups[0]!.steps.length).toBe(5);
  });

  it("top-level completions attribute to -1", () => {
    const { program, view, at } = fixture();
    const groups = callSitesFor(program, view, at("paper(color:", "expr"));
    expect(groups).toEqual([{ site: -1, steps: groups[0]!.steps }]);
    expect(groups[0]!.steps.length).toBe(1);
  });

  it("callStackAt is post-state: empty at top level, open inside a call", () => {
    const { program, view, at } = fixture();
    const houseSite = at("house(at: (20", "call");
    const rectGroups = callSitesFor(program, view, at("rect(left:", "expr"));
    const insideStep = rectGroups[0]!.steps[0]!;
    expect(callStackAt(view, insideStep)).toEqual([houseSite]);
    const paperStep = callSitesFor(program, view, at("paper(color:", "expr"))[0]!.steps[0]!;
    expect(callStackAt(view, paperStep)).toEqual([]);
  });
});
