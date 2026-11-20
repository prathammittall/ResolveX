'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Clock, GitBranch, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { EmptyState, ErrorBanner, cn } from '../_components/ui';
import { Button, Field, Input, MemberSelect, Modal, PageHeader, Pill, Select, SkeletonRows, useApi, useConfirm, useMembers, useToast } from '../_components/kit';
import { browserTimezone, timezones, useServices, useTeams } from '../oncall/_shared';

type Severity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
type TargetType = 'user' | 'team' | 'schedule' | 'webhook';
type Channel = 'in_app' | 'email' | 'webhook' | 'sms';
type Step = { id?: number; position?: number; delaySeconds: number; targetType: TargetType; targetId: string; notificationChannels: Channel[]; acknowledgmentRequired: boolean };
type ActiveHours = { start: number; end: number; days?: number[]; timezone?: string };
type Policy = {
  id: number;
  name: string;
  serviceId: number | null;
  enabled: boolean;
  severities: Severity[] | null;
  environment: 'production' | 'staging' | 'development' | null;
  teamId: string | null;
  activeHours: ActiveHours | null;
  priority: number;
  steps: Step[];
};
type ScheduleLite = { id: number; name: string };

const SEVERITIES: Severity[] = ['sev1', 'sev2', 'sev3', 'sev4'];
const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: 'in_app', label: 'In-app' },
  { id: 'email', label: 'Email' },
  { id: 'webhook', label: 'Webhook' },
  { id: 'sms', label: 'SMS' },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TARGET_LABEL: Record<TargetType, string> = { user: 'Person', team: 'Team', schedule: 'On-call schedule', webhook: 'Webhook URL' };

type StepDraft = { delay: number; unit: 'seconds' | 'minutes'; targetType: TargetType; targetId: string; channels: Channel[]; ack: boolean };
type Draft = {
  name: string;
  serviceId: string;
  severities: Severity[];
  environment: string;
  teamId: string;
  hoursOn: boolean;
  start: number;
  end: number;
  days: number[];
  tz: string;
  priority: number;
  enabled: boolean;
  steps: StepDraft[];
};

const toStepDraft = (s: Step): StepDraft =>
  s.delaySeconds % 60 === 0
    ? { delay: s.delaySeconds / 60, unit: 'minutes', targetType: s.targetType, targetId: s.targetId, channels: s.notificationChannels, ack: s.acknowledgmentRequired }
    : { delay: s.delaySeconds, unit: 'seconds', targetType: s.targetType, targetId: s.targetId, channels: s.notificationChannels, ack: s.acknowledgmentRequired };
const newStep = (): StepDraft => ({ delay: 5, unit: 'minutes', targetType: 'user', targetId: '', channels: ['in_app', 'email'], ack: true });

function draftFrom(p: Policy | null): Draft {
  if (!p) return { name: '', serviceId: '', severities: [], environment: '', teamId: '', hoursOn: false, start: 9, end: 17, days: [1, 2, 3, 4, 5], tz: browserTimezone(), priority: 0, enabled: true, steps: [newStep()] };
  return {
    name: p.name,
    serviceId: p.serviceId ? String(p.serviceId) : '',
    severities: Array.isArray(p.severities) ? p.severities : [],
    environment: p.environment ?? '',
    teamId: p.teamId ?? '',
    hoursOn: Boolean(p.activeHours),
    start: p.activeHours?.start ?? 9,
    end: p.activeHours?.end ?? 17,
    days: p.activeHours?.days ?? [0, 1, 2, 3, 4, 5, 6],
    tz: p.activeHours?.timezone ?? 'UTC',
    priority: p.priority ?? 0,
    enabled: p.enabled,
    steps: p.steps.length ? p.steps.map(toStepDraft) : [newStep()],
  };
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function TargetPicker({ step, onChange, teams, schedules }: { step: StepDraft; onChange: (id: string) => void; teams: Array<{ id: string; name: string }>; schedules: ScheduleLite[] }) {
  if (step.targetType === 'user') return <MemberSelect value={step.targetId ? Number(step.targetId) : null} onChange={(v) => onChange(v ? String(v) : '')} noneLabel="Choose a person…" />;
  if (step.targetType === 'team')
    return (
      <Select value={step.targetId} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a team…</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    );
  if (step.targetType === 'schedule')
    return (
      <Select value={step.targetId} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a schedule…</option>
        {schedules.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </Select>
    );
  return <Input type="url" value={step.targetId} onChange={(e) => onChange(e.target.value)} placeholder="https://hooks.example.com/pager" maxLength={500} />;
}

function PolicyModal({ initial, onClose, onSaved }: { initial: Policy | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const services = useServices();
  const teams = useTeams();
  const schedules = useApi<{ schedules: ScheduleLite[] }>('/api/oncall/schedules').data?.schedules ?? [];
  const [d, setD] = useState<Draft>(() => draftFrom(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = timezones(d.tz);

  const setStep = (i: number, patch: Partial<StepDraft>) => setD({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.steps.length) return;
    const next = [...d.steps];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setD({ ...d, steps: next });
  };

  async function save() {
    setError(null);
    if (!d.name.trim()) return setError('Give the policy a name.');
    if (d.hoursOn && d.days.length === 0) return setError('Pick at least one active day, or turn off active hours.');
    for (const [i, s] of d.steps.entries()) {
      if (!s.targetId.trim()) return setError(`Step ${i + 1}: choose a ${TARGET_LABEL[s.targetType].toLowerCase()}.`);
      if (s.targetType === 'webhook' && !/^https?:\/\//i.test(s.targetId.trim())) return setError(`Step ${i + 1}: the webhook must be an http(s) URL.`);
      if (s.channels.length === 0) return setError(`Step ${i + 1}: pick at least one channel.`);
      if (!Number.isFinite(s.delay) || s.delay <= 0) return setError(`Step ${i + 1}: the delay must be greater than zero.`);
    }
    const body = {
      name: d.name.trim(),
      serviceId: d.serviceId ? Number(d.serviceId) : null,
      enabled: d.enabled,
      severities: d.severities.length ? d.severities : null,
      environment: d.environment || null,
      teamId: d.teamId || null,
      activeHours: d.hoursOn ? { start: d.start, end: d.end, days: [...d.days].sort(), timezone: d.tz } : null,
      priority: d.priority,
      steps: d.steps.map((s, i) => ({ position: i, delaySeconds: Math.round(s.unit === 'minutes' ? s.delay * 60 : s.delay), targetType: s.targetType, targetId: s.targetId.trim(), notificationChannels: s.channels, acknowledgmentRequired: s.ack })),
    };
    setSaving(true);
    try {
      if (initial) await api.patch(`/api/escalation-policies/${initial.id}`, body);
      else await api.post('/api/escalation-policies', body);
      toast.success(initial ? 'Policy updated' : 'Policy created');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save policy');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New escalation policy'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save changes' : 'Create policy'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={100} placeholder="Payments SEV1 paging" /></Field>
          <Field label="Priority" hint="When several policies match, the highest priority wins (−100 to 100).">
            <Input type="number" min={-100} max={100} value={d.priority} onChange={(e) => setD({ ...d, priority: Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-[#dfdbcc] p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Conditions (leave blank for “any”)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Service">
              <Select value={d.serviceId} onChange={(e) => setD({ ...d, serviceId: e.target.value })}>
                <option value="">Any service</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Environment">
              <Select value={d.environment} onChange={(e) => setD({ ...d, environment: e.target.value })}>
                <option value="">Any environment</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </Select>
            </Field>
            <Field label="Owning team">
              <Select value={d.teamId} onChange={(e) => setD({ ...d, teamId: e.target.value })}>
                <option value="">Any team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Severities</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Severities">
              {SEVERITIES.map((s) => {
                const on = d.severities.includes(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => setD({ ...d, severities: on ? d.severities.filter((x) => x !== s) : [...d.severities, s] })} className={cn('rounded-lg border px-3 py-1 text-xs font-bold uppercase', on ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#dfdbcc] text-[#3d4a42] hover:bg-[#eeebe0]')}>
                    {s}
                  </button>
                );
              })}
              <span className="self-center text-xs text-[#5f6b64]">{d.severities.length === 0 ? 'Any severity' : ''}</span>
            </div>
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#14201a]">
              <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={d.hoursOn} onChange={(e) => setD({ ...d, hoursOn: e.target.checked })} />
              Only during active hours
            </label>
            {d.hoursOn && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="From">
                  <Select value={d.start} onChange={(e) => setD({ ...d, start: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                  </Select>
                </Field>
                <Field label="Until">
                  <Select value={d.end} onChange={(e) => setD({ ...d, end: Number(e.target.value) })}>
                    {Array.from({ length: 25 }, (_, h) => <option key={h} value={h}>{h === 24 ? '24:00 (midnight)' : hourLabel(h)}</option>)}
                  </Select>
                </Field>
                <Field label="Timezone">
                  <Select value={d.tz} onChange={(e) => setD({ ...d, tz: e.target.value })}>
                    {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-3">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Days</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Active days">
                    {DAYS.map((label, i) => {
                      const on = d.days.includes(i);
                      return (
                        <button key={label} type="button" aria-pressed={on} onClick={() => setD({ ...d, days: on ? d.days.filter((x) => x !== i) : [...d.days, i] })} className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', on ? 'border-[#b2e2a8] bg-[#dcefd8] text-[#177a43]' : 'border-[#dfdbcc] text-[#3d4a42] hover:bg-[#eeebe0]')}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {d.end <= d.start && <p className="mt-1 text-xs text-[#5f6b64]">The window wraps past midnight.</p>}
                </div>
              </div>
            )}
          </div>
        </fieldset>

        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Escalation steps (in order)</span>
          <ol className="space-y-3">
            {d.steps.map((s, i) => (
              <li key={i} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#14201a]">Step {i + 1}</span>
                  <div className="flex gap-1">
                    <button type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => moveStep(i, -1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move step ${i + 1} down`} disabled={i === d.steps.length - 1} onClick={() => moveStep(i, 1)} className="rounded p-1 text-[#5f6b64] hover:bg-[#eeebe0] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Remove step ${i + 1}`} disabled={d.steps.length === 1} onClick={() => setD({ ...d, steps: d.steps.filter((_, j) => j !== i) })} className="rounded p-1 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] disabled:opacity-30"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                  <Field label="Wait" hint={i === 0 ? 'After the incident opens' : 'If still unacknowledged'}>
                    <div className="flex gap-1">
                      <Input type="number" min={1} value={s.delay} onChange={(e) => setStep(i, { delay: Number(e.target.value) })} className="min-w-0" />
                      <Select aria-label="Delay unit" value={s.unit} onChange={(e) => setStep(i, { unit: e.target.value as StepDraft['unit'] })} className="w-auto">
                        <option value="minutes">min</option>
                        <option value="seconds">sec</option>
                      </Select>
                    </div>
                  </Field>
                  <Field label="Notify">
                    <Select value={s.targetType} onChange={(e) => setStep(i, { targetType: e.target.value as TargetType, targetId: '', channels: e.target.value === 'webhook' ? ['webhook'] : s.channels })}>
                      {(Object.keys(TARGET_LABEL) as TargetType[]).map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
                    </Select>
                  </Field>
                  <Field label={TARGET_LABEL[s.targetType]}>
                    <TargetPicker step={s} onChange={(id) => setStep(i, { targetId: id })} teams={teams} schedules={schedules} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Channels</span>
                  {CHANNELS.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-sm text-[#14201a]">
                      <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={s.channels.includes(c.id)} onChange={(e) => setStep(i, { channels: e.target.checked ? [...s.channels, c.id] : s.channels.filter((x) => x !== c.id) })} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <Button variant="secondary" size="sm" className="mt-3" disabled={d.steps.length >= 20} onClick={() => setD({ ...d, steps: [...d.steps, newStep()] })}>
            <Plus className="h-3.5 w-3.5" /> Add step
          </Button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#14201a]">
          <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
    </Modal>
  );
}

function delayText(sec: number) {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

export default function EscalationPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'services:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const services = useServices();
  const teams = useTeams();
  const schedules = useApi<{ schedules: ScheduleLite[] }>('/api/oncall/schedules').data?.schedules ?? [];
  const { data, error, loading, reload } = useApi<{ policies: Policy[] }>('/api/escalation-policies');
  const [editing, setEditing] = useState<Policy | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const policies = [...(data?.policies ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name));

  const targetName = (s: Step) => {
    if (s.targetType === 'user') return members.find((m) => String(m.userId) === s.targetId)?.name ?? `User #${s.targetId}`;
    if (s.targetType === 'team') return teams.find((t) => t.id === s.targetId)?.name ?? 'Team';
    if (s.targetType === 'schedule') return schedules.find((x) => String(x.id) === s.targetId)?.name ?? `Schedule #${s.targetId}`;
    try {
      return new URL(s.targetId).host;
    } catch {
      return s.targetId;
    }
  };

  async function toggle(p: Policy) {
    setBusy(p.id);
    try {
      await api.patch(`/api/escalation-policies/${p.id}`, { enabled: !p.enabled });
      toast.success(p.enabled ? 'Policy disabled' : 'Policy enabled');
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Policy) {
    const ok = await confirm({ title: `Delete ${p.name}?`, message: 'Incidents matching this policy will fall back to other policies. This cannot be undone.', confirmLabel: 'Delete policy', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/escalation-policies/${p.id}`);
      toast.success('Policy deleted');
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  return (
    <div>
      <PageHeader
        title="Escalation policies"
        description="Who gets paged, how, and when — until someone acknowledges. The highest-priority enabled policy whose conditions match an incident is used."
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New policy</Button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <SkeletonRows rows={4} />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No escalation policies"
          description="Without a policy, new incidents only notify their assignee. Add one to page people in order until someone responds."
          action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New policy</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {policies.map((p) => {
            const conditions = [
              p.serviceId ? `Service: ${services.find((s) => s.id === p.serviceId)?.name ?? `#${p.serviceId}`}` : null,
              p.severities?.length ? `Severity: ${p.severities.map((s) => s.toUpperCase()).join(', ')}` : null,
              p.environment ? `Env: ${p.environment}` : null,
              p.teamId ? `Team: ${teams.find((t) => t.id === p.teamId)?.name ?? 'team'}` : null,
              p.activeHours ? `${hourLabel(p.activeHours.start)}–${hourLabel(p.activeHours.end)} ${(p.activeHours.days ?? []).length === 7 || !p.activeHours.days ? 'daily' : (p.activeHours.days ?? []).map((x) => DAYS[x]).join(' ')} ${p.activeHours.timezone ?? 'UTC'}` : null,
            ].filter(Boolean) as string[];
            return (
              <div key={p.id} className={cn('rounded-2xl border border-[#dfdbcc] bg-white p-4 shadow-[0_2px_0_#dfdbcc]', !p.enabled && 'opacity-70')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-[#14201a]">{p.name}</h3>
                      {p.enabled ? <Pill tone="green">Enabled</Pill> : <Pill>Disabled</Pill>}
                      <Pill tone="violet">Priority {p.priority ?? 0}</Pill>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {conditions.length === 0 ? <Pill tone="blue">Matches every incident</Pill> : conditions.map((c) => <Pill key={c} tone="blue">{c}</Pill>)}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => toggle(p)}>{p.enabled ? 'Disable' : 'Enable'}</Button>
                      <button type="button" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0]"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Delete ${p.name}`} onClick={() => remove(p)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <ol className="mt-3 flex flex-wrap items-center gap-2">
                  {p.steps.map((s, i) => (
                    <li key={s.id ?? i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-[#5f6b64]" aria-hidden="true">→</span>}
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-2.5 py-1 text-xs">
                        <Clock className="h-3 w-3 text-[#5f6b64]" />
                        <span className="text-[#5f6b64]">{delayText(s.delaySeconds)}</span>
                        <span className="font-semibold text-[#14201a]">{TARGET_LABEL[s.targetType]}: {targetName(s)}</span>
                        <span className="text-[#5f6b64]">via {(Array.isArray(s.notificationChannels) ? s.notificationChannels : []).map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(', ')}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
      {(creating || editing) && <PolicyModal initial={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={reload} />}
    </div>
  );
}
