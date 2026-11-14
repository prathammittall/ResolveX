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
    'w-full rounded-xl border border-[#cbbaa9] bg-[#e2cfc0]/50 dark:bg-zinc-900/80 dark:border-white/10 px-3 py-2.5 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">Projects</h1>
          <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">Plan work, raise tickets and track them on a board.</p>
        </div>
        {manage && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            New project
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {!manage && user && (
        <div role="note" className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          You’re a <strong>{ROLE_LABEL[user.role]}</strong> in this organization, so you can’t create projects. Ask an
          owner or admin to create one (or to promote you).
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-[#574f47] dark:text-zinc-400">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#ff5414]" />
        Show archived projects
      </label>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={manage ? 'Create your first project, then raise tickets and assign them to your team.' : 'An owner or admin needs to create a project first.'}
          action={
            manage && (
              <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs">
                <Plus className="h-4 w-4" />
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
              className="group rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/70 dark:bg-[#101117] p-5 shadow-xs transition hover:border-[#ff5414]/50 dark:hover:border-[#ff5414]/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#e2cfc0] dark:bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-[#171a1f] dark:text-zinc-300">{p.key}</span>
                {p.archived && <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300 font-medium">Archived</span>}
              </div>
              <h2 className="mt-3 font-serif-title text-lg font-semibold text-[#171a1f] dark:text-white group-hover:text-[#ff5414] transition">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-[#574f47] dark:text-zinc-400">{p.description || 'No description'}</p>
            </Link>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New project">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <form onSubmit={create} className="relative w-full max-w-md rounded-2xl bg-[#eedccb] dark:bg-[#12131a] border border-[#cbbaa9] dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="font-serif-title text-lg font-semibold text-[#171a1f] dark:text-white">New project</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            {formError && <div className="mt-4"><ErrorBanner message={formError} /></div>}
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="p-name" className="mb-1 block text-sm font-medium text-[#171a1f] dark:text-zinc-200">Name</label>
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
                <label htmlFor="p-key" className="mb-1 block text-sm font-medium text-[#171a1f] dark:text-zinc-200">Key</label>
                <input
                  id="p-key"
                  required
                  maxLength={10}
                  value={key}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setKey(e.target.value.toUpperCase());
                  }}
                  className={`${input} font-mono`}
                  placeholder="PAY"
                />
                <p className="mt-1 text-xs text-[#574f47] dark:text-zinc-400">Tickets are numbered {key || 'KEY'}-1, {key || 'KEY'}-2, … Letters and digits, starting with a letter.</p>
              </div>
              <div>
                <label htmlFor="p-desc" className="mb-1 block text-sm font-medium text-[#171a1f] dark:text-zinc-200">Description <span className="font-normal text-[#574f47] dark:text-zinc-400">(optional)</span></label>
                <textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#574f47] dark:text-zinc-300 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs disabled:opacity-60">
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
