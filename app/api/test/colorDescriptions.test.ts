import { describe, expect, it } from 'vitest';
import { SHINGLES } from '@chq/pricing';
import { COLOR_DESCRIPTIONS } from '../src/lib/colorDescriptions';

// COLOR_DESCRIPTIONS is a bundled copy (see its file header) kept in sync by
// hand with @chq/pricing's SHINGLES colors. This regression test makes any
// future color addition/rename/removal in either place fail loudly instead
// of silently degrading the Nova Canvas prompt (missing description ->
// buildVisualizePrompt falls back to an empty first sentence).
describe('COLOR_DESCRIPTIONS', () => {
  const allShingleColors = [...SHINGLES['iko-cambridge'].colors, ...SHINGLES['tamko-titan-xt'].colors];

  it('golden: has exactly 24 colors total, matching the two product lines', () => {
    expect(allShingleColors).toHaveLength(24);
    expect(Object.keys(COLOR_DESCRIPTIONS)).toHaveLength(24);
  });

  it('golden: has a description for every SHINGLES color (no gaps)', () => {
    for (const color of allShingleColors) {
      expect(COLOR_DESCRIPTIONS).toHaveProperty(color);
    }
  });

  it('golden: has no extra colors beyond the union of both SHINGLES product lines', () => {
    const shingleColorSet = new Set(allShingleColors);
    for (const color of Object.keys(COLOR_DESCRIPTIONS)) {
      expect(shingleColorSet.has(color)).toBe(true);
    }
  });
});
