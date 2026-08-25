// Real shingle swatch imagery + per-color descriptions, keyed by the exact
// color strings in `@chq/pricing`'s SHINGLES data. Covers both product lines
// (IKO Cambridge and TAMKO Titan XT) in a single flat map since no color
// name repeats across the two lines.
//
// Copy source: docs/client/color-descriptions.md (Dylan Nadeau, Aug 20 2026
// emails). Rendered em-dash-free per the site's rendering rules; the two
// colors marked DRAFT in that doc (Beachwood, Dove White) render the same
// as every other color -- the DRAFT annotation is a note to the client
// about copy provenance, not on-site content.
//
// Images live in app/web/public/shingles/{iko,titan}/<kebab-slug>.jpg,
// processed from source photos (see docs/client/color-descriptions.md's
// asset mapping) to 480px max dimension, jpeg q80, each <= 80KB.
export interface ColorInfo {
  image: string;
  description: string;
}

export const COLOR_INFO: Record<string, ColorInfo> = {
  // IKO Cambridge (10)
  'Dual Black': {
    image: '/shingles/iko/dual-black.jpg',
    description:
      'A rich, classic black with subtle charcoal highlights that create depth and dimension. Its blended tones give the roof a bold, clean appearance without looking flat or overly uniform. Works especially well with white, gray, stone, brick, and modern exterior colors.',
  },
  'Dual Grey': {
    image: '/shingles/iko/dual-grey.jpg',
    description:
      'A versatile blend of medium gray, charcoal, and lighter gray tones that creates natural depth and dimension. It offers a clean, balanced look that complements both modern and traditional homes.',
  },
  'Dual Brown': {
    image: '/shingles/iko/dual-brown.jpg',
    description:
      'A warm, dimensional blend of rich brown, tan, and subtle earthy tones. The natural color variation adds depth and character, creating a classic look that pairs especially well with beige, cream, brick, stone, and other warm exterior finishes.',
  },
  Weatherwood: {
    image: '/shingles/iko/weatherwood.jpg',
    description:
      'A warm, natural blend of earthy brown, soft gray, and subtle tan tones. Its varied coloring creates a dimensional, weathered-wood appearance that pairs beautifully with neutral, stone, brick, and traditional exterior finishes.',
  },
  'Charcoal Grey': {
    image: '/shingles/iko/charcoal-grey.jpg',
    description:
      'A deep, sophisticated blend of charcoal and dark gray tones with subtle variation for added dimension. It delivers a bold, clean look that complements white, gray, stone, brick, and both modern and traditional exterior styles.',
  },
  'Harvard Slate': {
    image: '/shingles/iko/harvard-slate.jpg',
    description:
      'A sophisticated blend of deep gray, charcoal, and subtle cool-toned accents inspired by the natural variation of slate. Its layered coloring creates a rich, dimensional look that adds character while remaining versatile across both traditional and modern homes.',
  },
  'Earthtone Cedar': {
    image: '/shingles/iko/earthtone-cedar.jpg',
    description:
      'A warm, natural blend of cedar brown, tan, and subtle earthy tones designed to capture the character of real wood. Its rich color variation creates a welcoming, dimensional look that pairs beautifully with cream, beige, brick, stone, and other warm exterior finishes.',
  },
  Driftwood: {
    image: '/shingles/iko/driftwood.jpg',
    description:
      'A soft, natural blend of weathered brown, warm gray, and subtle tan tones inspired by aged coastal wood. Its balanced color variation creates a relaxed, dimensional look that complements beige, cream, stone, brick, and a wide range of neutral exterior finishes.',
  },
  Beachwood: {
    image: '/shingles/iko/beachwood.jpg',
    description:
      'A light, sandy blend of warm tan, soft beige, and subtle gray tones inspired by coastal sand. Its gentle variation creates a bright, welcoming look that pairs beautifully with cream, white, stucco, stone, and coastal exterior finishes.',
  },
  'Dove White': {
    image: '/shingles/iko/dove-white.jpg',
    description:
      'A clean, bright blend of soft white and light gray tones that creates a fresh, airy appearance. Its subtle variation adds dimension while keeping a crisp, classic look that pairs beautifully with white, gray, blue, and coastal exterior finishes.',
  },

  // TAMKO Titan XT (14)
  'Black Walnut': {
    image: '/shingles/titan/black-walnut.jpg',
    description:
      'A rich, dimensional blend of deep brown, dark walnut, and subtle charcoal tones. Its darker earthy coloring creates a warm, upscale look that adds depth and character while pairing beautifully with beige, cream, brick, stone, and natural wood exterior finishes.',
  },
  'Natural Timber': {
    image: '/shingles/titan/natural-timber.jpg',
    description:
      'A warm, dimensional blend of natural brown, tan, and subtle wood-inspired tones. Its balanced color variation creates the rich character of natural timber, offering a classic, inviting look that complements cream, beige, brick, stone, and other warm exterior finishes.',
  },
  'Thunderstorm Grey': {
    image: '/shingles/titan/thunderstorm-grey.jpg',
    description:
      'A bold, dimensional blend of deep gray, charcoal, and subtle lighter gray tones inspired by the dramatic colors of a stormy sky. Its rich contrast creates a clean, sophisticated look that pairs beautifully with white, gray, stone, brick, and modern exterior finishes.',
  },
  'Desert Sand': {
    image: '/shingles/titan/desert-sand.jpg',
    description:
      'A warm, inviting blend of sandy beige, soft tan, and subtle brown tones inspired by natural desert landscapes. Its gentle color variation creates a light, dimensional look that pairs beautifully with cream, stucco, stone, brick, and other warm neutral exterior finishes.',
  },
  'Glacier White': {
    image: '/shingles/titan/glacier-white.jpg',
    description:
      'A crisp, light blend of soft white and subtle cool-gray tones that creates a bright, clean appearance. Its gentle variation adds dimension while maintaining a fresh, modern look that pairs beautifully with white, gray, blue, coastal, and contemporary exterior finishes.',
  },
  'Olde English Pewter': {
    image: '/shingles/titan/olde-english-pewter.jpg',
    description:
      'A refined blend of pewter gray, soft charcoal, and subtle lighter gray tones. Its layered color variation creates a timeless, dimensional appearance that pairs beautifully with white, gray, brick, stone, and both traditional and modern exterior finishes.',
  },
  'Oxford Grey': {
    image: '/shingles/titan/oxford-grey.jpg',
    description:
      'A classic blend of medium gray, deep charcoal, and subtle lighter gray tones. Its balanced color variation creates a clean, dimensional look that complements white, blue, brick, stone, and a wide range of modern and traditional exterior finishes.',
  },
  'Rustic Black': {
    image: '/shingles/titan/rustic-black.jpg',
    description:
      'A bold, dimensional blend of deep black, charcoal, and subtle dark-gray tones. Its rich color variation adds depth and texture while maintaining a strong, sophisticated appearance that pairs beautifully with white, gray, brick, stone, and modern exterior finishes.',
  },
  'Rustic Cedar': {
    image: '/shingles/titan/rustic-cedar.jpg',
    description:
      'A warm, dimensional blend of cedar brown, rich amber, and subtle earthy tones inspired by the natural character of aged wood. Its varied coloring creates a rustic, inviting look that pairs beautifully with cream, beige, brick, stone, and natural wood exterior finishes.',
  },
  'Rustic Hickory': {
    image: '/shingles/titan/rustic-hickory.jpg',
    description:
      'A rich, dimensional blend of deep brown, warm tan, and subtle charcoal tones inspired by the natural variation of hickory wood. Its layered coloring creates a warm, rustic appearance that pairs beautifully with cream, beige, brick, stone, and natural wood exterior finishes.',
  },
  'Rustic Slate': {
    image: '/shingles/titan/rustic-slate.jpg',
    description:
      'A rich, dimensional blend of slate gray, deep charcoal, and subtle earthy tones inspired by the natural variation of stone. Its layered coloring creates a timeless, sophisticated look that pairs beautifully with white, gray, brick, stone, and a wide range of exterior styles.',
  },
  'Shadow Grey': {
    image: '/shingles/titan/shadow-grey.jpg',
    description:
      'A sleek, dimensional blend of medium gray, deep charcoal, and subtle shadowed tones. Its balanced color variation creates a clean, sophisticated appearance that pairs beautifully with white, blue, gray, stone, brick, and both modern and traditional exterior finishes.',
  },
  'Virginia Slate': {
    image: '/shingles/titan/virginia-slate.jpg',
    description:
      'A sophisticated blend of slate gray, charcoal, and subtle earthy tones inspired by the natural variation of quarried slate. Its layered coloring creates a rich, dimensional appearance that pairs beautifully with white, gray, brick, stone, and both traditional and modern exterior finishes.',
  },
  'Weathered Wood': {
    image: '/shingles/titan/weathered-wood.jpg',
    description:
      'A natural blend of warm brown, soft gray, and subtle tan tones inspired by the character of aged wood. Its varied coloring creates a warm, dimensional appearance that pairs beautifully with beige, cream, brick, stone, and a wide range of neutral exterior finishes.',
  },
};

// Retained from the previous hex-chip release: the disclosure that swatch
// imagery is a digital approximation, not a manufacturer sample.
export const SWATCH_NOTE = 'Digital approximation. Final color from manufacturer samples.';

export function colorInfo(color: string): ColorInfo | undefined {
  return COLOR_INFO[color];
}
