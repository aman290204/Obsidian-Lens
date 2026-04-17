/**
 * GET /api/video/[videoId]
 * Returns video metadata from Redis job record.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getJob } from '../../../src/lib/jobStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId } = req.query;
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    const job = await getJob(videoId);

    if (job && job.status === 'completed' && job.url) {
      return res.status(200).json({
        videoId: job.jobId,
        title: job.prompt || `Video - ${job.jobId.slice(0, 8)}`,
        language: job.language || 'english',
        durationMins: job.durationMins || 15,
        totalChapters: job.totalChapters,
        createdAt: new Date(job.createdAt).toISOString(),
        models: job.models,
        url: job.url,
        status: 'completed',
      });
    }

    // Job not found or not complete
    return res.status(404).json({ 
      error: 'Video not found or not yet processed',
      jobId: videoId,
      status: job?.status || 'not_found'
    });

  } catch (error) {
    console.error('[Video API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
