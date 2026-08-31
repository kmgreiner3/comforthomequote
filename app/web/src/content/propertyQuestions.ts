// Property questions asked at the end of the Home step, once the roof
// outline is confirmed (feedback round 8). A small data-driven list (id,
// label, help, pricing) so Dylan's still-pending Sunday (Aug 30) email
// questions can be added here later without restructuring StepHome.
// Solar is the first -- and for now only -- entry; its answer UI (a
// segmented no/yes control plus a count stepper) is specific enough that
// it's still hand-rendered in StepHome rather than driven generically off
// this list.
export interface PropertyQuestion {
  id: string;
  label: string;
  help: string;
  pricing: string;
}

export const PROPERTY_QUESTIONS: PropertyQuestion[] = [
  {
    id: 'solar',
    label: 'Do you have solar panels on your roof?',
    help: '$200 per panel covers removal by a licensed solar contractor before the project and reinstall after.',
    pricing: '$200 per panel',
  },
];

// Dylan's Sunday (Aug 30 2026) email listed more property questions for a
// future round -- see docs/client/pricing-rules.md's "Pending" note. Not
// implemented yet; tracked there, not here, until their copy/pricing lands.
export const SOLAR_QUESTION = PROPERTY_QUESTIONS[0]!;
