import type { AppProps } from 'next/app';
import { useState } from 'react';
import '../src/lumina_synth/glassmorphic.css';
import '../styles/globals.css';

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null; // Let _error.tsx handle it
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps, err }: AppProps & { err?: any }) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}