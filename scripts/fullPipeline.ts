#!/usr/bin/env npx tsx
/**
 * Full Demo Audio Pipeline - One Command
 * --------------------------------------
 * Generates → (optional: upload) → cache → ready
 *
 * USAGE:
 *   # Local only (public folder):
 *   npx tsx scripts/fullPipeline.ts
 *
 *   # With Drive upload:
 *   UPLOAD_TO_DRIVE=true DRIVE_FOLDER_ID=... npx tsx scripts/fullPipeline.ts
 *
 *   # After upload, update Redis:
 *   npx tsx scripts/fullPipeline.ts --cache-only urls.json
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';

const UPLOAD_TO_DRIVE = process.env.UPLOAD_TO_DRIVE === 'true';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const args = process.argv.slice(2);

async function execScript(scriptPath: string, env: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: cwd(),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  DEMO AUDIO PIPELINE - Complete Workflow');
  console.log('='.repeat(70));

  // Phase 1: Generate
  console.log('\n[1/3] Generating audio samples...');
  await execScript('scripts/generateDemoSamples.standalone.ts');

  // Phase 2: Upload (if enabled)
  if (UPLOAD_TO_DRIVE && DRIVE_FOLDER_ID) {
    console.log('\n[2/3] Uploading to Google Drive...');
    await execScript('scripts/uploadToDrive.ts');
    console.log('\n⚠️  Copy the URL mapping above and save to urls.json');
    console.log('   Then run: npx tsx scripts/fullPipeline.ts --cache-only urls.json');
  } else if (args.includes('--cache-only') && args[1]) {
    // Cache only mode
    console.log('\n[2/3] Caching URLs from', args[1]);
    const mapping = JSON.parse(await readFile(args[1], 'utf-8'));
    await cacheMapping(mapping);
    console.log('\n✅ Pipeline complete!');
    return;
  } else {
    console.log('\n[2/3] Skipping upload (local public/ only)');
  }

  // Phase 3: Summary
  console.log('\n[3/3] Summary');
  console.log('-'.repeat(70));
  console.log('Files generated in: public/audio-samples/');
  console.log('\nNext steps:');
  console.log('  1. Verify files: ls public/audio-samples/*/');
  console.log('  2. Start dev server: npm run dev');
  console.log('  3. Go to /create and test preview buttons');
  console.log('\nTo use Drive URLs instead of local files:');
  console.log('  1. Set UPLOAD_TO_DRIVE=true and DRIVE_FOLDER_ID');
  console.log('  2. Re-run this script');
  console.log('  3. Update src/lib/sampleAudio.ts with the Drive URLs');
  console.log('='.repeat(70));
}

async function cacheMapping(mapping: Record<string, Record<string, string>>): Promise<void> {
  const { Redis } = await import('ioredis');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
  });

  const pipeline = redis.pipeline();
  let count = 0;

  for (const [persona, langs] of Object.entries(mapping)) {
    for (const [lang, url] of Object.entries(langs as Record<string, string>)) {
      const key = `audio:samples:${persona}:${lang}`;
      pipeline.set(key, url, 'EX', 60 * 60 * 24 * 30);
      count++;
    }
  }

  pipeline.set('audio:samples:all', JSON.stringify(mapping), 'EX', 60 * 60 * 24 * 30);
  await pipeline.exec();

  console.log(`✅ Cached ${count} URLs in Redis`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('\n❌ Pipeline failed:', err.message);
    process.exit(1);
  });
}
