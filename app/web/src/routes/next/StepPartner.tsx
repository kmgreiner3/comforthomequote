import { PrimaryButton, StepHeading } from '../build/ui';
import { RevealGroup, RevealItem } from '../build/motion';
import { setNextStepFlagDone } from './useStepFlags';

export default function StepPartner({ onContinue }: { onContinue: () => void }) {
  function handleContinue() {
    setNextStepFlagDone('partnerSeen');
    onContinue();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <StepHeading eyebrow="Your roofing partner" title="Meet your local roofing partner" />
      </RevealItem>

      <RevealItem>
        <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-6 md:p-8">
          <p className="font-display text-2xl font-semibold text-navy-950 md:text-3xl">
            Online Convenience. Real People.
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink/80">
            At Comfort Home Quote, we believe the company installing your roof is just as important
            as the products you choose. That is why we strategically select one trusted roofing
            contractor in each county we serve.
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink/80">
            Our partners are selected for their experience, workmanship, reliability, reputation,
            applicable licensing and insurance requirements, and, most importantly, customer
            service. Our roofing partner has been in business for more than 20 years.
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink/80">
            If you have a question or concern before, during, or after installation, our team is
            available to help.
          </p>
        </div>
      </RevealItem>

      <RevealItem>
        <PrimaryButton className="mt-8" onClick={handleContinue}>
          Continue My Project
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
