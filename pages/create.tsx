import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppLayout from '../src/components/AppLayout';

const AVATARS = [
  { id: 'ethan',  name: 'Ethan (Pro)',  gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)', initials: 'ET' },
  { id: 'maya',   name: 'Maya',         gradient: 'linear-gradient(135deg, #0e7490, #22d3ee)', initials: 'MA' },
  { id: 'kenji',  name: 'Kenji',        gradient: 'linear-gradient(135deg, #065f46, #34d399)', initials: 'KE' },
  { id: 'clara',  name: 'Clara',        gradient: 'linear-gradient(135deg, #9d174d, #f472b6)', initials: 'CL' },
  { id: 'arjun',  name: 'Arjun',        gradient: 'linear-gradient(135deg, #92400e, #fbbf24)', initials: 'AR' },
  { id: 'priya',  name: 'Priya',        gradient: 'linear-gradient(135deg, #5b21b6, #ec4899)', initials: 'PR' },
];

// ── Hybrid language × English modes ─────────────────────────────────────────
// Each entry is a code-mixed mode: regional language blended with English.
// The value key must match LANGUAGE_CONFIG keys in nimClient.ts.
const LANGUAGES = [
  { value: 'hinglish',  label: '🇮🇳 Hinglish   — Hindi + English',     badge: 'Popular' },
  { value: 'tanglish',  label: '🌊 Tanglish   — Tamil + English',      badge: '' },
  { value: 'tenglish',  label: '🔆 Tenglish   — Telugu + English',     badge: '' },
  { value: 'manglish',  label: '🌴 Manglish   — Malayalam + English',  badge: '' },
  { value: 'kanglish',  label: '⭐ Kanglish   — Kannada + English',    badge: '' },
  { value: 'benglish',  label: '🪔 Benglish   — Bengali + English',    badge: '' },
  { value: 'marathlish',label: '🪁 Marathlish — Marathi + English',    badge: '' },
  { value: 'gujlish',   label: '💫 Gujlish    — Gujarati + English',   badge: '' },
  { value: 'urdu',      label: '📜 Urdu-Eng   — Urdu + English',       badge: '' },
  { value: 'odia',      label: '🌸 Odia-Eng   — Odia + English',       badge: '' },
  { value: 'english',   label: '🇬🇧 English    — Pure English',          badge: '' },
];


export default function CreatePage() {
  const router = useRouter();

  const [prompt,    setPrompt]    = useState('');
  const [language,  setLanguage]  = useState('hinglish');
  const [duration,  setDuration]  = useState(15);
  const [avatar,    setAvatar]    = useState('ethan');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [poolData,  setPoolData]  = useState<{
    healthy: number; total: number; rpm: number;
    stack: { primary: { llm: string; tts: string }; fallback: { llm: string; tts: string } };
  } | null>(null);

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

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a topic prompt.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), language, duration, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      router.push(`/processing/${data.jobId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }, [prompt, language, duration, avatar, router]);

  const durationMarks = [5, 10, 15, 30, 45, 60];

  return (
    <AppLayout>
      <Head>
        <title>Creation Zone | Obsidian Lens</title>
        <meta name="description" content="Synthesize cinematic AI explainer videos from a single prompt." />
      </Head>

      <style jsx global>{`
        input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        input[type='range']::-webkit-slider-track {
          height: 4px;
          border-radius: 99px;
          background: rgba(45,47,69,0.9);
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #22d3ee);
          box-shadow: 0 0 12px rgba(124,58,237,0.6);
          margin-top: -7px;
        }
        input[type='range']::-moz-range-track {
          height: 4px;
          border-radius: 99px;
          background: rgba(45,47,69,0.9);
        }
        input[type='range']::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #7c3aed, #22d3ee);
          box-shadow: 0 0 12px rgba(124,58,237,0.6);
        }
        textarea:focus { outline: none; }
        select:focus   { outline: none; }
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
            Synthesize cinematic knowledge from a single prompt.
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
          <div className="mb-8">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary mb-3">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              AI Directive
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
              placeholder='What topic do you want to master today? e.g. "How the stock market works in India"'
              rows={3}
            />
            {error && (
              <p className="mt-2 text-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            )}
          </div>

          {/* Language + Duration row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Language selector */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-3">
                Language Mode
              </label>
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(45,47,69,0.7)', background: 'rgba(13,15,26,0.7)' }}
              >
                <div className="max-h-52 overflow-y-auto no-scrollbar">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLanguage(l.value)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-all"
                      style={
                        language === l.value
                          ? { background: 'rgba(124,58,237,0.2)', color: 'var(--color-primary)', fontWeight: 600 }
                          : { color: 'var(--color-on-surface-variant)' }
                      }
                    >
                      <span>{l.label}</span>
                      <span className="flex items-center gap-2">
                        {l.badge && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background:'rgba(34,211,238,0.15)', color:'#22d3ee' }}>
                            {l.badge}
                          </span>
                        )}
                        {language === l.value && (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Duration slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
                  Duration
                </label>
                <span className="text-secondary font-bold font-headline">
                  {duration}m <span className="text-xs font-normal opacity-60">EST.</span>
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between mt-2 px-0.5">
                {durationMarks.map(m => (
                  <span
                    key={m}
                    className={`text-[10px] font-medium ${m === duration ? 'text-secondary' : 'text-on-surface-variant'}`}
                  >
                    {m}m
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Avatar Picker */}
          <div className="mb-10">
            <label className="block text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-5">
              NVIDIA Audio2Face Persona
            </label>
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
              {AVATARS.map(av => {
                const selected = avatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatar(av.id)}
                    className="flex-none flex flex-col items-center group"
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
                        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ background: av.gradient }}
                      >
                        {av.initials}
                      </div>
                      {selected && (
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
          </div>

          {/* CTA Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
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
              <h4 className="font-bold mb-1 text-on-surface font-headline">Pro Tip: Granular Details</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                The engine performs 40% better when you specify the tone and audience. Try:{' '}
                <em className="text-primary">&quot;Explain GST to a small business owner in simple Hinglish&quot;</em>
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
              {/* Key pool */}
              <div>
                <div className="h-1.5 w-full rounded-full overflow-hidden mb-1" style={{ background:'rgba(45,47,69,0.7)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: poolData ? `${(poolData.healthy / Math.max(poolData.total, 1)) * 100}%` : '0%', background:'#22d3ee' }} />
                </div>
                <p className="text-xs text-on-surface-variant">
                  API Keys: <span className="text-cyan-400 font-bold">{poolData?.healthy ?? '…'}</span>/{poolData?.total ?? '…'} active · <span className="text-primary font-bold">{poolData?.rpm ?? '…'}</span> RPM
                </p>
              </div>
              {/* Primary LLM */}
              <div className="pt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">LLM</span>
                  <span className="text-[10px] font-mono text-primary truncate max-w-[140px]">{poolData?.stack.primary.llm ?? 'qwen/qwen2.5-72b'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">TTS</span>
                  <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[140px]">{poolData?.stack.primary.tts ?? 'magpie-tts-multilingual'}</span>
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