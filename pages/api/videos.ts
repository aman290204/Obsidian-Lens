import type { NextApiRequest, NextApiResponse } from 'next';

interface Video {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  createdAt: string;
  language: string;
  status: string;
}

import { listJobs } from '../../src/lib/jobStore';

// Helper for UI formatting
function getGenericThumbnail(category: string) {
  // We can randomize or map based on prompting keywords. For now, basic rotating generic thumbs
  const thumbs = ['/thumbnails/stock-market.jpg', '/thumbnails/marketing.jpg', '/thumbnails/python.jpg'];
  return thumbs[Math.floor(Math.random() * thumbs.length)];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawJobs = await listJobs();
    
    // Convert JobRecords from Redis into the lightweight Video UI expected array
    const realVideos: Video[] = rawJobs
      .filter((job) => job.phase === 'DONE' || job.phase === 'COMPOSITING')
      .map((job) => ({
        id: job.videoId || job.jobId,
        title: job.prompt || 'Untitled Generation',
        duration: (job.durationMins || 1) * 60,
        thumbnail: getGenericThumbnail(job.prompt),
        createdAt: new Date(job.completedAt || job.startedAt).toISOString(),
        language: job.language || 'english',
        status: job.phase.toLowerCase(),
      }));

    res.status(200).json({ videos: realVideos });

  } catch (error) {
    console.error('Videos list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}