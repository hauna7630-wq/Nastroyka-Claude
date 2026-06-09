// PII masking middleware (PRD §4). Before any text is sent to an external LLM,
// sensitive values (emails, phone numbers, card numbers, passports) are replaced
// with stable placeholder tokens; the model's response is un-masked on the way
// back. The mapping is kept per-run (never sent to the provider).

export interface PiiMasker {
  // Replace PII in `text` with tokens, recording token->original in `mappings`.
  mask(text: string, mappings: Map<string, string>): string;
  // Restore originals from `mappings`.
  unmask(text: string, mappings: Map<string, string>): string;
}

interface Pattern {
  name: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { name: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { name: 'CARD', re: /\b(?:\d[ -]?){13,16}\b/g },
  // RU phone: +7/8 (XXX) XXX-XX-XX with flexible separators.
  { name: 'PHONE', re: /(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g },
  // RU passport: 4 digits + 6 digits (e.g. "45 12 345678").
  { name: 'PASSPORT', re: /\b\d{2}\s?\d{2}\s?\d{6}\b/g },
];

export class RegexPiiMasker implements PiiMasker {
  mask(text: string, mappings: Map<string, string>): string {
    let out = text;
    for (const p of PATTERNS) {
      let n = countTokens(mappings, p.name);
      out = out.replace(p.re, (match) => {
        const existing = findToken(mappings, match);
        if (existing) return existing;
        n += 1;
        const token = `[${p.name}_${n}]`;
        mappings.set(token, match);
        return token;
      });
    }
    return out;
  }

  unmask(text: string, mappings: Map<string, string>): string {
    let out = text;
    for (const [token, original] of mappings) {
      out = out.split(token).join(original);
    }
    return out;
  }
}

function countTokens(mappings: Map<string, string>, name: string): number {
  let n = 0;
  for (const key of mappings.keys()) if (key.startsWith(`[${name}_`)) n += 1;
  return n;
}

function findToken(mappings: Map<string, string>, original: string): string | undefined {
  for (const [token, value] of mappings) if (value === original) return token;
  return undefined;
}
