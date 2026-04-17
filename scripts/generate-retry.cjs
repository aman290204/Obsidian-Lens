#!/usr/bin/env node
/**
 * Retry failed samples with longer delays and API key rotation
 */

const { writeFile, mkdir } = require('fs/promises');
const { existsSync } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { cwd } = require('process');

const execAsync = promisify(exec);

const PYTHON = '.venv/bin/python';
const PYTHON_SCRIPT = path.join(cwd(), 'scripts', 'nim-riva-tts.py');
const OUTPUT_DIR = path.join(cwd(), 'public', 'audio-samples');

// Multiple API keys to rotate
const API_KEYS = [
  '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',
  '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',
  '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',
];
let keyIndex = 0;
function getNextKey() { return API_KEYS[keyIndex++ % API_KEYS.length]; }

const NVCF_FUNCTION_ID = '877104f7-e885-42b9-8de8-f6e4c6303969';

const PERSONAS = ['ethan', 'maya', 'kenji', 'clara', 'arjun', 'priya'];
const LANGUAGES = ['english','hinglish','tanglish','tenglish','manglish','kanglish','benglish','marathlish','gujlish','urdu','odia'];

const SAMPLE_TEXT = "Hello, I'm your AI presenter."; // Short for rate limit recovery

async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

async function generateSample(persona, language) {
  const outputDir = path.join(OUTPUT_DIR, persona);
  const outputPath = path.join(outputDir, `${language}.wav`);

  if (existsSync(outputPath)) {
    console.log(`[SKIP] ${persona}/${language}.wav`);
    return true;
  }

  await ensureDir(outputDir);

  const apiKey = getNextKey();
  const cmd = `${PYTHON} "${PYTHON_SCRIPT}" --function-id "${NVCF_FUNCTION_ID}" --api-key "${apiKey}" --language-code "en-US" --voice "Magpie-Multilingual.EN-US.Aria" --text "${SAMPLE_TEXT}"`;

  try {
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    if (!stdout || stdout.trim() === '') {
      throw new Error('Empty response');
    }

    const buffer = Buffer.from(stdout.trim(), 'base64');
    await writeFile(outputPath, buffer);
    console.log(`[OK]   ${persona}/${language}.wav`);
    return true;
  } catch (e) {
    if (e.message.includes('rate limit')) {
      console.log(`[RATE] ${persona}/${language} - will retry later`);
    } else {
      console.error(`[ERR] ${persona}/${language}: ${e.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  RETRY MISSING SAMPLES');
  console.log('='.repeat(60));

  // Find missing files
  const missing = [];
  for (const persona of PERSONAS) {
    for (const language of LANGUAGES) {
      const outputPath = path.join(OUTPUT_DIR, persona, `${language}.wav`);
      if (!existsSync(outputPath)) {
        missing.push({ persona, language });
      }
    }
  }

  console.log(`Missing: ${missing.length} samples`);
  console.log('='.repeat(60));

  let success = 0;
  let rateLimited = 0;
  let failed = 0;

  // First pass with 2 second delay
  for (const item of missing) {
    const ok = await generateSample(item.persona, item.language);
    if (ok) success++;
    else rateLimited++;

    await new Promise(r => setTimeout(r, 2000)); // 2s between calls
  }

  console.log('='.repeat(60));
  console.log(`Pass 1: ${success} generated, ${rateLimited} rate-limited`);

  // Second pass for rate-limited items with 5s delay
  if (rateLimited > 0) {
    console.log('\nWaiting 30s before retry...');
    await new Promise(r => setTimeout(r, 30000));

    let retrySuccess = 0;
    for (const item of missing) {
      const outputPath = path.join(OUTPUT_DIR, item.persona, `${item.language}.wav`);
      if (!existsSync(outputPath)) {
        console.log(`[RETRY] ${item.persona}/${item.language}`);
        const ok = await generateSample(item.persona, item.language);
        if (ok) retrySuccess++;
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    console.log(`Retry pass: ${retrySuccess} more generated`);
  }

  const total = (await import('fs/promises')).then(fs => fs.readdir(OUTPUT_DIR))
    .then(dirs => dirs.filter(d => d !== '.gitkeep' && d !== 'README.md' && d !== 'PLACEHOLDER_GUIDE.md' && d !== 'generate-placeholders.js'))
    .then(dirs => dirs.reduce((acc, dir) => acc + (require('fs').readdirSync(path.join(OUTPUT_DIR, dir)).filter(f => f.endsWith('.wav')).length), 0))
    .catch(() => 0);

  console.log('='.repeat(60));
  console.log(`✅ Total generated: ${total} / 66`);
  console.log('='.repeat(60));
}

if (require.main === module) {
  main().catch(console.error);
}
