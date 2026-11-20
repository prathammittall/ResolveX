'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Repeat, Trash2, Wrench } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { EmptyState, ErrorBanner, SectionCard, cn, formatDateTime } from '../_components/ui';
import { Button, Field, Input, Modal, PageHeader, Pill, Select, SkeletonRows, Textarea, useApi, useConfirm, useToast } from '../_components/kit';
import { CheckList, browserTimezone, fromLocalInput, timezones, toLocalInput, useServices } from '../oncall/_shared';

type Severity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
type MaintWindow = {
  id: number;
  serviceId: number | null;
  serviceIds: number[] | null;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  enabled: boolean;
  bypassSeverity: Severity | null;
  recurrence: 'daily' | 'weekly' | 'none' | null;
  recurrenceUntil: string | null;
  createdAt: string;
};

const PERIOD: Record<string, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 };
const BYPASS_OPTIONS: Array<{ value: '' | Severity; label: string }> = [
  { value: '', label: 'Silence everything (no pages)' },
  { value: 'sev1', label: 'Still page for SEV1' },
  { value: 'sev2', label: 'Still page for SEV2 and above (SEV1–SEV2)' },
  { value: 'sev3', label: 'Still page for SEV3 and above (SEV1–SEV3)' },
  { value: 'sev4', label: 'Still page for every severity (only mark services as in maintenance)' },
];

/** Where a window stands right now, including its recurring occurrences. */
function phase(w: MaintWindow, now: number): { kind: 'active' | 'upcoming' | 'past'; occStart: number; occEnd: number } {
  const start = Date.parse(w.startsAt);
  const end = Date.parse(w.endsAt);
  const dur = end - start;
  if (now < start) return { kind: 'upcoming', occStart: start, occEnd: end };
  if (now < end) return { kind: 'active', occStart: start, occEnd: end };
  const period = w.recurrence ? PERIOD[w.recurrence] : undefined;
  const until = w.recurrenceUntil ? Date.parse(w.recurrenceUntil) : Infinity;
  if (!period || now > until) return { kind: 'past', occStart: start, occEnd: end };
  const n = Math.floor((now - start) / period);
  const occStart = start + n * period;
  if (now < occStart + dur) return { kind: 'active', occStart, occEnd: occStart + dur };
  const next = occStart + period;
  if (next > until) return { kind: 'past', occStart, occEnd: occStart + dur };
  return { kind: 'upcoming', occStart: next, occEnd: next + dur };
}

type Draft = { name: string; description: string; allServices: boolean; serviceIds: number[]; startsAt: string; endsAt: string; timezone: string; recurrence: 'none' | 'daily' | 'weekly'; recurrenceUntil: string; bypass: '' | Severity; enabled: boolean };

function draftFrom(w: MaintWindow | null): Draft {
  if (!w) {
    const s = new Date(Date.now() + 3_600_000);
    s.setMinutes(0, 0, 0);
    return { name: '', description: '', allServices: false, serviceIds: [], startsAt: toLocalInput(s.toISOString()), endsAt: toLocalInput(new Date(s.getTime() + 2 * 3_600_000).toISOString()), timezone: browserTimezone(), recurrence: 'none', recurrenceUntil: '', bypass: 'sev1', enabled: true };
  }
  const ids = [...(Array.isArray(w.serviceIds) ? w.serviceIds : []), ...(w.serviceId ? [w.serviceId] : [])];
  return {
    name: w.name,
    description: w.description ?? '',
    allServices: ids.length === 0,
    serviceIds: [...new Set(ids)],
    startsAt: toLocalInput(w.startsAt),
    endsAt: toLocalInput(w.endsAt),
    timezone: w.timezone,
    recurrence: w.recurrence === 'daily' || w.recurrence === 'weekly' ? w.recurrence : 'none',
    recurrenceUntil: toLocalInput(w.recurrenceUntil),
    bypass: w.bypassSeverity ?? '',
    enabled: w.enabled,
  };
}

function WindowModal({ initial, onClose, onSaved }: { initial: MaintWindow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const services = useServices();
  const [d, setD] = useState<Draft>(() => draftFrom(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => timezones(d.timezone), [d.timezone]);

  async function save() {
    setError(null);
    const startsAt = fromLocalInput(d.startsAt);
    const endsAt = fromLocalInput(d.endsAt);
    if (!d.name.trim()) return setError('Give the window a name.');
    if (!startsAt || !endsAt) return setError('Choose a start and end time.');
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return setError('The window must end after it starts.');
    if (!d.allServices && d.serviceIds.length === 0) return setError('Pick the affected services, or choose “All services”.');
    const until = d.recurrence !== 'none' ? fromLocalInput(d.recurrenceUntil) : null;
    if (until && Date.parse(until) < Date.parse(startsAt)) return setError('“Repeat until” must be after the first start.');
    const body = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      serviceId: null,
      serviceIds: d.allServices ? null : d.serviceIds,
      startsAt,
      endsAt,
      timezone: d.timezone,
      recurrence: d.recurrence,
      recurrenceUntil: until,
      bypassSeverity: d.bypass || null,
      enabled: d.enabled,
    };
    setSaving(true);
    try {
      if (initial) await api.patch(`/api/maintenance-windows/${initial.id}`, body);
      else await api.post('/api/maintenance-windows', body);
      toast.success(initial ? 'Maintenance window updated' : 'Maintenance window scheduled');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save maintenance window');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'Schedule maintenance'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save changes' : 'Schedule'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={150} placeholder="Database upgrade" /></Field>
        <Field label="Description" hint="Shown on status pages that include an affected service."><Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={2000} className="min-h-[60px]" /></Field>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Affected services</span>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-[#14201a]">
            <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={d.allServices} onChange={(e) => setD({ ...d, allServices: e.target.checked })} />
            All services
          </label>
          {!d.allServices && <CheckList options={services.map((s) => ({ value: s.id, label: s.name, hint: s.environment }))} value={d.serviceIds} onChange={(v) => setD({ ...d, serviceIds: v })} empty="No services yet." />}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starts" hint="Your local time"><Input type="datetime-local" value={d.startsAt} onChange={(e) => setD({ ...d, startsAt: e.target.value })} /></Field>
          <Field label="Ends" hint="Your local time"><Input type="datetime-local" value={d.endsAt} onChange={(e) => setD({ ...d, endsAt: e.target.value })} /></Field>
          <Field label="Timezone" hint="Used when announcing the window">
            <Select value={d.timezone} onChange={(e) => setD({ ...d, timezone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repeats">
            <Select value={d.recurrence} onChange={(e) => setD({ ...d, recurrence: e.target.value as Draft['recurrence'] })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily at the same time</option>
              <option value="weekly">Weekly at the same time</option>
            </Select>
          </Field>
          {d.recurrence !== 'none' && (
            <Field label="Repeat until" hint="Leave empty to repeat indefinitely">
              <Input type="datetime-local" value={d.recurrenceUntil} onChange={(e) => setD({ ...d, recurrenceUntil: e.target.value })} />
            </Field>
          )}
        </div>
        <Field label="Paging during maintenance" hint="Alerts on affected services are suppressed while the window is active. Choose a severity to keep paging for serious incidents — that severity and anything more severe still notify on-call.">
          <Select value={d.bypass} onChange={(e) => setD({ ...d, bypass: e.target.value as Draft['bypass'] })}>
            {BYPASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#14201a]">
          <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
    </Modal>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'services:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const services = useServices();
  const { data, error, loading, reload } = useApi<{ maintenanceWindows: MaintWindow[] }>('/api/maintenance-windows');
  const [editing, setEditing] = useState<MaintWindow | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const now = Date.now();
  const groups = useMemo(() => {
    const rows = (data?.maintenanceWindows ?? []).map((w) => ({ w, p: phase(w, now) }));
    return {
      active: rows.filter((r) => r.p.kind === 'active').sort((a, b) => a.p.occEnd - b.p.occEnd),
      upcoming: rows.filter((r) => r.p.kind === 'upcoming').sort((a, b) => a.p.occStart - b.p.occStart),
      past: rows.filter((r) => r.p.kind === 'past').sort((a, b) => b.p.occEnd - a.p.occEnd),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const affected = (w: MaintWindow) => {
    const ids = [...new Set([...(Array.isArray(w.serviceIds) ? w.serviceIds : []), ...(w.serviceId ? [w.serviceId] : [])])];
    if (ids.length === 0) return 'All services';
    return ids.map((id) => services.find((s) => s.id === id)?.name ?? `Service #${id}`).join(', ');
  };

  async function toggle(w: MaintWindow) {
    setBusy(w.id);
    try {
      await api.patch(`/api/maintenance-windows/${w.id}`, { enabled: !w.enabled });
      toast.success(w.enabled ? 'MaintWindow disabled' : 'MaintWindow enabled');
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(w: MaintWindow) {
    const ok = await confirm({ title: `Delete ${w.name}?`, message: 'The window and its schedule are removed. Alerts on these services will page normally.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/maintenance-windows/${w.id}`);
      toast.success('Maintenance window deleted');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  const Row = ({ w, p }: { w: MaintWindow; p: ReturnType<typeof phase> }) => (
    <li className={cn('flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0', !w.enabled && 'opacity-60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#14201a]">{w.name}</span>
          {!w.enabled && <Pill>Disabled</Pill>}
          {w.recurrence && w.recurrence !== 'none' && (
            <Pill tone="violet"><Repeat className="h-3 w-3" /> {w.recurrence}{w.recurrenceUntil ? ` until ${new Date(w.recurrenceUntil).toLocaleDateString()}` : ''}</Pill>
          )}
          <Pill tone={w.bypassSeverity ? 'amber' : 'slate'}>{w.bypassSeverity ? `Pages ${w.bypassSeverity.toUpperCase()}${w.bypassSeverity === 'sev1' ? '' : '+'}` : 'All pages silenced'}</Pill>
        </div>
        <p className="mt-1 text-xs text-[#5f6b64]">
          {formatDateTime(new Date(p.occStart).toISOString())} – {formatDateTime(new Date(p.occEnd).toISOString())} · {w.timezone}
        </p>
        <p className="mt-0.5 text-xs text-[#3d4a42]">{affected(w)}</p>
        {w.description && <p className="mt-1 text-sm text-[#3d4a42]">{w.description}</p>}
      </div>
      {canManage && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" loading={busy === w.id} onClick={() => toggle(w)}>{w.enabled ? 'Disable' : 'Enable'}</Button>
          <button type="button" aria-label={`Edit ${w.name}`} onClick={() => setEditing(w)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><Pencil className="h-4 w-4" /></button>
          <button type="button" aria-label={`Delete ${w.name}`} onClick={() => remove(w)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </li>
  );

  const total = data?.maintenanceWindows.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Planned work windows. Alerts on affected services are suppressed (unless severe enough to bypass) and status pages announce the work."
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Schedule maintenance</Button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={5} />
      ) : total === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance scheduled" description="Schedule a window before deploys or migrations so on-call isn't paged for expected downtime." action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Schedule maintenance</Button> : undefined} />
      ) : (
        <div className="space-y-6">
          <SectionCard title={`In progress (${groups.active.length})`}>
            {groups.active.length === 0 ? <p className="text-sm text-[#5f6b64]">Nothing is under maintenance right now.</p> : <ul className="divide-y divide-[#dfdbcc]">{groups.active.map((r) => <Row key={r.w.id} w={r.w} p={r.p} />)}</ul>}
          </SectionCard>
          <SectionCard title={`Upcoming (${groups.upcoming.length})`}>
            {groups.upcoming.length === 0 ? <p className="text-sm text-[#5f6b64]">No upcoming windows.</p> : <ul className="divide-y divide-[#dfdbcc]">{groups.upcoming.map((r) => <Row key={r.w.id} w={r.w} p={r.p} />)}</ul>}
          </SectionCard>
          <SectionCard title={`History (${groups.past.length})`}>
            {groups.past.length === 0 ? <p className="text-sm text-[#5f6b64]">No past windows.</p> : <ul className="divide-y divide-[#dfdbcc]">{groups.past.map((r) => <Row key={r.w.id} w={r.w} p={r.p} />)}</ul>}
          </SectionCard>
        </div>
      )}
      {(creating || editing) && <WindowModal initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={reload} />}
    </div>
  );
}
