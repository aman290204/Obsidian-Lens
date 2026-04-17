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

// Simple userId generation (in production, use auth)
function generateUserId(): string {
  return `user_${Date.now()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, language, duration, avatar } = req.body ?? {};

  // Validation
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'A meaningful prompt is required (min 3 chars).' });
  }
  if (!VALID_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` });
  }
  const durationMins = Number(duration);
  if (!Number.isFinite(durationMins) || durationMins < 1 || durationMins > 60) {
    return res.status(400).json({ error: 'duration must be between 1 and 60 minutes.' });
  }
  if (!avatar || typeof avatar !== 'string') {
    return res.status(400).json({ error: 'An avatar must be selected.' });
  }

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
    durationMins,
    avatarId: avatar,
    totalChapters,
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  fetch(`${baseUrl}/api/worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  }).catch(err => {
    console.warn('[Generate] Worker trigger failed:', err.message);
  });
}
