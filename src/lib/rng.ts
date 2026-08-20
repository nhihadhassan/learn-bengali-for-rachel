/**
 * A deterministic pseudo-random generator, shared by the runtime lesson engine
 * (`@/lib/lesson-steps`) and the offline curriculum pipeline
 * (`src/curriculum/rng.ts`, which re-exports this module).
 *
 * Why the app needs one at all: `Math.random()` makes a generated lesson
 * unreproducible, which means the sequencing rules can only be spot-checked by
 * playing a lesson rather than asserted in a test. Seeding from the lesson id
 * makes "what does lesson 3 of unit 1 look like?" a question with one answer.
 *
 * This is the same "one definition, two consumers" arrangement as
 * `@/lib/text-tokens`.
 */

export type Rng = () => number;

/** FNV-1a 32-bit hash — turns a seed string into a uint32. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

export function seededShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function seededSample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return seededShuffle(items, rng).slice(0, Math.max(0, count));
}

export function seededPick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}
