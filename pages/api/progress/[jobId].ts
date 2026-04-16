/**
 * GET /api/progress/[jobId]
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-Sent Events (SSE) stream that emits real-time job progress
 * from the in-memory job store.
 *
 * Events emitted:
 *   { type: 'progress', job: JobRecord, poolStatus: {...} }
 *   { type: 'done',     job: JobRecord, videoId: string }
 *   { type: 'error',    message: string }
 *
 * Falls back to polling every 2s.
 * Closes automatically when the job reaches DONE or FAILED.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob } from '../../../src/lib/jobStore';
import { poolStatus } from '../../../src/lib/nimKeyPool';

// Disable Next.js body parsing for SSE routes
export const config = { api: { bodyParser: false } };

const POLL_INTERVAL_MS  = 1500;
const MAX_DURATION_MS   = 30 * 60 * 1000; // 30 min hard cap

function send(res: NextApiResponse, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Attempt to flush — works with Node's HTTP module
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

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  // Send initial connection acknowledgment
  send(res, 'connected', { jobId, time: Date.now() });

  let closed    = false;
  const startMs = Date.now();

  const interval = setInterval(async () => {
    if (closed) return clearInterval(interval);

    // Hard timeout guard
    if (Date.now() - startMs > MAX_DURATION_MS) {
      send(res, 'error', { message: 'Stream timeout — job took too long.' });
      clearInterval(interval);
      res.end();
      return;
    }

    const job = await getJob(jobId);

    if (!job) {
      // Job not in store — either expired or never existed
      send(res, 'error', { message: `Job ${jobId} not found. It may have expired.` });
      clearInterval(interval);
      res.end();
      return;
    }

    const pool = poolStatus();

    // Build a clean snapshot for the client
    const snapshot = {
      jobId:           job.jobId,
      phase:           job.phase,
      overallProgress: job.overallProgress,
      chapters:        job.chapters.map(c => ({
        index:    c.index,
        phase:    c.phase,
        title:    c.title,
        progress: c.progress,
      })),
      models:   job.models,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      pool: {
        healthy: pool.healthy,
        total:   pool.total,
        rpm:     pool.rpm,
        cooling: pool.cooling,
      },
    };

    if (job.phase === 'DONE') {
      send(res, 'done', { ...snapshot, videoId: job.videoId });
      clearInterval(interval);
      res.end();
      return;
    }

    if (job.phase === 'FAILED') {
      send(res, 'error', { ...snapshot, message: job.errorMessage || 'Pipeline failed' });
      clearInterval(interval);
      res.end();
      return;
    }

    send(res, 'progress', snapshot);

  }, POLL_INTERVAL_MS);

  // ── Cleanup on client disconnect ──────────────────────────────────────────
  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}