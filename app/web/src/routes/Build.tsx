import { useEffect, useState } from 'react';
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

function go(id: StepId) {
  window.location.hash = `#${id}`;
}

function goBack() {
  window.history.back();
}

export default function Build() {
  // Subscribing to the whole store is deliberate: any field change can
  // unlock a further step (e.g. setOutline unlocking "shingle"), so the
  // hash-sync effect below needs to re-run whenever the store changes.
  const buildState = useBuild();
  const [currentId, setCurrentId] = useState<StepId>('address');

  useEffect(() => {
    function sync() {
      const allowedIndex = maxAllowedIndex(useBuild.getState(), getStepFlags());
      const requested = stepIdFromHash(window.location.hash);
      // No hash at all (bare /build): resume at the furthest earned step
      // rather than forcing back to address every load.
      const requestedIndex = requested ? stepIndex(requested) : allowedIndex;
      const finalIndex = Math.min(requestedIndex, allowedIndex);
      const finalId = STEP_IDS[finalIndex]!;

      if (window.location.hash !== `#${finalId}`) {
        window.location.hash = `#${finalId}`;
      }
      setCurrentId(finalId);
    }

    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildState]);

  // Hash-only navigation doesn't reload the page, so the browser keeps
  // whatever scroll position the previous step left behind. Each step is a
  // fresh "screen" and should always open at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentId]);

  const isReview = currentId === 'review';

  return (
    <div className={`min-h-screen bg-sky-50 ${isReview ? 'pb-16' : 'pb-32 md:pb-20'}`}>
      {/* The review step has its own full-width price treatment (and CTA);
          every other step reserves a right-hand gutter so the fixed
          PriceHero card never overlaps live content. */}
      <div className={isReview ? '' : 'md:pr-80'}>
        <ProgressRail currentIndex={stepIndex(currentId)} />
        <main
          className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14"
          data-testid="build-step"
          data-step={currentId}
        >
          <StepTransition stepKey={currentId}>{renderStep(currentId)}</StepTransition>
        </main>
      </div>
      {!isReview && <PriceHero />}
    </div>
  );
}

function renderStep(id: StepId) {
  switch (id) {
    case 'address':
      return <StepAddress onContinue={() => go('home')} />;
    case 'home':
      return <StepHome onContinue={() => go('shingle')} onBack={goBack} />;
    case 'shingle':
      return <StepShingle onContinue={() => go('color')} onBack={goBack} />;
    case 'color':
      return <StepColor onContinue={() => go('underlayment')} onBack={goBack} />;
    case 'underlayment':
      return (
        <StepUnderlayment
          onContinue={() => {
            setStepFlagDone('underlayment');
            go('protection');
          }}
          onBack={goBack}
        />
      );
    case 'protection':
      return (
        <StepProtection
          onContinue={() => {
            setStepFlagDone('protection');
            go('included');
          }}
          onBack={goBack}
        />
      );
    case 'included':
      return (
        <StepIncluded
          onContinue={() => {
            setStepFlagDone('included');
            go('finishing');
          }}
          onBack={goBack}
        />
      );
    case 'finishing':
      return <StepFinishing onContinue={() => go('review')} onBack={goBack} />;
    case 'review':
      return <StepReview onEdit={() => go('shingle')} />;
    default:
      return null;
  }
}
