/**
 * POST /api/generate
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a job and triggers worker. Returns immediately with jobId.
 *
 * Flow:
 * 1. Validate input
 * 2. Create job in Redis (status: queued, stage: starting)
 * 3. Return jobId to client
 * 4. Trigger /api/worker (asynchronously)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createJob } from '../../src/lib/jobStore';
import { MODELS } from '../../src/lib/nimClient';
import { poolStatus } from '../../src/lib/nimKeyPool';
import { checkRateLimit } from '../../src/lib/redisStore';
import { z } from 'zod';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
    externalResolver: true,
  },
};

const VALID_LANGUAGES = [
  'hinglish', 'tanglish', 'tenglish', 'manglish', 'kanglish',
  'benglish', 'marathlish', 'gujlish', 'urdu', 'odia', 'english',
] as const;

const CHAPTER_DURATION = 2;
const MAX_CHAPTERS = 30;

// Zod schema for input validation
const GenerateSchema = z.object({
  prompt:        z.string().min(1).max(500).trim(),
  language:      z.enum(['hinglish', 'tanglish', 'tenglish', 'manglish', 'kanglish', 'benglish', 'marathlish', 'gujlish', 'urdu', 'odia', 'english']),
  slideLanguage: z.string().optional().default('english'),
  duration:      z.number().min(1).max(60),
  avatar:        z.string().min(1).max(50),
  docId:         z.string().optional(),
});

// Simple userId generation (in production, use auth)
function generateUserId(): string {
  return `user_${Date.now()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting by IP (Redis-backed)
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
             req.socket?.remoteAddress ||
             'unknown';
  try {
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
  } catch (err) {
    // Redis unavailable - fail closed to prevent abuse
    console.error('[RateLimit] Redis unavailable:', err);
    return res.status(503).json({ error: 'Rate limiter unavailable. Please try again later.' });
  }

  // Zod validation
  const validation = GenerateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: validation.error.errors
    });
  }

  const { prompt, language, slideLanguage, duration: durationMins, avatar, docId } = validation.data;

  // Pool health check
  const pool = poolStatus();
  if (pool.healthy === 0) {
    return res.status(503).json({
      error: 'All NVIDIA API keys are rate-limited or unavailable.',
      poolStatus: pool,
    });
  }

  // Create job
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const userId = generateUserId();
  const totalChapters = Math.min(MAX_CHAPTERS, Math.max(1, Math.ceil(durationMins / CHAPTER_DURATION)));

  await createJob({
    jobId,
    userId,
    prompt: prompt.trim(),
    language,
    slideLanguage,
    durationMins,
    avatarId: avatar,
    totalChapters,
    docId,
  });

  // Respond immediately
  res.status(200).json({
    jobId,
    userId,
    message: 'Video generation started',
    totalChapters,
    estimatedSecs: durationMins * 6,
    models: {
      llmPrimary: MODELS.llm.primary,
      llmFallback: MODELS.llm.fallback,
      ttsPrimary: MODELS.tts.primary,
      ttsFallback: MODELS.tts.fallback,
      avatar: MODELS.avatar,
    },
    poolStatus: pool,
  });

  // Trigger worker asynchronously (non-blocking)
  // Derive base URL from incoming request so it works on Vercel preview/prod/local
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  fetch(`${baseUrl}/api/worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': process.env.WORKER_SECRET || 'obsidian-internal',
    },
    body: JSON.stringify({ jobId }),
  }).catch(err => {
    console.warn('[Generate] Worker trigger failed:', err.message, '| baseUrl:', baseUrl);
  });
}
