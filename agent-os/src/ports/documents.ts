// Document parsing port (PRD §3). The read_document tool extracts plain text from
// a file. The MVP adapter handles text/markdown/csv/json inline; PDF/XLSX/DOCX
// adapters plug in behind the same port.

export interface DocumentInput {
  // MIME type, e.g. "text/plain", "text/csv", "application/json", "application/pdf".
  mime: string;
  // Raw UTF-8 content, OR base64-encoded bytes (set `base64: true`).
  content: string;
  base64?: boolean;
  filename?: string;
}

export interface DocumentParser {
  extractText(input: DocumentInput): Promise<string>;
}
