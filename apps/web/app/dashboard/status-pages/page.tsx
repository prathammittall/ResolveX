'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Eye, Globe, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { EmptyState, ErrorBanner, cn } from '../_components/ui';
import { Button, Field, Input, Modal, PageHeader, Pill, SkeletonRows, Textarea, useApi, useConfirm, useToast } from '../_components/kit';
import { useServices } from '../oncall/_shared';
import StatusView, { type PublicStatusPage } from '../../status/StatusView';

type StatusPageRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  brandColor: string | null;
  logoUrl: string | null;
  supportUrl: string | null;
  showIncidentHistory: boolean;
  serviceIds: number[];
  updatedAt: string;
};

type Draft = { name: string; slug: string; description: string; isPublic: boolean; brandColor: string; useBrand: boolean; logoUrl: string; supportUrl: string; showIncidentHistory: boolean; serviceIds: number[] };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

function draftFrom(p: StatusPageRow | null): Draft {
  if (!p) return { name: '', slug: '', description: '', isPublic: false, brandColor: '#177a43', useBrand: false, logoUrl: '', supportUrl: '', showIncidentHistory: true, serviceIds: [] };
  return { name: p.name, slug: p.slug, description: p.description ?? '', isPublic: p.isPublic, brandColor: p.brandColor ?? '#177a43', useBrand: Boolean(p.brandColor), logoUrl: p.logoUrl ?? '', supportUrl: p.supportUrl ?? '', showIncidentHistory: p.showIncidentHistory, serviceIds: p.serviceIds };
}

function PageModal({ initial, onClose, onSaved }: { initial: StatusPageRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const services = useServices();
  const [d, setD] = useState<Draft>(() => draftFrom(initial));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: number) => services.find((s) => s.id === id)?.name ?? `Service #${id}`;
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.serviceIds.length) return;
    const next = [...d.serviceIds];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setD({ ...d, serviceIds: next });
  };

  async function save() {
    setError(null);
    if (!d.name.trim()) return setError('Give the page a name.');
    if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(d.slug)) return setError('The URL slug must be 3–63 lowercase letters, digits and dashes, starting with a letter or digit.');
    if (d.logoUrl && !/^https:\/\//i.test(d.logoUrl.trim())) return setError('The logo must be an https:// URL.');
    if (d.supportUrl && !/^https?:\/\//i.test(d.supportUrl.trim())) return setError('The support link must be an http(s) URL.');
    if (d.useBrand && !/^#[0-9a-fA-F]{6}$/.test(d.brandColor)) return setError('Brand color must be a hex color like #177a43.');
    const body = {
      name: d.name.trim(),
      slug: d.slug,
      description: d.description.trim() || null,
      isPublic: d.isPublic,
      brandColor: d.useBrand ? d.brandColor : null,
      logoUrl: d.logoUrl.trim() || null,
      supportUrl: d.supportUrl.trim() || null,
      showIncidentHistory: d.showIncidentHistory,
      serviceIds: d.serviceIds,
    };
    setSaving(true);
    try {
      if (initial) await api.patch(`/api/status-pages/${initial.id}`, body);
      else await api.post('/api/status-pages', body);
      toast.success(initial ? 'Status page updated' : 'Status page created');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save status page');
    } finally {
      setSaving(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New status page'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save changes' : 'Create page'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={d.name} maxLength={100} placeholder="Acme status" onChange={(e) => setD({ ...d, name: e.target.value, slug: slugTouched ? d.slug : slugify(e.target.value) })} />
          </Field>
          <Field label="URL slug" hint={`${origin}/status/${d.slug || 'your-slug'}`}>
            <Input value={d.slug} maxLength={63} onChange={(e) => { setSlugTouched(true); setD({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }); }} />
          </Field>
        </div>
        <Field label="Description"><Textarea value={d.description} maxLength={1000} className="min-h-[60px]" onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="Live status of Acme's customer-facing services." /></Field>

        <div className={cn('rounded-xl border p-3', d.isPublic ? 'border-[#b2e2a8] bg-[#dcefd8]' : 'border-[#dfdbcc] bg-[#fbfaf6]')}>
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#177a43]" checked={d.isPublic} onChange={(e) => setD({ ...d, isPublic: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold text-[#14201a]">Public</span>
              <span className="block text-xs text-[#3d4a42]">
                Anyone with the link can see this page without signing in. Only service display names, health, uptime and incident titles are shown — never people, descriptions, URLs or timelines. Private pages can only be previewed here.
              </span>
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Brand color">
            <div className="flex items-center gap-2">
              <input type="checkbox" aria-label="Use a custom brand color" className="h-4 w-4 accent-[#177a43]" checked={d.useBrand} onChange={(e) => setD({ ...d, useBrand: e.target.checked })} />
              <input type="color" aria-label="Brand color picker" disabled={!d.useBrand} value={/^#[0-9a-fA-F]{6}$/.test(d.brandColor) ? d.brandColor : '#177a43'} onChange={(e) => setD({ ...d, brandColor: e.target.value })} className="h-9 w-10 cursor-pointer rounded-lg border border-[#dfdbcc] disabled:opacity-40" />
              <Input value={d.brandColor} disabled={!d.useBrand} onChange={(e) => setD({ ...d, brandColor: e.target.value })} maxLength={7} className="font-mono" />
            </div>
          </Field>
          <Field label="Logo URL" hint="HTTPS image, shown at 40×40"><Input type="url" value={d.logoUrl} maxLength={500} placeholder="https://…/logo.png" onChange={(e) => setD({ ...d, logoUrl: e.target.value })} /></Field>
          <Field label="Support URL" hint="“Get support” button"><Input type="url" value={d.supportUrl} maxLength={500} placeholder="https://support.example.com" onChange={(e) => setD({ ...d, supportUrl: e.target.value })} /></Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#14201a]">
          <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={d.showIncidentHistory} onChange={(e) => setD({ ...d, showIncidentHistory: e.target.checked })} />
          Show resolved incidents from the last 90 days
        </label>

        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Services shown (in order)</span>
          {d.serviceIds.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dfdbcc] px-3 py-3 text-sm text-[#5f6b64]">No services yet. Only services you add appear on the page.</p>
          ) : (
            <ol className="divide-y divide-[#dfdbcc] rounded-xl border border-[#dfdbcc]">
              {d.serviceIds.map((id, i) => (
                <li key={id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-xs font-bold text-[#5f6b64]">{i + 1}</span>
                  <span className="flex-1 truncate text-sm text-[#14201a]">{nameOf(id)}</span>
                  <button type="button" aria-label={`Move ${nameOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Move ${nameOf(id)} down`} disabled={i === d.serviceIds.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => setD({ ...d, serviceIds: d.serviceIds.filter((x) => x !== id) })} className="rounded p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2 flex gap-2">
            <label htmlFor="sp-add-service" className="sr-only">Add service</label>
            <select id="sp-add-service" value={adding} onChange={(e) => setAdding(e.target.value)} className="min-w-0 flex-1 cursor-pointer rounded-xl border border-[#dfdbcc] bg-white px-3 py-2 text-sm text-[#14201a]">
              <option value="">Choose a service…</option>
              {services.filter((s) => !d.serviceIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button variant="secondary" disabled={!adding} onClick={() => { setD({ ...d, serviceIds: [...d.serviceIds, Number(adding)] }); setAdding(''); }}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button variant="ghost" disabled={services.length === 0 || services.every((s) => d.serviceIds.includes(s.id))} onClick={() => setD({ ...d, serviceIds: [...d.serviceIds, ...services.filter((s) => !d.serviceIds.includes(s.id)).map((s) => s.id)] })}>
              Add all
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PreviewModal({ page, onClose }: { page: StatusPageRow; onClose: () => void }) {
  const { data, error, loading } = useApi<{ page: PublicStatusPage }>(`/api/status-pages/${page.id}/preview`);
  return (
    <Modal open wide onClose={onClose} title={`Preview · ${page.name}`}>
      {!page.isPublic && <p className="mb-3 rounded-xl border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-xs text-[#92400e]">This page is private. Only signed-in members can see this preview.</p>}
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <SkeletonRows rows={5} /> : data ? <div className="-mx-5 -mb-4 overflow-hidden border-t border-[#dfdbcc]"><StatusView page={data.page} /></div> : null}
    </Modal>
  );
}

export default function StatusPagesAdmin() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'statuspages:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const services = useServices();
  const { data, error, loading, reload } = useApi<{ statusPages: StatusPageRow[] }>('/api/status-pages');
  const [editing, setEditing] = useState<StatusPageRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<StatusPageRow | null>(null);

  async function remove(p: StatusPageRow) {
    const ok = await confirm({ title: `Delete ${p.name}?`, message: `The page ${p.isPublic ? `at /status/${p.slug} ` : ''}stops working immediately. This cannot be undone.`, confirmLabel: 'Delete page', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/status-pages/${p.id}`);
      toast.success('Status page deleted');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  const pages = data?.statusPages ?? [];

  return (
    <div>
      <PageHeader
        title="Status pages"
        description="Customer-facing pages showing the health and 90-day uptime of the services you choose."
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New status page</Button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : pages.length === 0 ? (
        <EmptyState icon={Globe} title="No status pages" description="Publish a status page so customers can check service health without contacting support." action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New status page</Button> : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pages.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
              <div className="h-1.5" style={{ background: p.brandColor ?? '#177a43' }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display truncate text-base font-bold text-[#14201a]">{p.name}</h3>
                      {p.isPublic ? <Pill tone="green"><Globe className="h-3 w-3" /> Public</Pill> : <Pill><Lock className="h-3 w-3" /> Private</Pill>}
                    </div>
                    <p className="font-mono text-xs text-[#5f6b64]">/status/{p.slug}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Delete ${p.name}`} onClick={() => remove(p)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                {p.description && <p className="mt-2 text-sm text-[#3d4a42]">{p.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.serviceIds.length === 0 ? (
                    <span className="text-xs text-[#5f6b64]">No services listed</span>
                  ) : (
                    p.serviceIds.map((id) => <Pill key={id} tone="blue">{services.find((s) => s.id === id)?.name ?? `Service #${id}`}</Pill>)
                  )}
                </div>
                <p className="mt-2 text-xs text-[#5f6b64]">{p.showIncidentHistory ? 'Shows incident history' : 'Hides incident history'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(p)}><Eye className="h-3.5 w-3.5" /> Preview</Button>
                  {p.isPublic && (
                    <a href={`/status/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfdbcc] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14201a] hover:bg-[#eeebe0]">
                      <ExternalLink className="h-3.5 w-3.5" /> Open public page
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {(creating || editing) && <PageModal initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={reload} />}
      {preview && <PreviewModal page={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
