import type { PitchClass, PricingConfig } from './types';
import { defaultConfig } from './config';

export function pitchClassFromDeg(
  pitchDeg: number,
  config: PricingConfig = defaultConfig
): PitchClass {
  if (pitchDeg >= config.pitchBreaksDeg.verySteepFrom) return 'verySteep';
  if (pitchDeg >= config.pitchBreaksDeg.steepFrom) return 'steep';
  return 'walkable';
}
