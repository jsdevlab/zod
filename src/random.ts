import type { Random } from './types';

/**
 * mulberry32 PRNG: deterministic seed → reproducible random sequence (lightweight, dependency-free).
 * The same seed produces an identical sequence of values
 *
 * @param seed - The seed (same seed, same sequence)
 * @returns A function that returns the next random float in [0, 1)
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded random utility
 *
 * @param seed - The random seed (same seed, same sequence)
 * @returns A seeded random utility
 */
export function createRandom(seed: number): Random {
  const next = mulberry32(seed);
  return {
    float: next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    string: (length, charset) => {
      let out = '';
      for (let i = 0; i < length; i++) {
        out += charset[Math.floor(next() * charset.length)];
      }
      return out;
    },
  };
}
