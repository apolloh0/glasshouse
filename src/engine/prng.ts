// CONTRACT (D3) — mulberry32. State is a uint32 carried in EngineState so
// history snapshots capture the stream position. Do not change the algorithm.
export interface Prng {
  state: number; // uint32
}

export function makePrng(seed: number): Prng {
  return { state: seed >>> 0 };
}

/** Next float in [0, 1). Mutates rng.state. */
export function nextFloat(rng: Prng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform integer in [from, to], inclusive. */
export function nextInt(rng: Prng, from: number, to: number): number {
  const lo = Math.ceil(Math.min(from, to));
  const hi = Math.floor(Math.max(from, to));
  return lo + Math.floor(nextFloat(rng) * (hi - lo + 1));
}
