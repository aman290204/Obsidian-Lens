#!/usr/bin/env node
/**
 * Full Demo Audio Generator - CommonJS (Works reliably)
 * Generates 66 WAV files: 6 personas × 11 languages
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
const NVCF_FUNCTION_ID = '877104f7-e885-42b9-8de8-f6e4c6303969';
const API_KEY = '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';

const PERSONAS = ['ethan', 'maya', 'kenji', 'clara', 'arjun', 'priya'];

// Use only English voices - Magpie TTS has limited language support
// This is for preview purposes - English samples show the persona's voice character
const LANGUAGES = {
  english:   { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  hinglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' }, // Fallback to English
  tanglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  tenglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  manglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  kanglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  benglish:  { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  marathlish:{ voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  gujlish:   { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
  urdu:      { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
 odia:      { voice: 'Magpie-Multilingual.EN-US.Aria', locale: 'en-US' },
};

// Short samples for all languages (same text pronounced in different styles would be ideal,
// but for preview we'll use the same English text since voice models are English-only)
const SAMPLE_TEXTS = {
  english: "Hello, I'm your AI presenter.",
  hinglish: "Hello, I'm your AI presenter.",
  tanglish: "Hello, I'm your AI presenter.",
  tenglish: "Hello, I'm your AI presenter.",
  manglish: "Hello, I'm your AI presenter.",
  kanglish: "Hello, I'm your AI presenter.",
  benglish: "Hello, I'm your AI presenter.",
  marathlish: "Hello, I'm your AI presenter.",
  gujlish: "Hello, I'm your AI presenter.",
  urdu: "Hello, I'm your AI presenter.",
  odia: "Hello, I'm your AI presenter.",
};

const GENDER_MAP = {
  ethan: 'male', maya: 'female', kenji: 'male', clara: 'female',
  arjun: 'male', priya: 'female'
};

async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) await mkdir(dirPath, { recursive: true });
}

async function generateSample(persona, language) {
  const localeConfig = LANGUAGES[language];
  if (!localeConfig) throw new Error(`Unknown language: ${language}`);

  const text = SAMPLE_TEXTS[language];
  const gender = GENDER_MAP[persona];
  let voice = localeConfig.voice;

  // Adjust voice gender
  if (gender === 'male') {
    voice = voice.replace('Female', 'Male').replace('female', 'male');
  }

  const outputDir = path.join(OUTPUT_DIR, persona);
  const outputPath = path.join(outputDir, `${language}.wav`);

  if (existsSync(outputPath)) {
    console.log(`[SKIP] ${persona}/${language}.wav`);
    return { skipped: true };
  }

  const cmd = `${PYTHON} "${PYTHON_SCRIPT}" --function-id "${NVCF_FUNCTION_ID}" --api-key "${API_KEY}" --language-code "${localeConfig.locale}" --voice "${voice}" --text "${text}"`;

  try {
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    });

    if (!stdout || stdout.trim() === '') {
      throw new Error('Empty response from TTS');
    }

    const buffer = Buffer.from(stdout.trim(), 'base64');
    await ensureDir(outputDir);
    await writeFile(outputPath, buffer);

    console.log(`[OK]   ${persona}/${language}.wav (${buffer.length} bytes)`);
    return { size: buffer.length };
  } catch (e) {
    console.error(`[ERR] ${persona}/${language}: ${e.message}`);
    return { error: e.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  DEMO AUDIO GENERATOR (CJS)');
  console.log('='.repeat(60));
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Total: ${PERSONAS.length * Object.keys(LANGUAGES).length} samples`);
  console.log('='.repeat(60));

  await ensureDir(OUTPUT_DIR);

  let generated = 0, skipped = 0, errors = 0;

  for (const persona of PERSONAS) {
    for (const language of Object.keys(LANGUAGES)) {
      const result = await generateSample(persona, language);
      if (result.skipped) skipped++;
      else if (result.error) errors++;
      else generated++;

      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('='.repeat(60));
  console.log(`✅ Complete: ${generated} generated, ${skipped} skipped, ${errors} errors`);
  console.log('='.repeat(60));
  console.log('\nFiles in: public/audio-samples/');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
