'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, FolderKanban, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { canManageWork, ROLE_LABEL } from '../../../lib/permissions';
import type { ProjectItem } from '../../../lib/types';
import { Button, Field, Input, MemberSelect, Modal, PageHeader, Pill, Select, Skeleton, Textarea, useApi, useConfirm, useMembers, useToast } from '../_components/kit';
import { EmptyState, ErrorBanner } from '../_components/ui';

type Project = ProjectItem & { leadId: number | null; teamId: string | null; color: string | null };
type Team = { id: string; name: string };

const SWATCHES = ['#177a43', '#0284c7', '#7c3aed', '#dc2626', '#e3a008', '#22a35a', '#3d4a42'];

function keyFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 4);
  return raw.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]+/, '').toUpperCase().slice(0, 10);
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const manage = canManageWork(user?.role);
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const members = useMembers();
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, loading, reload } = useApi<{ projects: Project[] }>(`/api/projects${showArchived ? '?archived=true' : ''}`);
  const teams = useApi<{ teams: Team[] }>('/api/teams');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const projects = data?.projects ?? [];
  const activeCount = projects.filter((p) => !p.archived).length;
  const teamName = (id: string | null) => (id ? teams.data?.teams.find((t) => t.id === id)?.name : undefined);

  async function setArchived(p: Project, archived: boolean) {
    if (archived && !(await confirm({ title: `Archive ${p.name}?`, message: 'Archived projects stay readable but no new tickets can be raised until restored.', confirmLabel: 'Archive' }))) return;
    setBusy(p.id);
    try {
      await api.patch(`/api/projects/${p.id}`, { archived });
      toast.success(archived ? `${p.name} archived` : `${p.name} restored`);
      if (archived && !showArchived) setShowArchived(true);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Project) {
    if (!(await confirm({ title: `Delete ${p.name}?`, message: `Every ticket, sprint and status in ${p.key} is permanently deleted. This cannot be undone.`, confirmLabel: 'Delete project', danger: true }))) return;
    setBusy(p.id);
    try {
      await api.del(`/api/projects/${p.id}`);
      toast.success(`${p.name} deleted`);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Plan work, run sprints and track tickets alongside live operational health."
        actions={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</Button>}
      />

      {!manage && user && (
        <div role="note" className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3 text-sm text-[#92400e]">
          You’re a <strong>{ROLE_LABEL[user.role]}</strong> in this organization, so you can’t create or archive projects.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#3d4a42]">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#177a43]" />
          Show archived projects
        </label>
        {data && (
          <span className="text-xs font-semibold text-[#5f6b64]">
            {activeCount} active{showArchived ? ` · ${projects.length - activeCount} archived` : ''}
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={showArchived ? 'No projects' : 'No active projects'}
          description={manage ? 'Create a project, then raise tickets and plan sprints.' : 'A manager or admin needs to create a project first.'}
          action={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create a project</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const lead = members.find((m) => m.userId === p.leadId);
            const team = teamName(p.teamId);
            return (
              <div key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
                <div className="h-1.5" style={{ background: p.color ?? '#177a43' }} />
                <Link href={`/dashboard/projects/${p.id}`} className="flex-1 p-5 hover:bg-[#fbfaf6]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-[#eeebe0] px-2 py-0.5 font-mono text-xs font-bold text-[#14201a]">{p.key}</span>
                    {p.archived && <Pill tone="amber">Archived</Pill>}
                  </div>
                  <h2 className="mt-3 font-display text-lg font-bold text-[#14201a] group-hover:text-[#177a43]">{p.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5f6b64]">{p.description || 'No description'}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5f6b64]">
                    {lead && <span>Lead: <span className="font-semibold text-[#3d4a42]">{lead.name}</span></span>}
                    {team && <span>Team: <span className="font-semibold text-[#3d4a42]">{team}</span></span>}
                  </div>
                </Link>
                {manage && (
                  <div className="flex justify-end gap-1 border-t border-[#dfdbcc] px-3 py-2">
                    {p.archived ? (
                      <>
                        <Button size="sm" variant="ghost" loading={busy === p.id} onClick={() => void setArchived(p, false)}><RotateCcw className="h-3.5 w-3.5" />Restore</Button>
                        <Button size="sm" variant="ghost" className="text-[#dc2626]" loading={busy === p.id} onClick={() => void remove(p)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" loading={busy === p.id} onClick={() => void setArchived(p, true)}><Archive className="h-3.5 w-3.5" />Archive</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectModal
        open={open}
        onClose={() => setOpen(false)}
        teams={teams.data?.teams ?? []}
        defaultLead={user?.id ?? null}
        onCreated={(p) => {
          toast.success(`${p.name} created`);
          router.push(`/dashboard/projects/${p.id}`);
        }}
      />
    </div>
  );
}

function CreateProjectModal({ open, onClose, teams, defaultLead, onCreated }: { open: boolean; onClose: () => void; teams: Team[]; defaultLead: number | null; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SWATCHES[0]!);
  const [leadId, setLeadId] = useState<number | null>(defaultLead);
  const [teamId, setTeamId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName('');
      setKey('');
      setKeyTouched(false);
      setDescription('');
      setColor(SWATCHES[0]!);
      setLeadId(defaultLead);
      setTeamId('');
      setError(null);
    }
  }

  const keyValid = /^[A-Z][A-Z0-9]{1,9}$/.test(key);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyValid) {
      setError('Key must be 2–10 letters or digits, starting with a letter');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ project: Project }>('/api/projects', { name: name.trim(), key, description: description.trim() || null, color, leadId, teamId: teamId || null });
      onCreated(res.project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-project-form" loading={saving} disabled={!name.trim() || !key}>Create project</Button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Name">
          <Input
            required
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(keyFromName(e.target.value));
            }}
            placeholder="Payments platform"
          />
        </Field>
        <Field label="Key" hint={`Tickets are numbered ${key || 'KEY'}-1, ${key || 'KEY'}-2… The key cannot be changed later.`} error={key && !keyValid ? 'Use 2–10 letters/digits starting with a letter' : undefined}>
          <Input
            required
            maxLength={10}
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            }}
            className="font-mono font-bold"
            placeholder="PAY"
          />
        </Field>
        <Field label="Description">
          <Textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead"><MemberSelect value={leadId} onChange={setLeadId} noneLabel="No lead" /></Field>
          <Field label="Team">
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Color</span>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-[#14201a]' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
            <input type="color" aria-label="Custom color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-[#dfdbcc] bg-white" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
