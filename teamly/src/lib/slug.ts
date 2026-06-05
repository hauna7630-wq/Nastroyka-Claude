// Unicode-aware slugify (keeps Cyrillic etc.). Pure + testable.

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

/**
 * Given a desired slug and the set of slugs already taken, return a unique slug
 * by appending -2, -3, … as needed.
 */
export function uniqueSlug(desired: string, taken: Iterable<string>): string {
  const base = slugify(desired);
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
