// Compact address reminder shown under the step rail on every /build step
// past address (feedback round 5, Task B item 3) -- lets the homeowner
// jump back and change the address at any point for a quick multi-address
// price comparison without losing their shingle/color/underlayment picks
// (see useBuild's setAddress semantics).
export default function AddressChip({ address, onChange }: { address: string; onChange: () => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6">
      <div
        data-testid="address-chip"
        className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm"
      >
        <span className="min-w-0 flex-1 truncate text-ink/70">{address}</span>
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 font-semibold text-blue-600 hover:text-blue-500"
        >
          Change
        </button>
      </div>
    </div>
  );
}
