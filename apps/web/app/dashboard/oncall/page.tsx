'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { EmptyState, ErrorBanner, SectionCard, cn, formatDateTime } from '../_components/ui';
import { Avatar } from '../_components/work';
import { Button, Field, Input, MemberSelect, Modal, PageHeader, Pill, Select, Skeleton, SkeletonRows, Textarea, useApi, useConfirm, useMembers, useToast } from '../_components/kit';
import { browserTimezone, fromLocalInput, timezones, toLocalInput, useTeams } from './_shared';

type Person = { id: number; name: string; email: string; avatarUrl?: string | null };
type Override = { id: number; scheduleId: number; userId: number; startsAt: string; endsAt: string; reason: string | null; user: Person | null };
type Schedule = {
  id: number;
  name: string;
  description: string | null;
  teamId: string | null;
  timezone: string;
  rotationHours: number;
  rotationStart: string;
  participants: Person[];
  current: { primary: number | null; secondary: number | null; shiftStart: string | null; shiftEnd: string | null; overridden: boolean; primaryUser: Person | null; secondaryUser: Person | null };
  overrides: Override[];
};
type Shift = { userId: number; startsAt: string; endsAt: string; user: Person | null };
type Calendar = { shifts: Shift[]; overrides: Override[] };

function rotationLabel(hours: number) {
  if (hours === 24) return 'Daily';
  if (hours === 168) return 'Weekly';
  if (hours === 336) return 'Every 2 weeks';
  if (hours % 24 === 0) return `Every ${hours / 24} days`;
  return `Every ${hours} h`;
}

function PersonChip({ person, label }: { person: Person | null; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {person ? <Avatar name={person.name} size={28} /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eeebe0]"><UserRound className="h-4 w-4 text-[#5f6b64]" /></span>}
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5f6b64]">{label}</div>
        <div className="truncate text-sm font-semibold text-[#14201a]">{person?.name ?? 'Nobody'}</div>
      </div>
    </div>
  );
}

// ---------------- Schedule form ----------------
type FormState = { name: string; description: string; teamId: string; timezone: string; rotationHours: number; rotationStart: string; participants: number[] };

function ScheduleModal({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: Schedule | null; onSaved: () => void }) {
  const toast = useToast();
  const teams = useTeams();
  const members = useMembers();
  const [form, setForm] = useState<FormState>(() => blank(initial));
  const [adding, setAdding] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => timezones(form.timezone), [form.timezone]);

  function blank(s: Schedule | null): FormState {
    if (s) return { name: s.name, description: s.description ?? '', teamId: s.teamId ?? '', timezone: s.timezone, rotationHours: s.rotationHours, rotationStart: toLocalInput(s.rotationStart), participants: s.participants.map((p) => p.id) };
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    return { name: '', description: '', teamId: '', timezone: browserTimezone(), rotationHours: 168, rotationStart: toLocalInput(start.toISOString()), participants: [] };
  }

  const nameOf = (id: number) => members.find((m) => m.userId === id)?.name ?? initial?.participants.find((p) => p.id === id)?.name ?? `User #${id}`;
  const move = (i: number, d: -1 | 1) => {
    const next = [...form.participants];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setForm({ ...form, participants: next });
  };

  async function save() {
    setError(null);
    const rotationStart = fromLocalInput(form.rotationStart);
    if (!form.name.trim()) return setError('Give the schedule a name.');
    if (!rotationStart) return setError('Choose when the rotation starts.');
    if (form.participants.length === 0) return setError('Add at least one participant.');
    if (!Number.isInteger(form.rotationHours) || form.rotationHours < 1 || form.rotationHours > 672) return setError('Rotation length must be between 1 and 672 hours.');
    const body = { name: form.name.trim(), description: form.description.trim() || null, teamId: form.teamId || null, timezone: form.timezone, rotationHours: form.rotationHours, rotationStart, participants: form.participants };
    setSaving(true);
    try {
      if (initial) await api.patch(`/api/oncall/schedules/${initial.id}`, body);
      else await api.post('/api/oncall/schedules', body);
      toast.success(initial ? 'Schedule updated' : 'Schedule created');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New on-call schedule'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save changes' : 'Create schedule'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Platform primary" maxLength={100} /></Field>
          <Field label="Team" hint="Incidents for this team's services route to this rotation.">
            <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} className="min-h-[60px]" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rotation length (hours)" hint={rotationLabel(form.rotationHours || 1)}>
            <Input type="number" min={1} max={672} value={form.rotationHours} onChange={(e) => setForm({ ...form, rotationHours: Number(e.target.value) })} />
            <div className="mt-1.5 flex gap-1">
              {[{ l: 'Daily', h: 24 }, { l: 'Weekly', h: 168 }, { l: '2 weeks', h: 336 }].map((p) => (
                <button key={p.h} type="button" onClick={() => setForm({ ...form, rotationHours: p.h })} className={cn('rounded-lg border px-2 py-0.5 text-xs font-semibold', form.rotationHours === p.h ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#dfdbcc] text-[#3d4a42] hover:bg-[#eeebe0]')}>
                  {p.l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Rotation starts" hint="Your local time; first handoff happens here.">
            <Input type="datetime-local" value={form.rotationStart} onChange={(e) => setForm({ ...form, rotationStart: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Participants (rotation order)</span>
          {form.participants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dfdbcc] px-3 py-3 text-sm text-[#5f6b64]">No one yet. The first person is primary for the first shift; the next person is their secondary.</p>
          ) : (
            <ol className="divide-y divide-[#dfdbcc] rounded-xl border border-[#dfdbcc]">
              {form.participants.map((id, i) => (
                <li key={id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-xs font-bold text-[#5f6b64]">{i + 1}</span>
                  <Avatar name={nameOf(id)} size={24} />
                  <span className="flex-1 truncate text-sm text-[#14201a]">{nameOf(id)}</span>
                  <button type="button" aria-label={`Move ${nameOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Move ${nameOf(id)} down`} disabled={i === form.participants.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => setForm({ ...form, participants: form.participants.filter((p) => p !== id) })} className="rounded p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="oncall-add-participant">Add participant</label>
            <select
              id="oncall-add-participant"
              value={adding ?? ''}
              onChange={(e) => setAdding(e.target.value ? Number(e.target.value) : null)}
              className="min-w-0 flex-1 cursor-pointer rounded-xl border border-[#dfdbcc] bg-white px-3 py-2 text-sm text-[#14201a]"
            >
              <option value="">Choose a person…</option>
              {members.filter((m) => !form.participants.includes(m.userId)).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
            <Button
              variant="secondary"
              disabled={adding === null}
              onClick={() => {
                if (adding !== null) setForm({ ...form, participants: [...form.participants, adding] });
                setAdding(null);
              }}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Override form ----------------
function OverrideModal({ schedule, onClose, onSaved }: { schedule: Schedule | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [userId, setUserId] = useState<number | null>(null);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const [startsAt, setStartsAt] = useState(toLocalInput(now.toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(now.getTime() + 8 * 3_600_000).toISOString()));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!schedule) return;
    setError(null);
    const s = fromLocalInput(startsAt);
    const e = fromLocalInput(endsAt);
    if (!userId) return setError('Choose who covers the shift.');
    if (!s || !e) return setError('Choose a start and end time.');
    if (Date.parse(e) <= Date.parse(s)) return setError('The override must end after it starts.');
    setSaving(true);
    try {
      await api.post(`/api/oncall/schedules/${schedule.id}/overrides`, { userId, startsAt: s, endsAt: e, reason: reason.trim() || null });
      toast.success('Override added');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add override');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={schedule !== null}
      onClose={onClose}
      title={`Add override${schedule ? ` · ${schedule.name}` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Add override</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <p className="text-sm text-[#3d4a42]">During an override the chosen person is primary; the scheduled primary becomes secondary.</p>
        <Field label="Covering person"><MemberSelect value={userId} onChange={setUserId} noneLabel="Choose a person…" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts"><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
        </div>
        <Field label="Reason (optional)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Vacation swap" /></Field>
      </div>
    </Modal>
  );
}

// ---------------- Calendar ----------------
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

function CalendarPanel({ schedule, canManage, version, onChanged, onAddOverride }: { schedule: Schedule; canManage: boolean; version: number; onChanged: () => void; onAddOverride: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [weeks, setWeeks] = useState<2 | 4>(2);
  const [offset, setOffset] = useState(0);
  const from = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - d.getDay() + offset * 7 * weeks);
    return d;
  }, [offset, weeks]);
  const days = weeks * 7;
  const { data, error, loading, reload } = useApi<Calendar>(`/api/oncall/schedules/${schedule.id}/calendar?from=${encodeURIComponent(from.toISOString())}&days=${days}`, [schedule.rotationHours, schedule.rotationStart, schedule.participants.map((p) => p.id).join(','), version]);

  const cells = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const dayStart = new Date(from);
      dayStart.setDate(from.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      const s = dayStart.getTime();
      const e = dayEnd.getTime();
      const shifts = (data?.shifts ?? []).filter((x) => overlaps(Date.parse(x.startsAt), Date.parse(x.endsAt), s, e));
      const overrides = (data?.overrides ?? []).filter((x) => overlaps(Date.parse(x.startsAt), Date.parse(x.endsAt), s, e));
      return { date: dayStart, shifts, overrides };
    });
  }, [data, from, days]);

  const today = startOfDay(new Date()).getTime();
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  async function removeOverride(o: Override) {
    const ok = await confirm({ title: 'Remove override?', message: `${o.user?.name ?? 'This person'} will no longer cover ${formatDateTime(o.startsAt)} – ${formatDateTime(o.endsAt)}.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/oncall/schedules/${schedule.id}/overrides/${o.id}`);
      toast.success('Override removed');
      reload();
      onChanged();
    } catch (e) {
      toast.error(e);
    }
  }

  const overrideList = [...(data?.overrides ?? [])].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const last = new Date(from);
  last.setDate(from.getDate() + days - 1);

  return (
    <SectionCard
      title={`Calendar · ${schedule.name}`}
      subtitle={`${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · shown in your local time`}
      action={
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous period" onClick={() => setOffset((o) => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="secondary" onClick={() => setOffset(0)}>Today</Button>
          <Button size="sm" variant="ghost" aria-label="Next period" onClick={() => setOffset((o) => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Select aria-label="Weeks shown" className="w-auto py-1 text-xs" value={weeks} onChange={(e) => { setWeeks(Number(e.target.value) as 2 | 4); setOffset(0); }}>
            <option value={2}>2 weeks</option>
            <option value={4}>4 weeks</option>
          </Select>
          {canManage && <Button size="sm" onClick={onAddOverride}><Plus className="h-3.5 w-3.5" /> Override</Button>}
        </div>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7 gap-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-1 text-[10px] font-bold uppercase tracking-wide text-[#5f6b64]">{d}</div>
              ))}
              {cells.map((c) => {
                const isToday = c.date.getTime() === today;
                return (
                  <div key={c.date.toISOString()} className={cn('min-h-[92px] rounded-xl border p-1.5', isToday ? 'border-[#b2e2a8] bg-[#dcefd8]/40' : 'border-[#dfdbcc] bg-[#fbfaf6]')}>
                    <div className={cn('mb-1 text-xs font-bold', isToday ? 'text-[#177a43]' : 'text-[#3d4a42]')}>
                      {c.date.toLocaleDateString(undefined, { month: c.date.getDate() === 1 ? 'short' : undefined, day: 'numeric' })}
                    </div>
                    <div className="space-y-1">
                      {c.overrides.map((o) => (
                        <div key={`o-${o.id}`} className="truncate rounded-md border border-[#fde68a] bg-[#fef3c7] px-1.5 py-0.5 text-[11px] font-semibold text-[#92400e]" title={`Override: ${o.user?.name ?? 'Unknown'} ${formatDateTime(o.startsAt)} – ${formatDateTime(o.endsAt)}${o.reason ? ` (${o.reason})` : ''}`}>
                          ⇄ {o.user?.name ?? 'Unknown'}
                        </div>
                      ))}
                      {c.shifts.map((s) => {
                        const startsHere = Date.parse(s.startsAt) > c.date.getTime();
                        return (
                          <div key={`s-${s.startsAt}`} className="truncate rounded-md bg-white px-1.5 py-0.5 text-[11px] text-[#14201a]" title={`${s.user?.name ?? `User #${s.userId}`}: ${formatDateTime(s.startsAt)} – ${formatDateTime(s.endsAt)}`}>
                            {startsHere && <span className="text-[#5f6b64]">{time(s.startsAt)} </span>}
                            {s.user?.name ?? `User #${s.userId}`}
                          </div>
                        );
                      })}
                      {c.shifts.length === 0 && c.overrides.length === 0 && <div className="text-[11px] text-[#5f6b64]">—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#5f6b64]">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-[#dfdbcc] bg-white" /> Scheduled primary</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-[#fde68a] bg-[#fef3c7]" /> Override</span>
          </div>

          <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Overrides in this period</h4>
          {overrideList.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">No overrides. {canManage ? 'Add one to cover vacations or swaps.' : ''}</p>
          ) : (
            <ul className="divide-y divide-[#dfdbcc] rounded-xl border border-[#dfdbcc]">
              {overrideList.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <Avatar name={o.user?.name ?? '?'} size={24} />
                  <span className="font-semibold text-[#14201a]">{o.user?.name ?? `User #${o.userId}`}</span>
                  <span className="text-xs text-[#5f6b64]">{formatDateTime(o.startsAt)} – {formatDateTime(o.endsAt)}</span>
                  {o.reason && <Pill tone="amber">{o.reason}</Pill>}
                  {canManage && (
                    <button type="button" aria-label="Remove override" onClick={() => removeOverride(o)} className="ml-auto rounded-lg p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ---------------- Page ----------------
export default function OnCallPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'oncall:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const teams = useTeams();
  const { data, error, loading, reload } = useApi<{ schedules: Schedule[] }>('/api/oncall/schedules');
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overrideFor, setOverrideFor] = useState<Schedule | null>(null);
  const [calVersion, setCalVersion] = useState(0);

  const schedules = data?.schedules ?? [];
  const selected = schedules.find((s) => s.id === selectedId) ?? schedules[0] ?? null;

  async function remove(s: Schedule) {
    const ok = await confirm({ title: `Delete ${s.name}?`, message: 'The rotation and all of its overrides are deleted. Escalation steps that page this schedule will no longer reach anyone.', confirmLabel: 'Delete schedule', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/oncall/schedules/${s.id}`);
      toast.success('Schedule deleted');
      if (selectedId === s.id) setSelectedId(null);
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  return (
    <div>
      <PageHeader
        title="On-call"
        description="Rotations decide who gets paged. Escalation policies can target a schedule to reach whoever is on call right now."
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New schedule</Button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No on-call schedules yet"
          description="Create a rotation so incidents always reach a person, even outside working hours."
          action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New schedule</Button> : undefined}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedules.map((s) => {
              const active = selected?.id === s.id;
              return (
                <div key={s.id} className={cn('rounded-2xl border bg-white p-4 shadow-[0_2px_0_#dfdbcc]', active ? 'border-[#177a43]' : 'border-[#dfdbcc]')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display truncate text-base font-bold text-[#14201a]">{s.name}</h3>
                      <p className="text-xs text-[#5f6b64]">
                        {rotationLabel(s.rotationHours)} · {s.participants.length} {s.participants.length === 1 ? 'person' : 'people'} · {s.timezone}
                        {s.teamId && ` · ${teams.find((t) => t.id === s.teamId)?.name ?? 'Team'}`}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><Pencil className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Delete ${s.name}`} onClick={() => remove(s)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                  {s.description && <p className="mt-2 line-clamp-2 text-sm text-[#3d4a42]">{s.description}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[#fbfaf6] p-3">
                    <PersonChip person={s.current.primaryUser} label={s.current.overridden ? 'Primary (override)' : 'Primary'} />
                    <PersonChip person={s.current.secondaryUser} label="Secondary" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5f6b64]">
                    <span>{s.current.shiftEnd ? `Shift ends ${formatDateTime(s.current.shiftEnd)}` : 'No active shift'}</span>
                    {s.overrides.length > 0 && <Pill tone="amber">{s.overrides.length} upcoming override{s.overrides.length === 1 ? '' : 's'}</Pill>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant={active ? 'primary' : 'secondary'} onClick={() => setSelectedId(s.id)}><CalendarDays className="h-3.5 w-3.5" /> Calendar</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => setOverrideFor(s)}><Plus className="h-3.5 w-3.5" /> Override</Button>}
                  </div>
                </div>
              );
            })}
          </div>
          {selected && <CalendarPanel key={selected.id} schedule={selected} canManage={canManage} version={calVersion} onChanged={reload} onAddOverride={() => setOverrideFor(selected)} />}
        </div>
      )}

      {(creating || editing) && (
        <ScheduleModal
          open
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => { reload(); setCalVersion((v) => v + 1); }}
        />
      )}
      {overrideFor && <OverrideModal schedule={overrideFor} onClose={() => setOverrideFor(null)} onSaved={() => { reload(); setCalVersion((v) => v + 1); }} />}
    </div>
  );
}
