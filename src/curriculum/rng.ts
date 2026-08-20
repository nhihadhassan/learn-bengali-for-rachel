// Deterministic PRNG so exercise generation is reproducible for a given seed.
//
// The implementation lives in `@/lib/rng` because the runtime lesson engine
// needs the same generator: if the pipeline and a real lesson disagreed about
// what "seed X" produces, a passing pipeline test would prove nothing about
// what a learner actually sees. This module keeps the pipeline's local names.

import {
  makeRng,
  seededPick,
  seededSample,
  seededShuffle,
  type Rng,
} from "../lib/rng";

export type { Rng };
export { hashSeed, makeRng, mulberry32 } from "../lib/rng";

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  return seededShuffle(items, rng);
}

export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return seededSample(items, count, rng);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return seededPick(items, rng);
}

export { makeRng as makeSeededRng };
