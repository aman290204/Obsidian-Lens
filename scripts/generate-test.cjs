#!/usr/bin/env node
/**
 * Simple test generator - CommonJS version
 */

const { writeFile, mkdir } = require('fs/promises');
const { existsSync } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { cwd } = require('process');

const execAsync = promisify(exec);

const PYTHON_SCRIPT = path.join(cwd(), 'scripts', 'nim-riva-tts.py');
const NVCF_FUNCTION_ID = '877104f7-e885-42b9-8de8-f6e4c6303969';
const API_KEY = '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';

async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

async function testGenerate() {
  console.log('Testing single sample generation...');
  console.log(`Python: ${PYTHON_SCRIPT}`);

  const text = "Hello, I'm your AI presenter. Welcome!";
  const voice = "Magpie-Multilingual.EN-US.Aria";
  const locale = "en-US";

  const cmd = `.venv/bin/python "${PYTHON_SCRIPT}" --function-id "${NVCF_FUNCTION_ID}" --api-key "${API_KEY}" --language-code "${locale}" --voice "${voice}" --text "${text}"`;

  console.log(`Running command...\n`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    console.log(`stderr: ${stderr || '(none)'}`);
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
  } catch (e) {
    console.error('FAILED:', e.message);
    if (e.stderr) console.error('stderr:', e.stderr);
    process.exit(1);
  }
}

testGenerate().catch(console.error);
