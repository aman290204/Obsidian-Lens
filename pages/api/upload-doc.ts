/**
 * POST /api/upload-doc
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a multipart form upload, extracts text from PDF / DOCX / TXT / MD,
 * stores it in Redis (TTL 1 hour), and returns a docId + preview.
 *
 * Adapted from: Voxora AI — app/api/upload/route.js
 * Key changes:
 *  - PDF support via pdf-parse (Voxora skipped this — we need it properly)
 *  - Stores extracted text in Redis rather than streaming back to client
 *  - Returns docId for subsequent /api/generate calls
 *  - Truncates at 12,000 words to stay inside NIM context window
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs';
import { saveToRedis } from '../../src/lib/redisStore';

export const config = {
  api: { bodyParser: false }, // required for multipart
};

const MAX_WORDS = 12_000;
const DOC_TTL_SECS = 60 * 60; // 1 hour

function truncateToWords(text: string, maxWords: number): { text: string; truncated: boolean } {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return { text: text.trim(), truncated: false };
  return { text: words.slice(0, maxWords).join(' '), truncated: true };
}

async function extractText(filePath: string, mimeType: string, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop();

  // Plain text / markdown / CSV
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'text/markdown' ||
      ['txt', 'md', 'csv'].includes(ext || '')) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  // DOCX — adapted directly from Voxora
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // PDF — Voxora skipped this; we use pdf-parse properly
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    // pdf-parse v2: named export, not .default
    const { default: pdfParse } = await import('pdf-parse') as any;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 }); // 20 MB max

  form.parse(req, async (err, _fields, files) => {
    if (err) {
      return res.status(400).json({ error: `Upload failed: ${err.message}` });
    }

    const fileField = files.doc ?? files.file;
    const file: FormidableFile | undefined = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return res.status(400).json({ error: 'No file received. Send field name "doc".' });
    }

    try {
      const rawText = await extractText(file.filepath, file.mimetype ?? '', file.originalFilename ?? '');
      const { text, truncated } = truncateToWords(rawText, MAX_WORDS);

      const wordCount = rawText.trim().split(/\s+/).length;
      const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Store in Redis with 1 hour TTL — key first, then data, then TTL
      await saveToRedis(`doc:${docId}`, { docId, text, fileName: file.originalFilename ?? 'document' }, DOC_TTL_SECS);

      return res.status(200).json({
        docId,
        fileName: file.originalFilename,
        wordCount,
        truncated,
        preview: text.slice(0, 300).replace(/\n+/g, ' ') + (text.length > 300 ? '…' : ''),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Extraction failed' });
    }
  });
}
