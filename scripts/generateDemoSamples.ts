#!/usr/bin/env npx tsx
/**
 * Demo Audio Sample Generator
 * ---------------------------
 * One-time script to generate preview audio for all persona × language combinations.
 *
 * USAGE:
 *   1. Set environment variables (NVIDIA_NIM_*, GOOGLE_APPLICATION_CREDENTIALS)
 *   2. Run: npx tsx scripts/generateDemoSamples.ts
 *   3. Upload generated files to Google Drive or copy to public/audio-samples/
 *
 * WHAT IT DOES:
 *   - Generates 3-second TTS audio for each combination
 *   - Saves as MP3 (converts from WAV)
 *   - Optionally uploads to Google Drive
 *
 * ARCHITECTURE:
 *   Uses existing synthesiseSpeech() from nimClient.ts
 *   → Calls NVIDIA Magpie TTS via Python bridge
 *   → Saves locally, optionally uploads to Drive
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { cwd } from 'process';

const execAsync = promisify(exec);

// Import the existing TTS function
// Note: This script runs with TSX so we can import from src/
import { synthesiseSpeech } from '../src/lib/nimClient';

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

// Short sample text for each language (3-4 seconds when spoken)
const SAMPLE_TEXTS: Record<string, string> = {
  english: "Hello, I'm your AI presenter. Welcome!",
  hinglish: "Namaste! Main aapka AI presenter hoon. Swagat hai!",
  tanglish: "Vanakkam! Naan unga AI presenter. Nandri!",
  tenglish: "Namaskaram! Nenu miru AI presenter. Ash house!",
  manglish: "Namaskaram! Njan ningade AI presenter. Nandikovam!",
  kanglish: "Namaskara! Nannaivu nimma AI presenter. Dhanyavada!",
  benglish: "Nomoskar! Ami tomra AI presenter. Dhonnobad!",
  marathlish: "Namaskar! Mi AI presenter ahe. Aabhari ahe!",
  gujlish: "Namaste! Huṁ tamārī AI presenter chūṁ. Ābharū!",
  urdu: "السلام علیکم! میں آپ کا AI پیشن Gor ہوں۔",
  odia: "ନିଆଁକ拜托! ମୁଁ ଆପଣଙ୍କ AI ପ୍ରେଜେଟର ଅଛି। ଧନ୍ୟବାଦ!"
};

// Mapping from persona to voice configuration
const PERSONA_VOICES: Record<string, { voice: string; gender: 'male' | 'female' }> = {
  ethan:  { voice: 'english_male',   gender: 'male' },
  maya:   { voice: 'english_female', gender: 'female' },
  kenji:  { voice: 'english_male',   gender: 'male' },
  clara:  { voice: 'english_female', gender: 'female' },
  arjun:  { voice: 'hindi_male',     gender: 'male' },
  priya:  { voice: 'hindi_female',   gender: 'female' },
};

// Output directories
const OUTPUT_DIR = path.join(cwd(), 'public', 'audio-samples');
const TEMP_DIR = path.join(cwd(), '.tmp', 'audio-samples');

// Optional: Google Drive upload
const UPLOAD_TO_DRIVE = process.env.UPLOAD_TO_DRIVE === 'true';
const DRIVE_FOLDER_ID = process.env.DRIVE_AUDIO_FOLDER_ID || '';

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

async function base64ToFile(base64: string, outputPath: string): Promise<void> {
  // Decode base64 to buffer
  const buffer = Buffer.from(base64, 'base64');

  // If we need to convert from WAV to MP3, use ffmpeg
  if (outputPath.endsWith('.mp3') && !base64.includes('RIFF')) {
    // Already MP3, write directly
    await writeFile(outputPath, buffer);
  } else if (outputPath.endsWith('.mp3')) {
    // Need WAV → MP3 conversion
    const tempWav = outputPath.replace('.mp3', '.wav');
    await writeFile(tempWav, buffer);

    // Convert using ffmpeg
    await execAsync(`ffmpeg -y -i "${tempWav}" -codec:a libmp3lame -qscale:a 5 "${outputPath}"`);

    // Clean up temp WAV
    await execAsync(`rm "${tempWav}"`);
  } else {
    await writeFile(outputPath, buffer);
  }
}

async function uploadToDrive(localPath: string, driveFolder: string, cloudFileName: string): Promise<string> {
  // This would use your existing Google Drive API integration
  // For now, return a placeholder URL
  console.log(`[DRIVE] Would upload ${localPath} to ${driveFolder}/${cloudFileName}`);
  return `https://drive.google.com/uc?id=PLACEHOLDER&export=download`;
}

async function generateSample(persona: string, language: string): Promise<void> {
  const personaConfig = PERSONA_VOICES[persona];
  if (!personaConfig) {
    throw new Error(`Unknown persona: ${persona}`);
  }

  const text = SAMPLE_TEXTS[language] || SAMPLE_TEXTS.english;
  const outputDir = path.join(OUTPUT_DIR, persona);
  const outputPath = path.join(outputDir, `${language}.mp3`);

  // Skip if already exists
  if (existsSync(outputPath)) {
    console.log(`[SKIP] ${persona}/${language}.mp3 already exists`);
    return;
  }

  console.log(`[GEN] ${persona}/${language}: "${text.substring(0, 30)}..."`);

  try {
    // Call existing TTS pipeline
    const result = await synthesiseSpeech({
      text,
      language: language as any,
    });

    // Ensure output directory exists
    await ensureDir(outputDir);

    // Save audio (convert WAV base64 to MP3)
    await base64ToFile(result.audioBase64, outputPath);

    console.log(`[OK]   ${persona}/${language}.mp3 ✓`);

    // Upload to Drive if enabled
    if (UPLOAD_TO_DRIVE && DRIVE_FOLDER_ID) {
      const drivePath = `audio-samples/${persona}/${language}.mp3`;
      const url = await uploadToDrive(outputPath, DRIVE_FOLDER_ID, `${persona}_${language}.mp3`);
      console.log(`[DRIVE] ${persona}/${language} → ${url}`);
    }
  } catch (e: any) {
    console.error(`[ERR] ${persona}/${language}:`, e.message);
    throw e;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DEMO AUDIO SAMPLE GENERATOR');
  console.log('='.repeat(60));
  console.log(`Output dir: ${OUTPUT_DIR}`);
  console.log(`Upload to Drive: ${UPLOAD_TO_DRIVE ? 'YES' : 'NO'}`);
  console.log(`Total samples: ${PERSONAS.length * LANGUAGES.length}`);
  console.log('='.repeat(60));

  // Ensure output directory exists
  await ensureDir(OUTPUT_DIR);

  let successCount = 0;
  let failCount = 0;

  for (const persona of PERSONAS) {
    for (const language of LANGUAGES) {
      try {
        await generateSample(persona, language);
        successCount++;
      } catch (e) {
        failCount++;
        console.error(`Failed: ${persona}/${language}`);
      }

      // Rate limit: small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('='.repeat(60));
  console.log(`COMPLETE: ${successCount} generated, ${failCount} failed`);
  console.log('='.repeat(60));

  if (UPLOAD_TO_DRIVE) {
    console.log('\nNext: Update SAMPLE_AUDIO in src/lib/sampleAudio.ts with Drive URLs');
  } else {
    console.log('\nNext: Copy public/audio-samples/ to your hosting or run:');
    console.log('  npm run build && npm start');
  }
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateSample, main };
