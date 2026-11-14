'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { OrganizationInfo } from '../../../lib/types';
import { ErrorBanner, PageLoader, SectionCard, formatDateTime } from '../_components/ui';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-[#574f47] dark:text-zinc-400">{label}</dt>
      <dd className="text-sm font-medium text-[#171a1f] dark:text-white">{children}</dd>
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
    // The accept page redeems the code and switches the session to the new organization.
    window.location.assign(`/dashboard/accept-invite?token=${encodeURIComponent(code.trim())}`);
  }

  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">Your organization and account.</p>
      </div>
      {error && <ErrorBanner message={error} />}

      <SectionCard title="Organization">
        <dl className="-my-3 divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
          <Row label="Name">{org?.name ?? '—'}</Row>
          <Row label="Identifier">
            <code className="rounded bg-[#e2cfc0] dark:bg-white/10 px-1.5 py-0.5 text-xs text-[#171a1f] dark:text-zinc-200">{org?.slug ?? '—'}</code>
          </Row>
          <Row label="Created">{org ? formatDateTime(org.createdAt) : '—'}</Row>
        </dl>
      </SectionCard>

      <SectionCard title="Your account">
        <dl className="-my-3 divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
          <Row label="Name">{user.name || user.username || '—'}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role in this organization">
            {ROLE_LABEL[user.role]}
            <span className="ml-2 text-xs font-normal text-[#574f47] dark:text-zinc-400">{ROLE_HELP[user.role]}</span>
          </Row>
        </dl>
      </SectionCard>

      <SectionCard title="Join another organization" subtitle="Paste the invitation code you were given.">
        <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row">
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
            className="min-w-0 flex-1 rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2.5 font-mono text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={joining}
            className="rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </form>
        {joinError && <div className="mt-3"><ErrorBanner message={joinError} /></div>}
        <p className="mt-2 text-xs text-[#574f47] dark:text-zinc-400">Invitations only work for the email address they were sent to.</p>
      </SectionCard>
    </div>
  );
}
