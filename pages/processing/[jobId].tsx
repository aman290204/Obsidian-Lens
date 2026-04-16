import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AppLayout from '../../src/components/AppLayout';

// ── Types mirrored from jobStore ─────────────────────────────────────────────
type JobPhase = 'QUEUED' | 'SCRIPTING' | 'SYNTHESISING' | 'AVATAR' | 'COMPOSITING' | 'DONE' | 'FAILED';

interface ChapterStatus {
  index:    number;
  phase:    JobPhase;
  title?:   string;
  progress: number;
}

interface ProgressEvent {
  jobId:           string;
  phase:           JobPhase;
  overallProgress: number;
  chapters:        ChapterStatus[];
  models: {
    llm:    string;
    tts:    string;
    avatar: string;
    usedFallback: boolean;
  };
  pool: {
    healthy: number;
    total:   number;
    rpm:     number;
    cooling: number;
  };
}

// ── Fun facts ────────────────────────────────────────────────────────────────
const FUN_FACTS = [
  {
    title: 'Primary LLM: Qwen 2.5 72B',
    body:  'Our primary script engine uses Qwen 2.5-72B Instruct — a 72-billion parameter model optimised for multilingual, conversational content generation.',
  },
  {
    title: 'Fallback: DeepSeek R1',
    body:  'If the primary LLM hits rate limits, we automatically switch to DeepSeek-R1 with no interruption to your generation.',
  },
  {
    title: 'Magpie Multilingual TTS',
    body:  'magpie-tts-multilingual natively supports Hinglish, Marathi, and Indian English — no post-processing needed for code-mixed speech.',
  },
  {
    title: 'NVIDIA Audio2Face-3D',
    body:  'audio2face-3d generates photorealistic lip-sync and micro-expressions in real time, frame by frame, directly from your synthesised audio.',
  },
  {
    title: 'Parallel Chunking',
    body:  'Your video is split into 2-minute chapters and fired simultaneously across all healthy API keys, hitting up to 175 RPM throughput.',
  },
];

// ── Phase display config ─────────────────────────────────────────────────────
const PHASE_STEPS: { phase: JobPhase; label: string; desc: string; icon: string }[] = [
  { phase: 'SCRIPTING',    label: 'Drafting conversational script',  desc: 'Qwen 2.5 72B is generating your chapter scripts in natural Hinglish/Marathi/English.',    icon: 'description' },
  { phase: 'SYNTHESISING', label: 'Synthesising lifelike voice',     desc: 'magpie-tts-multilingual is generating phonetically rich, emotionally natural audio.', icon: 'mic' },
  { phase: 'AVATAR',       label: 'Rendering avatar animations',     desc: 'audio2face-3d is applying precise lip-sync and micro-expressions to your presenter.',  icon: 'face' },
  { phase: 'COMPOSITING',  label: 'Stitching video in the cloud',    desc: 'All layers are being assembled into the final Obsidian codec MP4.',                   icon: 'cloud_upload' },
];

const PHASE_ORDER: JobPhase[] = ['QUEUED', 'SCRIPTING', 'SYNTHESISING', 'AVATAR', 'COMPOSITING', 'DONE', 'FAILED'];

function phaseIndex(phase: JobPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export default function ProcessingPage() {
  const router = useRouter();
  const { jobId } = router.query;

  const [progress,  setProgress]  = useState<ProgressEvent | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);
  const [videoId,   setVideoId]   = useState('');
  const esRef  = useRef<EventSource | null>(null);
  const doneRef = useRef(false); // mirrors `done` for use inside stable closures

  // Keep doneRef in sync with done state
  useEffect(() => { doneRef.current = done; }, [done]);

  // ── Connect SSE ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || typeof jobId !== 'string') return;

    const es = new EventSource(`/api/progress/${jobId}`);
    esRef.current = es;

    es.addEventListener('progress', (e: MessageEvent) => {
      try { setProgress(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('done', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        setVideoId(data.videoId || '');
        setDone(true);
      } catch {}
      es.close();
    });

    es.addEventListener('error', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message || 'An error occurred during generation.');
      } catch {
        setError('Connection to progress stream lost.');
      }
      es.close();
    });

    es.onerror = () => {
      if (!doneRef.current) setError('Lost connection to server. The job may still be running.');
      es.close();
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]); // intentionally omit `done` — reconnect only when jobId changes

  // ── Rotate fun facts ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setFactIndex(f => (f + 1) % FUN_FACTS.length), 6000);
    return () => clearInterval(t);
  }, []);

  // ── Redirect when done ────────────────────────────────────────────────────
  useEffect(() => {
    if (done && videoId) {
      const t = setTimeout(() => router.push(`/cinema/${videoId}`), 1800);
      return () => clearTimeout(t);
    }
  }, [done, videoId, router]);

  // ── Derived values ────────────────────────────────────────────────────────
  const overallPct  = done ? 100 : (progress?.overallProgress ?? 0);
  const currentPhase= progress?.phase ?? 'QUEUED';
  const chapters    = progress?.chapters ?? [];
  const pool        = progress?.pool;
  const models      = progress?.models;

  const currentStepIdx = PHASE_STEPS.findIndex(s => s.phase === currentPhase);

  if (!jobId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
      </div>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>{done ? 'Video Ready! | Obsidian Lens' : 'Processing | Obsidian Lens'}</title>
        <meta name="description" content="Your AI video is being synthesised." />
      </Head>

      <style jsx global>{`
        @keyframes progress-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 24px rgba(124,58,237,1); }
        }
        @keyframes scanline {
          0%   { opacity: 0; transform: translateY(0); }
          50%  { opacity: 0.15; }
          100% { opacity: 0; transform: translateY(100%); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-on-surface font-headline">
            {done ? '✨ Video Ready!' : error ? '⚠️ Generation Failed' : 'Rendering Your Vision'}
          </h1>
          <p className="text-on-surface-variant max-w-xl">
            {done
              ? 'Synthesis complete. Redirecting to your private screening room…'
              : error
              ? error
              : 'Our neural engines are weaving your prompt into a cinematic masterpiece.'}
          </p>
          {error && (
            <Link href="/create" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background:'linear-gradient(to right,#7c3aed,#22d3ee)' }}>
              <span className="material-symbols-outlined text-sm">arrow_back</span>Try Again
            </Link>
          )}
        </div>

        {/* ── Overall progress bar ──────────────────────────────────────── */}
        <div className="mb-10 p-6 rounded-2xl" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-on-surface">Overall Progress</span>
            <div className="flex items-center gap-3">
              {pool && (
                <span className="text-xs text-on-surface-variant">
                  <span className="text-emerald-400 font-bold">{pool.healthy}</span>/{pool.total} keys active · <span className="text-cyan-400 font-bold">{pool.rpm}</span> RPM
                </span>
              )}
              <span className="text-sm font-bold text-primary font-headline">{overallPct}%</span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background:'rgba(45,47,69,0.8)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPct}%`,
                background: done ? 'linear-gradient(to right, #34d399, #22d3ee)' : 'linear-gradient(to right, #7c3aed, #22d3ee)',
                animation: done ? 'none' : 'progress-glow 2s ease-in-out infinite',
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
            <span>Job: <code className="text-primary">{String(jobId).slice(0, 22)}…</code></span>
            {models && (
              <span className={models.usedFallback ? 'text-amber-400' : 'text-on-surface-variant'}>
                {models.usedFallback ? '⚠ Fallback stack active' : '✓ Primary stack'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Left: Pipeline steps ──────────────────────────────────── */}
          <div className="lg:col-span-7 rounded-3xl p-8" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-on-surface font-headline">System Workflow</h2>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.2)' }}>
                <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation:'pulse 1.5s infinite' }} />
                <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase">Live Engine Status</span>
              </div>
            </div>

            {/* Phase timeline */}
            <div className="relative space-y-7">
              <div className="absolute left-5 top-5 bottom-5 w-0.5 rounded-full" style={{ background:'rgba(45,47,69,0.6)' }} />

              {PHASE_STEPS.map((step, i) => {
                const isDone   = done || phaseIndex(currentPhase) > phaseIndex(step.phase);
                const isActive = !done && currentPhase === step.phase;
                const isPending= !isDone && !isActive;
                return (
                  <div key={step.phase} className={`relative flex items-start gap-6 transition-opacity duration-500 ${isPending ? 'opacity-35' : 'opacity-100'}`}>
                    <div
                      className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                      style={
                        isDone   ? { background:'linear-gradient(135deg, #7c3aed, #22d3ee)', boxShadow:'0 0 16px rgba(124,58,237,0.4)' } :
                        isActive ? { background:'rgba(13,15,26,0.9)', border:'2px solid #22d3ee', boxShadow:'0 0 12px rgba(34,211,238,0.4)' } :
                                   { background:'rgba(13,15,26,0.9)', border:'2px solid rgba(45,47,69,0.8)' }
                      }
                    >
                      {isDone ? (
                        <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings:"'FILL' 1" }}>check</span>
                      ) : isActive ? (
                        <span className="material-symbols-outlined text-cyan-400 text-lg animate-spin">refresh</span>
                      ) : (
                        <span className="material-symbols-outlined text-on-surface-variant text-lg">{step.icon}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-on-surface text-sm">{step.label}</h3>
                        <span className={`text-xs font-bold ${isDone ? 'text-primary' : isActive ? 'text-cyan-400' : 'text-on-surface-variant'}`}>
                          {isDone ? 'Completed' : isActive ? `${overallPct}%` : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{step.desc}</p>
                      {isActive && (
                        <div className="mt-2 h-1 w-full rounded-full overflow-hidden" style={{ background:'rgba(45,47,69,0.8)' }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width:`${overallPct}%`, background:'linear-gradient(to right, #7c3aed, #22d3ee)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chapter progress grid */}
            {chapters.length > 0 && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor:'rgba(45,47,69,0.5)' }}>
                <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-4">
                  Chapter Progress ({chapters.length} chapters)
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {chapters.map(ch => {
                    const chDone    = ch.phase === 'DONE';
                    const chActive  = ch.phase !== 'DONE' && ch.phase !== 'QUEUED' && ch.phase !== 'FAILED';
                    const chFailed  = ch.phase === 'FAILED';
                    return (
                      <div key={ch.index} className="flex flex-col items-center gap-1">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300"
                          style={
                            chDone   ? { background:'rgba(52,211,153,0.2)',  border:'1px solid rgba(52,211,153,0.5)',  color:'#34d399' } :
                            chFailed ? { background:'rgba(248,113,113,0.2)', border:'1px solid rgba(248,113,113,0.5)', color:'#f87171' } :
                            chActive ? { background:'rgba(34,211,238,0.15)', border:'1px solid rgba(34,211,238,0.4)',  color:'#22d3ee' } :
                                       { background:'rgba(45,47,69,0.4)',    border:'1px solid rgba(45,47,69,0.6)',   color:'#4b5563' }
                          }
                        >
                          {chDone ? '✓' : chFailed ? '✗' : ch.index + 1}
                        </div>
                        {chActive && (
                          <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background:'rgba(45,47,69,0.6)' }}>
                            <div className="h-full bg-cyan-400 rounded-full transition-all duration-500" style={{ width:`${ch.progress}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Fun facts + model info ────────────────────────── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Model stack card */}
            <div className="rounded-3xl p-6" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-4">Active Model Stack</h3>
              {[
                { role: 'LLM',    icon: 'psychology',       value: models?.llm    || (process.env.NEXT_PUBLIC_LLM_PRIMARY  ?? 'qwen/qwen2.5-72b-instruct') },
                { role: 'TTS',    icon: 'mic',              value: models?.tts    || (process.env.NEXT_PUBLIC_TTS_PRIMARY  ?? 'magpie-tts-multilingual') },
                { role: 'Avatar', icon: 'face',             value: models?.avatar || 'audio2face-3d' },
              ].map(m => (
                <div key={m.role} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor:'rgba(45,47,69,0.4)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(124,58,237,0.15)' }}>
                    <span className="material-symbols-outlined text-primary text-sm">{m.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">{m.role}</div>
                    <div className="text-xs text-on-surface font-mono truncate">{m.value}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: models?.usedFallback ? '#fbbf24' : '#34d399' }} />
                </div>
              ))}
              {models?.usedFallback && (
                <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Fallback stack active — primary key rate-limited
                </p>
              )}
            </div>

            {/* Rotating fun-fact card */}
            <div className="rounded-3xl p-7 relative overflow-hidden" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-7xl text-primary">lightbulb</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary text-lg">auto_awesome</span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">AI Engine Trivia</span>
              </div>
              <h5 className="font-bold text-base text-on-surface mb-2 font-headline transition-all duration-500">
                {FUN_FACTS[factIndex].title}
              </h5>
              <p className="text-on-surface-variant text-sm leading-relaxed">{FUN_FACTS[factIndex].body}</p>
              <div className="flex gap-2 mt-5">
                {FUN_FACTS.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full cursor-pointer transition-all duration-500 ${i === factIndex ? 'w-8 bg-secondary' : 'w-2 bg-outline-variant'}`} onClick={() => setFactIndex(i)} />
                ))}
              </div>
            </div>

            {/* Priority queue CTA */}
            <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)' }}>
              <div>
                <p className="text-sm font-bold text-primary">Need it faster?</p>
                <p className="text-xs text-on-surface-variant">Priority render queue available.</p>
              </div>
              <button className="px-4 py-2 rounded-lg text-xs font-bold text-primary transition-all" style={{ background:'rgba(124,58,237,0.2)' }}>
                Upgrade Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Tell Next.js this is a server-rendered page (never statically prerendered) ──
// Fixes: "Cannot find module for page: /processing/[jobId]"
export async function getServerSideProps() {
  return { props: {} };
}