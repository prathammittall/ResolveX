'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { ErrorBanner, PageLoader, SectionCard } from '../_components/ui';

function AcceptInvite() {
  const params = useSearchParams();
  const router = useRouter();
  const { switchOrg, user } = useAuth();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>(token ? 'working' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Redeem automatically when arriving from an invitation link. Guarded so React strict mode
  // does not submit the single-use token twice.
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await api.post<{ organizationId: string }>('/api/invitations/accept', { token });
        const switched = await switchOrg(res.organizationId);
        setState('done');
        if (switched.ok) setTimeout(() => window.location.assign('/dashboard'), 1200);
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not accept the invitation');
        setState('error');
      }
    })();
  }, [token, switchOrg]);

  if (!token) {
    return (
      <SectionCard title="Join an organization">
        <p className="text-sm text-slate-600">
          Open the invitation link you were sent, or paste the invitation code in{' '}
          <button className="font-medium text-[#25396e] underline" onClick={() => router.push('/dashboard/settings')}>
            Settings
          </button>
          .
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-10">
      {state === 'working' && <PageLoader />}
      {state === 'done' && (
        <SectionCard>
          <div className="flex items-start gap-3" role="status">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="font-serif-title text-lg font-semibold text-slate-900">You’ve joined the organization</h1>
              <p className="mt-1 text-sm text-slate-500">Taking you to your new workspace…</p>
            </div>
          </div>
        </SectionCard>
      )}
      {state === 'error' && (
        <SectionCard>
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 h-6 w-6 text-rose-600" />
            <div className="space-y-3">
              <h1 className="font-serif-title text-lg font-semibold text-slate-900">Invitation can’t be used</h1>
              {error && <ErrorBanner message={error} />}
              <p className="text-sm text-slate-500">
                Invitations are tied to one email address{user ? ` — you’re signed in as ${user.email}` : ''}. Ask the
                person who invited you to send a new one, or sign in with the invited address.
              </p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AcceptInvite />
    </Suspense>
  );
}
