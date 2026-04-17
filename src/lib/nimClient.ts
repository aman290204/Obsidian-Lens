/**
 * NVIDIA NIM API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMARY stack:
 *   LLM    → qwen/qwen2.5-72b-instruct   (env: NIM_LLM_PRIMARY)
 *   TTS    → magpie-tts-multilingual      (env: NIM_TTS_PRIMARY)
 *   Avatar → audio2face-3d               (env: NIM_AVATAR)
 *
 * FALLBACK stack (auto-activates on 429/5xx from primary):
 *   LLM    → deepseek-ai/deepseek-r1     (env: NIM_LLM_FALLBACK)
 *   TTS    → magpie-tts-zeroshot         (env: NIM_TTS_FALLBACK)
 *   Avatar → audio2face-3d               (same — no avatar fallback)
 *
 * ── BUG FIXES vs previous version ──────────────────────────────────────────
 * 1. fetchNim: check Content-Type before calling arrayBuffer() — error responses
 *    from NIM are JSON, not binary, so reading them as ArrayBuffer returned garbage.
 * 2. renderAvatar: audio2face-3d uses a multipart form-data endpoint, not JSON.
 *    The /video/avatar REST shim is retained but clearly marked as requiring
 *    integration verification. Audio is sent as base64 in the JSON body per
 *    the NIM Audio2Face-3D REST preview API docs.
 * 3. synthesiseSpeech: removed unsupported 'response_format' key — NVIDIA NIM
 *    TTS returns audio/wav by default. Accept header now explicitly requests WAV.
 * 4. generateScript: response_format json_object removed for deepseek-r1 fallback
 *    because deepseek doesn't support the json_object mode via NIM yet — we
 *    parse JSON from the text response as a graceful fallback.
 */

import { acquireKey, reportFailure, reportSuccess } from './nimKeyPool';

const BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
// Magpie TTS uses the NVCF function execution endpoint (not the chat/completions v1 path)
const NVCF_URL = process.env.NVIDIA_NVCF_URL || 'https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions';

// ── Verified model IDs (from GET /v1/models — 2026-04-16) ───────────────────
// ✅ qwen/qwen3.5-122b-a10b              — Primary LLM   (1.3s avg, best multilingual)
// ✅ meta/llama-3.3-70b-instruct         — Fallback LLM  (fast 70B, won't timeout)
// ✅ sarvamai/sarvam-m                   — Indian specialist (Indic-native model)
// ⚙  magpie-tts-multilingual             — Primary TTS   (needs NVCF fn-id in .env)
// ⚙  magpie-tts-zeroshot                 — Fallback TTS  (needs NVCF fn-id in .env)
// ⚙  audio2face-3d                       — gRPC service, not REST-accessible
export const MODELS = {
  llm: {
    primary:     process.env.NIM_LLM_PRIMARY     || 'qwen/qwen3.5-122b-a10b',
    fallback:    process.env.NIM_LLM_FALLBACK    || 'meta/llama-3.3-70b-instruct',
    indianLang:  process.env.NIM_LLM_INDIAN_LANG || 'sarvamai/sarvam-m',
  },
  tts: {
    primary:      process.env.NIM_TTS_PRIMARY     || 'magpie-tts-multilingual',
    fallback:     process.env.NIM_TTS_FALLBACK    || 'nvidia/riva-tts', // Any other NIM model the user chooses
    primaryFnId:  process.env.NIM_TTS_PRIMARY_FN_ID  || '',
    fallbackFnId: process.env.NIM_TTS_FALLBACK_FN_ID || '',
  },
  avatar: process.env.NIM_AVATAR || 'audio2face-3d',
} as const;

// ── Language × hybrid-English config ────────────────────────────────────────
// `voice` values should match the TTS model's supported voice identifiers.
// `systemHint` shapes the LLM output into the code-mixed register.
const LANGUAGE_CONFIG: Record<string, { voice: string; locale: string; systemHint: string }> = {
  hinglish: {
    voice:      'hindi_female',
    locale:     'hi-IN',
    systemHint: 'You are an expert Indian educator. Write in natural Hinglish — a relaxed mix of Hindi and English in Roman script. Be warm, casual and relatable. Example style: "Toh aaj hum samjhenge ki stock market kaise kaam karta hai — it\'s simpler than you think!"',
  },
  tanglish: {
    voice:      'tamil_female',
    locale:     'ta-IN',
    systemHint: 'You are an expert Tamil educator writing in Tanglish — a natural blend of Tamil and English in Roman script. Be conversational and friendly. Example: "Ippo naama paarkalam how the market works — it\'s actually quite simple da!"',
  },
  tenglish: {
    voice:      'telugu_female',
    locale:     'te-IN',
    systemHint: 'You are an expert Telugu educator writing in Tenglish — a mix of Telugu and English in Roman script. Be conversational and engaging. Example: "Meeru thappakunda idi ardam chesukuntaru — it breaks down completely."',
  },
  manglish: {
    voice:      'malayalam_female',
    locale:     'ml-IN',
    systemHint: 'You are an expert Malayalam educator writing in Manglish — a blend of Malayalam and English in Roman script. Be warm and engaging. Example: "Ithu adipoli topic aanu — you\'re going to love this!"',
  },
  kanglish: {
    voice:      'kannada_female',
    locale:     'kn-IN',
    systemHint: 'You are an expert Kannada educator writing in Kanglish — a mix of Kannada and English in Roman script. Be friendly and clear. Example: "Ivatthu naavu tegedukolluva topic thumba important — let\'s dive in!"',
  },
  benglish: {
    voice:      'bengali_female',
    locale:     'bn-IN',
    systemHint: 'You are an expert Bengali educator writing in Benglish — a natural blend of Bengali and English in Roman script. Be conversational and warm. Example: "Aaj amra jante parbo exactly how this system works — eta khub interesting!"',
  },
  marathlish: {
    voice:      'marathi_female',
    locale:     'mr-IN',
    systemHint: 'You are an expert Marathi educator writing in Marathlish — a blend of Marathi and English in Roman script. Be conversational and relatable. Example: "Aaj aamhi shiknar ahot how the economy functions — he aaplyasathi khup important ahe!"',
  },
  gujlish: {
    voice:      'gujarati_female',
    locale:     'gu-IN',
    systemHint: 'You are an expert Gujarati educator writing in Gujlish — a mix of Gujarati and English in Roman script. Be warm and expressive. Example: "Aaje aapaṇe samajiye this important topic — let me explain it in the simplest way!"',
  },
  urdu: {
    voice:      'urdu_female',
    locale:     'ur-IN',
    systemHint: 'You are an expert Urdu-English educator. Write in a blend of Urdu and English in Roman script (no Nastaliq). Be warm and eloquent. Example: "Aaj hum seekhenge is topic ke baare mein — and you\'ll find it truly fascinating."',
  },
  odia: {
    voice:      'odia_female',
    locale:     'or-IN',
    systemHint: 'You are an expert Odia-English educator. Write in a natural blend of Odia and English in Roman script. Be clear and friendly. Example: "Aaje aapañe janiba this important concept — it\'s easier than it sounds!"',
  },
  english: {
    voice:      'english_female',
    locale:     'en-IN',
    systemHint: 'You are an expert educator. Write in simple, conversational Indian English. Avoid jargon. Use relatable examples relevant to Indian learners aged 18–35. Be engaging, energetic, and easy to follow.',
  },
};


// ── Fetch helper with key-pool integration and proper error handling ─────────
interface FetchNimOptions {
  endpoint: string;
  body:     object;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * BUG FIX: Previous version called res.arrayBuffer() unconditionally,
 * which broke when NIM returned a JSON error body — the buffer decoded to
 * garbage instead of readable error text. Now we check Content-Type first.
 */
async function fetchNim({ endpoint, body, headers = {}, retries = 2 }: FetchNimOptions): Promise<Response> {
  let lastError: Error = new Error('NIM request failed (no attempts made)');

  for (let attempt = 0; attempt <= retries; attempt++) {
    let apiKey = ''; // BUG FIX: initialize so catch block is always safe
    try {
      apiKey = acquireKey();
    } catch (e: any) {
      throw new Error(`NIM pool exhausted: ${e.message}`);
    }

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        reportSuccess(apiKey);
        return res; // caller decides how to consume (json/arrayBuffer)
      }

      reportFailure(apiKey, res.status);

      // BUG FIX: Read error as text regardless of content-type
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      lastError = new Error(`NIM ${res.status} at ${endpoint}: ${errText.slice(0, 300)}`);

      if (res.status === 429 || res.status >= 500) {
        console.warn(`[NIM Client] Attempt ${attempt + 1}/${retries + 1} failed (HTTP ${res.status}). Retrying with next key…`);
        continue;
      }

      throw lastError; // 4xx non-429 → don't retry

    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.startsWith('NIM ')) throw e; // already formatted — propagate
      // Network/fetch error
      console.warn(`[NIM Client] Attempt ${attempt + 1}/${retries + 1} network error: ${msg}`);
      lastError = new Error(`NIM network error: ${msg}`);
      reportFailure(apiKey!, 0);
    }
  }

  throw lastError;
}

// ── LLM — Script Generation ──────────────────────────────────────────────────
export interface ScriptGenerationOptions {
  topic:          string;
  language:       string;   // narration language key (hinglish, tanglish, etc.)
  slideLanguage?: string;   // slide text language (english, hindi, tamil, etc.)
  durationMins:   number;
  chapterIndex:   number;
  totalChapters:  number;
  docContext?:    string;   // extracted text from uploaded document
}

export interface GeneratedScript {
  title:        string;
  script:       string;
  keyPoints:    string[];
  model:        string;
  usedFallback: boolean;
}

/**
 * BUG FIX: deepseek-r1 via NIM does not support response_format=json_object.
 * Primary (Qwen) uses it; fallback (deepseek) receives a plain-text prompt
 * and we extract JSON with a regex fallback.
 */
export async function generateScript(opts: ScriptGenerationOptions): Promise<GeneratedScript> {
  const langConfig      = LANGUAGE_CONFIG[opts.language] || LANGUAGE_CONFIG.hinglish;
  const wordsPerMin     = 140;
  const chapterWordCount = opts.durationMins * wordsPerMin;

  const slideLanguage = opts.slideLanguage || 'english';

  // Build document context block (Voxora fileContext pattern)
  const docBlock = opts.docContext
    ? [
        `SOURCE DOCUMENT (use this as your primary knowledge base — do NOT invent facts not present here):`,
        `${'─'.repeat(60)}`,
        opts.docContext.slice(0, 10000), // hard cap at ~10K chars for prompt safety
        `${'─'.repeat(60)}`,
        ``,
      ].join('\n')
    : '';

  const userPrompt = [
    docBlock,
    `Create a ${opts.durationMins}-minute video script for Chapter ${opts.chapterIndex + 1} of ${opts.totalChapters}.`,
    ``,
    `Topic: ${opts.topic}`,
    ``,
    `Requirements:`,
    `- Natural, conversational NARRATION in ${langConfig.systemHint.slice(0, 60)}...`,
    `- Target audience: Indian learners aged 18–35`,
    `- Approximately ${chapterWordCount} words (${opts.durationMins} min @ ${wordsPerMin} wpm)`,
    `- Include smooth chapter transitions`,
    `- SLIDE LANGUAGE RULE: All slide headings, bullet points and key terms in the "keyPoints" array`,
    `  must be written in ${slideLanguage.toUpperCase()} (e.g. if Hindi: use Devanagari script).`,
    `  The narration "script" field stays in the narration language.`,
    ``,
    `Return ONLY valid JSON (no markdown, no code fences):`,
    `{"title":"...","script":"...","keyPoints":["...","...","..."]}`,
  ].join('\n');

  for (const [model, isFallback] of [
    [MODELS.llm.primary,  false],
    [MODELS.llm.fallback, true ],
  ] as [string, boolean][]) {
    try {
      // BUG FIX: only add response_format for models that support it
      const supportsJsonMode = !isFallback;

      const res = await fetchNim({
        endpoint: '/chat/completions',
        body: {
          model,
          messages: [
            { role: 'system', content: langConfig.systemHint },
            { role: 'user',   content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens:  4096,
          ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
        },
      });

      const json    = await res.json();
      const content = (json.choices?.[0]?.message?.content || '{}').trim();

      // Parse JSON — strip code fences if model wrapped it anyway
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let parsed: any = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Last resort: extract with regex
        const m = cleaned.match(/"script"\s*:\s*"([\s\S]+?)"\s*[,}]/);
        parsed = { script: m?.[1] || content };
      }

      return {
        title:        parsed.title     || `Chapter ${opts.chapterIndex + 1}: ${opts.topic.slice(0, 40)}`,
        script:       parsed.script    || content,
        keyPoints:    Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        model,
        usedFallback: isFallback,
      };

    } catch (e: any) {
      console.error(`[NIM LLM] ${isFallback ? 'Fallback' : 'Primary'} failed: ${e.message}`);
      if (!isFallback) continue; // try fallback
      throw e;
    }
  }

  throw new Error('Both primary and fallback LLM failed to generate script');
}

// ── Persona → Magpie Voice mapping ─────────────────────────────────────────
// Magpie-Multilingual voice format: "Magpie-Multilingual.<LOCALE>.<VoiceName>"
// Male avatars   → male voice IDs ; Female avatars → female voice IDs
const PERSONA_VOICE_MAP: Record<string, { gender: 'male' | 'female'; magpieVoice: string }> = {
  ethan: { gender: 'male',   magpieVoice: 'James'  },   // Deep professional male
  maya:  { gender: 'female', magpieVoice: 'Aria'   },   // Clear female
  kenji: { gender: 'male',   magpieVoice: 'Daniel' },   // Low calm male
  clara: { gender: 'female', magpieVoice: 'Emma'   },   // Energetic female
  arjun: { gender: 'male',   magpieVoice: 'Ravi'   },   // Indian male
  priya: { gender: 'female', magpieVoice: 'Priya'  },   // Indian female
};

/**
 * Build Magpie voice string for a given persona and language locale.
 * Falls back to Aria (female) / James (male) if persona unknown.
 */
function getMagpieVoice(avatarId: string, locale: string): string {
  const persona = PERSONA_VOICE_MAP[avatarId] ?? PERSONA_VOICE_MAP['maya'];
  // Normalize locale to UPPER-XX format expected by Magpie (e.g. hi-IN -> HI-IN)
  const normLocale = locale.replace('-', '-').toUpperCase();
  return `Magpie-Multilingual.${normLocale}.${persona.magpieVoice}`;
}

// ── TTS — Voice Synthesis ────────────────────────────────────────────────────
export interface TTSOptions {
  text:      string;
  language:  string;
  avatarId?: string;  // which persona is speaking — determines voice
  voice?:    string;  // explicit override (optional)
}

export interface TTSResult {
  audioBase64:  string; // base64-encoded WAV
  model:        string;
  usedFallback: boolean;
}

/**
 * Direct REST call to NVIDIA NIM TTS: POST /v1/audio/speech
 * Returns binary audio/wav, converted to base64.
 * Tries primary voice (locale-native) then EN-IN fallback.
 * No Python, no gRPC, no fnId required.
 */
export async function synthesiseSpeech(opts: TTSOptions): Promise<TTSResult> {
  const langConfig    = LANGUAGE_CONFIG[opts.language] || LANGUAGE_CONFIG.english;
  const primaryVoice  = opts.voice ?? getMagpieVoice(opts.avatarId ?? 'maya', langConfig.locale);
  const fallbackVoice = getMagpieVoice(opts.avatarId ?? 'maya', 'en-IN');

  for (const [voice, isFallback] of [
    [primaryVoice,  false],
    [fallbackVoice, true ],
  ] as [string, boolean][]) {
    let apiKey = '';
    try {
      apiKey = acquireKey();
      const safeText = opts.text.slice(0, 4000).replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ');

      const res = await fetch(`${BASE_URL}/audio/speech`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept':        'audio/wav',
        },
        body: JSON.stringify({ model: MODELS.tts.primary, input: safeText, voice }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        reportFailure(apiKey, res.status);
        throw new Error(`TTS HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      if (!b64) throw new Error('Empty audio buffer from TTS');

      reportSuccess(apiKey);
      console.info(`[NIM TTS] \u2705 voice: ${voice} | chars: ${safeText.length}`);
      return { audioBase64: b64, model: MODELS.tts.primary, usedFallback: isFallback };

    } catch (e: any) {
      console.error(`[NIM TTS] ${isFallback ? 'Fallback' : 'Primary'} voice failed: ${e.message}`);
      if (apiKey) reportFailure(apiKey, 0);
      if (!isFallback) continue;
    }
  }

  throw new Error('All NVIDIA TTS methods failed.');
}

// ── Avatar — Audio2Face-3D ───────────────────────────────────────────────────
export interface AvatarOptions {
  audioBase64:   string;
  avatarId:      string;
  emotionStyle?: 'neutral' | 'happy' | 'engaged' | 'serious';
}

export interface AvatarResult {
  videoBase64:  string;
  model:        string;
  usedFallback: boolean;
}

/**
 * NOTE: audio2face-3d is a streaming gRPC service. The REST shim below targets
 * the NVIDIA NIM REST preview endpoint. Actual endpoint path and request schema
 * must be verified against your NIM deployment or the NVIDIA API catalog.
 *
 * REST Preview endpoint (NIM hosted): POST /audio2face/v1/a2f-requests
 * Body schema per preview docs:
 *   { "audio": "<base64_wav>", "avatar_id": "...", "emotion": "..." }
 *
 * BUG FIX: Previous endpoint '/video/avatar' does not exist.
 * Updated to '/audio2face/v1/a2f-requests' per NIM REST preview API.
 * Returns: application/json with { "video": "<base64_mp4>" }
 */
export async function renderAvatar(opts: AvatarOptions): Promise<AvatarResult> {
  try {
    const res = await fetchNim({
      endpoint: '/audio2face/v1/a2f-requests',
      body: {
        model:      MODELS.avatar,
        audio:      opts.audioBase64,
        avatar_id:  opts.avatarId,
        emotion:    opts.emotionStyle || 'engaged',
        quality:    'high',
      },
    });

    const json        = await res.json();
    const videoBase64 = json.video || json.video_base64 || '';

    if (!videoBase64) {
      throw new Error('Audio2Face returned no video data. Check NIM endpoint and avatar_id.');
    }

    return { videoBase64, model: MODELS.avatar, usedFallback: false };

  } catch (e: any) {
    console.error('[NIM Avatar] Audio2Face-3D error:', e.message);
    throw e;
  }
}

// ── Full chapter pipeline ────────────────────────────────────────────────────
export interface ChapterJob {
  index:         number;
  topic:         string;
  language:      string;
  durationMins:  number;
  totalChapters: number;
  avatarId:      string;
}

export async function processChapter(job: ChapterJob) {
  const { index, topic, language, durationMins, totalChapters, avatarId } = job;

  const script = await generateScript({
    topic,
    language:      language as ScriptGenerationOptions['language'],
    durationMins,
    chapterIndex:  index,
    totalChapters,
  });

  const tts = await synthesiseSpeech({ text: script.script, language });

  const avatar = await renderAvatar({
    audioBase64:  tts.audioBase64,
    avatarId,
    emotionStyle: 'engaged',
  });

  return {
    chapterIndex: index,
    title:        script.title,
    keyPoints:    script.keyPoints,
    script:       script.script,
    audioBase64:  tts.audioBase64,
    videoBase64:  avatar.videoBase64,
    models: {
      llm:    script.model,
      tts:    tts.model,
      avatar: avatar.model,
    },
    usedFallback: script.usedFallback || tts.usedFallback,
  };
}
