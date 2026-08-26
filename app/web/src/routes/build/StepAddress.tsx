import { useState, type FormEvent } from 'react';
import { useBuild } from '../../state/build';
import { validateFloridaAddress } from '../../lib/address';
import { PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import AddressCombobox from '../../components/AddressCombobox';

export default function StepAddress({ onContinue }: { onContinue: () => void }) {
  const setAddress = useBuild((s) => s.setAddress);
  const savedAddress = useBuild((s) => s.address);
  const savedPlaceId = useBuild((s) => s.placeId);
  const [value, setValue] = useState(savedAddress ?? '');
  // Only trust the store's saved placeId as a starting point if the input
  // still shows exactly the address it was picked for -- any edit below
  // clears it immediately.
  const [placeId, setPlaceId] = useState<string | null>(savedAddress ? savedPlaceId : null);
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const validation = validateFloridaAddress(value);

  function handleValueChange(next: string) {
    setValue(next);
    setPlaceId(null); // any manual edit invalidates a previously picked suggestion
  }

  function handleSelectSuggestion(description: string, selectedPlaceId: string) {
    setValue(description);
    setPlaceId(selectedPlaceId);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    // A picked suggestion is Google-canonicalized -- skip the client-side
    // format check and trust it directly.
    if (placeId) {
      setAddress(trimmed, placeId);
      onContinue();
      return;
    }
    if (!validation.ok) return;
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
          <AddressCombobox
            id="property-address"
            value={value}
            onValueChange={handleValueChange}
            onSelect={handleSelectSuggestion}
            placeholder="123 Palm Ave, Tampa, FL 33602"
            inputClassName="min-h-[44px] w-full rounded-xl border-2 border-navy-950/15 bg-white px-5 py-4 text-lg text-ink outline-none transition-colors focus:border-blue-600"
          />
          {touched && !validation.ok && (
            <p className="mt-2 text-sm text-red-600">{validation.error}</p>
          )}
          <p className="mt-2 text-sm text-ink/60">
            Serving Florida homeowners. Enter your full address with ZIP code.
          </p>
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
