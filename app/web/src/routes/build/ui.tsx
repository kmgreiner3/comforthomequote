import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

// Circle (currentColor fill) + white check glyph. Used where the checkmark
// sits on top of a variable-color background (e.g. a color swatch) and
// needs its own contrast regardless of what's underneath.
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M5.5 10.2l2.8 2.8 6.2-6.4" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Plain check glyph, no circle: for badges on a card whose background is
// already the solid selected-state fill (currentColor drives the stroke).
export function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StepHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{eyebrow}</p>
      )}
      <h1 className="mt-1 font-display text-3xl font-semibold text-navy-950 md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-xl text-base text-ink/70">{subtitle}</p>}
    </div>
  );
}

export function IncludedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy-950 ${className}`}
    >
      Included
    </span>
  );
}

interface SelectionCardProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * Big-tap-target selection card: 2px navy border, flips to blue-600 fill +
 * white check when selected, per the design language spec.
 */
export function SelectionCard({ selected, onSelect, children, className = '', ...rest }: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative w-full min-h-[44px] rounded-2xl border-2 p-6 text-left transition-colors duration-200 ${
        selected
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-navy-950/15 bg-white text-ink hover:border-blue-600/50'
      } ${className}`}
      {...rest}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-white">
          <CheckGlyph className="h-4 w-4 text-blue-600" />
        </span>
      )}
      {children}
    </button>
  );
}

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-[44px] rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-navy-950/20 disabled:text-ink/40 ${className}`}
      {...props}
    />
  );
}

export function SecondaryLinkButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-[44px] rounded-full border border-navy-950/20 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors duration-200 hover:border-blue-600 hover:text-blue-600 ${className}`}
      {...props}
    />
  );
}

/**
 * Quiet "Start over" text link with an inline (not window.confirm) confirm
 * step: a stray tap shows "Clear this quote and start fresh?" with its own
 * confirm/cancel, so nothing is wiped without a second, deliberate tap.
 */
export function StartOverLink({
  onConfirm,
  label = 'Start over',
  className = '',
}: {
  onConfirm: () => void;
  label?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 text-sm ${className}`}>
        <span className="text-ink/70">Clear this quote and start fresh?</span>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] font-semibold text-blue-600 hover:text-blue-500"
        >
          Yes, start over
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-[44px] font-semibold text-ink/50 hover:text-ink"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`min-h-[44px] text-sm font-medium text-ink/50 underline-offset-2 transition-colors hover:text-blue-600 hover:underline ${className}`}
    >
      {label}
    </button>
  );
}

/**
 * Amber accuracy disclosure for the satellite/adjusted-outline confirm
 * card (feedback round 5, Task B item 2): the automated measurement -- even
 * after a homeowner drags the outline to fit -- is never final; a licensed
 * professional always reviews it. Always visible on that card, not
 * dismissible.
 */
export function AccuracyNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-amber-400/40 bg-amber-400/15 p-4 ${className}`}>
      <p className="text-sm text-ink/80">
        The automated measurement may not be exact. A licensed professional reviews every roof and
        makes any needed adjustments before final pricing.
      </p>
    </div>
  );
}

export function BackChevron({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-blue-600"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M12 4.5 6 10l6 5.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}

