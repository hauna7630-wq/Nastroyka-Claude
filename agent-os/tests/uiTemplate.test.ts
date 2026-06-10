import { COORDINATOR_HTML } from '../src/api/ui';

// The SPA lives inside a template literal; escapes like \n or \s inside it are
// consumed by the TEMPLATE, not by the browser. A single '\n' inside a quoted
// JS string ships a REAL newline and kills the whole UI with a SyntaxError
// (this happened in production: black office, empty sidebar). These tests make
// that class of bug impossible to ship again.

function scriptBody(): string {
  const m = COORDINATOR_HTML.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('no <script> block found in COORDINATOR_HTML');
  return m[1];
}

describe('COORDINATOR_HTML integrity', () => {
  it('served JS parses without SyntaxError', () => {
    // new Function compiles (does not execute) the body — a parse-level check.
    expect(() => new Function(scriptBody())).not.toThrow();
  });

  it('template body contains no backticks or ${ interpolations', () => {
    const body = COORDINATOR_HTML;
    expect(body.includes('`')).toBe(false);
    // eslint-disable-next-line no-template-curly-in-string
    expect(body.includes('${')).toBe(false);
  });

  it('no real newline is embedded inside a single-quoted JS string', () => {
    // Heuristic: a line whose unescaped single-quotes are unbalanced usually
    // means a string literal was torn by a template-consumed \n.
    const lines = scriptBody().split('\n');
    const torn: number[] = [];
    lines.forEach((line, i) => {
      const noComment = line.replace(/\/\/.*$/, '');
      const quotes = (noComment.match(/(?<!\\)'/g) ?? []).length;
      if (quotes % 2 === 1) torn.push(i + 1);
    });
    // Torn strings come in pairs of odd-quote lines; a healthy file has none.
    expect(torn).toEqual([]);
  });
});
