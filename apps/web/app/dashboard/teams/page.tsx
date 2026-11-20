'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Crown, FolderKanban, Pencil, Plus, Server, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { ServiceHealthStatus } from '../../../lib/types';
import { EmptyState, ErrorBanner, HealthBadge, SectionCard, cn, formatDateTime, timeAgo } from '../_components/ui';
import { Avatar } from '../_components/work';
import { Button, Field, Input, MemberSelect, Modal, PageHeader, Pill, Skeleton, SkeletonRows, Textarea, useApi, useConfirm, useToast } from '../_components/kit';

type TeamMember = { userId: number; name: string; email: string; isLead: boolean; avatarUrl: string | null };
type Team = {
  id: string;
  name: string;
  description: string | null;
  members: TeamMember[];
  projects: Array<{ id: string; key: string; name: string }>;
  services: Array<{ id: number; name: string; healthStatus: ServiceHealthStatus }>;
};
type Activity = { id: string; type: string; data: Record<string, unknown> | null; createdAt: string; actor: string; task: { ref: string; title: string } | null };

function PersonAvatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <Avatar name={name} size={size} />;
}

const humanize = (t: string) => t.replace(/_/g, ' ');

function TeamModal({ initial, onClose, onSaved }: { initial: Team | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError('Give the team a name.');
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() || null };
      if (initial) {
        await api.patch(`/api/teams/${initial.id}`, body);
        onSaved(initial.id);
      } else {
        const res = await api.post<{ team: { id: string } }>('/api/teams', body);
        onSaved(res.team.id);
      }
      toast.success(initial ? 'Team updated' : 'Team created');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save team');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New team'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{initial ? 'Save' : 'Create team'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Name"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Platform" /></Field>
        <Field label="Description"><Textarea value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} placeholder="What this team owns" /></Field>
      </div>
    </Modal>
  );
}

function TeamDetail({ team, canManage, onChanged, onEdit, onDelete }: { team: Team; canManage: boolean; onChanged: () => void; onEdit: () => void; onDelete: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState<number | null>(null);
  const [asLead, setAsLead] = useState(false);
  const [busy, setBusy] = useState<number | 'add' | null>(null);
  const activity = useApi<{ activity: Activity[] }>(`/api/teams/${team.id}/activity`, [team.members.length]);

  async function addMember() {
    if (!adding) return;
    setBusy('add');
    try {
      await api.post(`/api/teams/${team.id}/members`, { userId: adding, isLead: asLead });
      toast.success('Member added');
      setAdding(null);
      setAsLead(false);
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function toggleLead(m: TeamMember) {
    setBusy(m.userId);
    try {
      await api.post(`/api/teams/${team.id}/members`, { userId: m.userId, isLead: !m.isLead });
      toast.success(m.isLead ? `${m.name} is no longer a lead` : `${m.name} is now a lead`);
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(m: TeamMember) {
    const ok = await confirm({ title: `Remove ${m.name}?`, message: `${m.name} will leave ${team.name}. They stay in the organization.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    setBusy(m.userId);
    try {
      await api.del(`/api/teams/${team.id}/members/${m.userId}`);
      toast.success('Member removed');
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  const members = [...team.members].sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-[#14201a]">{team.name}</h2>
            <p className="mt-1 text-sm text-[#3d4a42]">{team.description || <span className="italic text-[#5f6b64]">No description</span>}</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Delete ${team.name}`}><Trash2 className="h-3.5 w-3.5 text-[#dc2626]" /></Button>
            </div>
          )}
        </div>
      </div>

      <SectionCard title={`Members (${team.members.length})`}>
        {members.length === 0 ? (
          <p className="text-sm text-[#5f6b64]">No members yet.</p>
        ) : (
          <ul className="divide-y divide-[#dfdbcc]">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <PersonAvatar name={m.name} url={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#14201a]">
                    {m.name}
                    {m.isLead && <Pill tone="amber"><Crown className="h-3 w-3" /> Lead</Pill>}
                  </div>
                  <div className="truncate text-xs text-[#5f6b64]">{m.email}</div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" loading={busy === m.userId} onClick={() => toggleLead(m)}>{m.isLead ? 'Remove lead' : 'Make lead'}</Button>
                    <button type="button" aria-label={`Remove ${m.name}`} onClick={() => removeMember(m)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]"><UserMinus className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#dfdbcc] pt-4">
            <label className="block min-w-[200px] flex-1">
              <span className="sr-only">Add member</span>
              <MemberSelect value={adding} onChange={setAdding} noneLabel="Add a member…" />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-[#14201a]">
              <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={asLead} onChange={(e) => setAsLead(e.target.checked)} /> Lead
            </label>
            <Button disabled={!adding || team.members.some((m) => m.userId === adding)} loading={busy === 'add'} onClick={addMember}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 md:grid-cols-2">
        <SectionCard title="Projects">
          {team.projects.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">No projects assigned. Set the team on a project to link it.</p>
          ) : (
            <ul className="space-y-1.5">
              {team.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/projects/${p.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#14201a] hover:bg-[#f6f4ec]">
                    <FolderKanban className="h-4 w-4 text-[#5f6b64]" />
                    <span className="font-mono text-xs text-[#5f6b64]">{p.key}</span>
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Services">
          {team.services.length === 0 ? (
            <p className="text-sm text-[#5f6b64]">No services owned. Set the team on a service to link it.</p>
          ) : (
            <ul className="space-y-1.5">
              {team.services.map((s) => (
                <li key={s.id}>
                  <Link href={`/dashboard/services/${s.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-[#14201a] hover:bg-[#f6f4ec]">
                    <span className="flex items-center gap-2"><Server className="h-4 w-4 text-[#5f6b64]" />{s.name}</span>
                    <HealthBadge status={s.healthStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent activity" subtitle="Ticket activity by members of this team">
        {activity.error && <ErrorBanner message={activity.error} />}
        {activity.loading && !activity.data ? (
          <SkeletonRows rows={4} />
        ) : (activity.data?.activity ?? []).length === 0 ? (
          <p className="text-sm text-[#5f6b64]">No activity yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.data!.activity.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 text-sm">
                <Avatar name={a.actor} size={22} />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-[#14201a]">{a.actor}</span> <span className="text-[#3d4a42]">{humanize(a.type)}</span>{' '}
                  {a.task && (
                    <Link href={`/dashboard/tasks/${a.task.ref}`} className="text-[#177a43] hover:underline">
                      <span className="font-mono text-xs">{a.task.ref}</span> {a.task.title}
                    </Link>
                  )}
                  <div className="text-xs text-[#5f6b64]" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

export default function TeamsPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'teams:manage');
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<{ teams: Team[] }>('/api/teams');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);

  const teams = data?.teams ?? [];
  const selected = teams.find((t) => t.id === selectedId) ?? teams[0] ?? null;

  async function remove(t: Team) {
    const ok = await confirm({ title: `Delete ${t.name}?`, message: 'Members stay in the organization; projects, services and schedules linked to this team lose the link. This cannot be undone.', confirmLabel: 'Delete team', danger: true });
    if (!ok) return;
    try {
      await api.del(`/api/teams/${t.id}`);
      toast.success('Team deleted');
      setSelectedId(null);
      reload();
    } catch (e) {
      toast.error(e);
    }
  }

  return (
    <div>
      <PageHeader title="Teams" description="Group people to own services and projects, route incidents and share on-call." actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New team</Button>} />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <SkeletonRows rows={4} />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={UsersRound} title="No teams yet" description="Create a team, add people, then assign it to services and projects." action={canManage ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New team</Button> : undefined} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Teams" className="space-y-1.5">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                aria-current={selected?.id === t.id}
                className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition', selected?.id === t.id ? 'border-[#177a43] bg-white' : 'border-[#dfdbcc] bg-[#fbfaf6] hover:bg-[#f6f4ec]')}
              >
                <div className="font-semibold text-[#14201a]">{t.name}</div>
                <div className="mt-0.5 text-xs text-[#5f6b64]">
                  {t.members.length} member{t.members.length === 1 ? '' : 's'} · {t.services.length} service{t.services.length === 1 ? '' : 's'} · {t.projects.length} project{t.projects.length === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </nav>
          {selected && <TeamDetail key={selected.id} team={selected} canManage={canManage} onChanged={reload} onEdit={() => setEditing(selected)} onDelete={() => remove(selected)} />}
        </div>
      )}
      {(creating || editing) && (
        <TeamModal
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(id) => { if (id) setSelectedId(id); reload(); }}
        />
      )}
    </div>
  );
}
