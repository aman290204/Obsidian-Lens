# Demo Audio Feature - Quick Reference

## TL;DR

```bash
# 1. Generate audio samples (66 files)
npm run generate:demo-samples

# 2. (Optional) Upload to Google Drive
export DRIVE_FOLDER_ID="your-folder-id"
npm run generate:demo-samples:upload

# 3. (Optional) Cache URLs in Redis
npx tsx scripts/cacheAudioSamples.ts urls.json

# 4. Done. Go to /create and click avatars/languages to preview
```

## What This Does

- **6 personas** × **11 languages** = **66 preview audio files**
- Frontend plays preview when you click an avatar or language option
- Uses existing NVIDIA TTS pipeline (one-time generation)
- Storage options: local `/public` or Google Drive
- Optional Redis caching for fast URL lookup

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/sampleAudio.ts` | Audio URL mapping + playback functions |
| `pages/create.tsx` | UI with click-to-play preview buttons |
| `scripts/generateDemoSamples.standalone.ts` | Generate all 66 WAV files |
| `scripts/uploadToDrive.ts` | Upload to Google Drive |
| `scripts/cacheAudioSamples.ts` | Cache Drive URLs in Redis |
| `public/audio-samples/` | Static WAV files (if not using Drive) |

## Already Integrated

✅ UI changes in `pages/create.tsx`:
- Avatar picker plays sample on click
- Language selector plays sample on click
- Visual feedback (volume overlay, play icons)
- Auto-stop after 4 seconds

✅ Backend ready:
- Generation script uses existing TTS pipeline
- Upload script uses your Google Drive integration
- Redis cache layer available

## To Activate

1. Ensure env vars:
   ```bash
   NVIDIA_API_KEY=sk-...
   NIM_TTS_PRIMARY_FN_ID=...
   ```

2. Generate files:
   ```bash
   npm run generate:demo-samples
   ```

3. Start dev server and test:
   ```bash
   npm run dev
   # Visit http://localhost:3000/create
   ```

## Stuck?

- See `COMPLETE_DEMO_AUDIO_PIPELINE.md` for detailed docs
- `DEMO_AUDIO_SETUP.md` for architecture details
- `public/audio-samples/README.md` for file structure
