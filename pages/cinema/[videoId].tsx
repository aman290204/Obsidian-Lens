import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import AppLayout from '../../src/components/AppLayout';

const METADATA = [
  { icon: 'high_quality', label: 'Resolution',  value: '4K UHD (3840 × 2160)' },
  { icon: 'speed',        label: 'Encoding',    value: 'H.265 High Profile' },
  { icon: 'neurology',    label: 'Engine',      value: 'Obsidian-v2-Fluid' },
  { icon: 'mic',          label: 'TTS Model',   value: 'NVIDIA Riva Neural' },
];

export default function CinemaPage() {
  const router = useRouter();
  const { videoId } = router.query;
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!videoId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
      </div>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>Private Screening | Obsidian Lens</title>
        <meta name="description" content="Watch your AI-generated cinematic video." />
      </Head>

      <style jsx global>{`
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface mb-1 font-headline">
              Private Screening
            </h1>
            <p className="text-on-surface-variant text-sm">
              Video ID: <code className="text-primary">{String(videoId).slice(0, 24)}…</code>
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.25)' }}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation:'pulse 2s infinite' }} />
            <span className="text-xs font-bold tracking-widest uppercase text-cyan-400">Ready to Export</span>
          </div>
        </div>

        {/* Premium Video Player */}
        <div
          className="relative w-full aspect-video rounded-2xl overflow-hidden group mb-8"
          style={{
            boxShadow: '0 0 80px rgba(124,58,237,0.2), 0 40px 80px rgba(0,0,0,0.6)',
            border: '1px solid rgba(45,47,69,0.6)',
          }}
        >
          {/* Cinematic gradient background (placeholder for actual video) */}
          <div
            className="absolute inset-0 transition-all duration-700"
            style={{
              background: playing
                ? 'linear-gradient(135deg, #0d0721 0%, #1a0e3a 30%, #050d1a 60%, #0d0721 100%)'
                : 'linear-gradient(135deg, #0d0721 0%, #1e0e46 25%, #071520 50%, #0e0030 75%, #030712 100%)',
            }}
          >
            {/* Animated stars */}
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 2 + 1 + 'px',
                  height: Math.random() * 2 + 1 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                  background: 'white',
                  opacity: Math.random() * 0.5 + 0.1,
                  animation: `float ${Math.random() * 3 + 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 4}s`,
                }}
              />
            ))}
            {/* Central glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 rounded-full" style={{ background:'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
            </div>
          </div>

          {/* Hover gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button
              onClick={() => setPlaying(p => !p)}
              className="w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95"
              style={{
                background: 'rgba(13,15,26,0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 0 30px rgba(124,58,237,0.4)',
                opacity: playing ? 0 : 1,
              }}
            >
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings:"'FILL' 1" }}>
                {playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
          </div>

          {/* Click to pause/play (when playing) */}
          {playing && (
            <button
              className="absolute inset-0 z-10"
              onClick={() => setPlaying(false)}
              aria-label="Pause"
            />
          )}

          {/* Playing indicator */}
          {playing && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }}>
              <span className="w-2 h-2 rounded-full bg-red-500" style={{ animation:'pulse 1s infinite' }} />
              <span className="text-xs font-bold text-white">Playing</span>
            </div>
          )}

          {/* Scrubber */}
          <div className="absolute bottom-6 left-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full" style={{ width:'42%', background:'linear-gradient(to right, #7c3aed, #22d3ee)' }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/60 text-[10px] font-mono">04:12 / 15:00</span>
              <span className="text-white/60 text-[10px] font-mono">24 fps • 4K</span>
            </div>
          </div>

          {/* TC Overlay */}
          <div className="absolute top-5 left-5 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
            <div className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/80" style={{ background:'rgba(13,15,26,0.7)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(8px)' }}>
              TC: 00:04:12:08
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/80" style={{ background:'rgba(13,15,26,0.7)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(8px)' }}>
              FPS: 24.00
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <button
            className="flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background:'linear-gradient(to right, #7c3aed, #22d3ee)', boxShadow:'0 4px 20px rgba(124,58,237,0.3)' }}
          >
            <span className="material-symbols-outlined">download</span>
            Download to Device
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-on-surface transition-all hover:brightness-110 active:scale-95"
            style={{ background:'rgba(19,21,32,0.9)', border:'1px solid rgba(45,47,69,0.7)' }}
          >
            <span className="material-symbols-outlined">{copied ? 'check' : 'link'}</span>
            {copied ? 'Copied!' : 'Share Link'}
          </button>
          <Link
            href="/create"
            className="flex items-center justify-center gap-3 py-4 rounded-xl font-semibold transition-all hover:brightness-110 active:scale-95 text-secondary"
            style={{ background:'rgba(19,21,32,0.9)', border:'1px solid rgba(34,211,238,0.2)' }}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Generate Another
          </Link>
        </div>

        {/* Technical metadata */}
        <div
          className="pt-8 border-t"
          style={{ borderColor:'rgba(45,47,69,0.5)' }}
        >
          <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface-variant mb-6">Technical Specifications</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {METADATA.map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(124,58,237,0.12)' }}
                >
                  <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">{item.label}</div>
                  <div className="text-sm text-on-surface font-medium">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Server-rendered on demand — never statically prerendered ────────────────
export async function getServerSideProps() {
  return { props: {} };
}