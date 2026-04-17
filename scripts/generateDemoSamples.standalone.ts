#!/usr/bin/env npx tsx
/**
 * Demo Audio Sample Generator - Standalone Version
 * ------------------------------------------------
 * Generates TTS audio samples using NVIDIA TTS API directly.
 *
 * PREREQUISITES:
 *   - NVIDIA NIM API key(s) in .env
 *   - Python bridge script: scripts/nim-riva-tts.py
 *
 * RUN:
 *   npx tsx scripts/generateDemoSamples.standalone.ts
 *
 * OUTPUT:
 *   public/audio-samples/{persona}/{language}.wav
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { cwd } from 'process';

const execAsync = promisify(exec);

// Configuration
const PERSONAS = [
  'ethan',
  'maya',
  'kenji',
  'clara',
  'arjun',
  'priya',
];

const LANGUAGES = [
  'english',
  'hinglish',
  'tanglish',
  'tenglish',
  'manglish',
  'kanglish',
  'benglish',
  'marathlish',
  'gujlish',
  'urdu',
  'odia',
];

// Sample text mapping (3-4 seconds)
const SAMPLE_TEXTS: Record<string, string> = {
  english: "Hello, I'm your AI presenter. Welcome!",
  hinglish: "Namaste! Main aapka AI presenter hoon.",
  tanglish: "Vanakkam! Naan unga AI presenter.",
  tenglish: "Namaskaram! Nenu miru AI presenter.",
  manglish: "Namaskaram! Njan ningade AI presenter.",
  kanglish: "Namaskara! Nannaivu nimma AI presenter.",
  benglish: "Nomoskar! Ami tomra AI presenter.",
  marathlish: "Namaskar! Mi AI presenter ahe.",
  gujlish: "Namaste! Huṁ tamārī AI presenter chūṁ.",
  urdu: "السلام علیکم! میں آپ کا AIPresenter ہوں۔",
  odia: "ନିଆଁକ拜托! ମୁଁ ଆପଣଙ୍କ AI ପ୍ରେଜେଟର ଅଛି।",
};

// Voice mapping for Magpie TTS
const LANGUAGE_VOICES: Record<string, { voice: string; locale: string }> = {
  hinglish:  { voice: 'Magpie-Multilingual.HI-IN.Female', locale: 'hi-IN' },
  english:   { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  tanglish:  { voice: 'Magpie-Multilingual.TA-IN.Female', locale: 'ta-IN' },
  tenglish:  { voice: 'Magpie-Multilingual.TE-IN.Female', locale: 'te-IN' },
  manglish:  { voice: 'Magpie-Multilingual.ML-IN.Female', locale: 'ml-IN' },
  kanglish:  { voice: 'Magpie-Multilingual.KN-IN.Female', locale: 'kn-IN' },
  benglish:  { voice: 'Magpie-Multilingual.BN-IN.Female', locale: 'bn-IN' },
  marathlish:{ voice: 'Magpie-Multilingual.MR-IN.Female', locale: 'mr-IN' },
  gujlish:   { voice: 'Magpie-Multilingual.GU-IN.Female', locale: 'gu-IN' },
  urdu:      { voice: 'Magpie-Multilingual.UR-IN.Female', locale: 'ur-IN' },
  odia:      { voice: 'Magpie-Multilingual.OR-IN.Female', locale: 'or-IN' },
};

// Gender mapping for personas
const PERSONA_GENDER: Record<string, 'male' | 'female'> = {
  ethan:  'male',
  maya:   'female',
  kenji:  'male',
  clara:  'female',
  arjun:  'male',
  priya:  'female',
};

const OUTPUT_DIR = path.join(cwd(), 'public', 'audio-samples');
const PYTHON_SCRIPT = path.join(cwd(), 'scripts', 'nim-riva-tts.py');
const PYTHON = process.env.PYTHON_BIN || ('.venv/bin/python' + (process.platform === 'win32' ? '.exe' : ''));

// Get env vars
const NVCF_FUNCTION_ID = process.env.NIM_TTS_PRIMARY_FN_ID;
const API_KEY = process.env.NVIDIA_API_KEY;

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

async function generateAudioWithPython(text: string, language: string, voice: string): Promise<Buffer> {
  if (!NVCF_FUNCTION_ID) {
    throw new Error('NIM_TTS_PRIMARY_FN_ID environment variable not set');
  }
  if (!API_KEY) {
    throw new Error('NVIDIA_API_KEY environment variable not set');
  }

  const locale = LANGUAGE_VOICES[language]?.locale || 'en-US';
  const safeText = text.replace(/"/g, '\\"');

  // Use venv Python if available
  const pythonCmd = (existsSync(PYTHON) ? PYTHON : 'python') + ` "${PYTHON_SCRIPT}" --function-id "${NVCF_FUNCTION_ID}" --api-key "${API_KEY}" --language-code "${locale}" --voice "${voice}" --text "${safeText}"`;

  console.log(`  [CMD] ${pythonCmd.substring(0, 80)}...`);

  try {
    const { stdout, stderr } = await execAsync(pythonCmd, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 30000, // 30 seconds
    });

    if (!stdout || stdout.trim() === '') {
      throw new Error(`Python bridge returned empty. stderr: ${stderr}`);
    }

    return Buffer.from(stdout.trim(), 'base64');
  } catch (e: any) {
    throw new Error(`Python execution failed: ${e.message}`);
  }
}

// WAV files are supported natively by browsers and are smaller than MP3 for short clips
// NVIDIA TTS returns WAV, so we'll save directly without conversion
async function prepareAudio(wavBuffer: Buffer): Promise<Buffer> {
  return wavBuffer; // Return WAV directly - no conversion needed
}

async function generateSample(persona: string, language: string): Promise<void> {
  const text = SAMPLE_TEXTS[language] || SAMPLE_TEXTS.english;
  const gender = PERSONA_GENDER[persona];
  const voiceConfig = LANGUAGE_VOICES[language];

  if (!gender || !voiceConfig) {
    throw new Error(`Invalid persona or language: ${persona}/${language}`);
  }

  // Adjust voice for gender (simplified - in production map properly)
  const voice = voiceConfig.voice
    .replace('Female', gender === 'male' ? 'Male' : 'Female')
    .replace('female', gender === 'male' ? 'male' : 'female');

  const outputDir = path.join(OUTPUT_DIR, persona);
  const outputPath = path.join(outputDir, `${language}.wav`);

  // Skip if exists
  if (existsSync(outputPath)) {
    console.log(`[SKIP] ${persona}/${language}.wav`);
    return;
  }

  console.log(`[GEN] ${persona}/${language} (${voice})`);

  try {
    // Generate WAV via NVIDIA TTS
    const wavBuffer = await generateAudioWithPython(text, language, voice);

    // Save as WAV (browsers support it natively)
    await ensureDir(outputDir);
    await writeFile(outputPath, wavBuffer);

    console.log(`[OK]   ${persona}/${language}.wav ✓`);
  } catch (e: any) {
    console.error(`[ERR] ${persona}/${language}: ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DEMO AUDIO SAMPLE GENERATOR');
  console.log('='.repeat(60));
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Total: ${PERSONAS.length * LANGUAGES.length} samples`);
  console.log('='.repeat(60));

  if (!NVCF_FUNCTION_ID || !API_KEY) {
    console.error('\n❌ Missing required environment variables:');
    console.error('   - NIM_TTS_PRIMARY_FN_ID');
    console.error('   - NVIDIA_API_KEY');
    console.error('\nSet them in .env.local or export before running.');
    process.exit(1);
  }

  await ensureDir(OUTPUT_DIR);

  let success = 0;
  let failed = 0;

  for (const persona of PERSONAS) {
    for (const language of LANGUAGES) {
      try {
        await generateSample(persona, language);
        success++;
        // Rate limit
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        failed++;
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`✅ Complete: ${success} generated, ${failed} failed`);
  console.log('='.repeat(60));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
