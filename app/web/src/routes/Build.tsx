import { useCallback, useEffect, useState } from 'react';
import { useBuild } from '../state/build';
import PriceHero from '../components/PriceHero';
import ProgressRail from './build/ProgressRail';
import { StepTransition } from './build/motion';
import { STEP_IDS, maxAllowedIndex, stepIdFromHash, stepIndex, type StepId } from './build/steps';
import { getStepFlags, setStepFlagDone } from './build/useStepFlags';
import StepAddress from './build/StepAddress';
import StepHome from './build/StepHome';
import StepShingle from './build/StepShingle';
import StepColor from './build/StepColor';
import StepUnderlayment from './build/StepUnderlayment';
import StepProtection from './build/StepProtection';
import StepIncluded from './build/StepIncluded';
import StepFinishing from './build/StepFinishing';
import StepReview from './build/StepReview';

function goBack() {
  window.history.back();
}

export default function Build() {
  // Subscribing to the whole store is deliberate: any field change can
  // unlock a further step (e.g. setOutline unlocking "shingle"), so the
  // clamp-and-sync logic below needs to re-run whenever the store changes.
  const buildState = useBuild();
  const resetQuote = useBuild((s) => s.resetQuote);
  const [currentId, setCurrentId] = useState<StepId>('address');

  // Deliberately never assigns `location.hash = ...`: that's a real
  // navigation as far as the browser is concerned, and it triggers the
  // native "scroll to the element whose id matches the fragment" behavior
  // (this is exactly what caused the cold-load scroll-jump on Address,
  // whose input id used to collide with the #address hash). The History
  // API's pushState/replaceState update the URL bar without ever
  // triggering that scroll-into-view, regardless of whether some future
  // element id happens to collide with a step hash.
  const applyStep = useCallback((desiredId: StepId | null, opts: { replace: boolean }) => {
    const allowedIndex = maxAllowedIndex(useBuild.getState(), getStepFlags());
    const desiredIndex = desiredId ? stepIndex(desiredId) : allowedIndex;
    const finalIndex = Math.min(desiredIndex, allowedIndex);
    const finalId = STEP_IDS[finalIndex]!;

    if (window.location.hash !== `#${finalId}`) {
      const url = `${window.location.pathname}${window.location.search}#${finalId}`;
      if (opts.replace) window.history.replaceState(window.history.state, '', url);
      else window.history.pushState(window.history.state, '', url);
    }
    setCurrentId(finalId);
  }, []);

  // Initial mount, and whenever the store changes (a store update can
  // unlock a further step): re-clamp against whatever's in the URL hash.
  // Always a *replace* -- this is normalizing/redirecting, not a user
  // navigation, so it shouldn't create a Back-able history entry.
  useEffect(() => {
    applyStep(stepIdFromHash(window.location.hash), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildState, applyStep]);

  // Browser Back/Forward (including window.history.back() below) fires
  // popstate; re-read the hash the browser already navigated to and clamp.
  useEffect(() => {
    function onPopState() {
      applyStep(stepIdFromHash(window.location.hash), { replace: true });
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyStep]);

  // Step-to-step navigation doesn't reload the page, so the browser keeps
  // whatever scroll position the previous step left behind. Each step is a
  // fresh "screen" and should always open at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentId]);

  function goToStep(id: StepId) {
    // push: a real forward decision, so it creates a Back-able entry.
    applyStep(id, { replace: false });
  }

  // "Start over" (rail + Review's quiet link): resetQuote() alone is enough
  // to land back on Address -- it changes buildState, which the clamp-and-
  // sync effect above already reacts to on every store change (address is
  // now null, so maxAllowedIndex clamps to 0 and rewrites the URL hash to
  // #address via replaceState). No separate navigation call needed here.
  function handleStartOver() {
    resetQuote();
  }

  const isReview = currentId === 'review';
  const allowedIndex = maxAllowedIndex(buildState, getStepFlags());
  // Nothing to clear yet on a pristine quote (no address, no outline, no
  // shingle) -- the rail's "Start over" link would just be clutter on the
  // very first screen, so it only shows up once there's something to lose.
  const isPristine = !buildState.address && buildState.outlineSqft == null && buildState.shingle == null;

  return (
    <div className={`min-h-screen bg-sky-50 ${isReview ? 'pb-16' : 'pb-32 md:pb-20'}`}>
      {/* The review step has its own full-width price treatment (and CTA);
          every other step reserves a right-hand gutter so the fixed
          PriceHero card never overlaps live content. */}
      <div className={isReview ? '' : 'md:pr-80'}>
        <ProgressRail
          currentIndex={stepIndex(currentId)}
          maxAllowedIndex={allowedIndex}
          onStepClick={goToStep}
          onStartOver={isPristine ? undefined : handleStartOver}
        />
        <main
          className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14"
          data-testid="build-step"
          data-step={currentId}
        >
          <StepTransition stepKey={currentId}>
            {renderStep(currentId, goToStep, handleStartOver)}
          </StepTransition>
        </main>
      </div>
      {!isReview && <PriceHero />}
    </div>
  );
}

function renderStep(id: StepId, goToStep: (id: StepId) => void, onStartOver: () => void) {
  switch (id) {
    case 'address':
      return <StepAddress onContinue={() => goToStep('home')} />;
    case 'home':
      return <StepHome onContinue={() => goToStep('shingle')} onBack={goBack} />;
    case 'shingle':
      return <StepShingle onContinue={() => goToStep('color')} onBack={goBack} />;
    case 'color':
      return <StepColor onContinue={() => goToStep('underlayment')} onBack={goBack} />;
    case 'underlayment':
      return (
        <StepUnderlayment
          onContinue={() => {
            setStepFlagDone('underlayment');
            goToStep('protection');
          }}
          onBack={goBack}
        />
      );
    case 'protection':
      return (
        <StepProtection
          onContinue={() => {
            setStepFlagDone('protection');
            goToStep('included');
          }}
          onBack={goBack}
        />
      );
    case 'included':
      return (
        <StepIncluded
          onContinue={() => {
            setStepFlagDone('included');
            goToStep('finishing');
          }}
          onBack={goBack}
        />
      );
    case 'finishing':
      return <StepFinishing onContinue={() => goToStep('review')} onBack={goBack} />;
    case 'review':
      return <StepReview onEdit={() => goToStep('shingle')} onStartOver={onStartOver} />;
    default:
      return null;
  }
}
