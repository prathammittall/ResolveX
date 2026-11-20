'use client';

import React, { useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, RotateCcw, Send, Trash2, Webhook } from 'lucide-react';
import { api } from '../../../lib/api';
import { EmptyState, ErrorBanner, SectionCard, cn, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Field, Input, Modal, Pill, SkeletonRows, useApi, useConfirm, useToast } from '../_components/kit';
import { CopyBox } from '../oncall/_shared';

type Endpoint = { id: number; name: string; url: string; events: string[]; enabled: boolean; secretPrefix: string; createdAt: string; updatedAt: string };
type Delivery = {
  id: number;
  event: string;
  eventId: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed' | string;
  attempts: number;
  responseStatus: number | null;
  responseSnippet: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

const EVENT_HELP: Record<string, string> = {
  'incident.created': 'A new incident is declared or auto-created',
  'incident.acknowledged': 'Someone acknowledges an incident',
  'incident.status_changed': 'An incident moves through its lifecycle',
  'incident.resolved': 'An incident is resolved',
  'service.health_changed': 'A service turns healthy, degraded or down',
  'deployment.created': 'A deployment is recorded',
  'task.created': 'A ticket is created',
  'task.updated': 'A ticket changes',
  'postmortem.published': 'A postmortem is published',
};

export function SecretOnce({ title, secret, onClose, children }: { title: string; secret: string | null; onClose: () => void; children?: React.ReactNode }) {
  return (
    <Modal open={secret !== null} onClose={onClose} title={title} footer={<Button onClick={onClose}>I’ve saved it</Button>}>
      <div className="space-y-3">
        <p className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e]">Copy this now. For your security it will not be shown again.</p>
        {secret && <CopyBox value={secret} label="secret" />}
        {children}
      </div>
    </Modal>
  );
}

function EndpointModal({ initial, events, onClose, onSaved }: { initial: Endpoint | null; events: string[]; onClose: () => void; onSaved: (secret?: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [selected, setSelected] = useState<string[]>(initial?.events ?? ['incident.created', 'incident.resolved']);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = selected.includes('*');

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Give the endpoint a name.');
    if (!/^https?:\/\//i.test(url.trim())) return setError('Enter the full URL, starting with https://.');
    if (selected.length === 0) return setError('Choose at least one event.');
    setSaving(true);
    try {
      const body = { name: name.trim(), url: url.trim(), events: selected, enabled };
      if (initial) {
        await api.patch(`/api/webhook-endpoints/${initial.id}`, body);
        toast.success('Endpoint updated');
        onSaved();
      } else {
        const res = await api.post<{ secret: string }>('/api/webhook-endpoints', body);
        toast.success('Endpoint created');
        onSaved(res.secret);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save endpoint');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New webhook endpoint'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save' : 'Create endpoint'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Slack bridge" /></Field>
          <Field label="URL" hint="Must be publicly reachable; HTTPS required in production"><Input type="url" value={url} maxLength={2000} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/resolvex" /></Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Events</span>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#14201a]">
            <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={all} onChange={(e) => setSelected(e.target.checked ? ['*'] : [])} />
            All events (including ones added later)
          </label>
          <div className={cn('grid gap-1 sm:grid-cols-2', all && 'pointer-events-none opacity-50')}>
            {events.map((ev) => (
              <label key={ev} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f6f4ec]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#177a43]" disabled={all} checked={selected.includes(ev)} onChange={(e) => setSelected(e.target.checked ? [...selected.filter((x) => x !== '*'), ev] : selected.filter((x) => x !== ev))} />
                <span>
                  <span className="block font-mono text-xs font-semibold text-[#14201a]">{ev}</span>
                  {EVENT_HELP[ev] && <span className="block text-xs text-[#5f6b64]">{EVENT_HELP[ev]}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#14201a]">
          <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
      </div>
    </Modal>
  );
}

function DeliveryStatus({ d }: { d: Delivery }) {
  if (d.status === 'delivered') return <Pill tone="green">Delivered</Pill>;
  if (d.status === 'failed') return <Pill tone="red">Failed</Pill>;
  return <Pill tone="amber">{d.attempts > 0 ? 'Retrying' : 'Pending'}</Pill>;
}

function Deliveries({ endpoint, version }: { endpoint: Endpoint; version: number }) {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ deliveries: Delivery[] }>(`/api/webhook-endpoints/${endpoint.id}/deliveries?limit=50`, [version]);
  const [inspect, setInspect] = useState<Delivery | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  async function retry(d: Delivery) {
    setRetrying(d.id);
    try {
      const res = await api.post<{ delivery: Delivery | null }>(`/api/webhook-endpoints/${endpoint.id}/deliveries/${d.id}/retry`);
      if (res.delivery?.status === 'delivered') toast.success('Delivered');
      else toast.info(res.delivery?.error ? `Retry attempted: ${res.delivery.error}` : 'Retry attempted');
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setRetrying(null);
    }
  }

  const rows = data?.deliveries ?? [];
  return (
    <SectionCard title={`Deliveries · ${endpoint.name}`} subtitle="Most recent 50" action={<Button size="sm" variant="ghost" onClick={reload} aria-label="Refresh deliveries"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>}>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#5f6b64]">No deliveries yet. Use “Send test” to queue a ping.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                <th className="px-5 py-2">Event</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Response</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-5 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfdbcc]">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-[#f6f4ec]">
                  <td className="px-5 py-2 font-mono text-xs text-[#14201a]">{d.event}</td>
                  <td className="px-3 py-2"><DeliveryStatus d={d} /></td>
                  <td className="px-3 py-2 text-[#3d4a42]">{d.attempts}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#3d4a42]">{d.responseStatus ?? '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-[#991b1b]" title={d.error ?? ''}>{d.error ?? ''}</td>
                  <td className="px-3 py-2 text-xs text-[#5f6b64]" title={formatDateTime(d.createdAt)}>{timeAgo(d.createdAt)}</td>
                  <td className="px-5 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setInspect(d)}><Eye className="h-3.5 w-3.5" /> Payload</Button>
                      {d.status !== 'delivered' && <Button size="sm" variant="secondary" loading={retrying === d.id} onClick={() => retry(d)}><RotateCcw className="h-3.5 w-3.5" /> Retry</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={inspect !== null} onClose={() => setInspect(null)} title={`Delivery #${inspect?.id ?? ''}`} wide>
        {inspect && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><span className="text-xs font-bold uppercase text-[#5f6b64]">Event</span><div className="font-mono text-xs">{inspect.event}</div></div>
              <div><span className="text-xs font-bold uppercase text-[#5f6b64]">Delivery id (X-ResolveX-Delivery)</span><div className="break-all font-mono text-xs">{inspect.eventId}</div></div>
              <div><span className="text-xs font-bold uppercase text-[#5f6b64]">Delivered</span><div className="text-xs">{inspect.deliveredAt ? formatDateTime(inspect.deliveredAt) : '—'}</div></div>
              <div><span className="text-xs font-bold uppercase text-[#5f6b64]">Next attempt</span><div className="text-xs">{inspect.nextAttemptAt ? formatDateTime(inspect.nextAttemptAt) : '—'}</div></div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase text-[#5f6b64]">Payload</span>
              <pre className="mt-1 max-h-80 overflow-auto rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs text-[#14201a]">{JSON.stringify(inspect.payload, null, 2)}</pre>
            </div>
            {inspect.responseSnippet && (
              <div>
                <span className="text-xs font-bold uppercase text-[#5f6b64]">Response ({inspect.responseStatus ?? '—'})</span>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs text-[#14201a]">{inspect.responseSnippet}</pre>
              </div>
            )}
            {inspect.error && <ErrorBanner message={inspect.error} />}
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

export function WebhooksTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<{ endpoints: Endpoint[]; events: string[] }>('/api/webhook-endpoints');
  const [editing, setEditing] = useState<Endpoint | null>(null);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const endpoints = data?.endpoints ?? [];
  const selected = endpoints.find((e) => e.id === selectedId) ?? endpoints[0] ?? null;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (e: Endpoint) =>
    run(`t${e.id}`, async () => {
      await api.patch(`/api/webhook-endpoints/${e.id}`, { enabled: !e.enabled });
      toast.success(e.enabled ? 'Endpoint disabled' : 'Endpoint enabled');
      reload();
    });
  const test = (e: Endpoint) =>
    run(`s${e.id}`, async () => {
      await api.post(`/api/webhook-endpoints/${e.id}/test`);
      toast.success('Test ping queued — it appears in deliveries within a few seconds');
      setSelectedId(e.id);
      setTimeout(() => setVersion((v) => v + 1), 3000);
      setVersion((v) => v + 1);
    });
  const rotate = async (e: Endpoint) => {
    if (!(await confirm({ title: 'Rotate signing secret?', message: `The current secret for ${e.name} stops working immediately. Update your receiver with the new one.`, confirmLabel: 'Rotate' }))) return;
    await run(`r${e.id}`, async () => {
      const res = await api.post<{ secret: string }>(`/api/webhook-endpoints/${e.id}/rotate-secret`);
      setSecret(res.secret);
      reload();
    });
  };
  const remove = async (e: Endpoint) => {
    if (!(await confirm({ title: `Delete ${e.name}?`, message: 'Events stop being sent and the delivery history is deleted.', confirmLabel: 'Delete', danger: true }))) return;
    await run(`d${e.id}`, async () => {
      await api.del(`/api/webhook-endpoints/${e.id}`);
      toast.success('Endpoint deleted');
      reload();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[#5f6b64]">
          ResolveX POSTs JSON to your URL when events happen. Each request is signed with <code className="font-mono text-xs">X-ResolveX-Signature</code> (HMAC-SHA256) — see API &amp; docs for verification code.
        </p>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New endpoint</Button>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : endpoints.length === 0 ? (
        <EmptyState icon={Webhook} title="No webhook endpoints" description="Forward incidents, deployments and ticket changes to chat tools, data pipelines or your own automation." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New endpoint</Button>} />
      ) : (
        <>
          <ul className="space-y-3">
            {endpoints.map((e) => (
              <li key={e.id} className={cn('rounded-2xl border bg-white p-4 shadow-[0_2px_0_#dfdbcc]', selected?.id === e.id ? 'border-[#177a43]' : 'border-[#dfdbcc]')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setSelectedId(e.id)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#14201a]">{e.name}</span>
                      {e.enabled ? <Pill tone="green">Enabled</Pill> : <Pill>Disabled</Pill>}
                    </div>
                    <div className="mt-0.5 break-all font-mono text-xs text-[#5f6b64]">{e.url}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(Array.isArray(e.events) ? e.events : []).map((ev) => <Pill key={ev} tone="blue">{ev === '*' ? 'all events' : ev}</Pill>)}
                    </div>
                    <div className="mt-1 text-xs text-[#5f6b64]">Secret <span className="font-mono">{e.secretPrefix}…</span></div>
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="secondary" loading={busy === `s${e.id}`} onClick={() => test(e)}><Send className="h-3.5 w-3.5" /> Send test</Button>
                    <Button size="sm" variant="ghost" loading={busy === `t${e.id}`} onClick={() => toggle(e)}>{e.enabled ? 'Disable' : 'Enable'}</Button>
                    <Button size="sm" variant="ghost" loading={busy === `r${e.id}`} onClick={() => rotate(e)}><RotateCcw className="h-3.5 w-3.5" /> Rotate secret</Button>
                    <button type="button" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Delete ${e.name}`} onClick={() => remove(e)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {selected && <Deliveries key={selected.id} endpoint={selected} version={version} />}
        </>
      )}
      {(creating || editing) && (
        <EndpointModal
          initial={editing}
          events={data?.events ?? Object.keys(EVENT_HELP)}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(s) => { if (s) setSecret(s); reload(); }}
        />
      )}
      <SecretOnce title="Signing secret" secret={secret} onClose={() => setSecret(null)}>
        <p className="text-xs text-[#5f6b64]">Use it to verify the <code className="font-mono">X-ResolveX-Signature</code> header: compute HMAC-SHA256 of <code className="font-mono">{'`${timestamp}.${rawBody}`'}</code> and compare with <code className="font-mono">v1</code>.</p>
      </SecretOnce>
    </div>
  );
}
