// Rich document parser (file-handling spec): DOCX (mammoth), PDF (pdf-parse),
// XLSX/XLS (SheetJS) + the inline text/markdown/csv/json handling of the MVP
// parser, all behind the same DocumentParser port.
//
// Honesty contract: when a file genuinely cannot be read, the error does not
// crash with library internals — it states what failed and proposes a concrete
// fix the user can act on (re-export as csv/docx, split the file, send text),
// so the agent can relay an actionable message instead of a stack trace.

import { DocumentInput, DocumentParser } from '../ports/documents';

// Hard cap on extracted text fed back into prompts (characters).
const MAX_TEXT = 200_000;

export class UnreadableDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreadableDocumentError';
  }
}

function ext(filename?: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename ?? '');
  return (m?.[1] ?? '').toLowerCase();
}

function clip(text: string): string {
  const t = text.trim();
  return t.length <= MAX_TEXT
    ? t
    : t.slice(0, MAX_TEXT) + `\n…[обрезано: документ длиннее ${MAX_TEXT} символов]`;
}

function unreadable(kind: string, fix: string, cause?: unknown): UnreadableDocumentError {
  const why = cause instanceof Error ? ` (${cause.message.slice(0, 160)})` : '';
  return new UnreadableDocumentError(
    `Не удалось прочитать ${kind}${why}. Что можно сделать: ${fix}`,
  );
}

export class RichDocumentParser implements DocumentParser {
  async extractText(input: DocumentInput): Promise<string> {
    const mime = input.mime.toLowerCase();
    const fext = ext(input.filename);
    const bytes = input.base64
      ? Buffer.from(input.content, 'base64')
      : Buffer.from(input.content, 'utf8');

    // --- binary formats (need base64 bytes) ---
    if (mime.includes('pdf') || fext === 'pdf') {
      return clip(await this.pdf(bytes));
    }
    if (mime.includes('wordprocessingml') || fext === 'docx') {
      return clip(await this.docx(bytes));
    }
    if (mime.includes('spreadsheetml') || mime.includes('excel') || fext === 'xlsx' || fext === 'xls') {
      return clip(this.sheet(bytes));
    }
    if (mime.includes('msword') || fext === 'doc') {
      // Legacy binary .doc — no pure-JS parser worth trusting.
      throw unreadable(
        'старый формат .doc',
        'пересохраните файл как .docx (Word: Файл → Сохранить как) или вставьте текст сообщением.',
      );
    }
    if (mime.includes('presentationml') || fext === 'pptx' || fext === 'ppt') {
      throw unreadable(
        'презентацию PowerPoint',
        'экспортируйте её в PDF (Файл → Экспорт) и пришлите PDF — его я читаю.',
      );
    }
    if (mime.includes('zip') || fext === 'zip' || fext === 'rar' || fext === '7z') {
      throw unreadable(
        'архив',
        'распакуйте и пришлите файлы по одному (txt/md/csv/json/docx/pdf/xlsx поддерживаются).',
      );
    }

    // --- text-ish formats (raw is meaningful UTF-8) ---
    const raw = input.base64 ? bytes.toString('utf8') : input.content;
    if (mime.includes('json') || fext === 'json') {
      try {
        return clip(JSON.stringify(JSON.parse(raw)));
      } catch {
        return clip(raw);
      }
    }
    if (mime.includes('csv') || fext === 'csv' || fext === 'tsv') {
      const sep = fext === 'tsv' ? '\t' : ',';
      return clip(
        raw
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => l.split(sep).map((c) => c.trim()).join(' | '))
          .join('\n'),
      );
    }
    if (
      mime.startsWith('text/') ||
      mime.includes('markdown') ||
      mime.includes('plain') ||
      ['txt', 'md', 'log', 'yaml', 'yml', 'xml', 'html'].includes(fext)
    ) {
      return clip(raw);
    }

    // Unknown: if it decodes as mostly-printable text, use it; otherwise be honest.
    const sample = raw.slice(0, 2000);
    // Replacement chars + C0 control chars (minus tab/newline) signal binary content.
    const binSignals = (sample.match(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
    if (sample.length > 0 && binSignals / sample.length < 0.05) return clip(raw);
    throw unreadable(
      `файл "${input.filename ?? input.mime}" (${input.mime})`,
      'конвертируйте его в txt/md/csv/json/docx/pdf/xlsx — эти форматы я читаю; большие файлы можно разбить на части.',
    );
  }

  private async docx(bytes: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: bytes });
      return String(result.value ?? '');
    } catch (e) {
      throw unreadable(
        'документ Word (.docx)',
        'проверьте, что файл не повреждён и не под паролем; либо пересохраните как PDF или вставьте текст сообщением.',
        e,
      );
    }
  }

  private async pdf(bytes: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const result = await parser.getText();
        return String(result.text ?? '');
      } finally {
        await parser.destroy?.();
      }
    } catch (e) {
      throw unreadable(
        'PDF',
        'если это скан без текстового слоя — нужен OCR (пересохраните через распознавание текста); файл под паролем нужно разблокировать; большой PDF можно разбить на части.',
        e,
      );
    }
  }

  private sheet(bytes: Buffer): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX = require('xlsx');
      const wb = XLSX.read(bytes, { type: 'buffer' });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]).trim();
        if (csv) parts.push(`# Лист: ${name}\n${csv}`);
      }
      if (parts.length === 0) throw new Error('workbook has no readable sheets');
      return parts.join('\n\n');
    } catch (e) {
      throw unreadable(
        'таблицу Excel',
        'пересохраните лист как CSV (Файл → Сохранить как → CSV) и пришлите его — CSV я читаю напрямую.',
        e,
      );
    }
  }
}
