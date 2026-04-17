# Demo Audio Setup Guide

## Overview

This feature adds **preview audio** for each persona/language combination in the creation zone. Users can click avatars or language options to hear what the AI voice sounds like before generating.

## Architecture

```
Frontend (public/)
├── audio-samples/
│   ├── ethan/english.mp3
│   ├── ethan/hinglish.mp3
│   ├── maya/english.mp3
│   └── ... (6 personas × 11 languages = 66 files)

UI (pages/create.tsx)
├── playPreview() → uses sampleAudio.ts
└── Visual feedback (play icons, overlays)

Backend (unchanged)
└── Worker → NVIDIA → Drive → Redis
```

## Quick Start

### Option A: Using Public Folder (Simple)

1. Generate samples locally:
   ```bash
   npx tsx scripts/generateDemoSamples.standalone.ts
   ```

2. Files will appear in `public/audio-samples/{persona}/{language}.mp3`

3. Start dev server:
   ```bash
   npm run dev
   ```

4. Go to `/create` - previews work immediately

### Option B: Using Google Drive (Scalable)

1. Create folder in Google Drive (e.g., "Obsidian Audio Samples")

2. Set environment variable:
   ```bash
   export DRIVE_FOLDER_ID="your-folder-id"
   export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
   ```

3. Generate and upload in one step:
   ```bash
   npm run generate:demo-samples:upload
   ```

4. Update `src/lib/sampleAudio.ts` with Drive URLs:
   ```typescript
   export const SAMPLE_AUDIO = {
     ethan: {
       english: "https://drive.google.com/uc?id=FILE_ID&export=download",
       // ...
     },
     // ...
   };
   ```

## Prerequisites

### For TTS Generation
- **NVIDIA API Key**: `NVIDIA_API_KEY` in `.env.local`
- **NVCF Function ID**: `NIM_TTS_PRIMARY_FN_ID` for Magpie TTS
- **Python Bridge**: `scripts/nim-riva-tts.py` (existing)
- **FFmpeg**: Available in PATH (for WAV → MP3 conversion)

### For Drive Upload
- **Google Cloud Project** with Drive API enabled
- **Service Account** with credentials JSON
- **Drive Folder** with appropriate permissions

## File Structure

```
public/audio-samples/
├── README.md                 # This documentation
├── PLACEHOLDER_GUIDE.md      # Quick reference
├── .gitkeep                  # Keep folder in git
├── ethan/
│   ├── english.mp3
│   ├── hinglish.mp3
│   └── ... (11 languages)
├── maya/
├── kenji/
├── clara/
├── arjun/
└── priya/
```

## Audio Specifications

- **Format**: MP3
- **Sample Rate**: 44.1 kHz or 48 kHz
- **Bitrate**: 128-192 kbps
- **Duration**: 3-5 seconds
- **Volume**: Normalized to -3 dB peak
- **Content**: Short phrase like "Hello, I'm Ethan. Welcome!"

## Implementation Details

### sampleAudio.ts (src/lib/)

```typescript
export const SAMPLE_AUDIO = {
  ethan: {
    english: '/audio-samples/ethan/english.mp3',
    hinglish: '/audio-samples/ethan/hinglish.mp3',
    // ...
  },
  // 6 personas × 11 languages
};

export function getSampleAudio(persona: string, language: string): string | null {
  const personaSamples = SAMPLE_AUDIO[persona as keyof typeof SAMPLE_AUDIO];
  if (!personaSamples) return null;

  // Try exact language match
  if (personaSamples[language as keyof typeof personaSamples]) {
    return personaSamples[language as keyof typeof personaSamples];
  }

  // Fallback to English
  return personaSamples.english || null;
}

export async function playSampleAudio(persona: string, language: string): Promise<boolean> {
  const url = getSampleAudio(persona, language);
  if (!url) return false;

  try {
    const currentAudio = document.querySelector('audio[data-sample="true"]') as HTMLAudioElement;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
    }

    const audio = new Audio(url);
    audio.setAttribute('data-sample', 'true');
    audio.volume = 0.5;
    await audio.play();
    return true;
  } catch (err) {
    console.debug('[SampleAudio] Play failed:', err);
    return false;
  }
}
```

### UI Integration (pages/create.tsx)

- Avatar picker: Click to play that persona's sample in current language
- Language selector: Click to play that language for current persona
- Visual indicators: Play icons, volume overlays
- Auto-stop after 4 seconds
- Toggle: Click again to stop playback

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 on audio files | Verify files exist in `public/audio-samples/` |
| No play button | Check `SAMPLE_AUDIO` entries in sampleAudio.ts |
| Audio doesn't play | Browser autoplay policy - ensure user interaction first |
| Generation fails | Check `NVIDIA_API_KEY` and `NIM_TTS_PRIMARY_FN_ID` |
| FFmpeg not found | Install FFmpeg or skip MP3 conversion |
| Upload fails | Verify Google credentials and Drive folder ID |

## Environment Variables

```bash
# NVIDIA TTS
NVIDIA_API_KEY=sk-...
NIM_TTS_PRIMARY_FN_ID=...

# Google Drive (optional)
DRIVE_FOLDER_ID=...
GOOGLE_APPLICATION_CREDENTIALS=./path/to/credentials.json
```

## NPM Scripts

```bash
npm run generate:demo-samples        # Generate to public/
npm run generate:demo-samples:upload # Generate + upload to Drive
```

## Adding New Personas/Languages

1. Update `SAMPLE_AUDIO` in `src/lib/sampleAudio.ts`
2. Add directory in `public/audio-samples/`
3. Generate audio using the script with modified config
4. Update UI components if needed

## Important Notes

- **Frontend-only feature**: Does not affect production video generation
- **Cache-friendly**: Files served from `/public` are statically cached
- **Backwards compatible**: Missing files fall back gracefully
- **Separate from pipeline**: Preview audio never touches the worker system
