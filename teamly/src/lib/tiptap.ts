// Extract plain text from a TipTap/ProseMirror JSON document, for full-text
// search and previews. Pure + framework-free.

export interface ProseMirrorNode {
  type?: string;
  text?: string;
  content?: ProseMirrorNode[];
}

// Block-level node types that should introduce a line break in extracted text.
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
]);

export function extractText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc as ProseMirrorNode, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function walk(node: ProseMirrorNode | undefined, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (typeof node.text === 'string') out.push(node.text);
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, out);
    if (node.type && BLOCK_TYPES.has(node.type)) out.push('\n');
  }
}

// A short single-line preview for tree/list views.
export function previewText(doc: unknown, max = 160): string {
  const text = extractText(doc);
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };
