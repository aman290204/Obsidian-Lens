import { useState, useCallback, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppLayout from '../src/components/AppLayout';
import { playSampleAudio, stopSampleAudio, getSampleAudio } from '../src/lib/sampleAudio';

const AVATARS = [
  { id: 'ethan',  name: 'Ethan (Pro)',  gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)', initials: 'ET' },
  { id: 'maya',   name: 'Maya',         gradient: 'linear-gradient(135deg, #0e7490, #22d3ee)', initials: 'MA' },
  { id: 'kenji',  name: 'Kenji',        gradient: 'linear-gradient(135deg, #065f46, #34d399)', initials: 'KE' },
  { id: 'clara',  name: 'Clara',        gradient: 'linear-gradient(135deg, #9d174d, #f472b6)', initials: 'CL' },
  { id: 'arjun',  name: 'Arjun',        gradient: 'linear-gradient(135deg, #92400e, #fbbf24)', initials: 'AR' },
  { id: 'priya',  name: 'Priya',        gradient: 'linear-gradient(135deg, #5b21b6, #ec4899)', initials: 'PR' },
];

const LANGUAGES = [
  { value: 'hinglish',   label: '🇮🇳 Hinglish   — Hindi + English',    badge: 'Popular' },
  { value: 'tanglish',   label: '🌊 Tanglish   — Tamil + English',     badge: '' },
  { value: 'tenglish',   label: '🔆 Tenglish   — Telugu + English',    badge: '' },
  { value: 'manglish',   label: '🌴 Manglish   — Malayalam + English', badge: '' },
  { value: 'kanglish',   label: '⭐ Kanglish   — Kannada + English',   badge: '' },
  { value: 'benglish',   label: '🪔 Benglish   — Bengali + English',   badge: '' },
  { value: 'marathlish', label: '🪁 Marathlish — Marathi + English',   badge: '' },
  { value: 'gujlish',    label: '💫 Gujlish    — Gujarati + English',  badge: '' },
  { value: 'urdu',       label: '📜 Urdu-Eng   — Urdu + English',      badge: '' },
  { value: 'odia',       label: '🌸 Odia-Eng   — Odia + English',      badge: '' },
  { value: 'english',    label: '🇬🇧 English    — Pure English',         badge: '' },
];

const SLIDE_LANGUAGES = [
  { value: 'english',    label: '🇬🇧 English' },
  { value: 'hindi',      label: '🇮🇳 Hindi (हिन्दी)' },
  { value: 'tamil',      label: '🌊 Tamil (தமிழ்)' },
  { value: 'telugu',     label: '🔆 Telugu (తెలుగు)' },
  { value: 'malayalam',  label: '🌴 Malayalam (മലയാളം)' },
  { value: 'kannada',    label: '⭐ Kannada (ಕನ್ನಡ)' },
  { value: 'bengali',    label: '🪔 Bengali (বাংলা)' },
  { value: 'marathi',    label: '🪁 Marathi (मराठी)' },
  { value: 'gujarati',   label: '💫 Gujarati (ગુજરાતી)' },
  { value: 'urdu',       label: '📜 Urdu (اردو)' },
  { value: 'odia',       label: '🌸 Odia (ଓଡ଼ିଆ)' },
];

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md';
const MAX_FILE_MB = 20;

interface DocState {
  docId: string;
  fileName: string;
  wordCount: number;
  truncated: boolean;
  preview: string;
}

export default function CreatePage() {
  const router = useRouter();

  const [prompt,        setPrompt]        = useState('');
  const [language,      setLanguage]      = useState('hinglish');
  const [slideLanguage, setSlideLanguage] = useState('english');
  const [duration,      setDuration]      = useState(15);
  const [avatar,        setAvatar]        = useState('ethan');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [poolData,      setPoolData]      = useState<{
    healthy: number; total: number; rpm: number;
    stack: { primary: { llm: string; tts: string }; fallback: { llm: string; tts: string } };
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Document upload state
  const [docState,      setDocState]      = useState<DocState | null>(null);
  const [docUploading,  setDocUploading]  = useState(false);
  const [docError,      setDocError]      = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef  = useRef<HTMLDivElement>(null);

  // Poll pool status every 15s
  useEffect(() => {
    const fetchPool = () =>
      fetch('/api/pool-status')
        .then(r => r.json())
        .then(d => setPoolData({ healthy: d.pool.healthy, total: d.pool.total, rpm: d.pool.rpm, stack: d.stack }))
        .catch(() => {});
    fetchPool();
    const t = setInterval(fetchPool, 15_000);
    return () => clearInterval(t);
  }, []);

  // ── Document upload ──────────────────────────────────────────────────────────
  const uploadDoc = useCallback(async (file: File) => {
    setDocError('');
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setDocError(`File too large (max ${MAX_FILE_MB} MB)`);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext ?? '')) {
      setDocError('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
      return;
    }
    setDocUploading(true);
    try {
      const form = new FormData();
      form.append('doc', file);
      const res = await fetch('/api/upload-doc', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setDocState({ docId: data.docId, fileName: data.fileName, wordCount: data.wordCount, truncated: data.truncated, preview: data.preview });
    } catch (e: any) {
      setDocError(e.message || 'Upload failed');
    } finally {
      setDocUploading(false);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDoc(file);
  }, [uploadDoc]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) uploadDoc(file);
  }, [uploadDoc]);

  const removeDoc = useCallback(() => {
    setDocState(null);
    setDocError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() && !docState) {
      setError('Please enter a topic or attach a document.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || `Explain the content of the attached document`,
          language,
          slideLanguage,
          duration,
          avatar,
          docId: docState?.docId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      router.push(`/processing/${data.jobId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }, [prompt, language, slideLanguage, duration, avatar, docState, router]);

  const durationMarks = [5, 10, 15, 30, 45, 60];

  // Handle preview playback
  const playPreview = useCallback(async (persona: string, lang: string) => {
    if (isPlayingPreview) {
      stopSampleAudio();
      setIsPlayingPreview(false);
      return;
    }
    const success = await playSampleAudio(persona, lang);
    if (success) {
      setIsPlayingPreview(true);
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = setTimeout(() => {
        stopSampleAudio();
        setIsPlayingPreview(false);
      }, 4000);
    }
  }, [isPlayingPreview]);

  useEffect(() => {
    return () => {
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      stopSampleAudio();
    };
  }, []);

  const handleAvatarChange = useCallback((newAvatar: string) => {
    setAvatar(newAvatar);
    playPreview(newAvatar, language);
  }, [language, playPreview]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    playPreview(avatar, newLanguage);
  }, [avatar, playPreview]);

  return (
    <AppLayout>
      <Head>
        <title>Creation Zone | Obsidian Lens</title>
        <meta name="description" content="Synthesize cinematic AI explainer videos from a single prompt." />
      </Head>

      <style jsx global>{`
        input[type='range'] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type='range']::-webkit-slider-track {
          height: 6px;
          border-radius: 99px;
          background: linear-gradient(to right, #7c3aed var(--pct, 25%), rgba(45,47,69,0.9) var(--pct, 25%));
        }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #22d3ee); box-shadow: 0 0 14px rgba(124,58,237,0.7); margin-top: -7px; }
        input[type='range']::-moz-range-track { height: 6px; border-radius: 99px; background: rgba(45,47,69,0.9); }
        input[type='range']::-moz-range-progress { height: 6px; border-radius: 99px; background: linear-gradient(to right, #7c3aed, #22d3ee); }
        input[type='range']::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; border: none; background: linear-gradient(135deg, #7c3aed, #22d3ee); box-shadow: 0 0 14px rgba(124,58,237,0.7); }
        textarea:focus { outline: none; }
        select:focus   { outline: none; box-shadow: 0 0 0 2px rgba(124,58,237,0.4); }
        select option  { background: #0d0f1a; color: #e2e8f0; }
        .drop-active { border-color: rgba(124,58,237,0.6) !important; background: rgba(124,58,237,0.08) !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Ambient glows */}
      <div className="fixed top-20 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background:'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-0 left-64 w-80 h-80 rounded-full pointer-events-none" style={{ background:'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)' }} />

      <div className="max-w-4xl mx-auto px-8 py-10 relative z-10">
        <header className="mb-10">
          <h1 className="text-5xl font-bold tracking-tighter mb-3 text-on-surface font-headline">
            Creation Zone
          </h1>
          <p className="text-on-surface-variant text-lg">
            Synthesize cinematic knowledge from a single prompt — or attach a document.
          </p>
        </header>

        {/* Main glassmorphic card */}
        <div
          className="rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(19,21,32,0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(45,47,69,0.8)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Prompt input */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary mb-3">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              {docState ? 'Additional Focus (optional)' : 'AI Directive'}
            </label>
            <textarea
              value={prompt}
              onChange={e => { setPrompt(e.target.value); setError(''); }}
              className="w-full rounded-2xl p-5 text-lg text-on-surface placeholder:text-on-surface-variant/40 resize-none transition-all leading-relaxed"
              style={{
                background: 'rgba(13,15,26,0.7)',
                border: error ? '1px solid rgba(248,113,113,0.6)' : '1px solid rgba(45,47,69,0.7)',
                minHeight: '110px',
              }}
              placeholder={docState
                ? 'Optional: tell the AI what aspect of the document to focus on…'
                : 'What topic do you want to master today? e.g. "How the stock market works in India"'}
              rows={3}
            />
            {error && (
              <p className="mt-2 text-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            )}
          </div>

          {/* ── Document Upload Zone ─────────────────────────────────────────── */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-3">
              <span className="material-symbols-outlined text-base">attach_file</span>
              Source Document
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background:'rgba(34,211,238,0.12)', color:'#22d3ee' }}>
                PDF · DOCX · TXT
              </span>
              <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background:'rgba(52,211,153,0.1)', color:'#6ee7b7' }}>
                Optional
              </span>
            </label>

            {docState ? (
              /* Uploaded state */
              <div
                className="rounded-2xl p-4 flex items-start gap-4"
                style={{ background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.25)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(52,211,153,0.12)' }}>
                  <span className="material-symbols-outlined text-emerald-400">description</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-emerald-400 truncate">{docState.fileName}</p>
                    <button onClick={removeDoc} className="text-on-surface-variant hover:text-error transition-colors flex-shrink-0" aria-label="Remove document">
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {docState.wordCount.toLocaleString()} words
                    {docState.truncated && <span className="ml-1 text-amber-400"> · truncated to 12,000 words</span>}
                  </p>
                  <p className="text-xs text-on-surface-variant/60 mt-2 italic line-clamp-2">{docState.preview}</p>
                </div>
              </div>
            ) : (
              /* Drop zone */
              <div
                ref={dropZoneRef}
                onDragOver={e => { e.preventDefault(); dropZoneRef.current?.classList.add('drop-active'); }}
                onDragLeave={() => dropZoneRef.current?.classList.remove('drop-active')}
                onDrop={e => { dropZoneRef.current?.classList.remove('drop-active'); handleDrop(e); }}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
                style={{ border:'1px dashed rgba(45,47,69,0.8)', background:'rgba(13,15,26,0.4)', minHeight:'90px' }}
              >
                {docUploading ? (
                  <>
                    <span className="material-symbols-outlined text-3xl text-primary animate-spin">refresh</span>
                    <p className="text-sm text-on-surface-variant">Extracting text…</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">cloud_upload</span>
                    <p className="text-sm text-on-surface-variant">
                      <span className="text-primary font-semibold">Click to upload</span> or drag & drop
                    </p>
                    <p className="text-xs text-on-surface-variant/50">PDF, DOCX, TXT, MD — max 20 MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileInput}
              className="hidden"
              id="doc-upload-input"
            />
            {docError && (
              <p className="mt-2 text-xs text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error</span>
                {docError}
              </p>
            )}
          </div>

          {/* ── Language + Slide Language + Duration ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Narration language */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-3">
                Narration Language
              </label>
              <select
                id="narration-language"
                value={language}
                onChange={e => handleLanguageChange(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-on-surface appearance-none cursor-pointer transition-all"
                style={{
                  background: 'rgba(13,15,26,0.85)',
                  border: '1px solid rgba(45,47,69,0.8)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%237c3aed'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px',
                  color: 'var(--color-on-surface)',
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}{l.badge ? ' ★' : ''}</option>
                ))}
              </select>
            </div>

            {/* Slide language */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-3">
                Slide Language
                <span className="ml-2 normal-case font-normal opacity-50 text-[10px]">on-screen text</span>
              </label>
              <select
                id="slide-language"
                value={slideLanguage}
                onChange={e => setSlideLanguage(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-on-surface appearance-none cursor-pointer transition-all"
                style={{
                  background: 'rgba(13,15,26,0.85)',
                  border: '1px solid rgba(45,47,69,0.8)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%2322d3ee'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px',
                  color: 'var(--color-on-surface)',
                }}
              >
                {SLIDE_LANGUAGES.map(sl => (
                  <option key={sl.value} value={sl.value}>{sl.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
                  Duration
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={duration}
                    onChange={e => setDuration(Math.min(60, Math.max(1, Number(e.target.value))))}
                    className="w-14 text-center text-sm font-bold rounded-lg py-1 text-secondary font-headline"
                    style={{ background:'rgba(13,15,26,0.8)', border:'1px solid rgba(45,47,69,0.7)', outline:'none' }}
                  />
                  <span className="text-xs font-normal text-on-surface-variant opacity-60">min</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                style={{
                  '--pct': `${((duration - 1) / 59) * 100}%`,
                } as React.CSSProperties}
                className="w-full"
              />
              <div className="flex justify-between mt-2 px-0.5">
                {durationMarks.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={`text-[10px] font-medium transition-colors ${m === duration ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Avatar Picker */}
          <div className="mb-10">
            <label className="block text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-5">
              AI Presenter Voice
            </label>
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
              {AVATARS.map(av => {
                const selected = avatar === av.id;
                const isPreviewActive = isPlayingPreview && avatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => handleAvatarChange(av.id)}
                    className="flex-none flex flex-col items-center group relative"
                  >
                    <div
                      className="relative w-20 h-20 rounded-full p-0.5 transition-all duration-200"
                      style={{
                        border: selected ? '2px solid #22d3ee' : '2px solid transparent',
                        background: selected ? 'linear-gradient(#0d0f1a, #0d0f1a) padding-box, linear-gradient(135deg, #7c3aed, #22d3ee) border-box' : 'transparent',
                        transform: selected ? 'scale(1.08)' : 'scale(1)',
                        boxShadow: selected ? '0 0 20px rgba(34,211,238,0.3)' : 'none',
                      }}
                    >
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-lg relative"
                        style={{ background: av.gradient }}
                      >
                        {av.initials}
                        {isPreviewActive && (
                          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 animate-pulse">
                            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings:"'FILL' 1" }}>volume_up</span>
                          </div>
                        )}
                      </div>
                      {selected && !isPreviewActive && (
                        <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background:'rgba(34,211,238,0.2)' }}>
                          <span className="material-symbols-outlined text-cyan-400 text-lg" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-center text-xs mt-2 font-medium transition-colors ${selected ? 'text-cyan-400' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                      {av.name}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-on-surface-variant/50">
              Click an avatar to hear a voice preview in the selected language.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            id="synthesis-btn"
            className="w-full py-5 rounded-2xl font-headline font-bold text-2xl tracking-tight text-white flex items-center justify-center gap-4 group transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? 'rgba(124,58,237,0.5)'
                : 'linear-gradient(to right, #7c3aed, #22d3ee)',
              boxShadow: loading ? 'none' : '0 8px 40px rgba(124,58,237,0.4)',
            }}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-3xl animate-spin">refresh</span>
                Initiating Synthesis…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">bolt</span>
                INITIATE SYNTHESIS
                <span className="material-symbols-outlined text-3xl opacity-60">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-12 gap-6 mt-8">
          <div
            className="col-span-12 md:col-span-7 rounded-2xl p-6 flex gap-5 items-start"
            style={{ background:'rgba(19,21,32,0.7)', border:'1px solid rgba(45,47,69,0.5)' }}
          >
            <div className="p-3 rounded-xl flex-shrink-0" style={{ background:'rgba(244,114,182,0.1)' }}>
              <span className="material-symbols-outlined text-tertiary">tips_and_updates</span>
            </div>
            <div>
              <h4 className="font-bold mb-1 text-on-surface font-headline">Pro Tip: Use a Document</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Attach your research paper, textbook chapter, or notes — the AI will generate the entire video from your content, grounded in your material with no hallucinations.
              </p>
            </div>
          </div>
          <div
            className="col-span-12 md:col-span-5 rounded-2xl p-6"
            style={{ background:'rgba(19,21,32,0.7)', border:'1px solid rgba(45,47,69,0.5)' }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-primary tracking-widest uppercase">Engine Status</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: poolData ? (poolData.healthy > 0 ? '#34d399' : '#f87171') : '#fbbf24',
                  boxShadow:  poolData ? (poolData.healthy > 0 ? '0 0 8px rgba(52,211,153,0.8)' : '0 0 8px rgba(248,113,113,0.8)') : '0 0 8px rgba(251,191,36,0.8)',
                  animation: 'pulse 2s infinite',
                }}
              />
            </div>
            <div className="space-y-3">
              <div>
                <div className="h-1.5 w-full rounded-full overflow-hidden mb-1" style={{ background:'rgba(45,47,69,0.7)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: poolData ? `${(poolData.healthy / Math.max(poolData.total, 1)) * 100}%` : '0%', background:'#22d3ee' }} />
                </div>
                <p className="text-xs text-on-surface-variant">
                  API Keys: <span className="text-cyan-400 font-bold">{poolData?.healthy ?? '…'}</span>/{poolData?.total ?? '…'} active · <span className="text-primary font-bold">{poolData?.rpm ?? '…'}</span> RPM
                </p>
              </div>
              <div className="pt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">LLM</span>
                  <span className="text-[10px] font-mono text-primary truncate max-w-[140px]">{poolData?.stack.primary.llm ?? 'qwen/qwen3.5'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">TTS</span>
                  <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[140px]">{poolData?.stack.primary.tts ?? 'magpie-tts'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Avatar</span>
                  <span className="text-[10px] font-mono text-tertiary truncate max-w-[140px]">audio2face-3d</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}