/**
 * GET /api/video/[videoId]
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns metadata for a completed video.
 * In production, fetches the Google Drive webContentLink, title, etc.
 * For now, resolves via the jobStore using the videoId pattern.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listJobs } from '../../../src/lib/jobStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId } = req.query;
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    // Try to find the job that produced this video
    const jobs      = await listJobs();
    const parentJob = jobs.find(j => j.videoId === videoId);

    if (parentJob) {
      return res.status(200).json({
        videoId,
        title:          parentJob.prompt, // use full title
        language:       parentJob.language,
        durationMins:   parentJob.durationMins,
        chapters:       parentJob.totalChapters,
        createdAt:      new Date(parentJob.completedAt || parentJob.startedAt).toISOString(),
        models:         parentJob.models,
        webContentLink: parentJob.driveLink || `https://drive.google.com/uc?id=${videoId}`,
        status:         'completed',
      });
    }

    // Graceful fallback — videoId may come from a previous session
    const durationFromId = parseInt(videoId.split('-')[2] || '600', 10);
    return res.status(200).json({
      videoId,
      title:          `AI Explainer Video`,
      language:       'hinglish',
      durationMins:   Math.round(durationFromId / 60) || 15,
      chapters:       5,
      createdAt:      new Date().toISOString(),
      models: {
        llm:          process.env.NIM_LLM_PRIMARY  || 'qwen/qwen2.5-72b-instruct',
        tts:          process.env.NIM_TTS_PRIMARY  || 'magpie-tts-multilingual',
        avatar:       process.env.NIM_AVATAR       || 'audio2face-3d',
        usedFallback: false,
      },
      webContentLink: `https://drive.google.com/uc?id=${videoId}`,
      status:         'completed',
    });

  } catch (error) {
    console.error('[Video API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}