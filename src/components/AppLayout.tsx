import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

const NAV_ITEMS = [
  { key: 'create',  label: 'Create',  icon: 'magic_button',    href: '/create' },
  { key: 'library', label: 'Library', icon: 'movie',           href: '/' },
  { key: 'queue',   label: 'Queue',   icon: 'hourglass_empty', href: '#' },
];


export default function AppLayout({ children, pageTitle }: AppLayoutProps) {
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/';
    return router.pathname.startsWith(href);
  };

  return (
    <>
      <style jsx global>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          user-select: none;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <nav
        className="fixed top-0 w-full flex justify-between items-center px-8 h-16 z-50"
        style={{
          background: 'rgba(3,7,18,0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          borderBottom: '1px solid rgba(45,47,69,0.8)',
        }}
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-headline tracking-tight"
          >
            Obsidian Lens
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link href="/create" className={`transition-colors pb-1 ${router.pathname === '/create' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
              Studio
            </Link>
            <Link href="/" className={`transition-colors pb-1 ${router.pathname === '/' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
              Library
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/create"
            className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            + Create New
          </Link>
          {/* Avatar placeholder */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}
          >
            U
          </div>
        </div>
      </nav>

      {/* ── Side Navigation ────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-full flex flex-col pt-20 pb-6 z-40 w-64"
        style={{ background: 'rgba(13,15,26,0.95)', borderRight: '1px solid rgba(45,47,69,0.8)' }}
      >
        {/* Engine badge */}
        <div className="px-4 mb-6">
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}>
              <span className="material-symbols-outlined text-white text-lg">auto_awesome</span>
            </div>
            <div>
              <div className="text-on-surface font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Core Engine</div>
              <div className="text-xs text-on-surface-variant">V2.5 Obsidian</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href) && item.href !== '#';
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-cyan-400 border-r-2 border-cyan-400'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }`}
                style={active ? { background: 'linear-gradient(to right, rgba(124,58,237,0.15), rgba(34,211,238,0.05))' } : {}}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 space-y-1">
          <div className="px-4 py-3 mb-2">
            <button className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(to right, #7c3aed, #22d3ee)' }}>
              Upgrade to Pro
            </button>
          </div>
          <button className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>Settings</span>
          </button>
          <button className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all">
            <span className="material-symbols-outlined text-[20px]">help</span>
            <span>Support</span>
          </button>
        </div>
      </aside>

      {/* ── Page Content ──────────────────────────────────────────────── */}
      <main className="ml-64 pt-16 min-h-screen bg-background">
        {children}
      </main>
    </>
  );
}
