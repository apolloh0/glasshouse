// T1 (lexer) + T2 (parser, diagnostics, node ids)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lex } from "../src/lang/lexer.js";
import { parse } from "../src/lang/parser.js";
import { ChalkError } from "../src/lang/diagnostics.js";

const ex = (name: string): string => readFileSync("examples/" + name, "utf8");

function expectDiagnostic(source: string, pattern: RegExp): void {
  try {
    parse(source);
  } catch (e) {
    expect(e).toBeInstanceOf(ChalkError);
    expect((e as ChalkError).message).toMatch(pattern);
    expect((e as ChalkError).diagnostic.span.line).toBeGreaterThan(0);
    return;
  }
  expect.fail("expected a diagnostic matching " + pattern.source);
}

/** Collect every {id, span} node reachable from the program, generically. */
function collectIds(root: unknown): number[] {
  const ids: number[] = [];
  const seen = new Set<object>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== "object" || seen.has(v)) return;
    seen.add(v as object);
    if (v instanceof Map) { for (const x of v.values()) walk(x); return; }
    const o = v as Record<string, unknown>;
    if (typeof o["id"] === "number" && typeof o["span"] === "object") ids.push(o["id"] as number);
    for (const k of Object.keys(o)) if (k !== "span") walk(o[k]);
  };
  walk(root);
  return ids;
}

describe("lexer", () => {
  it("synthesizes indent/dedent and skips comments and blank lines", () => {
    const toks = lex("every frame:\n  // hi\n\n  x = 1\nx = 2\n");
    const kinds = toks.map((t) => t.kind);
    expect(kinds).toContain("indent");
    expect(kinds).toContain("dedent");
    expect(kinds.filter((k) => k === "indent").length).toBe(1);
    expect(toks[toks.length - 1]!.kind).toBe("eof");
  });

  it("rejects tabs with a plain-language message", () => {
    expect(() => lex("every frame:\n\tx = 1\n")).toThrowError(/spaces, not tabs/);
  });

  it("packs color literals and reads both angle suffixes", () => {
    const toks = lex("#2A76C6 30\u00B0 30deg 2.5");
    expect(toks[0]!.kind).toBe("color");
    expect(toks[0]!.value).toBe(0x2a76c6);
    expect(toks[1]!.kind).toBe("angle");
    expect(toks[1]!.value).toBe(30);
    expect(toks[2]!.kind).toBe("angle");
    expect(toks[2]!.value).toBe(30);
    expect(toks[3]!.kind).toBe("number");
    expect(toks[3]!.value).toBe(2.5);
  });

  it("gives every token an accurate span", () => {
    const toks = lex("state y = 40\n");
    const y = toks.find((t) => t.text === "y")!;
    expect(y.span.line).toBe(1);
    expect(y.span.col).toBe(7);
  });
});

describe("parser", () => {
  it("parses the bouncing ball example", () => {
    const p = parse(ex("bouncing-ball.chalk"));
    expect(p.frames.length).toBe(1);
    expect(p.events.length).toBe(0);
    expect(p.setup.length).toBe(3); // paper + two state decls
    expect(p.defs.size).toBe(0);
  });

  it("parses definitions and repeat (house row)", () => {
    const p = parse(ex("house-row.chalk"));
    expect(p.defs.has("house")).toBe(true);
    expect(p.defs.get("house")!.params.map((x) => x.name)).toEqual(["at", "height"]);
    expect(p.frames.length).toBe(0);
  });

  it("parses event blocks (pointer paint)", () => {
    const p = parse(ex("pointer-paint.chalk"));
    expect(p.events.length).toBe(1);
    expect(p.events[0]!.event).toEqual({ kind: "pointer", which: "pressed" });
  });

  it("requires labels on all call arguments", () => {
    expectDiagnostic("circle(10, 20)\n", /label/i);
  });

  it("rejects assignment at top level, in learner language", () => {
    expectDiagnostic("x = 10\n", /every frame|when/);
  });

  it("rejects `state` outside top level", () => {
    expectDiagnostic("every frame:\n  state y = 1\n", /top/i);
  });

  it("allows the single-line if form", () => {
    const p = parse("state y = 0\nevery frame:\n  if y > 5: y = 0\n");
    expect(p.frames.length).toBe(1);
  });

  it("assigns unique pre-order ids, stably across parses (D7)", () => {
    const src = ex("bouncing-ball.chalk");
    const a = parse(src);
    const b = parse(src);
    const idsA = collectIds(a).sort((x, y) => x - y);
    const idsB = collectIds(b).sort((x, y) => x - y);
    expect(idsA.length).toBeGreaterThan(10);
    expect(new Set(idsA).size).toBe(idsA.length);        // unique
    expect(idsA[0]).toBe(0);                             // start at 0
    expect(idsA[idsA.length - 1]).toBe(a.nodeCount - 1); // dense
    expect(idsA).toEqual(idsB);                          // stable
  });
});
