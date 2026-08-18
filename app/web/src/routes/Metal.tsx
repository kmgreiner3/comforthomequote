import { useState, type SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { METAL, TILE } from '@chq/pricing';
import { WARRANTY_FOOTNOTE } from '../content/footnote';
import Lightbox, { type LightboxImage } from '../components/Lightbox';

// Small hand-drawn line-icon set for this page's four benefit cards.
// Same visual language as content/icons.tsx (1.5px stroke, no fill,
// 24x24 viewBox) but kept local since these four are specific to metal
// roofing and not reused by the "What's Included" grid.
function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function DurabilityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3z" />
      <path d="M8.5 12.5l2.2 2.2L15.5 10" />
    </IconBase>
  );
}

function WindIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 16a3.5 3.5 0 0 1 .5-6.98A5 5 0 0 1 17 10.5a3 3 0 0 1-.5 5.5H7z" />
      <path d="M9 19l-1.2 2M13 19l-1.2 2M17 19l-1.2 2" />
    </IconBase>
  );
}

function EnergyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M3 12h2M19 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" />
    </IconBase>
  );
}

function MaintenanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M5 19c0-7 4-12 14-13-1 10-6 14-13 14z" />
      <path d="M8 18c2-3 4.5-6 9-9" />
    </IconBase>
  );
}

const BENEFITS: { icon: (props: SVGProps<SVGSVGElement>) => JSX.Element; title: string; body: string }[] = [
  {
    icon: DurabilityIcon,
    title: 'Engineered to last',
    body: 'Concealed fasteners and continuous panels shrug off hail, heavy rain, and decades of sun. Most standing seam roofs are just getting started after 40 years.',
  },
  {
    icon: WindIcon,
    title: 'Holds on when it counts',
    body: 'Interlocking seams and hidden fasteners give the whole roof one continuous surface, with nothing exposed for wind to catch or lift.',
  },
  {
    icon: EnergyIcon,
    title: 'Cooler attic, lower bills',
    body: 'Reflective metal panels bounce solar heat away from your home instead of soaking it in, so your air conditioner works less all summer.',
  },
  {
    icon: MaintenanceIcon,
    title: 'Built to be left alone',
    body: 'Metal will not rot, crack, or draw insects the way traditional roofing can. Rinse it off once in a while and it keeps performing.',
  },
];

const FLYERS: LightboxImage[] = [
  { src: '/metal/flyer-1.jpg', alt: 'Standing seam metal roof overview flyer' },
  { src: '/metal/flyer-2.jpg', alt: 'Why choose standing seam metal roofing comparison flyer' },
  { src: '/metal/flyer-3.jpg', alt: 'Standing seam metal roofing color and finish options flyer' },
];

const FLYER_LABELS = ['Standing Seam Overview', 'Why Choose Standing Seam', 'Color & Finish Options'];

export default function Metal() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div data-testid="metal-page">
      {/* Hero */}
      <section className="bg-navy-950 px-4 py-16 text-center text-white sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Standing Seam Metal. Built to Last.
          </h1>
          <p className="mt-4 text-lg text-sky-50/80">
            Concealed fasteners, interlocking panels, and decades of protection for Florida roofs.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border-2 border-navy-950/10 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-navy-950">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Warranty / guarantee + pricing framing (no calculator, no per-SQ table:
          metal pricing has tier cliffs, see docs/client/pricing-rules.md) */}
      <section className="bg-sky-50 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Guarantee &amp; warranty</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy-950 md:text-3xl">
            Backed for decades, not years
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-5">
              <p className="font-display text-2xl font-semibold text-navy-950">{METAL.guaranteeYears} years</p>
              <p className="mt-1 text-sm text-ink/70">Workmanship guarantee, transferable once.</p>
            </div>
            <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-5">
              <p className="font-display text-2xl font-semibold text-navy-950">{METAL.manufacturerWarrantyYears} years</p>
              <p className="mt-1 text-sm text-ink/70">Tri State corrosion and paint warranty.*</p>
            </div>
            <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-5">
              <p className="font-display text-2xl font-semibold text-navy-950">24-gauge</p>
              <p className="mt-1 text-sm text-ink/70">Heavier-gauge panel upgrade available.</p>
            </div>
          </div>

          <p className="mt-6 text-base leading-relaxed text-ink/80">
            Standing seam pricing depends on your roof&apos;s shape, pitch, and panel profile.
            Every metal roof is quoted custom.
          </p>

          <p className="mt-4 text-xs leading-relaxed text-ink/50">
            {METAL.name}. *{WARRANTY_FOOTNOTE}
          </p>
        </div>
      </section>

      {/* Flyer gallery */}
      <section className="bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">See it up close</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy-950 md:text-3xl">
            Standing seam reference sheets
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {FLYERS.map((flyer, i) => (
              <button
                key={flyer.src}
                type="button"
                onClick={() => setOpenIndex(i)}
                data-testid={`flyer-${i + 1}`}
                aria-label={`Open ${FLYER_LABELS[i]} full screen`}
                className="group min-h-[44px] overflow-hidden rounded-2xl border-2 border-navy-950/10 bg-sky-50 text-left transition-colors duration-200 hover:border-blue-600/50"
              >
                <img src={flyer.src} alt={flyer.alt} className="aspect-[11/14] w-full object-cover" />
                <p className="px-4 py-3 text-sm font-semibold text-navy-950 transition-colors duration-200 group-hover:text-blue-600">
                  {FLYER_LABELS[i]}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Eagle Tile */}
      <section className="bg-sky-50 px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Also available</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-navy-950 md:text-3xl">Eagle Tile</h2>

          <p className="mt-4 text-base leading-relaxed text-ink/80">
            Tile is our least requested roof, but it is on the table. {TILE.name} comes with a{' '}
            {TILE.guaranteeYears}-year labor and material guarantee, transferable once, plus a{' '}
            {TILE.manufacturerWarranty.toLowerCase()} on the tile itself.
          </p>

          <p className="mt-4 text-base leading-relaxed text-ink/80">Eagle Tile projects are quoted custom.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-950 px-4 py-14 text-center text-white sm:px-6">
        <div className="mx-auto max-w-xl">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Want a metal or tile quote? Email us.</h2>

          {/* TODO: swap to quotes@comforthomequote.com once domain mail (SES/forwarding) exists. */}
          <a
            href="mailto:dylannadeau2@gmail.com?subject=Metal%20roof%20quote%20request"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-blue-500"
          >
            Email quotes@comforthomequote.com
          </a>

          <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-3 text-sm font-medium text-white/90">
            Preview build. Email goes to the team directly.
          </p>
        </div>
      </section>

      {/* Cross-link */}
      <section className="bg-white px-4 py-8 text-center sm:px-6">
        <p className="text-sm text-ink/70">
          Building a shingle roof?{' '}
          <Link to="/build" className="font-semibold text-blue-600 hover:text-blue-500">
            Get your price now.
          </Link>
        </p>
      </section>

      {openIndex !== null && (
        <Lightbox
          images={FLYERS}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      )}
    </div>
  );
}
