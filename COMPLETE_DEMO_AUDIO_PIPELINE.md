# Complete Demo Audio Pipeline

End-to-end solution for generating, uploading, and caching audio preview samples.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ pages/create.tsx                                    │   │
│  │ • Avatar picker → triggers preview                  │   │
│  │ • Language selector → triggers preview              │   │
│  │ • Visual feedback (overlays, play icons)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ src/lib/sampleAudio.ts                              │   │
│  │ • getSampleAudio() → URL lookup                     │   │
│  │ • try Redis → fallback to local mapping             │   │
│  │ • playSampleAudio() → HTML5 Audio API               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ (URL resolved)
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND / CACHE                          │
│  ┌─────────────────┐         ┌──────────────────────┐    │
│  │   Redis Cache   │  or     │  Public /static      │    │
│  │ • audio:samples │         │  /audio-samples/     │    │
│  │ • TTL: 30 days  │         │  • .wav files        │    │
│  └─────────────────┘         └──────────────────────┘    │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │   Google Drive (optional)                           │   │
│  │   https://drive.google.com/uc?id=...                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start (All-in-One)

### 1. Prerequisites

- **NVIDIA API**: `NVIDIA_API_KEY` and `NIM_TTS_PRIMARY_FN_ID` in `.env.local`
- **Python Bridge**: `scripts/nim-riva-tts.py` (already exists)
- **Google Drive** (optional): Service account JSON + `DRIVE_FOLDER_ID`
- **Node**: v18+ with `tsx` (`npm install -D tsx`)

### 2. Generate Audio Files

```bash
# Generate all 66 WAV files (6 personas × 11 languages)
npm run generate:demo-samples
```

Files will be created in `public/audio-samples/{persona}/{language}.wav`

### 3. Upload to Google Drive (Optional - for scalability)

```bash
# Set your Drive folder ID
export DRIVE_FOLDER_ID="your-folder-id"
export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"

# Generate AND upload in one step
npm run generate:demo-samples:upload
```

This outputs the URL mapping (copy it to `urls.json`).

### 4. Cache URLs in Redis

```bash
# After upload, save the URL mapping to urls.json
npx tsx scripts/cacheAudioSamples.ts urls.json
```

### 5. Update sampleAudio.ts (if using Drive URLs)

Replace the local paths with Drive URLs, or use the cached version:

```typescript
// Option A: Use local files (simplest)
export const SAMPLE_AUDIO = {
  ethan: { english: '/audio-samples/ethan/english.wav', ... },
  // ...
};

// Option B: Use Redis cache (modified getSampleAudio)
// Read from Redis, fallback to SAMPLE_AUDIO mapping
```

## File Locations

```
├── src/
│   └── lib/
│       ├── sampleAudio.ts         # Audio mapping (WAV paths or Drive URLs)
│       └── audioSampleCache.ts    # Redis caching layer
├── pages/
│   └── create.tsx                 # UI integration with preview
├── public/
│   └── audio-samples/             # Static WAV files (if not using Drive)
│       ├── ethan/english.wav
│       ├── maya/hinglish.wav
│       └── ...
├── scripts/
│   ├── generateDemoSamples.standalone.ts  # Generate all samples
│   ├── uploadToDrive.ts                   # Upload to Drive
│   ├── cacheAudioSamples.ts               # Cache URLs in Redis
│   └── nim-riva-tts.py                    # Python TTS bridge
├── credentials.json                  # Google service account
├── urls.json                         # Generated URL mapping
└── DEMO_AUDIO_SETUP.md               # Detailed docs
```

## Environment Variables

```bash
# NVIDIA TTS
NVIDIA_API_KEY=sk-...
NIM_TTS_PRIMARY_FN_ID=877104f7-e885-42b9-8de8-f6e4c6303969

# Google Drive (optional)
DRIVE_FOLDER_ID=1sX8Vc5qtyQVkr2fOem-RoxdcgtPN3BYx
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## NPM Scripts

```json
{
  "scripts": {
    "generate:demo-samples": "tsx scripts/generateDemoSamples.standalone.ts",
    "generate:demo-samples:upload": "UPLOAD_TO_DRIVE=true tsx scripts/generateDemoSamples.standalone.ts",
    "cache:audio-samples": "tsx scripts/cacheAudioSamples.ts"
  }
}
```

## What Gets Generated

| Persona | Gender | Languages |
|---------|--------|-----------|
| Ethan   | Male   | 11        |
| Maya    | Female | 11        |
| Kenji   | Male   | 11        |
| Clara   | Female | 11        |
| Arjun   | Male (Indian) | 11  |
| Priya   | Female (Indian) | 11 |

**Total: 66 audio files**

Each file is ~3-5 seconds of WAV audio (44.1kHz, 16-bit).

## Integration Flow

### 1. First Time Setup

```bash
# Generate locally (fastest for testing)
npm run generate:demo-samples

# OR generate + upload to Drive (production)
npm run generate:demo-samples:upload > urls.json
npx tsx scripts/cacheAudioSamples.ts urls.json
```

### 2. In sampleAudio.ts

```typescript
import { getCachedUrl } from './audioSampleCache';

export async function getSampleAudio(persona: string, language: string): Promise<string | null> {
  // Try Redis first
  const cached = await getCachedUrl(persona, language);
  if (cached) return cached;

  // Fallback to local mapping
  return SAMPLE_AUDIO[persona]?.[language]?.replace('.wav', '.wav') || null;
}
```

### 3. Dev vs Prod

- **Dev**: Use local public files (no Redis needed)
- **Prod**: Use Drive URLs cached in Redis (scalable)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `NVIDIA_API_KEY` missing | Add to .env.local |
| `NIM_TTS_PRIMARY_FN_ID` missing | Check .env.local for NVCF function ID |
| Python bridge fails | `pip install nvidia-riva-client` |
| FFmpeg not found | Skip conversion - uses WAV directly |
| Drive upload fails | Verify service account has Drive scope |
| Redis connection fails | Check REDIS_HOST/PORT in .env |

## Costs & Rate Limits

- **NVIDIA TTS**: ~$0.02 per sample (66 samples ≈ $1.32)
- **Rate limiting**: 500ms delay between calls in generator
- **Total time**: ~5-10 minutes for all 66 samples

## Notes

- WAV format is supported by all modern browsers
- Files are small (< 100KB each for 3-5 second clips)
- Redis caching eliminates Drive API latency
- Frontend remains unchanged whether using local or Drive URLs
