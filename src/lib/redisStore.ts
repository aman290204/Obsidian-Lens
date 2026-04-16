import Redis from 'ioredis';
import { JobRecord } from './jobStore';

// Initialize Redis 
// Uses REDIS_URL if available, else defaults to localhost:6379 
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('error', (err) => {
  console.error('[Redis Error]', err);
});

const JOB_TTL_SEC = 2 * 60 * 60; // 2 hours

export async function saveJob(job: JobRecord): Promise<void> {
  const key = `job:${job.jobId}`;
  await redisClient.setex(key, JOB_TTL_SEC, JSON.stringify(job));
}

export async function getJob(jobId: string): Promise<JobRecord | undefined> {
  const data = await redisClient.get(`job:${jobId}`);
  if (!data) return undefined;
  try {
    return JSON.parse(data) as JobRecord;
  } catch (e) {
    return undefined;
  }
}

export async function listJobs(): Promise<JobRecord[]> {
  // Use KEYS or SCAN to retrieve all jobs 
  // Warning: KEYS is blocking but fine for small deployments; for prod we would use SCAN but this works for local MVP
  const keys = await redisClient.keys('job:*');
  if (!keys || keys.length === 0) return [];
  
  const pipeline = redisClient.pipeline();
  keys.forEach((k) => pipeline.get(k));
  const results = await pipeline.exec();
  
  if (!results) return [];
  
  const jobs: JobRecord[] = [];
  results.forEach(([err, val]) => {
    if (!err && val) {
      try {
        jobs.push(JSON.parse(val as string) as JobRecord);
      } catch (e) {}
    }
  });
  
  return jobs.sort((a, b) => b.startedAt - a.startedAt);
}
