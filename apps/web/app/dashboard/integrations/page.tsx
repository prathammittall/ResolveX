'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Webhook } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { cn } from '../_components/ui';
import { PageHeader, Tabs } from '../_components/kit';
import { WebhooksTab } from './_webhooks';
import { ApiKeysTab } from './_apikeys';
import { GitHubTab } from './_github';

type TabId = 'webhooks' | 'keys' | 'github';

const GITHUB_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'GitHub connected. You can now link repositories and see live commits and pull requests.' },
  denied: { ok: false, text: 'GitHub did not grant access (the authorization was cancelled or denied). Try connecting again.' },
  invalid: { ok: false, text: 'The GitHub sign-in response could not be verified. Start the connection again from this page.' },
  expired: { ok: false, text: 'The GitHub connection request expired. Start the connection again.' },
  error: { ok: false, text: 'Something went wrong while finishing the GitHub connection. Try again, or check the server logs.' },
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const admin = can(user?.role, 'integrations:manage');
  const [tab, setTab] = useState<TabId>('webhooks');
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  // Handle the redirect back from GitHub OAuth (?github=connected|denied|invalid|expired|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('github');
    if (!status) return;
    setTab('github');
    setBanner(GITHUB_MESSAGES[status] ?? { ok: false, text: `GitHub connection finished with status “${status}”.` });
    params.delete('github');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  return (
    <div>
      <PageHeader title="Integrations" description="Send events to your systems, automate with API keys and connect GitHub to link commits and pull requests to tickets." />
      {banner && (
        <div role="status" className={cn('mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm', banner.ok ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#fecaca] bg-[#fee2e2] text-[#991b1b]')}>
          <span>{banner.text}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      )}
      {!admin && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3 text-sm text-[#92400e]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Only owners and admins can manage webhooks, API keys and the GitHub connection. You can view linked repositories.
        </div>
      )}
      <Tabs<TabId>
        tabs={[
          { id: 'webhooks', label: 'Outgoing webhooks' },
          { id: 'keys', label: 'API keys' },
          { id: 'github', label: 'GitHub' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === 'webhooks' && (admin ? <WebhooksTab /> : <Locked icon={Webhook} what="outgoing webhooks" />)}
        {tab === 'keys' && (admin ? <ApiKeysTab /> : <Locked icon={KeyRound} what="API keys" />)}
        {tab === 'github' && <GitHubTab admin={admin} />}
      </div>
    </div>
  );
}

function Locked({ icon: Icon, what }: { icon: React.ComponentType<{ className?: string }>; what: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#dfdbcc] bg-[#fbfaf6] p-6 text-sm text-[#5f6b64]">
      <Icon className="h-5 w-5" />
      Ask an owner or admin to manage {what}.
    </div>
  );
}
