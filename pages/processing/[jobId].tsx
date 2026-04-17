"use client";

import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AppLayout from '../../src/components/AppLayout';

// New job schema types
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
type JobStage = 'starting' | 'generating' | 'uploading' | 'done';

interface ProgressEvent {
  jobId: string;
  userId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  error: string | null;
  prompt?: string;
  language?: string;
  totalChapters?: number;
  models?: { llm: string; tts: string; avatar: string; usedFallback: boolean };
  createdAt: number;
  lastUpdated: number;
  url?: string;
}

const FUN_FACTS = [
  { title: 'Primary LLM: Qwen 2.5 72B', body: 'Our primary script engine uses Qwen 2.5-72B Instruct — a 72-billion parameter model optimised for multilingual, conversational content generation.' },
  { title: 'Fallback: DeepSeek R1', body: 'If the primary LLM hits rate limits, we automatically switch to DeepSeek-R1 with no interruption to your generation.' },
  { title: 'Magpie Multilingual TTS', body: 'magpie-tts-multilingual natively supports Hinglish, Marathi, and Indian English — no post-processing needed for code-mixed speech.' },
  { title: 'NVIDIA Audio2Face-3D', body: 'audio2face-3d generates photorealistic lip-sync and micro-expressions in real time, frame by frame.' },
  { title: 'Step-Based Architecture', body: 'Worker re-triggers itself every few seconds, avoiding Vercel timeout limits and making jobs fully resumable.' },
];

const STAGE_STEPS: { stage: JobStage; label: string; desc: string; icon: string }[] = [
  { stage: 'starting', label: 'Initializing job', desc: 'Preparing your video generation request.', icon: 'hourglass_empty' },
  { stage: 'generating', label: 'Generating video content', desc: 'NVIDIA is creating script, voice, and avatar animations.', icon: 'auto_awesome' },
  { stage: 'uploading', label: 'Uploading to cloud storage', desc: 'Your video is being uploaded to Google Drive.', icon: 'cloud_upload' },
  { stage: 'done', label: 'Complete!', desc: 'Your video is ready for download.', icon: 'check_circle' },
];

function stageIndex(stage: JobStage): number {
  return STAGE_STEPS.findIndex(s => s.stage === stage);
}

export default function ProcessingPage() {
  const router = useRouter();
  const { jobId } = router.query;

  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const esRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);

  useEffect(() => { doneRef.current = done; }, [done]);

  // SSE connection
  useEffect(() => {
    if (!jobId || typeof jobId !== 'string') return;

    const es = new EventSource(`/api/progress/${jobId}`);
    esRef.current = es;

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
      } catch (err) {}
    });

    es.addEventListener('done', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        setVideoUrl(data.url || '');
        setDone(true);
      } catch (err) {}
      es.close();
    });

    es.addEventListener('error', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message || 'Connection lost');
      } catch {
        setError('Connection to progress stream lost.');
      }
      es.close();
    });

    es.onerror = () => {
      if (!doneRef.current) setError('Lost connection to server.');
      es.close();
    };

    return () => { es.close(); };
  }, [jobId]);

  // Rotate fun facts
  useEffect(() => {
    const t = setInterval(() => setFactIndex(f => (f + 1) % FUN_FACTS.length), 6000);
    return () => clearInterval(t);
  }, []);

  // Redirect when done
  useEffect(() => {
    if (done && videoUrl) {
      const t = setTimeout(() => router.push(`/cinema/${jobId}`), 2000);
      return () => clearTimeout(t);
    }
  }, [done, videoUrl, router]);

  const currentStage = progress?.stage || 'starting';
  const currentStageIdx = stageIndex(currentStage);
  const overallPct = done ? 100 : (progress?.progress || 0);

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
        <meta name="description" content="Your AI video is being synthesized." />
      </Head>

      <style jsx global>{`
        @keyframes progress-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(124,58,237,0.4); }
          50% { box-shadow: 0 0 24px rgba(124,58,237,1); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
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

        {/* Overall progress */}
        <div className="mb-10 p-6 rounded-2xl" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-on-surface">Overall Progress</span>
            <span className="text-sm font-bold text-primary font-headline">{overallPct}%</span>
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
          {progress && (
            <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
              <span>Job: <code className="text-primary">{jobId?.toString().slice(0, 22)}…</code></span>
              <span className="capitalize">Stage: {progress.stage}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Stage timeline */}
          <div className="lg:col-span-7 rounded-3xl p-8" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-on-surface font-headline">Processing Pipeline</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.2)' }}>
                <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation:'pulse 1.5s infinite' }} />
                <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase">Live</span>
              </div>
            </div>

            <div className="relative space-y-7">
              <div className="absolute left-5 top-5 bottom-5 w-0.5 rounded-full" style={{ background:'rgba(45,47,69,0.6)' }} />

              {STAGE_STEPS.map((step, i) => {
                const isDone = done || currentStageIdx > i;
                const isActive = !done && currentStageIdx === i;
                const isPending = !isDone && !isActive;
                return (
                  <div key={step.stage} className={`relative flex items-start gap-6 transition-opacity duration-500 ${isPending ? 'opacity-35' : 'opacity-100'}`}>
                    <div
                      className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                      style={{
                        background: isDone
                          ? 'linear-gradient(135deg, #7c3aed, #22d3ee)'
                          : isActive
                          ? 'rgba(13,15,26,0.9)'
                          : 'rgba(13,15,26,0.9)',
                        border: isActive ? '2px solid #22d3ee' : '2px solid rgba(45,47,69,0.8)',
                        boxShadow: isDone ? '0 0 16px rgba(124,58,237,0.4)' : isActive ? '0 0 12px rgba(34,211,238,0.4)' : 'none',
                      }}
                    >
                      {isDone ? (
                        <span className="material-symbols-outlined text-white text-lg">check</span>
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
          </div>

          {/* Right: Info panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Model stack */}
            <div className="rounded-3xl p-6" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-4">Active Model Stack</h3>
              {[
                { role: 'LLM', icon: 'psychology', value: progress?.models?.llm || 'N/A' },
                { role: 'TTS', icon: 'mic', value: progress?.models?.tts || 'N/A' },
                { role: 'Avatar', icon: 'face', value: progress?.models?.avatar || 'N/A' },
              ].map(m => (
                <div key={m.role} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor:'rgba(45,47,69,0.4)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'rgba(124,58,237,0.15)' }}>
                    <span className="material-symbols-outlined text-primary text-sm">{m.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">{m.role}</div>
                    <div className="text-xs text-on-surface font-mono truncate">{m.value}</div>
                  </div>
                </div>
              ))}
              {progress?.models?.usedFallback && (
                <p className="text-xs text-amber-400 mt-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Fallback stack active
                </p>
              )}
            </div>

            {/* Fun facts */}
            <div className="rounded-3xl p-7 relative overflow-hidden" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.6)' }}>
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-7xl text-primary">lightbulb</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary text-lg">auto_awesome</span>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">AI Engine Trivia</span>
              </div>
              <h5 className="font-bold text-base text-on-surface mb-2 font-headline">{FUN_FACTS[factIndex].title}</h5>
              <p className="text-on-surface-variant text-sm leading-relaxed">{FUN_FACTS[factIndex].body}</p>
              <div className="flex gap-2 mt-5">
                {FUN_FACTS.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full cursor-pointer transition-all duration-500 ${i === factIndex ? 'w-8 bg-secondary' : 'w-2 bg-outline-variant'}`} onClick={() => setFactIndex(i)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
