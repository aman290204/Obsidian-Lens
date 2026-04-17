import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface ErrorProps {
  statusCode?: number;
  message?: string;
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode, message }) => {
  return (
    <>
      <Head>
        <title>{statusCode ? `Error ${statusCode}` : 'Error'} | Obsidian Lens</title>
      </Head>
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-6">
        <div className="glass-panel rounded-2xl p-8 border border-outline-variant/10 text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-error/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-4xl">error</span>
          </div>
          <h1 className="text-3xl font-headline font-bold mb-2">
            {statusCode ? `${statusCode}` : 'Error'}
          </h1>
          <p className="text-on-surface-variant mb-6">
            {message || (statusCode === 404 ? 'Page not found' : 'An unexpected error occurred')}
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary text-on-primary-fixed rounded-lg font-medium hover:brightness-110 transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
            Return to Studio
          </Link>
        </div>
      </div>
      <style jsx global>{`
        .glass-panel {
          background: rgba(34, 38, 47, 0.4);
          backdrop-filter: blur(12px);
        }
      `}</style>
    </>
  );
};

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  const message = err?.message;
  return { statusCode, message };
};

export default ErrorPage;