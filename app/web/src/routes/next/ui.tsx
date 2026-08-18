import type { ReactNode } from 'react';

export const inputClass =
  'min-h-[44px] w-full rounded-xl border-2 border-navy-950/15 bg-white px-5 py-4 text-base text-ink outline-none transition-colors focus:border-blue-600';

/** Slim demo-mode banner shown on the info and schedule steps. */
export function DemoNotice() {
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-medium text-navy-950">
      Preview build. Submissions are not saved yet.
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink/70">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs text-ink/50">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
