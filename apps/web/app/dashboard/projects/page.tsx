'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { canManageWork, ROLE_LABEL } from '../../../lib/permissions';
import type { ProjectItem, StatusItem } from '../../../lib/types';
import { EmptyState, ErrorBanner, PageLoader } from '../_components/ui';

function keyFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 4);
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const manage = canManageWork(user?.role);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.get<{ projects: ProjectItem[] }>(`/api/projects${showArchived ? '?archived=true' : ''}`);
      setProjects(res.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.post<{ project: ProjectItem; statuses: StatusItem[] }>('/api/projects', {
        name,
        key,
        description: description.trim() || null,
      });
      window.location.assign(`/dashboard/projects/${res.project.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to create project');
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  const input =
    'w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2.5 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20 placeholder-[#5f6b64]/50';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dfdbcc] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Projects</h1>
          <p className="mt-1 text-sm text-[#5f6b64]">Plan work, manage sprints, and coordinate tasks with live operational health.</p>
        </div>
        {manage && (
          <button
            onClick={() => setOpen(true)}
            className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New project
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {!manage && user && (
        <div role="note" className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3 text-sm text-[#92400e]">
          You’re a <strong>{ROLE_LABEL[user.role]}</strong> in this organization, so you can’t create projects. Ask an
          owner or admin to create one.
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-[#3d4a42] cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#177a43] rounded" />
          Show archived projects
        </label>
        <span className="text-xs font-semibold text-[#5f6b64]">{projects.length} {projects.length === 1 ? 'project' : 'projects'} active</span>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={manage ? 'Create your first project, then raise tickets and track them on your Kanban board.' : 'An owner or admin needs to create a project first.'}
          action={
            manage && (
              <button onClick={() => setOpen(true)} className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer">
                <Plus className="h-4 w-4 mr-1.5" />
                Create a project
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_0_#dfdbcc]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#eeebe0] px-2 py-0.5 font-mono text-xs font-bold text-[#14201a]">{p.key}</span>
                {p.archived && <span className="rounded-full bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 text-xs text-[#92400e] font-semibold">Archived</span>}
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-[#14201a] group-hover:text-[#177a43] transition">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-[#5f6b64]">{p.description || 'No description provided'}</p>
            </Link>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New project">
          <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <form onSubmit={create} className="relative w-full max-w-md rounded-2xl bg-white border border-[#dfdbcc] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-[#14201a]">New project</h2>
                <p className="mt-0.5 text-xs text-[#5f6b64]">Set up a new workspace board and issue tracker.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            {formError && <div className="mt-4"><ErrorBanner message={formError} /></div>}
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="p-name" className="mb-1 block text-sm font-semibold text-[#14201a]">Name</label>
                <input
                  id="p-name"
                  required
                  autoFocus
                  maxLength={100}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!keyTouched) setKey(keyFromName(e.target.value));
                  }}
                  className={input}
                  placeholder="Payments platform"
                />
              </div>
              <div>
                <label htmlFor="p-key" className="mb-1 block text-sm font-semibold text-[#14201a]">Key</label>
                <input
                  id="p-key"
                  required
                  maxLength={10}
                  value={key}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setKey(e.target.value.toUpperCase());
                  }}
                  className={`${input} font-mono font-bold`}
                  placeholder="PAY"
                />
                <p className="mt-1 text-xs text-[#5f6b64]">Tickets will be numbered {key || 'KEY'}-1, {key || 'KEY'}-2... Letters and digits only.</p>
              </div>
              <div>
                <label htmlFor="p-desc" className="mb-1 block text-sm font-semibold text-[#14201a]">Description <span className="font-normal text-[#5f6b64]">(optional)</span></label>
                <textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={input} placeholder="Brief description of the team or initiative..." />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={() => setOpen(false)} className="btn-kizupi-white text-sm px-4 py-2 cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="btn-kizupi-go text-sm px-5 py-2 cursor-pointer disabled:opacity-60">
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
