/**
 * GET /api/progress/[jobId]
 * Server-Sent Events (SSE) stream for real-time job progress.
 * Works with the new step-based job schema.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob } from '../../../src/lib/jobStore';

export const config = { api: { bodyParser: false } };

const POLL_INTERVAL_MS = 1500;
const MAX_DURATION_MS = 30 * 60 * 1000;

function send(res: NextApiResponse, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  (res as any).flush?.();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  send(res, 'connected', { jobId, time: Date.now() });

  let closed = false;
  const startMs = Date.now();

  const interval = setInterval(async () => {
    if (closed) return clearInterval(interval);

    if (Date.now() - startMs > MAX_DURATION_MS) {
      send(res, 'error', { message: 'Stream timeout — job took too long.' });
      clearInterval(interval);
      res.end();
      return;
    }

    const job = await getJob(jobId);

    if (!job) {
      send(res, 'error', { message: `Job ${jobId} not found or expired.` });
      clearInterval(interval);
      res.end();
      return;
    }

    const snapshot = {
      jobId: job.jobId,
      userId: job.userId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      error: job.error,
      prompt: job.prompt,
      language: job.language,
      totalChapters: job.totalChapters,
      models: job.models,
      createdAt: job.createdAt,
      lastUpdated: job.lastUpdated,
      url: job.url,
    };

    if (job.status === 'completed') {
      send(res, 'done', snapshot);
      clearInterval(interval);
      res.end();
      return;
    }

    if (job.status === 'failed') {
      send(res, 'error', { ...snapshot, message: job.error || 'Job failed' });
      clearInterval(interval);
      res.end();
      return;
    }

    send(res, 'progress', snapshot);

  }, POLL_INTERVAL_MS);

  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}
