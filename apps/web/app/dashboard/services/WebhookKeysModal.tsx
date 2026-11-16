'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import type { ServiceItem, WebhookKeyItem } from '../../../lib/types';
import { ErrorBanner, Spinner, formatDateTime, timeAgo } from '../_components/ui';

/**
 * Per-service alert ingestion keys. A key lets a monitoring tool POST alerts for exactly this service;
 * the secret is shown once at creation and only its hash is kept on the server.
 */
export default function WebhookKeysModal({
  service,
  canManage,
  onClose,
}: {
  service: ServiceItem;
  canManage: boolean;
  onClose: () => void;
}) {
  const [keys, setKeys] = useState<WebhookKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const base = `/api/services/${service.id}/webhook-keys`;

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ keys: WebhookKeyItem[] }>(base);
      setKeys(res.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSecret(null);
    try {
      const res = await api.post<{ token: string }>(base, { name });
      setSecret(res.token);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(key: WebhookKeyItem) {
    if (!window.confirm(`Revoke "${key.name}"? External tools using it will immediately stop being able to send alerts.`)) return;
    try {
      await api.del(`${base}/${key.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  }

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically. Select the key and copy it manually.');
    }
  }

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Webhook keys for ${service.name}`}>
      <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#dfdbcc] pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#14201a]">Alert webhook keys</h2>
            <p className="mt-0.5 text-xs text-[#5f6b64]">Target: {service.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] transition cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-[#eeebe0]/60 border border-[#dfdbcc] p-3 text-xs leading-relaxed text-[#3d4a42]">
          Send telemetry and alerts with <code className="font-mono font-bold text-[#14201a]">POST {apiBase}/api/webhooks/alerts</code> and header{' '}
          <code className="font-mono text-[#177a43]">Authorization: Bearer &lt;key&gt;</code>. Each key is strictly scoped to this service.
        </p>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        {secret && (
          <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fef3c7] p-4" role="status">
            <p className="text-sm font-bold text-[#92400e]">Copy your key now — it will not be shown again.</p>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                readOnly
                value={secret}
                aria-label="New webhook key"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-[#fde68a] bg-white text-[#14201a] px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={copy}
                className="btn-kizupi-go text-xs px-3.5 py-2 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {canManage && (
          <form onSubmit={create} className="mt-5 flex gap-2">
            <label htmlFor="key-name" className="sr-only">
              Key name
            </label>
            <input
              id="key-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Datadog Production, Cloudwatch"
              className="min-w-0 flex-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20 placeholder-[#5f6b64]/50"
            />
            <button
              type="submit"
              disabled={creating}
              className="btn-kizupi-go text-sm px-4 py-2 cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              {creating ? 'Creating…' : 'Create key'}
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-[#dfdbcc]/60 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5f6b64] mb-3">Active keys</h3>
          {loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : keys.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#5f6b64]">No webhook keys created yet.</p>
          ) : (
            <ul className="divide-y divide-[#dfdbcc]/50">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#14201a]">
                      {k.name}
                      {k.revokedAt && <span className="ml-2 rounded-full bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5] px-2 py-0.5 text-[10px] font-bold">revoked</span>}
                    </p>
                    <p className="text-xs text-[#5f6b64] mt-0.5">
                      <code className="font-mono font-semibold text-[#14201a]">{k.keyPrefix}…</code> · created {formatDateTime(k.createdAt)} ·{' '}
                      {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : 'never used'}
                    </p>
                  </div>
                  {canManage && !k.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revoke(k)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] transition cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
