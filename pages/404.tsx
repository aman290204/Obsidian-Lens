import Head from 'next/head';
import Link from 'next/link';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 – Page Not Found | Obsidian Lens</title>
      </Head>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" style={{background:'radial-gradient(circle at 30% 30%, rgba(126,81,255,0.08) 0%, transparent 60%), #030712'}}>
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8" style={{background:'rgba(126,81,255,0.15)', border:'1px solid rgba(126,81,255,0.3)'}}>
            <span className="material-symbols-outlined text-5xl text-violet-400">search_off</span>
          </div>
          <h1 className="text-8xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-4" style={{fontFamily:'Space Grotesk, sans-serif'}}>404</h1>
          <p className="text-slate-300 text-xl font-medium mb-2" style={{fontFamily:'Space Grotesk, sans-serif'}}>Page not found</p>
          <p className="text-slate-500 mb-10">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110 active:scale-95" style={{background:'linear-gradient(to right, #7c3aed, #06b6d4)'}}>
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Studio
          </Link>
        </div>
      </div>
    </>
  );
}
