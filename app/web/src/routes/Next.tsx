import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useBuild } from '../state/build';
import {
  NEXT_STEP_IDS,
  NEXT_STEP_LABELS,
  maxAllowedNextIndex,
  nextStepIdFromHash,
  nextStepIndex,
  type NextStepId,
} from './next/steps';
import { getNextStepFlags } from './next/useStepFlags';
import StepPartner from './next/StepPartner';
import StepInfo from './next/StepInfo';
import StepSchedule from './next/StepSchedule';
import StepConfirm from './next/StepConfirm';

function goBack() {
  window.history.back();
}

function NextProgress({ currentIndex }: { currentIndex: number }) {
  const total = NEXT_STEP_IDS.length;
  const pct = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10" aria-label="Progress">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        Step {currentIndex + 1} of {total}: {NEXT_STEP_LABELS[NEXT_STEP_IDS[currentIndex]!]}
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-navy-950/10">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Next() {
  // Subscribing to the whole store, same rationale as Build.tsx: setting
  // contact/visit can unlock a further step, so the clamp-and-sync effect
  // needs to re-run on every store change.
  const buildState = useBuild();
  const [currentId, setCurrentId] = useState<NextStepId>('partner');

  const applyStep = useCallback((desiredId: NextStepId | null, opts: { replace: boolean }) => {
    const allowedIndex = maxAllowedNextIndex(useBuild.getState(), getNextStepFlags());
    const desiredIndex = desiredId ? nextStepIndex(desiredId) : allowedIndex;
    const finalIndex = Math.min(desiredIndex, allowedIndex);
    const finalId = NEXT_STEP_IDS[finalIndex]!;

    if (window.location.hash !== `#${finalId}`) {
      const url = `${window.location.pathname}${window.location.search}#${finalId}`;
      if (opts.replace) window.history.replaceState(window.history.state, '', url);
      else window.history.pushState(window.history.state, '', url);
    }
    setCurrentId(finalId);
  }, []);

  useEffect(() => {
    if (!buildState.accepted) return;
    applyStep(nextStepIdFromHash(window.location.hash), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildState, applyStep]);

  useEffect(() => {
    function onPopState() {
      applyStep(nextStepIdFromHash(window.location.hash), { replace: true });
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyStep]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentId]);

  // Post-acceptance flow only: bounce anyone who lands here without having
  // completed the wizard's "I'm Ready to Move Forward" step back to /build.
  if (!buildState.accepted) return <Navigate to="/build" replace />;

  function goToStep(id: NextStepId) {
    applyStep(id, { replace: false });
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-16">
      <NextProgress currentIndex={nextStepIndex(currentId)} />
      <main
        className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14"
        data-testid="next-step"
        data-step={currentId}
      >
        {renderStep(currentId, goToStep)}
      </main>
    </div>
  );
}

function renderStep(id: NextStepId, goToStep: (id: NextStepId) => void) {
  switch (id) {
    case 'partner':
      return <StepPartner onContinue={() => goToStep('info')} />;
    case 'info':
      return <StepInfo onContinue={() => goToStep('schedule')} onBack={goBack} />;
    case 'schedule':
      return <StepSchedule onContinue={() => goToStep('confirm')} onBack={goBack} />;
    case 'confirm':
      return <StepConfirm />;
    default:
      return null;
  }
}
