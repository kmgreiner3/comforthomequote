import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBuild } from '../state/build';
import { FINANCING_DISCLOSURE } from '../content/footnote';

const MIN_LENGTH = 5;

const TRUST_POINTS = [
  'No name, phone, or email needed to see your price',
  'One trusted local contractor per county',
  'Your price updates live as you build',
];

const HOW_IT_WORKS: { title: string; body: string }[] = [
  { title: 'Enter your address', body: 'No name or phone required, just the property.' },
  { title: 'Build your roof', body: 'Pick your shingle, color, and options. Watch your price update live.' },
  { title: 'See your price', body: 'Get your exact project price and monthly estimate, instantly.' },
];

function TrustPoint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="text-sm font-medium text-ink/80">{children}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const setAddress = useBuild((s) => s.setAddress);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const isValid = trimmed.length >= MIN_LENGTH;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    setAddress(trimmed);
    navigate('/build');
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-navy-950 px-4 py-16 text-center text-white sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            See Your Roof Price. No Salesperson Required.
          </h1>
          <p className="mt-4 text-lg text-sky-50/80">A quote from the comfort of your home.</p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row"
            noValidate
          >
            <label htmlFor="landing-address" className="sr-only">
              Property address
            </label>
            <input
              id="landing-address"
              name="address"
              type="text"
              autoComplete="off"
              placeholder="123 Palm Ave, Tampa, FL"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-[44px] w-full flex-1 rounded-xl border-2 border-white/15 bg-white px-5 py-4 text-base text-ink outline-none transition-colors focus:border-blue-500"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white transition-colors duration-200 hover:bg-blue-500"
            >
              Build My Roof
            </button>
          </form>
          {touched && !isValid && (
            <p className="mt-3 text-sm text-amber-400">Enter your property address to continue.</p>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-navy-950/5 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {TRUST_POINTS.map((point) => (
            <TrustPoint key={point}>{point}</TrustPoint>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sky-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-blue-600">
            How it works
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-950 font-display text-base font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold text-navy-950">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink/70">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Education strip */}
      <section className="bg-white px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-display text-base font-semibold text-navy-950">Why materials matter</h3>
            <p className="mt-1.5 text-sm text-ink/70">
              Your shingles and underlayment set your roof&apos;s protection, appearance, and
              warranty. We explain every option in plain language.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-navy-950">
              Everything included
            </h3>
            <p className="mt-1.5 text-sm text-ink/70">
              Removal, decking, ventilation, flashing, permits, and cleanup all come standard.
              Nothing hidden, nothing extra to ask for.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-navy-950">Financing</h3>
            <p className="mt-1.5 text-sm text-ink/70">
              Roofs from about $10 per month for every $1,000 of project cost.*
            </p>
            <p className="mt-1 text-xs text-ink/40">*{FINANCING_DISCLOSURE}</p>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-4xl flex-col gap-2 border-t border-navy-950/10 pt-6 text-sm sm:flex-row sm:justify-between">
          <p className="text-ink/70">
            New here?{' '}
            <Link to="/about" className="font-semibold text-blue-600 hover:text-blue-500">
              Read about Comfort Home Quote
            </Link>
          </p>
          <p className="text-ink/70">
            Considering metal or tile?{' '}
            <Link to="/metal" className="font-semibold text-blue-600 hover:text-blue-500">
              Explore your options
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
