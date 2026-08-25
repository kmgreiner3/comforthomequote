import { useState } from 'react';
import { PrimaryButton, StepHeading } from '../build/ui';
import { RevealGroup, RevealItem } from '../build/motion';
import Lightbox, { type LightboxImage } from '../../components/Lightbox';
import { setNextStepFlagDone } from './useStepFlags';

const PARTNER_DOCS: LightboxImage[] = [
  { src: '/partner/license.jpg', alt: 'Florida Roofing Contractor License' },
  { src: '/partner/insurance.jpg', alt: 'Certificate of Liability Insurance' },
];

export default function StepPartner({ onContinue }: { onContinue: () => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function handleContinue() {
    setNextStepFlagDone('partnerSeen');
    onContinue();
  }

  return (
    <>
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
              You may have completed the entire Comfort Home Quote process online, but that does not
              mean you are on your own. Technology makes it possible to research your options, design
              your roof, understand your pricing, and make your decision from home.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink/80">
              Customer service is what makes the experience complete. If you have a question, concern,
              or simply want to speak with someone about your project, we are here for you.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink/80">
              Our team is available around the clock to help guide you through the process, from the
              moment you accept your quote through installation and beyond. The convenience of an
              online experience, backed by real people and a trusted local roofing company.
            </p>
          </div>
        </RevealItem>

        <RevealItem>
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Licensed and insured</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {PARTNER_DOCS.map((doc, i) => (
                <button
                  key={doc.src}
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  data-testid={`partner-doc-${i + 1}`}
                  aria-label={`Open ${doc.alt} full screen`}
                  className="group min-h-[44px] overflow-hidden rounded-2xl border-2 border-navy-950/10 bg-sky-50 text-left transition-colors duration-200 hover:border-blue-600/50"
                >
                  <img src={doc.src} alt="" className="aspect-[4/3] w-full object-cover" />
                  <p className="px-4 py-3 text-sm font-semibold text-navy-950 transition-colors duration-200 group-hover:text-blue-600">
                    {doc.alt}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink/50">
              Verify any Florida contractor license at{' '}
              <a
                href="https://www.myfloridalicense.com/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-blue-600"
              >
                MyFloridaLicense.com
              </a>
              .
            </p>
          </div>
        </RevealItem>

        <RevealItem>
          <PrimaryButton className="mt-8" onClick={handleContinue}>
            Continue My Project
          </PrimaryButton>
        </RevealItem>
      </RevealGroup>

      {openIndex !== null && (
        <Lightbox
          images={PARTNER_DOCS}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      )}
    </>
  );
}
