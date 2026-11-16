'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { OrganizationInfo } from '../../../lib/types';
import { ErrorBanner, PageLoader, SectionCard, formatDateTime } from '../_components/ui';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-semibold text-[#5f6b64]">{label}</dt>
      <dd className="text-sm font-bold text-[#14201a]">{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ organization: OrganizationInfo }>('/api/org')
      .then((res) => setOrg(res.organization))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load organization'))
      .finally(() => setLoading(false));
  }, []);

  function join(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    window.location.assign(`/dashboard/accept-invite?token=${encodeURIComponent(code.trim())}`);
  }

  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="border-b border-[#dfdbcc] pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Settings</h1>
        <p className="mt-1 text-sm text-[#5f6b64]">Organization configuration and personal account profile.</p>
      </div>
      {error && <ErrorBanner message={error} />}

      <SectionCard title="Organization">
        <dl className="-my-3 divide-y divide-[#dfdbcc]/50">
          <Row label="Organization Name">{org?.name ?? '—'}</Row>
          <Row label="Workspace Identifier">
            <code className="rounded-md bg-[#eeebe0] px-2 py-0.5 font-mono text-xs font-bold text-[#14201a]">{org?.slug ?? '—'}</code>
          </Row>
          <Row label="Created">{org ? formatDateTime(org.createdAt) : '—'}</Row>
        </dl>
      </SectionCard>

      <SectionCard title="Your Account">
        <dl className="-my-3 divide-y divide-[#dfdbcc]/50">
          <Row label="Full Name">{user.name || user.username || '—'}</Row>
          <Row label="Email Address">{user.email}</Row>
          <Row label="Current Workspace Role">
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full bg-[#dcefd8] text-[#177a43] px-2.5 py-0.5 text-xs font-bold border border-[#b2e2a8]">
                {ROLE_LABEL[user.role]}
              </span>
              <span className="text-xs font-normal text-[#5f6b64]">{ROLE_HELP[user.role]}</span>
            </span>
          </Row>
        </dl>
      </SectionCard>

      <SectionCard title="Join another organization" subtitle="Paste the invitation token code you were issued.">
        <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row mt-2">
          <label htmlFor="invite-code" className="sr-only">
            Invitation code
          </label>
          <input
            id="invite-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="rxinv_…"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2.5 font-mono text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20 placeholder-[#5f6b64]/50"
          />
          <button
            type="submit"
            disabled={joining}
            className="btn-kizupi-go text-sm px-5 py-2.5 cursor-pointer disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join organization'}
          </button>
        </form>
        {joinError && <div className="mt-3"><ErrorBanner message={joinError} /></div>}
        <p className="mt-2 text-xs text-[#5f6b64]">Invitations are cryptographically validated and only work for the target email address.</p>
      </SectionCard>
    </div>
  );
}
