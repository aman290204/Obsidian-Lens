/**
 * Audio Sample Cache - Redis Integration
 * --------------------------------------
 * Caches audio sample URLs to avoid repeated Drive API calls.
 *
 * USAGE:
 *  1. First run: generate samples → upload to Drive → store URLs in Redis
 *  2. Later runs: sampleAudio.ts reads from Redis, falls back to local
 *
 * KEYS:
 *  - `audio:samples:${persona}:${language}` → Drive URL
 *  - `audio:samples:all` → JSON blob of all mappings
 *
 * SETUP:
 *  - Ensure Redis connection (ioredis) is configured
 *  - Run: npx tsx scripts/uploadToDrive.ts > urls.json
 *  - Then: npx tsx scripts/cacheAudioSamples.ts
 */

import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
});

export async function cacheSampleUrls(persona: string, language: string, url: string): Promise<void> {
  const key = `audio:samples:${persona}:${language}`;
  await redis.set(key, url, 'EX', 60 * 60 * 24 * 30); // 30 days TTL
}

export async function cacheAllSamples(mapping: Record<string, Record<string, string>>): Promise<void> {
  const key = 'audio:samples:all';
  await redis.set(key, JSON.stringify(mapping), 'EX', 60 * 60 * 24 * 30);
}

export async function getCachedUrl(persona: string, language: string): Promise<string | null> {
  const key = `audio:samples:${persona}:${language}`;
  return await redis.get(key);
}

export async function getAllCached(): Promise<Record<string, Record<string, string>> | null> {
  const data = await redis.get('audio:samples:all');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export default redis;
