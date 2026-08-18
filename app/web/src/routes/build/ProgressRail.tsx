import { STEP_IDS, STEP_LABELS } from './steps';

export default function ProgressRail({ currentIndex }: { currentIndex: number }) {
  const total = STEP_IDS.length;
  const pct = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 md:px-6 md:pt-10" aria-label="Progress">
      {/* Mobile: step count + line */}
      <div className="md:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Step {currentIndex + 1} of {total}
        </p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-navy-950/10">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop: thin rail with dots + labels */}
      <div className="hidden md:block">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-[7px] h-px bg-navy-950/10" />
          <div
            className="absolute left-0 top-[7px] h-px bg-blue-600 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
          {STEP_IDS.map((id, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <div key={id} className="relative z-10 flex flex-col items-center gap-2">
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors duration-300 ${
                    done || active
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-navy-950/20 bg-sky-50'
                  }`}
                />
                <span
                  className={`text-[11px] font-medium ${active ? 'text-navy-950' : 'text-ink/50'}`}
                >
                  {STEP_LABELS[id]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
