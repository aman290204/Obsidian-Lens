#!/usr/bin/env npx tsx
/**
 * Cache audio sample URLs to Redis
 * --------------------------------
 * After uploading samples to Drive, cache the URLs in Redis for fast access.
 *
 * USAGE:
 *  1. Run upload script: npm run generate:demo-samples:upload
 *  2. Copy the generated URL mapping
 *  3. Create a file with the mapping (e.g., urls.json):
 *      { "ethan": { "english": "https://...", ... }, ... }
 *  4. Run: npx tsx scripts/cacheAudioSamples.ts urls.json
 *
 * This caches all URLs with 30-day TTL and creates a bulk lookup key.
 */

import { readFile } from 'fs/promises';
import { Redis } from 'ioredis';
import { join } from 'path';
import { cwd } from 'process';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
});

async function main() {
  const mappingFile = process.argv[2] || join(cwd(), 'urls.json');

  console.log('='.repeat(60));
  console.log('CACHE AUDIO SAMPLE URLs TO REDIS');
  console.log('='.repeat(60));
  console.log(`Reading from: ${mappingFile}`);

  try {
    const raw = await readFile(mappingFile, 'utf-8');
    const mapping = JSON.parse(raw);

    let count = 0;
    const pipeline = redis.pipeline();

    // Cache individual mappings
    for (const [persona, languages] of Object.entries(mapping)) {
      for (const [language, url] of Object.entries(languages as Record<string, string>)) {
        const key = `audio:samples:${persona}:${language}`;
        pipeline.set(key, url, 'EX', 60 * 60 * 24 * 30); // 30 days
        count++;
      }
    }

    // Cache full mapping
    pipeline.set('audio:samples:all', JSON.stringify(mapping), 'EX', 60 * 60 * 24 * 30);

    await pipeline.exec();

    console.log(`✅ Cached ${count} individual URLs + full mapping`);
    console.log('='.repeat(60));
    console.log('Next: Verify with: redis-cli keys "audio:samples:*"');
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
