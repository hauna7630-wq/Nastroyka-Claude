// read_document tool (PRD §3): extract plain text from a document for the agent.

import { ToolSpec } from './registry';

export const readDocumentTool: ToolSpec = {
  schema: {
    name: 'read_document',
    description:
      'Extract text from a document (text/markdown/csv/json inline; pdf/xlsx/docx via a parser).',
    inputSchema: {
      type: 'object',
      properties: {
        mime: { type: 'string' },
        content: { type: 'string', description: 'UTF-8 text, or base64 bytes with base64=true' },
        base64: { type: 'boolean' },
        filename: { type: 'string' },
      },
      required: ['mime', 'content'],
    },
  },
  security: {
    network: 'deny',
    cpuMs: 5000,
    memMb: 256,
    persistFs: false,
  },
  async run(input, ctx) {
    if (!ctx.documents) {
      throw new Error('read_document is not configured (no document parser)');
    }
    const text = await ctx.documents.extractText({
      mime: String(input.mime ?? 'text/plain'),
      content: String(input.content ?? ''),
      base64: Boolean(input.base64),
      filename: input.filename ? String(input.filename) : undefined,
    });
    return { text, chars: text.length };
  },
};
