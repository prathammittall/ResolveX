'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell, Notice, postPublic } from '../forgot-password/AuthShell';

type State = { kind: 'verifying' } | { kind: 'done' } | { kind: 'error'; message: string };

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>(token.length >= 10 ? { kind: 'verifying' } : { kind: 'error', message: 'This verification link is incomplete. Open the link from your email again.' });
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use: guard against React running the effect twice in development.
    if (started.current || token.length < 10) return;
    started.current = true;
    postPublic('/api/auth/verify-email', { token })
      .then(() => setState({ kind: 'done' }))
      .catch((err: unknown) => setState({ kind: 'error', message: err instanceof Error ? err.message : 'Verification failed' }));
  }, [token]);

  if (state.kind === 'verifying') {
    return (
      <AuthShell title="Verifying your email…">
        <div className="flex items-center gap-3 text-sm text-[#3d4a42]" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[#177a43]" /> Confirming your address, one moment.
        </div>
      </AuthShell>
    );
  }
  if (state.kind === 'done') {
    return (
      <AuthShell title="Email verified">
        <Notice kind="success">Thanks! Your email address is confirmed, so you’ll receive incident alerts and invitations.</Notice>
        <Link href="/dashboard" className="btn-kizupi-go px-4 py-2 text-sm">Continue to ResolveX</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="We couldn’t verify your email">
      <Notice kind="error">{state.message}</Notice>
      <p className="mb-4 text-sm text-[#3d4a42]">Links expire after 48 hours and work only once. Sign in and request a new one from Settings.</p>
      <Link href="/dashboard/settings" className="btn-kizupi-go px-4 py-2 text-sm">Go to settings</Link>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f6f4ec]">
          <Loader2 className="h-7 w-7 animate-spin text-[#177a43]" />
        </div>
      }
    >
      <Verify />
    </Suspense>
  );
}
