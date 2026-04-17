import Redis from 'ioredis';
import { JobRecord } from './jobStore';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('error', (err) => {
  console.error('[Redis Error]', err);
});

const JOB_TTL_SEC = 24 * 60 * 60; // 24 hours
const RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const key = `ratelimit:${ip}`;
    const count = await redisClient.incr(key);

    if (count === 1) {
      // First request - set TTL
      await redisClient.expire(key, RATE_LIMIT_WINDOW_SEC);
    }

    return count <= RATE_LIMIT_MAX;
  } catch (err) {
    // Redis unavailable - fail closed (more secure)
    // In production, monitor Redis health separately
    throw new Error('Rate limiter unavailable');
  }
}

export async function saveJob(job: JobRecord): Promise<void> {
  const key = `job:${job.jobId}`;
  await redisClient.setex(key, JOB_TTL_SEC, JSON.stringify(job));
}

export async function getJob(jobId: string): Promise<JobRecord | undefined> {
  const data = await redisClient.get(`job:${jobId}`);
  if (!data) return undefined;
  try {
    return JSON.parse(data) as JobRecord;
  } catch {
    return undefined;
  }
}

export async function listJobs(): Promise<JobRecord[]> {
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

  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

// Generic operations for chapter storage and other arbitrary keys
export async function saveToRedis(key: string, data: any, ttl: number = JOB_TTL_SEC): Promise<void> {
  await redisClient.setex(key, ttl, JSON.stringify(data));
}

export async function getFromRedis(key: string): Promise<any> {
  const data = await redisClient.get(key);
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}
