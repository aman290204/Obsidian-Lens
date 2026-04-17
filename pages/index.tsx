import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AppLayout from '../src/components/AppLayout';

interface Video {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  createdAt: string;
  language: string;
  status: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  hinglish: 'Hinglish',
  english:  'English',
  marathi:  'Marathi',
};

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #1e1040 0%, #7c3aed 50%, #1e1040 100%)',
  'linear-gradient(135deg, #052e44 0%, #22d3ee 50%, #052e44 100%)',
  'linear-gradient(135deg, #3f1133 0%, #f472b6 50%, #3f1133 100%)',
  'linear-gradient(135deg, #102030 0%, #06b6d4 50%, #102030 100%)',
  'linear-gradient(135deg, #1a1060 0%, #818cf8 50%, #1a1060 100%)',
  'linear-gradient(135deg, #0d2d1a 0%, #34d399 50%, #0d2d1a 100%)',
];

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} weeks ago`;
}

export default function Library() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/videos')
      .then(r => r.json())
      .then(d => { setVideos(d.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <Head>
        <title>Library | Obsidian Lens</title>
        <meta name="description" content="Your cinematic archive of AI-generated explainer videos." />
      </Head>

      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-on-surface font-headline">
              Your Library
            </h1>
            <p className="text-on-surface-variant max-w-lg">
              Your cinematic archive of AI-generated explainer videos.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-sm pointer-events-none">
                search
              </span>
              <input
                className="bg-surface-container border border-outline-variant/40 rounded-full pl-10 pr-6 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all w-56"
                placeholder="Search library..."
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Link
              href="/create"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(to right, #7c3aed, #22d3ee)' }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Video
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: 'movie', label: 'Total Videos', value: videos.length },
            { icon: 'schedule', label: 'Total Duration', value: `${Math.round(videos.reduce((a, v) => a + v.duration, 0) / 60)}m` },
            { icon: 'check_circle', label: 'Completed', value: videos.filter(v => v.status === 'completed').length },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/30"
              style={{ background: 'rgba(19,21,32,0.8)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <span className="material-symbols-outlined text-primary text-xl">{stat.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-on-surface font-headline">{stat.value}</div>
                <div className="text-xs text-on-surface-variant">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.5)' }}>
                <div className="aspect-video animate-pulse" style={{ background:'rgba(35,37,56,0.9)' }} />
                <div className="p-4 space-y-2">
                  <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background:'rgba(45,47,69,0.8)' }} />
                  <div className="h-2 rounded-full animate-pulse w-1/2" style={{ background:'rgba(45,47,69,0.6)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.2)' }}>
              <span className="material-symbols-outlined text-4xl text-primary">video_library</span>
            </div>
            <h3 className="text-xl font-semibold text-on-surface mb-2 font-headline">
              {search ? 'No results found' : 'No videos yet'}
            </h3>
            <p className="text-on-surface-variant mb-8 max-w-xs">
              {search ? `No videos match "${search}"` : 'Start creating your first AI explainer video.'}
            </p>
            <Link
              href="/create"
              className="px-6 py-3 rounded-xl font-semibold text-white hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(to right, #7c3aed, #22d3ee)' }}
            >
              Create Your First Video
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((video, idx) => (
              <Link
                key={video.id}
                href={`/cinema/${video.id}`}
                className="group relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(124,58,237,0.2)]"
                style={{ background:'rgba(19,21,32,0.8)', border:'1px solid rgba(45,47,69,0.5)' }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  <div
                    className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                    style={{ background: THUMB_GRADIENTS[idx % THUMB_GRADIENTS.length] }}
                  />
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background:'rgba(0,0,0,0.3)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background:'rgba(124,58,237,0.8)', backdropFilter:'blur(8px)' }}>
                      <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings:"'FILL' 1" }}>play_arrow</span>
                    </div>
                  </div>
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    {fmtDuration(video.duration)}
                  </div>
                  {/* Language badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background:'rgba(124,58,237,0.7)', color:'#e9ddff', backdropFilter:'blur(4px)' }}>
                    {LANGUAGE_LABELS[video.language] || video.language}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4 flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-on-surface line-clamp-2 leading-snug">
                    {video.title}
                  </h3>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[11px] text-on-surface-variant">{fmtRelative(video.createdAt)}</span>
                    <button
                      onClick={e => e.preventDefault()}
                      className="material-symbols-outlined text-on-surface-variant hover:text-primary text-xl transition-colors"
                    >
                      more_horiz
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}