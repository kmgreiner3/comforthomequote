import { STEP_IDS, STEP_LABELS, type StepId } from './steps';
import { StartOverLink } from './ui';

function ChevronIcon({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
  const d = direction === 'left' ? 'M12 4.5 6 10l6 5.5' : 'M8 4.5 14 10l-6 5.5';
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProgressRail({
  currentIndex,
  maxAllowedIndex,
  onStepClick,
  onStartOver,
}: {
  currentIndex: number;
  maxAllowedIndex: number;
  onStepClick: (id: StepId) => void;
  // Omitted entirely on a pristine quote (nothing to clear yet) -- the
  // link would just be clutter on the very first screen.
  onStartOver?: () => void;
}) {
  const total = STEP_IDS.length;
  const pct = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < maxAllowedIndex;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 md:px-6 md:pt-10" aria-label="Progress">
      {onStartOver && (
        <div className="flex items-center justify-end">
          <StartOverLink onConfirm={onStartOver} />
        </div>
      )}

      {/* Mobile: step count + compact back/forward + line */}
      <div className="mt-2 md:hidden">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Step {currentIndex + 1} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous step"
              disabled={!canGoBack}
              onClick={() => canGoBack && onStepClick(STEP_IDS[currentIndex - 1]!)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink/60 transition-colors disabled:cursor-not-allowed disabled:text-ink/20 enabled:hover:bg-navy-950/5 enabled:hover:text-blue-600"
            >
              <ChevronIcon direction="left" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next step"
              disabled={!canGoForward}
              onClick={() => canGoForward && onStepClick(STEP_IDS[currentIndex + 1]!)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink/60 transition-colors disabled:cursor-not-allowed disabled:text-ink/20 enabled:hover:bg-navy-950/5 enabled:hover:text-blue-600"
            >
              <ChevronIcon direction="right" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-navy-950/10">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop: thin rail with clickable dots + labels */}
      <div className="mt-4 hidden md:block">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-[7px] h-px bg-navy-950/10" />
          <div
            className="absolute left-0 top-[7px] h-px bg-blue-600 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
          {STEP_IDS.map((id, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            const earned = i <= maxAllowedIndex;
            return (
              <button
                key={id}
                type="button"
                disabled={!earned}
                aria-current={active ? 'step' : undefined}
                aria-label={`Go to ${STEP_LABELS[id]} step`}
                onClick={() => onStepClick(id)}
                className="relative z-10 -m-1 flex flex-col items-center gap-2 rounded-lg p-1 transition-opacity disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:opacity-70 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-offset-2 enabled:focus-visible:outline-blue-600"
              >
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors duration-300 ${
                    done || active
                      ? 'border-blue-600 bg-blue-600'
                      : earned
                        ? 'border-blue-600 bg-white'
                        : 'border-navy-950/20 bg-sky-50'
                  }`}
                />
                <span
                  className={`text-[11px] font-medium ${
                    active ? 'text-navy-950' : earned ? 'text-ink/70' : 'text-ink/40'
                  }`}
                >
                  {STEP_LABELS[id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
