'use client';

import React, { useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { assignableRoles, ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { OrgRole } from '../../../lib/types';
import { EmptyState, ErrorBanner, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Field, Input, Modal, Pill, Select, SkeletonRows, useApi, useConfirm, useMembers, useToast } from '../_components/kit';
import { SecretOnce } from './_webhooks';

type ApiKey = { id: number; name: string; keyPrefix: string; role: OrgRole; userId: number; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string };

function KeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const { user } = useAuth();
  const roles = assignableRoles(user?.role).filter((r) => r !== 'owner');
  const toast = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState<OrgRole>(roles.includes('viewer') ? 'viewer' : roles[0] ?? 'viewer');
  const [expiry, setExpiry] = useState('90');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError('Name the key after what uses it.');
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ key: string }>('/api/api-keys', { name: name.trim(), role, expiresInDays: expiry ? Number(expiry) : null });
      toast.success('API key created');
      onCreated(res.key);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New API key" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Create key</Button></>}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="CI deploy notifier" /></Field>
        <Field label="Role" hint={ROLE_HELP[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Expires" hint="Short-lived keys limit the damage if one leaks.">
          <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="30">In 30 days</option>
            <option value="90">In 90 days</option>
            <option value="180">In 180 days</option>
            <option value="365">In 1 year</option>
            <option value="730">In 2 years</option>
            <option value="">Never</option>
          </Select>
        </Field>
        <p className="text-xs text-[#5f6b64]">The key acts as you in this organization, limited to the role above. Send it as <code className="font-mono">Authorization: Bearer rxk_…</code>.</p>
      </div>
    </Modal>
  );
}

export function ApiKeysTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const { data, error, loading, reload } = useApi<{ apiKeys: ApiKey[] }>('/api/api-keys');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function revoke(k: ApiKey) {
    if (!(await confirm({ title: `Revoke ${k.name}?`, message: 'Anything using this key stops working immediately. This cannot be undone.', confirmLabel: 'Revoke', danger: true }))) return;
    try {
      await api.del(`/api/api-keys/${k.id}`);
      toast.success('Key revoked');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  const keys = data?.apiKeys ?? [];
  const now = Date.now();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[#5f6b64]">Use API keys for scripts and CI. Each key carries a role, so give automation the least access it needs.</p>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New API key</Button>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="No API keys" description="Create a key to call the ResolveX API from scripts, CI pipelines or other tools." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New API key</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-3 py-2.5">Key</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Created by</th>
                <th className="px-3 py-2.5">Last used</th>
                <th className="px-3 py-2.5">Expires</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfdbcc]">
              {keys.map((k) => {
                const expired = k.expiresAt !== null && Date.parse(k.expiresAt) < now;
                return (
                  <tr key={k.id} className={k.revokedAt || expired ? 'opacity-60' : 'hover:bg-[#f6f4ec]'}>
                    <td className="px-4 py-2.5 font-semibold text-[#14201a]">{k.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#3d4a42]">{k.keyPrefix}…</td>
                    <td className="px-3 py-2.5"><Pill tone="blue">{ROLE_LABEL[k.role] ?? k.role}</Pill></td>
                    <td className="px-3 py-2.5 text-xs text-[#3d4a42]">{members.find((m) => m.userId === k.userId)?.name ?? `User #${k.userId}`}</td>
                    <td className="px-3 py-2.5 text-xs text-[#5f6b64]">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#5f6b64]">{k.expiresAt ? formatDateTime(k.expiresAt) : 'Never'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {k.revokedAt ? (
                        <Pill tone="red">Revoked</Pill>
                      ) : expired ? (
                        <Pill tone="amber">Expired</Pill>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => revoke(k)}><Trash2 className="h-3.5 w-3.5 text-[#dc2626]" /> Revoke</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && <KeyModal onClose={() => setCreating(false)} onCreated={(k) => { setNewKey(k); reload(); }} />}
      <SecretOnce title="Your new API key" secret={newKey} onClose={() => setNewKey(null)}>
        <pre className="overflow-x-auto rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs text-[#14201a]">{`curl -H "Authorization: Bearer ${newKey ?? 'rxk_…'}" \\\n  ${typeof window !== 'undefined' ? window.location.origin : ''}/api/incidents`}</pre>
      </SecretOnce>
    </div>
  );
}
