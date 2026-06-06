// Document parser (MVP): handles text / markdown / csv / json inline. PDF/XLSX/
// DOCX require a rich parser (pdf-parse / xlsx / mammoth) behind the same port.

import { DocumentInput, DocumentParser } from '../ports/documents';

export class PlainTextDocumentParser implements DocumentParser {
  async extractText(input: DocumentInput): Promise<string> {
    const raw = input.base64 ? Buffer.from(input.content, 'base64').toString('utf8') : input.content;
    const mime = input.mime.toLowerCase();

    if (mime.includes('json')) {
      try {
        return JSON.stringify(JSON.parse(raw));
      } catch {
        return raw.trim();
      }
    }
    if (mime.includes('csv')) {
      return raw
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((l) => l.split(',').map((c) => c.trim()).join(' | '))
        .join('\n');
    }
    if (mime.startsWith('text/') || mime.includes('markdown') || mime.includes('plain')) {
      return raw.trim();
    }
    if (
      mime.includes('pdf') ||
      mime.includes('officedocument') ||
      mime.includes('msword') ||
      mime.includes('excel')
    ) {
      throw new Error(
        `Document type "${input.mime}" requires a rich parser (pdf/xlsx/docx) — not enabled in the MVP`,
      );
    }
    return raw.trim(); // best-effort default
  }
}
