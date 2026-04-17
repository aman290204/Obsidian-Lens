/**
 * POST /api/export-slides
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a downloadable PPTX / DOCX / PDF from a video script.
 * 
 * Adapted from: Voxora AI — app/api/generate-file/route.js
 * Key changes:
 *  - Converted from App Router to Pages Router
 *  - PPTX slide design updated to match Obsidian Lens dark aesthetic
 *  - Accepts jobId from Redis OR raw content string
 *  - Supports types: pptx | docx | pdf
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob } from '../../src/lib/jobStore';
import { getFromRedis } from '../../src/lib/redisStore';

export const config = {
  api: { responseLimit: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, content: rawContent, jobId, filename } = req.body ?? {};

  if (!type) return res.status(400).json({ error: 'type is required (pptx | docx | pdf)' });

  // Resolve content — from jobId or raw
  let content: string = rawContent ?? '';
  let title = filename || 'obsidian-lens';

  if (jobId && !rawContent) {
    const job = await getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Collect all chapter scripts from Redis
    const parts: string[] = [];
    const totalChapters = job.totalChapters ?? 1;
    for (let i = 0; i < totalChapters; i++) {
      const chapterData = await getFromRedis(`job:${jobId}:chapter:${i}`);
      if (chapterData?.script) {
        parts.push(`# Chapter ${i + 1}: ${chapterData.title ?? ''}\n\n${chapterData.script}`);
      }
    }
    content = parts.join('\n\n---\n\n');
    title = `${job.prompt?.slice(0, 40) ?? 'video'}-slides`;
  }

  if (!content) return res.status(400).json({ error: 'No content available' });

  try {
    // ── PPTX (adapted from Voxora with Obsidian Lens dark theme) ─────────────
    if (type === 'pptx') {
      const pptxgen = (await import('pptxgenjs')).default;
      const prs = new pptxgen();
      prs.layout = 'LAYOUT_16x9';

      const lines = content.split('\n').filter((l: string) => l.trim());
      let slideTitle = '';
      let slideContent: string[] = [];

      const flushSlide = () => {
        if (!slideTitle && slideContent.length === 0) return;
        const slide = prs.addSlide();
        // Obsidian Lens dark theme (matches the app aesthetic)
        slide.background = { color: '0A0A0F' };

        // Add subtle accent bar
        slide.addShape(prs.ShapeType.rect, {
          x: 0, y: 0, w: 10, h: 0.08, fill: { color: '7C3AED' },
        });

        if (slideTitle) {
          slide.addText(slideTitle, {
            x: 0.5, y: 0.4, w: 9, h: 1,
            fontSize: 28, bold: true, color: 'A78BFA', fontFace: 'Segoe UI',
          });
        }
        if (slideContent.length > 0) {
          slide.addText(slideContent.join('\n'), {
            x: 0.5, y: 1.6, w: 9, h: 5,
            fontSize: 15, color: 'E5E7EB', fontFace: 'Segoe UI',
            valign: 'top', wrap: true, lineSpacingMultiple: 1.5,
          });
        }
        slideTitle = '';
        slideContent = [];
      };

      for (const line of lines) {
        if (line.startsWith('# ') || line.startsWith('## ')) {
          flushSlide();
          slideTitle = line.replace(/^#+\s*/, '');
        } else if (line === '---') {
          flushSlide();
        } else {
          const clean = line.replace(/\*\*/g, '').replace(/^[-*] /, '• ');
          slideContent.push(clean);
        }
      }
      flushSlide();

      const buffer = await prs.write({ outputType: 'arraybuffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.pptx"`);
      return res.send(Buffer.from(buffer as ArrayBuffer));
    }

    // ── DOCX (adapted directly from Voxora) ──────────────────────────────────
    if (type === 'docx') {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const lines = content.split('\n');
      const children: any[] = [];

      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2, spacing: { after: 160 } }));
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3, spacing: { after: 120 } }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 }, spacing: { after: 80 } }));
        } else if (line.trim() === '' || line === '---') {
          children.push(new Paragraph({ text: '' }));
        } else {
          const parts = line.split(/(\*\*.*?\*\*)/);
          const runs = parts.map((part: string) =>
            part.startsWith('**') && part.endsWith('**')
              ? new TextRun({ text: part.slice(2, -2), bold: true })
              : new TextRun({ text: part })
          );
          children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
        }
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.docx"`);
      return res.send(buffer);
    }

    // ── PDF (adapted from Voxora) ─────────────────────────────────────────────
    if (type === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const lines = content.split('\n');
      let y = 20;

      for (const line of lines) {
        if (y > 270) { doc.addPage(); y = 20; }
        if (line.startsWith('# ')) {
          doc.setFontSize(18); doc.setFont('helvetica', 'bold');
          doc.text(line.slice(2), 15, y); y += 10;
          doc.setFont('helvetica', 'normal');
        } else if (line.startsWith('## ')) {
          doc.setFontSize(14); doc.setFont('helvetica', 'bold');
          doc.text(line.slice(3), 15, y); y += 8;
          doc.setFont('helvetica', 'normal');
        } else if (line.trim() === '' || line === '---') {
          y += 4;
        } else {
          doc.setFontSize(11);
          const clean = line.replace(/\*\*/g, '').replace(/^[-*] /, '• ');
          const wrapped = doc.splitTextToSize(clean, 180);
          doc.text(wrapped, 15, y);
          y += wrapped.length * 6;
        }
      }

      const buffer = Buffer.from(doc.output('arraybuffer'));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
      return res.send(buffer);
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });

  } catch (e: any) {
    console.error('[ExportSlides]', e);
    return res.status(500).json({ error: e.message || 'Export failed' });
  }
}
