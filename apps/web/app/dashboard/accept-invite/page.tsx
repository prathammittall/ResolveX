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
        <p className="text-sm text-[#5f6b64]">
          Open the invitation link you were sent, or paste the invitation code in{' '}
          <button className="font-bold text-[#177a43] underline hover:text-[#0f5e32] transition cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
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
          <div className="flex items-start gap-3.5" role="status">
            <div className="w-10 h-10 rounded-full bg-[#dcefd8] text-[#177a43] flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-[#14201a]">You’ve joined the organization</h1>
              <p className="mt-1 text-sm text-[#5f6b64]">Redirecting you to your new workspace…</p>
            </div>
          </div>
        </SectionCard>
      )}
      {state === 'error' && (
        <SectionCard>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#fee2e2] text-[#dc2626] flex items-center justify-center shrink-0">
              <MailWarning className="h-5 w-5" />
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-lg font-bold text-[#14201a]">Invitation cannot be redeemed</h1>
              {error && <ErrorBanner message={error} />}
              <p className="text-sm text-[#5f6b64]">
                Invitations are bound to one email address{user ? ` — you’re currently signed in as ${user.email}` : ''}. Ask the
                organization admin to verify your email, or sign in with the invited email address.
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
