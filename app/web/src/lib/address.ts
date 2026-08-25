// Florida-only address validation, shared by the landing hero input and
// StepAddress. Deliberately conservative: it never tries to be a real
// geocoder, just a fast client-side sanity check that catches the two
// things that actually break the /api/measure flow downstream: an address
// with no ZIP at all (the satellite lookup can't disambiguate the house),
// and an address that isn't in Florida (we only serve Florida homes).

export type AddressValidation = { ok: true } | { ok: false; error: string };

const MIN_LENGTH = 10;

// Florida ZIP codes run 32000-34999. This intentionally mirrors the plain
// digit ranges rather than a real ZIP database; it is a client-side sanity
// check, not the source of truth (the /api/measure geocode is).
const FLORIDA_ZIP_RE = /\b3[234]\d{3}\b/;
const ANY_FIVE_DIGIT_RE = /\b\d{5}\b/g;

// Matches a bare two-letter token (not part of a longer word) sitting
// right in front of a Florida-looking ZIP, e.g. the "GA" in "Atlanta, GA
// 34236". Used only as a defensive check: a Florida-shaped ZIP can still
// be paired with an explicit non-FL state abbreviation, and that should
// still read as out of area.
const STATE_BEFORE_FL_ZIP_RE = /(?<![A-Za-z])([A-Za-z]{2})(?![A-Za-z])\.?\s*,?\s*3[234]\d{3}\b/;

export function validateFloridaAddress(input: string): AddressValidation {
  const trimmed = input.trim();

  if (trimmed.length < MIN_LENGTH || !trimmed.includes(',')) {
    return { ok: false, error: 'Enter your full street address with city and ZIP code.' };
  }

  const zipMatches = trimmed.match(ANY_FIVE_DIGIT_RE);
  if (!zipMatches) {
    return { ok: false, error: 'Include your ZIP code so we find the right home.' };
  }

  const hasFloridaZip = zipMatches.some((zip) => FLORIDA_ZIP_RE.test(zip));
  if (!hasFloridaZip) {
    return { ok: false, error: 'We currently serve Florida homes only.' };
  }

  const stateToken = trimmed.match(STATE_BEFORE_FL_ZIP_RE);
  const state = stateToken?.[1];
  if (state && state.toUpperCase() !== 'FL') {
    return { ok: false, error: 'We currently serve Florida homes only.' };
  }

  return { ok: true };
}
