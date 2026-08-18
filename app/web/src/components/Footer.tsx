import { FINANCING_DISCLOSURE, WARRANTY_FOOTNOTE } from '../content/footnote';

export default function Footer() {
  return (
    <footer className="bg-navy-950">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sky-50">
        <p className="font-display text-lg">A quote from the comfort of your home.</p>
        <p className="mt-1 text-sm text-sky-50/80">Serving Florida homeowners</p>
        <p className="mt-6 max-w-3xl text-xs text-sky-50/60">*{WARRANTY_FOOTNOTE}</p>
        <p className="mt-2 max-w-3xl text-xs text-sky-50/60">*{FINANCING_DISCLOSURE}</p>
      </div>
    </footer>
  );
}
