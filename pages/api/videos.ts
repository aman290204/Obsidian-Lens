import type { NextApiRequest, NextApiResponse } from 'next';
import { listJobs } from '../../src/lib/jobStore';

interface Video {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  createdAt: string;
  language: string;
  status: string;
  userId: string;
}

// Simple thumbnail generation (gradient based on jobId)
function getThumbnailGradient(jobId: string): string {
  const gradients = [
    'linear-gradient(135deg, #1e1040 0%, #7c3aed 50%, #1e1040 100%)',
    'linear-gradient(135deg, #052e44 0%, #22d3ee 50%, #052e44 100%)',
    'linear-gradient(135deg, #3f1133 0%, #f472b6 50%, #3f1133 100%)',
    'linear-gradient(135deg, #102030 0%, #06b6d4 50%, #102030 100%)',
    'linear-gradient(135deg, #1a1060 0%, #818cf8 50%, #1a1060 100%)',
  ];
  const idx = parseInt(jobId.slice(-1), 36) % gradients.length;
  return gradients[idx];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawJobs = await listJobs();

    // Filter to completed jobs only
    const realVideos: Video[] = rawJobs
      .filter(job => job.status === 'completed' && job.url)
      .map(job => ({
        id: job.jobId,
        title: job.prompt || `Video ${job.jobId.slice(0, 8)}`,
        duration: job.durationMins || 15,
        thumbnail: getThumbnailGradient(job.jobId),
        createdAt: new Date(job.createdAt).toISOString(),
        language: job.language || 'english',
        status: job.status,
        userId: job.userId,
      }));

    res.status(200).json({ videos: realVideos });

  } catch (error) {
    console.error('Videos list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
