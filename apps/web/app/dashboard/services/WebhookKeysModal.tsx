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
    if (!window.confirm(`Revoke "${key.name}"? Tools using it will stop being able to send alerts.`)) return;
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb] dark:bg-[#12131a] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif-title text-lg font-semibold text-[#171a1f] dark:text-white">Alert webhook keys</h2>
            <p className="mt-0.5 text-sm text-[#574f47] dark:text-zinc-400">{service.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-[#e2cfc0]/60 dark:bg-white/5 border border-[#cbbaa9]/40 dark:border-white/5 p-3 text-xs leading-relaxed text-[#574f47] dark:text-zinc-300">
          Send alerts with <code>POST {apiBase}/api/webhooks/alerts</code> and the header{' '}
          <code>Authorization: Bearer &lt;key&gt;</code>. Each key only works for this service.
        </p>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        {secret && (
          <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-500/10 p-4" role="status">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Copy your key now — it won’t be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={secret}
                aria-label="New webhook key"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-[#faefe3] dark:bg-zinc-900 text-[#171a1f] dark:text-white px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#171a1f] dark:bg-[#ff5414] text-white px-3 py-2 text-xs font-semibold hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
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
              placeholder="e.g. Datadog production"
              className="min-w-0 flex-1 rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2.5 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {creating ? 'Creating…' : 'Create key'}
            </button>
          </form>
        )}

        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : keys.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#574f47] dark:text-zinc-400">No keys yet.</p>
          ) : (
            <ul className="divide-y divide-[#cbbaa9]/20 dark:divide-white/5">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#171a1f] dark:text-white">
                      {k.name}
                      {k.revokedAt && <span className="ml-2 rounded-full bg-[#e2cfc0] dark:bg-white/10 px-2 py-0.5 text-xs text-[#574f47] dark:text-zinc-400">revoked</span>}
                    </p>
                    <p className="text-xs text-[#574f47] dark:text-zinc-400">
                      <code>{k.keyPrefix}…</code> · created {formatDateTime(k.createdAt)} ·{' '}
                      {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : 'never used'}
                    </p>
                  </div>
                  {canManage && !k.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revoke(k)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#574f47] dark:text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 transition"
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
