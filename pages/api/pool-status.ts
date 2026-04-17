/**
 * GET /api/pool-status
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the current health of the NVIDIA NIM API key pool.
 * Used by the UI "System Load" card and admin dashboard.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { poolStatus } from '../../src/lib/nimKeyPool';
import { MODELS } from '../../src/lib/nimClient';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pool = poolStatus();

  return res.status(200).json({
    pool,
    stack: {
      primary: {
        llm:    MODELS.llm.primary,
        tts:    MODELS.tts.primary,
        avatar: MODELS.avatar,
      },
      fallback: {
        llm:    MODELS.llm.fallback,
        tts:    MODELS.tts.fallback,
        avatar: MODELS.avatar,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
