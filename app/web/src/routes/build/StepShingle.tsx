import { useState } from 'react';
import { configuredTotal, estimatedMonthly, titanUpgrade, SHINGLES, type ShingleKey } from '@chq/pricing';
import { useBuild } from '../../state/build';
import { perMonth, usd } from '../../lib/format';
import { BackChevron, PrimaryButton, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import Drawer from './Drawer';
import Lightbox, { type LightboxImage } from '../../components/Lightbox';
import { WARRANTY_FOOTNOTE } from '../../content/footnote';
import { MANUFACTURER_WARRANTY_LINE } from '../../content/warranty';

// Product literature shown in each shingle's "Learn more" drawer. IKO's
// three images are pages of the same brochure (one shared caption); Titan's
// two images are a distinct brochure and a distinct case study.
const LITERATURE: Record<ShingleKey, LightboxImage[]> = {
  'iko-cambridge': [
    { src: '/literature/iko-1.jpg', alt: 'IKO Cambridge brochure, page 1' },
    { src: '/literature/iko-2.jpg', alt: 'IKO Cambridge brochure, page 2' },
    { src: '/literature/iko-3.jpg', alt: 'IKO Cambridge brochure, page 3' },
  ],
  'tamko-titan-xt': [
    { src: '/literature/titan-1.jpg', alt: 'Titan XT colors and features' },
    { src: '/literature/titan-2.jpg', alt: 'Hurricane Milton case study' },
  ],
};

const LITERATURE_CAPTIONS: Record<ShingleKey, string[]> = {
  'iko-cambridge': ['IKO Cambridge brochure', 'IKO Cambridge brochure', 'IKO Cambridge brochure'],
  'tamko-titan-xt': ['Titan XT colors and features', 'Hurricane Milton case study'],
};

// Verified warranty facts for the Learn More drawer (Dylan Nadeau, per the
// plan discussion + review amendments). Conditional phrasing kept exactly --
// "when installed according to applicable ... requirements" -- never a bare
// claim that a given roof actually meets that standard.
const WARRANTY_DETAILS: Record<ShingleKey, string[]> = {
  'iko-cambridge': [
    '10-year Iron Clad Protection period*',
    '110 MPH standard Limited Wind Warranty, up to 130 MPH when installed according to applicable IKO high-wind requirements (six-nail application)*',
  ],
  'tamko-titan-xt': [
    '10-year Full Start non-prorated warranty period*',
    'Up to 160 MPH, 15-year Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements (TAMKO starter and hip and ridge)*',
    'UL 2218 Class 3 impact resistance',
  ],
};

export default function StepShingle({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const sq = useBuild((s) => s.sq);
  // round8: configuredTotal now takes solarPanels (not underlayment).
  const solarPanels = useBuild((s) => s.solarPanels);
  const shingle = useBuild((s) => s.shingle);
  const setShingle = useBuild((s) => s.setShingle);
  const [drawerKey, setDrawerKey] = useState<ShingleKey | null>(null);
  const [litIndex, setLitIndex] = useState<number | null>(null);

  if (sq == null) return null; // shouldn't render: gated behind a valid home size

  const betterTotal = configuredTotal(sq, 'iko-cambridge', solarPanels ?? 0);
  const betterMonthly = estimatedMonthly(betterTotal);
  const delta = titanUpgrade(sq);
  const bestTotal = betterTotal + delta;
  const monthlyDelta = estimatedMonthly(bestTotal) - betterMonthly;

  // Selecting a card only selects it (highlight + price + description stay
  // put). Advancing is always the homeowner's own explicit [Continue] tap.
  function select(key: ShingleKey) {
    setShingle(key);
  }

  function openDrawer(key: ShingleKey) {
    setLitIndex(null);
    setDrawerKey(key);
  }

  return (
    <>
      <RevealGroup>
        <RevealItem>
          <BackChevron onClick={onBack} />
          <StepHeading
            eyebrow="Shingle"
            title="Choose your shingle"
            subtitle="Your shingles are your home's primary layer of protection, and one of the biggest factors in how your new roof looks and performs. We've simplified the decision to two options."
          />
        </RevealItem>

        <RevealItem className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <SelectionCard selected={shingle === 'iko-cambridge'} onSelect={() => select('iko-cambridge')}>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Better</p>
              <p className="mt-1 font-display text-2xl font-semibold">{SHINGLES['iko-cambridge'].name}</p>
              <p className="mt-1 text-sm opacity-80">{SHINGLES['iko-cambridge'].tagline}</p>
              <p className="mt-5 font-display text-3xl font-semibold tabular-nums">{usd(betterTotal)}</p>
              <p className="mt-1 text-sm opacity-80">or approximately {perMonth(betterMonthly)}</p>
              <ul className="mt-5 space-y-1.5 text-sm opacity-90">
                {SHINGLES['iko-cambridge'].highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true">&bull;</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold opacity-90">
                {SHINGLES['iko-cambridge'].workmanshipYears} year workmanship guarantee
              </p>
              <p className="mt-1 text-sm opacity-80">{MANUFACTURER_WARRANTY_LINE['iko-cambridge']}</p>
              <span className="mt-5 inline-block rounded-full border border-current px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
                Select
              </span>
            </SelectionCard>
            <button
              type="button"
              onClick={() => openDrawer('iko-cambridge')}
              className="self-start text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Learn more
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <SelectionCard selected={shingle === 'tamko-titan-xt'} onSelect={() => select('tamko-titan-xt')}>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Best</p>
              <p className="mt-1 font-display text-2xl font-semibold">{SHINGLES['tamko-titan-xt'].name}</p>
              <p className="mt-1 text-sm opacity-80">{SHINGLES['tamko-titan-xt'].tagline}</p>
              <p className="mt-5 font-display text-3xl font-semibold tabular-nums">+{usd(delta)}</p>
              <p className="mt-1 text-sm opacity-80">or approximately +{perMonth(monthlyDelta)}</p>
              <ul className="mt-5 space-y-1.5 text-sm opacity-90">
                {SHINGLES['tamko-titan-xt'].highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true">&bull;</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold opacity-90">
                {SHINGLES['tamko-titan-xt'].workmanshipYears} year workmanship guarantee
              </p>
              <p className="mt-1 text-sm opacity-80">{MANUFACTURER_WARRANTY_LINE['tamko-titan-xt']}</p>
              <span className="mt-5 inline-block rounded-full border border-current px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
                Upgrade
              </span>
            </SelectionCard>
            <button
              type="button"
              onClick={() => openDrawer('tamko-titan-xt')}
              className="self-start text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Learn more
            </button>
          </div>
        </RevealItem>

        <RevealItem>
          <PrimaryButton className="mt-8" disabled={shingle == null} onClick={onContinue}>
            Continue
          </PrimaryButton>
        </RevealItem>
      </RevealGroup>

      <Drawer
        open={drawerKey != null}
        onClose={() => setDrawerKey(null)}
        title={drawerKey ? SHINGLES[drawerKey].name : ''}
      >
        {drawerKey && (
          <div>
            <p className="mb-4 text-sm font-medium text-ink/70">{SHINGLES[drawerKey].tagline}</p>
            <ul className="space-y-2 text-sm text-ink/90">
              {SHINGLES[drawerKey].highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden="true">&bull;</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-blue-600">
              Warranty details
            </p>
            <ul className="space-y-2 text-sm text-ink/90">
              {WARRANTY_DETAILS[drawerKey].map((d) => (
                <li key={d} className="flex gap-2">
                  <span aria-hidden="true">&bull;</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>

            <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-blue-600">
              Product literature
            </p>
            <div className="grid grid-cols-3 gap-2">
              {LITERATURE[drawerKey].map((doc, i) => (
                <button
                  key={doc.src}
                  type="button"
                  onClick={() => setLitIndex(i)}
                  data-testid={`literature-${drawerKey}-${i + 1}`}
                  aria-label={`Open ${LITERATURE_CAPTIONS[drawerKey][i]} full screen`}
                  className="group min-h-[44px] overflow-hidden rounded-xl border-2 border-navy-950/10 bg-sky-50 text-left transition-colors duration-200 hover:border-blue-600/50"
                >
                  <img src={doc.src} alt="" className="aspect-[4/5] w-full object-cover" />
                  <p className="px-2 py-2 text-[11px] font-medium leading-snug text-ink/70 transition-colors duration-200 group-hover:text-blue-600">
                    {LITERATURE_CAPTIONS[drawerKey][i]}
                  </p>
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs text-ink/50">*{WARRANTY_FOOTNOTE}</p>
          </div>
        )}
      </Drawer>

      {drawerKey && litIndex !== null && (
        <Lightbox
          images={LITERATURE[drawerKey]}
          index={litIndex}
          onClose={() => setLitIndex(null)}
          onIndexChange={setLitIndex}
        />
      )}
    </>
  );
}
