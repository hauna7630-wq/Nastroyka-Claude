// Vector helpers. Pure + testable.

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function l2normalize(a: number[]): number[] {
  const n = norm(a);
  if (n === 0) return a.slice();
  return a.map((x) => x / n);
}

export function cosineSim(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// pgvector text literal, e.g. [0.1,0.2,0.3].
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
