// T8 — golden snapshots. `UPDATE_GOLDEN=1 npm test` (or npm run test:update)
// writes; plain runs compare. Inspect regenerated goldens before committing.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Session } from "../../src/host/run.js";
import { fnv1a, serializeDisplayList } from "../../src/render/displayList.js";
import type { FrameInputs } from "../../src/engine/frame.js";

interface CaseSpec {
  source: string;
  seed: number;
  frames: number;
  fullFrames: number;
  script: Array<{ frame: number; pointer: { x: number; y: number; down: boolean }; events: FrameInputs["events"] }>;
}

interface Golden {
  fullFrames: string[]; // serialized display lists for frames 0..fullFrames-1
  chainHash: string;    // fnv1a chained over every frame's serialization
  frames: number;
}

const CASES_DIR = "tests/golden/cases";
const UPDATE = process.env["UPDATE_GOLDEN"] === "1";

function runCase(spec: CaseSpec): Golden {
  const source = readFileSync(join("examples", spec.source), "utf8");
  const script = new Map<number, FrameInputs>(
    spec.script.map((s) => [s.frame, { pointer: s.pointer, events: s.events }]),
  );
  const session = new Session(source, spec.seed);
  const fullFrames: string[] = [];
  let chain = "";
  const frames = Math.max(spec.frames, 1);
  for (let k = 0; k < frames; k++) {
    const inputs = script.get(k) ?? { pointer: { x: 0, y: 0, down: false }, events: [] };
    const ser = serializeDisplayList(session.advance(inputs));
    if (k < spec.fullFrames) fullFrames.push(ser);
    chain = fnv1a(chain + ser);
  }
  return { fullFrames, chainHash: chain, frames };
}

describe("goldens", () => {
  const caseFiles = readdirSync(CASES_DIR).filter((f) => f.endsWith(".case.json"));
  expect(caseFiles.length).toBeGreaterThan(0);

  for (const file of caseFiles) {
    it(file.replace(".case.json", ""), () => {
      const spec = JSON.parse(readFileSync(join(CASES_DIR, file), "utf8")) as CaseSpec;
      const goldenPath = join(CASES_DIR, file.replace(".case.json", ".golden.json"));
      const actual = runCase(spec);
      if (UPDATE) {
        writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + "\n");
        console.log("wrote", goldenPath, "— eyeball it before committing");
        return;
      }
      if (!existsSync(goldenPath)) {
        expect.fail("missing " + goldenPath + " — run: npm run test:update, inspect, commit");
      }
      const expected = JSON.parse(readFileSync(goldenPath, "utf8")) as Golden;
      expect(actual.frames).toBe(expected.frames);
      expect(actual.fullFrames).toEqual(expected.fullFrames);
      expect(actual.chainHash).toBe(expected.chainHash);
    });
  }
});
