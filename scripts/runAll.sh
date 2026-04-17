#!/bin/bash
set -e

echo "=========================================="
echo "  DEMO AUDIO PIPELINE - COMPLETE"
echo "=========================================="

# Activate venv
source .venv/bin/activate

# Load env
set -a
source .env.local
export NIM_TTS_PRIMARY_FN_ID="877104f7-e885-42b9-8de8-f6e4c6303969"
export NVIDIA_API_KEY="${NVIDIA_API_KEY_1}"
set +a

# Step 1: Generate single test file
echo ""
echo "[1/3] Testing with 1 sample..."
npx tsx scripts/testGenerate.ts

# Step 2: Generate all
echo ""
echo "[2/3] Generating all 66 samples..."
npx tsx scripts/generateDemoSamples.standalone.ts

# Step 3: Upload to Drive?
if [ -n "$DRIVE_FOLDER_ID" ]; then
  echo ""
  echo "[3/3] Uploading to Google Drive..."
  UPLOAD_TO_DRIVE=true npx tsx scripts/generateDemoSamples.standalone.ts

  echo ""
  echo "Next: Cache URLs in Redis"
  echo "  npx tsx scripts/cacheAudioSamples.ts urls.json"
else
  echo ""
  echo "Skipping Drive upload (DRIVE_FOLDER_ID not set)"
  echo "Files are in public/audio-samples/"
fi

echo ""
echo "=========================================="
echo "  DONE"
echo "=========================================="
