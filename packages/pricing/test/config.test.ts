import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../src/config';

describe('defaultConfig', () => {
  it('has a dated version string', () => {
    expect(defaultConfig.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
  it('covers all four materials and the seven seeded counties plus default', () => {
    expect(Object.keys(defaultConfig.materialPerSquare).sort()).toEqual(
      ['architectural', 'metal', 'threeTab', 'tile']
    );
    for (const c of ['Hillsborough','Pinellas','Pasco','Sarasota','Miami-Dade','Broward','Palm Beach','default']) {
      expect(defaultConfig.permitByCounty[c]).toBeGreaterThan(0);
    }
  });
});
