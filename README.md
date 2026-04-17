# 🎬 Obsidian Lens — AI Video Mastery Studio

> Synthesise cinematic, multilingual explainer videos from a single prompt using NVIDIA NIM APIs.

---

## Table of Contents

1. [Overview](#overview)
2. [Live Tech Stack](#live-tech-stack)
3. [Project Architecture](#project-architecture)
4. [Directory Structure](#directory-structure)
5. [Environment Setup](#environment-setup)
6. [Local Development](#local-development)
7. [API Routes Reference](#api-routes-reference)
8. [NVIDIA NIM Integration](#nvidia-nim-integration)
9. [Key Pool System](#key-pool-system)
10. [Generation Pipeline](#generation-pipeline)
11. [Known Issues & Limitations](#known-issues--limitations)
12. [Bug Fix Log](#bug-fix-log)
13. [Deployment Guide](#deployment-guide)
14. [Roadmap](#roadmap)

---

## Overview

**Obsidian Lens** is a Next.js 14 web application that converts a natural-language topic prompt into a full-length AI-narrated video with lip-synced avatar animation. The pipeline is:

```
User Prompt
   │
   ▼  [NVIDIA NIM — Qwen 2.5 72B or DeepSeek-R1]
Script Generation (per 2-min chapter)
   │
   ▼  [NVIDIA NIM — Magpie TTS Multilingual or ZeroShot]
Voice Synthesis (WAV audio)
   │
   ▼  [NVIDIA NIM — Audio2Face-3D]
Avatar Animation (lip-sync + micro-expressions)
   │
   ▼  [FFmpeg (TODO) → Google Drive]
Final MP4 → Your Library
```

Languages supported: **Hinglish** · **Marathi** · **English** · **Hindi**

---

## Live Tech Stack

### Primary Stack
| Role | Provider | Model |
|---|---|---|
| **LLM (Script)** | NVIDIA NIM | `qwen/qwen2.5-72b-instruct` |
| **TTS (Voice)** | NVIDIA NIM | `magpie-tts-multilingual` |
| **Avatar** | NVIDIA NIM | `audio2face-3d` |

### Fallback Stack (auto-activates on 429 / 5xx)
| Role | Provider | Model |
|---|---|---|
| **LLM fallback** | NVIDIA NIM | `deepseek-ai/deepseek-r1` |
| **TTS fallback** | NVIDIA NIM | `magpie-tts-zeroshot` |
| **Avatar** | NVIDIA NIM | `audio2face-3d` (same) |

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 14 (Pages Router) | SSR/SSG framework |
| TypeScript | Type safety |
| Tailwind CSS | Utility-first styling |
| Material Design 3 tokens | Color system (CSS variables) |
| Space Grotesk + Inter | Typography |
| Material Symbols | Icon system |

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js SSR)                                   │
│  ┌──────────┐  ┌────────────┐  ┌───────────────────┐    │
│  │ / Library │  │ /create    │  │ /processing/[id]  │    │
│  │ (Static) │  │ (Static)   │  │ (SSR + SSE stream)│    │
│  └──────────┘  └────────────┘  └───────────────────┘    │
│         ↓              ↓                 ↑               │
│  POST /api/generate  (returns jobId)     │               │
│         ↓                     GET /api/progress/[jobId]  │
│  Background pipeline                     ↑ SSE           │
│  ┌──────────────────────────────────┐   │               │
│  │  runPipeline()                   │→──┘               │
│  │  ├─ generateScript()   [LLM]     │                   │
│  │  ├─ synthesiseSpeech() [TTS]     │                   │
│  │  └─ renderAvatar()    [Avatar]   │                   │
│  └──────────────────────────────────┘                   │
│         ↓                                               │
│  JobStore (in-memory) ←→ /api/progress SSE              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow
1. User fills prompt on `/create` → POST `/api/generate`
2. Server creates a `JobRecord`, responds with `{ jobId }` immediately
3. Background `runPipeline()` processes chapters in parallel
4. `/processing/[jobId]` opens an SSE connection to `/api/progress/[jobId]`
5. SSE emits `progress` events (every 1.5 s) and a final `done` event
6. On `done`, the UI auto-redirects to `/cinema/[videoId]`

---

## Directory Structure

```
Video Generation/
├── pages/
│   ├── index.tsx                # Library (video grid)
│   ├── create.tsx               # Creation Zone (form + avatar picker)
│   ├── 404.tsx                  # Custom 404 page
│   ├── _app.tsx                 # App wrapper
│   ├── _document.tsx            # HTML document (global fonts)
│   ├── _error.tsx               # Custom error page
│   ├── cinema/
│   │   └── [videoId].tsx        # Private screening room (SSR)
│   ├── processing/
│   │   └── [jobId].tsx          # Real-time generation progress (SSR + SSE)
│   └── api/
│       ├── generate.ts          # POST → starts NIM pipeline
│       ├── pool-status.ts       # GET  → key pool health + model names
│       ├── videos.ts            # GET  → library video list
│       ├── progress/
│       │   └── [jobId].ts       # GET  → SSE progress stream
│       └── video/
│           └── [videoId].ts     # GET  → video metadata
│
├── src/
│   ├── components/
│   │   └── AppLayout.tsx        # Shared sidebar + topnav layout
│   └── lib/
│       ├── nimKeyPool.ts        # Round-robin API key manager
│       ├── nimClient.ts         # NVIDIA NIM API client (LLM/TTS/Avatar)
│       └── jobStore.ts          # In-memory job state machine
│
├── styles/
│   └── globals.css              # MD3 CSS variables + global styles
├── tailwind.config.js           # MD3 color tokens + font config
├── next.config.js               # Image domains whitelist
├── .env.local                   # Secret keys (gitignored)
└── .env.local.example           # Template for new developers
```

---

## Environment Setup

### 1. Copy the environment template

```bash
cp .env.local.example .env.local
```

### 2. Configure NVIDIA API Keys

The app supports two env-var formats — both work simultaneously and are automatically deduplicated:

**Format A — Comma-separated list (recommended):**
```env
NVIDIA_NIM_API_KEYS="nvapi-key1,nvapi-key2,nvapi-key3"
```

**Format B — Individual numbered keys:**
```env
NVIDIA_API_KEY_1=nvapi-key1
NVIDIA_API_KEY_2=nvapi-key2
NVIDIA_API_KEY_3=nvapi-key3
```

> **Throughput:** Each key provides ~35 RPM. 3 keys = ~105 RPM. 5 keys = ~175 RPM.

### 3. Full `.env.local` reference

```env
# ── NVIDIA NIM API Keys ──────────────────────────────────────────────────────
NVIDIA_NIM_API_KEYS="nvapi-xxx,nvapi-yyy,nvapi-zzz"

# Optional individual format (also supported)
NVIDIA_API_KEY_1=nvapi-xxx
NVIDIA_API_KEY_2=nvapi-yyy
NVIDIA_API_KEY_3=nvapi-zzz

# ── NIM Base URL ─────────────────────────────────────────────────────────────
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

# ── Primary Model Stack ──────────────────────────────────────────────────────
NIM_LLM_PRIMARY=qwen/qwen2.5-72b-instruct
NIM_TTS_PRIMARY=magpie-tts-multilingual
NIM_AVATAR=audio2face-3d

# ── Fallback Model Stack ─────────────────────────────────────────────────────
NIM_LLM_FALLBACK=deepseek-ai/deepseek-r1
NIM_TTS_FALLBACK=magpie-tts-zeroshot

# ── Google Drive (Video Storage — optional) ──────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_KEY=   # base64-encoded service account JSON
GOOGLE_DRIVE_FOLDER_ID=       # target folder for video upload

# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start
```

### Verify API Key Pool on startup

When the dev server starts, check the terminal for:
```
[NIM KeyPool] Loaded 3 key(s). Estimated RPM: 105.
```

If you see a ⚠️ warning, your keys are missing or malformed.

### Live engine status

Visit `http://localhost:3000/api/pool-status` for a real-time JSON snapshot:
```json
{
  "pool": { "total": 3, "healthy": 3, "cooling": 0, "dead": 0, "rpm": 105 },
  "stack": {
    "primary":  { "llm": "qwen/qwen2.5-72b-instruct", "tts": "magpie-tts-multilingual", "avatar": "audio2face-3d" },
    "fallback": { "llm": "deepseek-ai/deepseek-r1",   "tts": "magpie-tts-zeroshot" }
  }
}
```

---

## API Routes Reference

### `POST /api/generate`
Initiates a video generation job.

**Request body:**
```json
{
  "prompt":   "How the stock market works in India",
  "language": "hinglish",
  "duration": 15,
  "avatar":   "ethan"
}
```

**Response (`200`):**
```json
{
  "jobId":         "job-1713267000000-abc1234",
  "totalChapters": 8,
  "estimatedSecs": 90,
  "models": { "llmPrimary": "qwen/qwen2.5-72b-instruct", "..." : "..." },
  "poolStatus": { "healthy": 3, "rpm": 105 }
}
```

**Error responses:**
| Code | Meaning |
|------|---------|
| `400` | Invalid prompt / language / duration / avatar |
| `503` | All API keys exhausted — retry in 60s |

---

### `GET /api/progress/[jobId]`
Server-Sent Events stream of generation progress.

**Event types:**

| Event | Payload |
|-------|---------|
| `connected` | `{ jobId, time }` |
| `progress` | `{ phase, overallProgress, chapters[], pool }` |
| `done` | `{ ...progress, videoId }` |
| `error` | `{ message }` |

**Chapter phases:** `QUEUED → SCRIPTING → SYNTHESISING → AVATAR → DONE / FAILED`

**Job phases:** `QUEUED → SCRIPTING → COMPOSITING → DONE / FAILED`

---

### `GET /api/pool-status`
Returns current key health and active model stack. Safe to poll.

---

### `GET /api/videos`
Returns mock video library data (to be replaced with Google Drive integration).

---

### `GET /api/video/[videoId]`
Returns metadata for a completed video. Looks up the job that produced it from the store.

---

## NVIDIA NIM Integration

### Endpoint Map

| Service | Endpoint | Notes |
|---------|----------|-------|
| LLM | `POST /chat/completions` | OpenAI-compatible schema |
| TTS | `POST /audio/speech` | Returns `audio/wav` binary |
| Avatar | `POST /audio2face/v1/a2f-requests` | REST preview API |

### LLM Request Schema
```json
{
  "model": "qwen/qwen2.5-72b-instruct",
  "messages": [
    { "role": "system", "content": "<language system prompt>" },
    { "role": "user",   "content": "<chapter script prompt>" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "response_format": { "type": "json_object" }
}
```
> ⚠️ `response_format: json_object` is **not** sent to `deepseek-r1` (fallback) — it doesn't support this mode via NIM. The fallback uses regex extraction instead.

### TTS Request Schema
```json
{
  "model": "magpie-tts-multilingual",
  "input": "<script text>",
  "voice": "hindi_female"
}
```

### Audio2Face-3D Request Schema
```json
{
  "model": "audio2face-3d",
  "audio": "<base64_wav>",
  "avatar_id": "ethan",
  "emotion": "engaged",
  "quality": "high"
}
```
> ⚠️ **Audio2Face-3D** is a streaming gRPC service. The REST shim endpoint (`/audio2face/v1/a2f-requests`) targets the NVIDIA NIM REST preview. **Verify the exact endpoint path against your NIM deployment** in the [NVIDIA API Catalog](https://build.nvidia.com/).

---

## Key Pool System

Located in `src/lib/nimKeyPool.ts`.

### States
```
HEALTHY  ──429──▶  COOLING ──(60s)──▶  HEALTHY
HEALTHY  ──5xx──▶  failures++ ──(×3)──▶  DEAD
```

### How it works

1. **Startup**: scans both `NVIDIA_NIM_API_KEYS` and `NVIDIA_API_KEY_1…10`, deduplicates, builds a pool
2. **acquireKey()**: returns the next HEALTHY key in monotonic round-robin order
3. **reportFailure(key, status)**:
   - `429` → COOLING for 60 s (failure counter reset, not incremented)
   - `5xx / 0` → failure++ ; if ≥3 → DEAD
4. **reportSuccess(key)**: resets failure counter; recovers COOLING keys
5. **poolStatus()**: triggers a cooldown-recovery sweep as a side-effect, then returns a health snapshot

### Cursor fix
The previous implementation reset `_cursor = _cursor % healthy.length` after each selection. When the healthy pool shrinks (e.g., one key goes COOLING), this could cause the cursor to jump and repeatedly select the same key. The fix: cursor is incremented **monotonically** and `% healthy.length` is only applied **at selection time**.

---

## Generation Pipeline

### Phase Timeline (per chapter)

```
Chapter N starts
  │
  ├─ 10% ─ SCRIPTING    → generateScript()   [Qwen 2.5 72B → DeepSeek-R1]
  ├─ 35% ─ SYNTHESISING → synthesiseSpeech() [Magpie TTS    → Magpie ZeroShot]
  ├─ 65% ─ AVATAR       → renderAvatar()     [Audio2Face-3D]
  └─ 100% ─ DONE
```

### Parallel Concurrency

Chapters are batched based on the number of healthy API keys:

```
concurrency = min(healthy_keys, total_chapters, 5)
```

For 3 keys and a 15-min video (8 chapters):
- Batch 1: chapters 0, 1, 2 fire simultaneously
- Batch 2: chapters 3, 4, 5 fire simultaneously
- Batch 3: chapters 6, 7 fire simultaneously

---

## Known Issues & Limitations

### 🔴 Critical

| Issue | Impact | Status |
|-------|--------|--------|
| **Fire-and-forget in serverless** | `runPipeline()` is called after `res.json()` in `/api/generate`. On Vercel (serverless), the function process may terminate before the pipeline completes. Works correctly in local dev (single persistent Node.js process). | Known — needs Vercel Queue / Railway worker |
| **In-memory JobStore** | `jobStore.ts` uses a `Map` in Node.js module memory. Each Vercel serverless invocation gets a fresh process, so jobs created in one invocation won't be visible in another. | Works locally. Needs Redis/PlanetScale in production. |
| **Audio2Face-3D REST endpoint** | The `/audio2face/v1/a2f-requests` endpoint path needs verification against the actual NIM deployment. The schema may differ from what's implemented. | Needs integration testing |

### 🟡 Medium

| Issue | Impact | Status |
|-------|--------|--------|
| **No Google Drive upload** | `/api/generate` simulates compositing with a 1.5 s delay. Videos are not actually stored anywhere. | Stub — needs FFmpeg + Drive resumable upload |
| **No authentication** | Any visitor can submit generation jobs and consume API credits. | Needs NextAuth.js or Clerk |
| **No persistent video library** | `/api/videos` returns mock data. Library doesn't show real generated videos. | Needs database (PlanetScale / Supabase) |
| **SSE in Vercel** | Long-running SSE connections hit Vercel's 30s response timeout. | Use Pusher / Ably for production real-time |

### 🟢 Low

| Issue | Impact | Status |
|-------|--------|--------|
| `AvatarPicker.tsx` uses `<img>` | LCP warning (no `next/image`) | Low priority |
| `ThumbnailGrid.tsx` uses `<img>` | LCP warning | Low priority |
| Font `display=block` warning | Slight CLS risk | Low priority |

---

## Bug Fix Log

All bugs found during audit and their resolutions:

### `nimKeyPool.ts`
| Bug | Fix |
|-----|-----|
| Only read `NVIDIA_API_KEY_N` format | Added `NVIDIA_NIM_API_KEYS` comma-separated parsing with deduplication |
| Cursor reset to `% healthy.length` caused repeated key selection when pool shrinks | Changed to monotonic increment; modulo applied only at **selection time** |
| `reportFailure(429)` incremented failure counter (could prematurely mark keys DEAD) | 429 now resets failure counter and puts key in COOLING instead |

### `nimClient.ts`
| Bug | Fix |
|-----|-----|
| `apiKey` declared as `let apiKey: string` but used in catch block before guaranteed assignment | Initialized to `''` — always safe |
| `fetchNim()` called `res.arrayBuffer()` unconditionally — JSON error bodies decoded to garbage | Now checks `Content-Type` before calling `arrayBuffer()` |
| Avatar endpoint `/video/avatar` does not exist in NIM | Updated to `/audio2face/v1/a2f-requests` per REST preview docs |
| TTS body included `response_format: 'wav'` — unsupported parameter | Removed; added `Accept: audio/wav` header instead |
| DeepSeek-R1 fallback received `response_format: json_object` request it can't handle | Primary only: Qwen sends `json_object`; DeepSeek receives plain text + regex extraction |
| Voice IDs used platform-specific names that don't match NIM's TTS voice IDs | Updated to `hindi_female`, `marathi_female`, `english_female`, `hindi_male` |

### `generate.ts`
| Bug | Fix |
|-----|-----|
| `parseInt(duration, 10)` called on a number (not a string) — returned `NaN` | Replaced with `Number(duration)` which handles both types |
| `concurrency = 0` when no keys available silently skipped all chapters | Added `Math.max(1, ...)` guard + 503 pre-check |
| Chapter phase jumped from `SCRIPTING` directly to `DONE`, skipping `SYNTHESISING` and `AVATAR` | Pipeline expanded to call steps individually with phase updates between each |

### `pages/processing/[jobId].tsx`
| Bug | Fix |
|-----|-----|
| `useEffect` missing `done` in dep array — stale closure in `onerror` handler | Added `doneRef` (mirrors `done` state) used in closure; suppressed with eslint comment |
| Build error: `PageNotFoundError` — Next.js tried to statically prerender dynamic route | Added `getServerSideProps()` to force SSR |

### `pages/cinema/[videoId].tsx`
| Bug | Fix |
|-----|-----|
| Same static prerender error as processing page | Added `getServerSideProps()` |

### `tailwind.config.js` / `globals.css`
| Bug | Fix |
|-----|-----|
| MD3 color tokens (`bg-background`, `text-on-surface`, etc.) compiled to nothing — no CSS variable definitions existed | Added full MD3 palette as CSS custom properties in `globals.css`; registered all tokens in `tailwind.config.js` |

---

## Deployment Guide

### Vercel (Recommended for frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Required environment variables** (set in Vercel Dashboard → Settings → Environment Variables):
- `NVIDIA_NIM_API_KEYS`
- `NIM_LLM_PRIMARY`, `NIM_TTS_PRIMARY`, `NIM_AVATAR`
- `NIM_LLM_FALLBACK`, `NIM_TTS_FALLBACK`

> ⚠️ **Production blocker**: The background pipeline (`runPipeline`) won't survive Vercel serverless timeouts. You must offload long-running jobs to a persistent service before deploying to production.

### Recommended Production Architecture

```
Vercel (Next.js frontend + API)
    │
    ├── POST /api/generate  → enqueues job to Vercel Queue / Railway
    │                              ↓
    │                      Worker process (Railway / Fly.io)
    │                      ├── nimClient.ts pipeline
    │                      └── Writes progress to Redis
    │
    ├── GET /api/progress/[jobId] → reads from Redis (replaces in-memory JobStore)
    │
    └── Pusher / Ably for real-time client events (replaces SSE)
```

---

## Roadmap

- [ ] **Google Drive upload** — FFmpeg pipe + resumable upload via service account
- [ ] **Persistent job store** — Replace `Map` with Redis (`ioredis`)
- [ ] **Auth** — NextAuth.js with Google OAuth
- [ ] **Background worker** — Railway-hosted Node.js worker consuming Vercel Queue
- [ ] **Real video library** — Database-backed video list with metadata
- [ ] **Pusher integration** — Replace SSE with Pusher Channels for production WebSocket
- [ ] **Chapter preview** — Show script text + key points per chapter on processing page
- [ ] **Download to device** — Signed Google Drive export link on cinema page
- [ ] **Multi-avatar blending** — Blend expressions across chapters for continuity
- [ ] **Subtitle burn-in** — Auto-generate SRT from TTS transcript and burn into video

---

## Contributing

```bash
# Clone
git clone <your-repo-url>
cd "Video Generation"

# Install
npm install

# Copy env
cp .env.local.example .env.local
# Fill in your NVIDIA_NIM_API_KEYS

# Dev
npm run dev
```

---

*Built with ❤️ using NVIDIA NIM · Next.js 14 · Tailwind CSS*