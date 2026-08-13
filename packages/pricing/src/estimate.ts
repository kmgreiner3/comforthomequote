import type { Estimate, LineItem, PricingConfig, RoofInput, Selections } from './types';
import { defaultConfig } from './config';
import { pitchClassFromDeg } from './pitch';

const roundTo100 = (x: number) => Math.round(x / 100) * 100;

export function computeEstimate(
  roof: RoofInput,
  sel: Selections,
  config: PricingConfig = defaultConfig
): Estimate {
  if (!(roof.areaSqft > 0) || roof.areaSqft > 30000)
    throw new RangeError('areaSqft must be in (0, 30000]');
  if (roof.pitchDeg < 0 || roof.pitchDeg > 60)
    throw new RangeError('pitchDeg must be in [0, 60]');
  if (sel.skylights < 0 || !Number.isInteger(sel.skylights))
    throw new RangeError('skylights must be a non-negative integer');
  if (sel.gutterLf < 0) throw new RangeError('gutterLf must be >= 0');
  const wastePct = config.wastePct[roof.complexity];
  const squaresRaw = (roof.areaSqft * (100 + wastePct)) / 10000;
  const squares = Math.round(squaresRaw * 10) / 10;

  const hvhz = (base: number) =>
    roof.hvhz ? (base * (100 + config.hvhzPct)) / 100 : base;
  const withMargin = (base: number) =>
    Math.round((base * (100 + config.marginPct)) / 100);

  const pitchClass = pitchClassFromDeg(roof.pitchDeg, config);
  const storiesPct = config.storiesFactorPct[String(roof.stories) as '1' | '2' | '3'];

  const materialsBase = hvhz(squaresRaw * config.materialPerSquare[sel.material]);
  const laborBase = hvhz((squaresRaw * config.laborPerSquare[pitchClass] * storiesPct) / 100);
  const permit = config.permitByCounty[roof.county] ?? config.permitByCounty['default']!;

  const lineItems: LineItem[] = [
    { key: 'materials', label: 'Materials', amount: withMargin(materialsBase) },
    { key: 'labor', label: 'Labor', amount: withMargin(laborBase) },
  ];
  if (sel.underlaymentUpgrade) lineItems.push({
    key: 'underlayment', label: 'Peel & stick underlayment upgrade',
    amount: withMargin(squaresRaw * config.underlaymentUpgradePerSquare),
  });
  if (sel.ridgeVent) lineItems.push({
    key: 'ridgeVent', label: 'Ridge vent', amount: withMargin(config.ridgeVentFlat),
  });
  if (sel.skylights > 0) lineItems.push({
    key: 'skylights', label: `Skylights (${sel.skylights})`,
    amount: withMargin(sel.skylights * config.perSkylight),
  });
  if (sel.gutterLf > 0) lineItems.push({
    key: 'gutters', label: `Gutters (${sel.gutterLf} ln ft)`,
    amount: withMargin(sel.gutterLf * config.gutterPerLf),
  });
  if (sel.solarReady) lineItems.push({
    key: 'solarReady', label: 'Solar-ready prep', amount: withMargin(config.solarReadyFlat),
  });
  lineItems.push({ key: 'permit', label: `${roof.county} County permit & inspections`, amount: permit });
  lineItems.push({
    key: 'disposal', label: 'Tear-off & disposal',
    amount: withMargin(squaresRaw * config.disposalPerSquare),
  });

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  return {
    configVersion: config.version,
    squares,
    lineItems,
    subtotal,
    low: roundTo100((subtotal * (100 - config.bandPct)) / 100),
    high: roundTo100((subtotal * (100 + config.bandPct)) / 100),
  };
}
