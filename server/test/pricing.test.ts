import { describe, it, expect } from 'vitest';
import { estimateCost, runCost } from '../src/adapters/llm/pricing.js';

/**
 * The cost badge computes cost on read via `runCost` (tokens × model price).
 * The contract that matters for the UI: a run with no usable data → null (the
 * client renders "—", never "$0.00"). These guard that null discipline plus the
 * arithmetic the PR-list cumulative column and per-run badges sum over.
 */
describe('estimateCost', () => {
  it('prices a known model: tokens × per-1M rate', () => {
    // gpt-4.1 = { in: 2.0, out: 8.0 } per 1M tokens.
    // 1M in + 1M out = 2.0 + 8.0 = 10.0
    expect(estimateCost('gpt-4.1', 1_000_000, 1_000_000)).toBeCloseTo(10.0, 9);
    // deepseek/deepseek-v4-flash = { in: 0.14, out: 0.28 }
    expect(estimateCost('deepseek/deepseek-v4-flash', 9_119, 1_210)).toBeCloseTo(
      (9_119 * 0.14 + 1_210 * 0.28) / 1_000_000,
      12,
    );
  });

  it('returns null for an unknown/unpriced model', () => {
    expect(estimateCost('totally-made-up-model', 1000, 1000)).toBeNull();
    // Provider-prefixed slug that is not in the table falls through to null.
    expect(estimateCost('openrouter/deepseek-v4-flash', 1000, 1000)).toBeNull();
  });
});

describe('runCost (null-safe cost badge)', () => {
  it('returns the priced cost when there is real usage', () => {
    expect(runCost('gpt-4.1', 1_000_000, 1_000_000)).toBeCloseTo(10.0, 9);
  });

  it('returns null when there is no usable data → UI renders "—"', () => {
    expect(runCost(null, 1000, 1000)).toBeNull(); // no model
    expect(runCost(undefined, 1000, 1000)).toBeNull();
    expect(runCost('gpt-4.1', 0, 0)).toBeNull(); // no recorded usage
    expect(runCost('gpt-4.1', null, null)).toBeNull();
    expect(runCost('unknown-model', 5000, 5000)).toBeNull(); // unpriced model
  });

  it('treats a free (priced-at-zero) model with real usage as $0, not "no data"', () => {
    // z-ai/glm-4.7-flash is the free evals baseline ({ in: 0, out: 0 }).
    expect(runCost('z-ai/glm-4.7-flash', 5000, 5000)).toBe(0);
  });

  it('sums consistently — the PR-list cumulative column adds per-run costs', () => {
    const a = runCost('gpt-4.1', 9_119, 1_210);
    const b = runCost('deepseek/deepseek-v4-flash', 12_011, 1_400);
    const c = runCost('unknown-model', 8_457, 1_100); // skipped (null)
    const total = [a, b, c].filter((x): x is number => x != null).reduce((s, x) => s + x, 0);
    expect(total).toBeCloseTo((a ?? 0) + (b ?? 0), 12);
    expect(c).toBeNull();
  });
});
