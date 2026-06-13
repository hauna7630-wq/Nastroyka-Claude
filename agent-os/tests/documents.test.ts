import { RichDocumentParser, UnreadableDocumentError } from '../src/adapters/documents.rich';

// Tiny real fixtures (generated once): a minimal valid DOCX (zip with one
// paragraph) and a minimal valid PDF with a text layer.
const DOCX_B64 =
  'UEsDBBQAAAAIAK1pylzJTxqw6wAAAK4BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QvU7DMBDeeQrLK4odGBBCSTrwMwJDeYCTfUks7LPlc0v79jht6YAK4933q69b7YIXW8zsIvXyRrVSIJloHU29/Fi/NPdScAGy4CNhL/fIcjVcdet9QhZVTNzLuZT0oDWbGQOwigmpImPMAUo986QTmE+YUN+27Z02kQpSacriIYfuCUfY+CKed/V9LJLRsxSPR+KS1UtIyTsDpeJ6S/ZXSnNKUFV54PDsEl9XgtQXExbk74CT7q0uk51F8Q65vEKoLP0Vs9U2mk2oSvW/zYWecRydwbN+cUs5GmSukwevzkgARz/99WHu4RtQSwMEFAAAAAgArWnKXLmBRHGwAAAAKgEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4J1TRN5pWgaEUJMuCKkrKgeIEjeNaB5KwqO3JwMDIAZG278/y233sDO5YUzGOwZNVQNBJ70yTjM4D8f1DkjKwikxe4cMFkzQ8VV7wlnkspMmExIpiEsMppzDntIkJ7QiVT6gK5PRRytyKaOmQciL0Eg3db2l8d0A/mGSXjGIvWqADEvAf2w/jkbiwcurRZd/nPhKFFlEjZnB3UdF1atdFRYob+nHi/wJUEsDBBQAAAAIAK1pylycVKGb4AAAAAwBAAARAAAAd29yZC9kb2N1bWVudC54bWxFjzFOAzEQRXtOYVmiZL1JgdBqd9NxAjiAWZtkpfWMZTtZ0kEailRcgDNEKEIICFxhfCPspKB5o/9H+l+/nj2Yga208z1CwydFyZmGDlUP84bf3lxfXHHmgwQlBwTd8LX2fNae1WOlsFsaDYGlBPDV2PBFCLYSwncLbaQv0GpIv3t0RoYk3VyM6JR12GnvU4EZxLQsL4WRPfA2Rd6hWudrM1xGaOk1buJzfIkbRp/0Q9+0owPt47Zi9Bsfk7NPzjt9MHqL22zEJ/rK8kA7NpmeF7XIOZnuSHvkqUv872j/AFBLAQIUAxQAAAAIAK1pylzJTxqw6wAAAK4BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgArWnKXLmBRHGwAAAAKgEAAAsAAAAAAAAAAAAAAIABHAEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgArWnKXJxUoZvgAAAADAEAABEAAAAAAAAAAAAAAIAB9QEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAAAQDAAAAAA==';
const PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iaiA8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4gZW5kb2JqCjIgMCBvYmogPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmogPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4gZW5kb2JqCjQgMCBvYmogPDwgL0xlbmd0aCA2NCA+PiBzdHJlYW0KQlQgL0YxIDEyIFRmIDUwIDc1MCBUZCAoUXVhcnRlcmx5IHJldmVudWUgZ3JldyAxMiBwZXJjZW50KSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCjUgMCBvYmogPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+IGVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDM1NSAwMDAwMCBuIAp0cmFpbGVyIDw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQyNQolJUVPRg==';

describe('RichDocumentParser', () => {
  const parser = new RichDocumentParser();

  it('extracts text from a DOCX', async () => {
    const text = await parser.extractText({
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: DOCX_B64,
      base64: true,
      filename: 'report.docx',
    });
    expect(text).toContain('продажи выросли на 12%');
  });

  it('extracts text from a PDF', async () => {
    const text = await parser.extractText({
      mime: 'application/pdf',
      content: PDF_B64,
      base64: true,
      filename: 'report.pdf',
    });
    expect(text).toContain('Quarterly revenue grew 12 percent');
  });

  it('extracts every sheet of an XLSX as labeled CSV', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['месяц', 'выручка'],
        ['январь', 100],
        ['февраль', 112],
      ]),
      'Продажи',
    );
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const text = await parser.extractText({
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: b64,
      base64: true,
      filename: 'sales.xlsx',
    });
    expect(text).toContain('# Лист: Продажи');
    expect(text).toContain('февраль,112');
  });

  it('handles csv/json/markdown inline', async () => {
    expect(
      await parser.extractText({ mime: 'text/csv', content: 'a,b\n1,2', filename: 'd.csv' }),
    ).toBe('a | b\n1 | 2');
    expect(
      await parser.extractText({ mime: 'application/json', content: '{ "k" :  1 }' }),
    ).toBe('{"k":1}');
    expect(
      await parser.extractText({ mime: 'text/markdown', content: '# Заголовок\nтекст' }),
    ).toContain('Заголовок');
  });

  it('fails honestly with an actionable fix for legacy .doc', async () => {
    await expect(
      parser.extractText({ mime: 'application/msword', content: 'xxxx', base64: true, filename: 'old.doc' }),
    ).rejects.toThrow(/пересохраните файл как \.docx/);
  });

  it('fails honestly for pptx, archives, and corrupted binaries', async () => {
    await expect(
      parser.extractText({ mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', content: 'xxxx', base64: true, filename: 's.pptx' }),
    ).rejects.toThrow(/экспортируйте её в PDF/);
    await expect(
      parser.extractText({ mime: 'application/zip', content: 'xxxx', base64: true, filename: 'a.zip' }),
    ).rejects.toThrow(/распакуйте/);
    // Corrupted docx → honest message, not a library stack trace.
    await expect(
      parser.extractText({ mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: Buffer.from('not a zip').toString('base64'), base64: true, filename: 'broken.docx' }),
    ).rejects.toThrow(UnreadableDocumentError);
  });

  it('rejects unknown binary content with a conversion proposal', async () => {
    const binary = Buffer.from([0, 1, 2, 3, 255, 254, 0, 7, 8, 0, 1, 2]).toString('base64');
    await expect(
      parser.extractText({ mime: 'application/octet-stream', content: binary, base64: true, filename: 'blob.bin' }),
    ).rejects.toThrow(/конвертируйте/);
  });
});
