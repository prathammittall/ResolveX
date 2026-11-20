'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArrowDown, ArrowUp, RotateCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../../../../lib/api';
import type { StatusCategory, StatusItem } from '../../../../lib/types';
import { Button, Field, Input, MemberSelect, Select, SkeletonRows, Textarea, useApi, useConfirm, useToast } from '../../_components/kit';
import { EmptyState, ErrorBanner, SectionCard } from '../../_components/ui';
import { Avatar } from '../../_components/work';
import { CATEGORY_LABEL, usePerms, type Project } from './_shared';

type ProjectMember = { id: string; role: 'lead' | 'member'; user: { id: number; name: string; email: string; avatarUrl: string | null } | null };
type Team = { id: string; name: string };

export function MembersTab({ project }: { project: Project }) {
  const { manage } = usePerms();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<{ members: ProjectMember[] }>(`/api/projects/${project.id}/members`);
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole] = useState<'lead' | 'member'>('member');
  const [busy, setBusy] = useState(false);

  async function upsert(uid: number, r: 'lead' | 'member', verb: string) {
    setBusy(true);
    try {
      await api.post(`/api/projects/${project.id}/members`, { userId: uid, role: r });
      toast.success(verb);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: ProjectMember) {
    if (!m.user) return;
    if (!(await confirm({ title: 'Remove from project?', message: `${m.user.name} will no longer be listed as a member of ${project.name}. Their tickets stay assigned.`, confirmLabel: 'Remove', danger: true }))) return;
    try {
      await api.del(`/api/projects/${project.id}/members/${m.user.id}`);
      toast.success(`${m.user.name} removed`);
      reload();
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <div className="space-y-5">
      {manage && (
        <SectionCard title="Add member">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (userId) void upsert(userId, role, 'Member added').then(() => setUserId(null));
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Person" className="min-w-[14rem] flex-1">
              <MemberSelect value={userId} onChange={setUserId} noneLabel="Choose someone…" />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'lead' | 'member')}>
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </Select>
            </Field>
            <Button type="submit" loading={busy} disabled={!userId}><UserPlus className="h-4 w-4" />Add</Button>
          </form>
        </SectionCard>
      )}
      <SectionCard title="Project members">
        {loading && !data ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : !data || data.members.length === 0 ? (
          <EmptyState icon={Users} title="No project members yet" description={manage ? 'Add the people who work on this project.' : 'A manager can add people to this project.'} />
        ) : (
          <ul className="divide-y divide-[#dfdbcc]">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={m.user?.name ?? '?'} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#14201a]">{m.user?.name ?? 'Former member'}</div>
                  <div className="truncate text-xs text-[#5f6b64]">{m.user?.email}</div>
                </div>
                {manage && m.user ? (
                  <>
                    <Select aria-label={`Role of ${m.user.name}`} value={m.role} disabled={busy} onChange={(e) => void upsert(m.user!.id, e.target.value as 'lead' | 'member', 'Role updated')} className="w-auto! py-1! text-xs!">
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => void remove(m)} aria-label={`Remove ${m.user.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                ) : (
                  <span className="text-xs font-semibold capitalize text-[#3d4a42]">{m.role}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

export function SettingsTab({ project, statuses, onChanged }: { project: Project; statuses: StatusItem[]; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const teams = useApi<{ teams: Team[] }>('/api/teams');
  const [form, setForm] = useState({ name: project.name, description: project.description ?? '', color: project.color ?? '#177a43', leadId: project.leadId, teamId: project.teamId ?? '' });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newStatus, setNewStatus] = useState({ name: '', category: 'in_progress' as StatusCategory });
  const base = `/api/projects/${project.id}`;

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(base, { name: form.name.trim(), description: form.description.trim() || null, color: form.color, leadId: form.leadId, teamId: form.teamId || null });
      toast.success('Project settings saved');
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  const swap = (a: StatusItem, b: StatusItem) =>
    run(async () => {
      await api.patch(`${base}/statuses/${a.id}`, { position: b.position });
      await api.patch(`${base}/statuses/${b.id}`, { position: a.position });
    }, 'Workflow reordered');

  async function deleteStatus(s: StatusItem) {
    if (!(await confirm({ title: `Delete “${s.name}”?`, message: 'The status must be empty. Tickets in it must be moved first.', confirmLabel: 'Delete status', danger: true }))) return;
    await run(() => api.del(`${base}/statuses/${s.id}`), 'Status deleted');
  }

  async function toggleArchive() {
    if (!project.archived && !(await confirm({ title: 'Archive project?', message: 'Archived projects stay readable, but no new tickets can be raised until restored.', confirmLabel: 'Archive' }))) return;
    await run(() => api.patch(base, { archived: !project.archived }), project.archived ? 'Project restored' : 'Project archived');
  }

  async function deleteProject() {
    if (!(await confirm({ title: `Delete ${project.name}?`, message: 'Every ticket, sprint and status in this project is permanently deleted. This cannot be undone.', confirmLabel: 'Delete project', danger: true }))) return;
    setBusy(true);
    try {
      await api.del(base);
      toast.success('Project deleted');
      router.replace('/dashboard/projects');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Project details">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Key" hint="The key cannot be changed"><Input value={project.key} disabled readOnly className="font-mono" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Lead"><MemberSelect value={form.leadId} onChange={(v) => setForm({ ...form, leadId: v })} noneLabel="No lead" /></Field>
          <Field label="Team">
            <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">No team</option>
              {(teams.data?.teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Color">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Project color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-[#dfdbcc] bg-white" />
              <span className="font-mono text-xs text-[#5f6b64]">{form.color}</span>
            </div>
          </Field>
          <div className="flex items-end justify-end sm:col-span-1">
            <Button type="submit" loading={saving} disabled={!form.name.trim()}>Save changes</Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Workflow statuses" subtitle="Board columns, left to right. Statuses in the Done category count as finished.">
        <ul className="divide-y divide-[#dfdbcc]">
          {statuses.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <Input
                aria-label={`Name of ${s.name}`}
                defaultValue={s.name}
                key={`${s.id}-${s.name}`}
                maxLength={40}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) void run(() => api.patch(`${base}/statuses/${s.id}`, { name: v }), 'Status renamed');
                }}
                className="min-w-0 flex-1"
              />
              <Select aria-label={`Category of ${s.name}`} value={s.category} disabled={busy} onChange={(e) => void run(() => api.patch(`${base}/statuses/${s.id}`, { category: e.target.value }), 'Category updated')} className="w-auto!">
                {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </Select>
              <Button size="sm" variant="ghost" disabled={busy || i === 0} onClick={() => void swap(s, statuses[i - 1]!)} aria-label={`Move ${s.name} left`}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={busy || i === statuses.length - 1} onClick={() => void swap(s, statuses[i + 1]!)} aria-label={`Move ${s.name} right`}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={busy || statuses.length <= 1} onClick={() => void deleteStatus(s)} aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.post(`${base}/statuses`, newStatus), `Status “${newStatus.name}” added`).then(() => setNewStatus({ name: '', category: 'in_progress' }));
          }}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <Field label="New status" className="min-w-[12rem] flex-1">
            <Input required maxLength={40} value={newStatus.name} onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })} placeholder="e.g. In review" />
          </Field>
          <Field label="Category">
            <Select value={newStatus.category} onChange={(e) => setNewStatus({ ...newStatus, category: e.target.value as StatusCategory })}>
              {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Button type="submit" loading={busy} disabled={!newStatus.name.trim()}>Add status</Button>
        </form>
      </SectionCard>

      <SectionCard title="Danger zone">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#3d4a42]">{project.archived ? 'This project is archived. Restore it to raise tickets again, or delete it permanently.' : 'Archive the project to freeze it. Archived projects can be restored or deleted.'}</p>
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy} onClick={() => void toggleArchive()}>
              {project.archived ? <><RotateCcw className="h-4 w-4" />Restore</> : <><Archive className="h-4 w-4" />Archive</>}
            </Button>
            {project.archived && <Button variant="danger" loading={busy} onClick={() => void deleteProject()}><Trash2 className="h-4 w-4" />Delete</Button>}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
