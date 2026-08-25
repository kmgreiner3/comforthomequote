// Kebab-cases a color name for use in S3 keys, e.g. "Dual Black" -> "dual-black".
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
