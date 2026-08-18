import { useState, type FormEvent } from 'react';
import { useBuild } from '../../state/build';
import { PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

const MIN_LENGTH = 5;

export default function StepAddress({ onContinue }: { onContinue: () => void }) {
  const setAddress = useBuild((s) => s.setAddress);
  const savedAddress = useBuild((s) => s.address);
  const [value, setValue] = useState(savedAddress ?? '');
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const isValid = trimmed.length >= MIN_LENGTH;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    setAddress(trimmed);
    onContinue();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <StepHeading
          eyebrow="Let's start with your home"
          title="Where's the roof?"
          subtitle="Enter the address where you're considering replacing the roof."
        />
      </RevealItem>

      <RevealItem>
        <form onSubmit={handleSubmit} className="max-w-xl">
          <label htmlFor="property-address" className="sr-only">
            Property address
          </label>
          <input
            id="property-address"
            name="address"
            type="text"
            autoComplete="off"
            placeholder="123 Palm Ave, Tampa, FL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border-2 border-navy-950/15 bg-white px-5 py-4 text-lg text-ink outline-none transition-colors focus:border-blue-600"
          />
          {touched && !isValid && (
            <p className="mt-2 text-sm text-red-600">Enter the property address to continue.</p>
          )}
          <PrimaryButton type="submit" className="mt-5 w-full sm:w-auto">
            Build My Roof
          </PrimaryButton>
        </form>
      </RevealItem>

      <RevealItem>
        <p className="mt-8 text-sm text-ink/60">
          No name, phone, or email needed to see your price.
        </p>
      </RevealItem>
    </RevealGroup>
  );
}
