import { useMemo, useState, type FormEvent } from 'react';
import { useBuild, type Visit } from '../../state/build';
import { BackChevron, PrimaryButton, StepHeading } from '../build/ui';
import { RevealGroup, RevealItem } from '../build/motion';
import { DemoNotice, Field, inputClass } from './ui';

const WINDOWS: Visit['window'][] = ['Morning', 'Afternoon', 'No Preference'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function StepSchedule({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const saved = useBuild((s) => s.visit);
  const setVisit = useBuild((s) => s.setVisit);

  // Feedback round 8, item 15: the window is tomorrow through today+7
  // inclusive (today itself is rejected -- not enough lead time to
  // schedule a visit). Not a store selector: both bounds are a pure
  // function of the current date, recomputed fresh each mount rather than
  // persisted.
  const { minDate, maxDate } = useMemo(() => {
    const min = new Date();
    min.setDate(min.getDate() + 1);
    const max = new Date();
    max.setDate(max.getDate() + 7);
    return { minDate: toISODate(min), maxDate: toISODate(max) };
  }, []);

  const [date, setDate] = useState(saved?.date ?? '');
  const [windowValue, setWindowValue] = useState<Visit['window'] | ''>(saved?.window ?? '');
  const [errors, setErrors] = useState<{ date?: string; window?: string }>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: { date?: string; window?: string } = {};
    if (!date) next.date = 'Choose a date for your visit.';
    else if (date < minDate || date > maxDate) next.date = 'Choose a date within the next 7 days.';
    if (!windowValue) next.window = 'Choose a preferred time window.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setVisit({ date, window: windowValue as Visit['window'] });
    onContinue();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="Pre-installation visit"
          title="When can our project manager visit?"
          subtitle="Before installation, your project manager will visit the property to document existing conditions and take the necessary pre-installation photos."
        />
      </RevealItem>

      <RevealItem>
        <DemoNotice />
      </RevealItem>

      <RevealItem>
        <form onSubmit={handleSubmit} noValidate className="mt-6 max-w-xl space-y-6">
          <Field
            label="Visit date"
            htmlFor="visit-date"
            error={errors.date}
            hint="Choose a date within the next 7 days."
          >
            <input
              id="visit-date"
              name="visit-date"
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div>
            <p className="text-sm font-medium text-ink/70">Preferred time window</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {WINDOWS.map((w) => (
                <label
                  key={w}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-3 text-center text-sm font-semibold transition-colors duration-200 ${
                    windowValue === w
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-navy-950/15 bg-white text-ink hover:border-blue-600/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="visit-window"
                    value={w}
                    checked={windowValue === w}
                    onChange={() => setWindowValue(w)}
                    className="sr-only"
                  />
                  {w}
                </label>
              ))}
            </div>
            {errors.window && <p className="mt-1.5 text-sm text-red-600">{errors.window}</p>}
          </div>

          <PrimaryButton type="submit" className="w-full sm:w-auto">
            Schedule My Visit
          </PrimaryButton>
        </form>
      </RevealItem>
    </RevealGroup>
  );
}
