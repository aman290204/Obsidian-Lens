#!/usr/bin/env npx tsx
/**
 * Quick test - generate 1 sample to verify pipeline
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { cwd } from 'process';

const execAsync = promisify(exec);

const PYTHON_SCRIPT = path.join(cwd(), 'scripts', 'nim-riva-tts.py');
const NVCF_FUNCTION_ID = process.env.NIM_TTS_PRIMARY_FN_ID || '877104f7-e885-42b9-8de8-f6e4c6303969';
const API_KEY = process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY_1;

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

async function testGenerate(): Promise<void> {
  console.log('Testing single sample generation...');
  console.log(`Python: ${PYTHON_SCRIPT}`);
  console.log(`Function ID: ${NVCF_FUNCTION_ID}`);
  console.log(`API Key: ${API_KEY?.slice(0, 10)}...`);

  if (!API_KEY) {
    console.error('ERROR: No API key found');
    process.exit(1);
  }

  const text = "Hello, I'm your AI presenter. Welcome!";
  const voice = "Magpie-Multilingual.EN-US.Aria";
  const locale = "en-US";

  const cmd = `.venv/bin/python "${PYTHON_SCRIPT}" --function-id "${NVCF_FUNCTION_ID}" --api-key "${API_KEY}" --language-code "${locale}" --voice "${voice}" --text "${text}"`;

  console.log(`Running: ${cmd}\n`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    console.log(`stderr: ${stderr}`);
    console.log(`stdout length: ${stdout.length}`);

    if (!stdout || stdout.trim() === '') {
      throw new Error('No output from Python');
    }

    const buffer = Buffer.from(stdout.trim(), 'base64');
    console.log(`Audio buffer size: ${buffer.length} bytes`);

    // Save as WAV
    const outputDir = path.join(cwd(), 'public', 'audio-samples', 'ethan');
    await ensureDir(outputDir);
    const outputPath = path.join(outputDir, 'english.wav');
    await writeFile(outputPath, buffer);

    console.log(`\n✅ Success! Saved to: ${outputPath}`);
    console.log(`File size: ${buffer.length} bytes`);
  } catch (e: any) {
    console.error('FAILED:', e.message);
    console.error('stderr:', e.stderr);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testGenerate().catch(console.error);
}
