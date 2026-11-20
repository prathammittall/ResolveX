'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Loader2, SearchX } from 'lucide-react';
import StatusView, { type PublicStatusPage } from '../StatusView';

type LoadState = { kind: 'loading' } | { kind: 'ok'; page: PublicStatusPage } | { kind: 'not_found' } | { kind: 'error'; message: string };

export default function PublicStatusRoute() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? '').toLowerCase();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(
    async (quiet = false) => {
      if (!/^[a-z0-9-]{3,63}$/.test(slug)) {
        setState({ kind: 'not_found' });
        return;
      }
      if (!quiet) setState({ kind: 'loading' });
      try {
        // Plain fetch: this page is public and must never trigger the dashboard's login redirect.
        const res = await fetch(`/api/public/status/${encodeURIComponent(slug)}`, { credentials: 'omit', cache: 'no-store' });
        if (res.status === 404) {
          setState({ kind: 'not_found' });
          return;
        }
        const data = (await res.json().catch(() => null)) as { ok?: boolean; page?: PublicStatusPage; error?: { message?: string } } | null;
        if (!res.ok || !data?.ok || !data.page) {
          setState({ kind: 'error', message: data?.error?.message ?? `Could not load this status page (HTTP ${res.status}).` });
          return;
        }
        setState({ kind: 'ok', page: data.page });
      } catch {
        if (!quiet) setState({ kind: 'error', message: 'Could not reach the status service. Check your connection and try again.' });
      }
    },
    [slug],
  );

  useEffect(() => {
    void load();
    // Refresh every 60 seconds while the page is open.
    const t = setInterval(() => void load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (state.kind === 'ok') document.title = `${state.page.name} status`;
  }, [state]);

  if (state.kind === 'ok') return <StatusView page={state.page} />;

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#f6f4ec', color: '#14201a' }}>
      {state.kind === 'loading' && (
        <div className="flex flex-col items-center gap-3" role="status">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#177a43' }} />
          <span className="text-sm" style={{ color: '#5f6b64' }}>Loading status…</span>
        </div>
      )}
      {state.kind === 'not_found' && (
        <div className="max-w-sm text-center">
          <SearchX className="mx-auto h-10 w-10" style={{ color: '#5f6b64' }} />
          <h1 className="font-display mt-3 text-2xl font-extrabold">Status page not found</h1>
          <p className="mt-2 text-sm" style={{ color: '#5f6b64' }}>
            There is no public status page at this address. It may have been renamed, made private, or removed.
          </p>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto h-10 w-10" style={{ color: '#dc2626' }} />
          <h1 className="font-display mt-3 text-2xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-sm" style={{ color: '#5f6b64' }}>{state.message}</p>
          <button type="button" onClick={() => void load()} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#177a43' }}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
