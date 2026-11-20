'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import type { StatusItem } from '../../../../lib/types';
import { Button, PageHeader, Pill, Skeleton, Tabs, useApi, useMembers } from '../../_components/kit';
import { ErrorBanner } from '../../_components/ui';
import { BoardTab } from './_board';
import { CalendarTab } from './_calendar';
import { ListTab } from './_list';
import { OverviewTab } from './_overview';
import { MembersTab, SettingsTab } from './_settings';
import { SprintsTab } from './_sprints';
import { TicketModal, usePerms, type Project, type Sprint } from './_shared';

type Tab = 'overview' | 'board' | 'list' | 'calendar' | 'sprints' | 'members' | 'settings';
const TABS: Tab[] = ['overview', 'board', 'list', 'calendar', 'sprints', 'members', 'settings'];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const perms = usePerms();
  const members = useMembers();
  const proj = useApi<{ project: Project; statuses: StatusItem[] }>(`/api/projects/${id}`);
  const spr = useApi<{ sprints: Sprint[] }>(`/api/projects/${id}/sprints`);
  const [tab, setTab] = useState<Tab>('overview');
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);

  // Remember the tab in the URL hash so reloads and shared links land on it.
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.includes(h)) setTab(h);
  }, []);
  const changeTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `#${t}`);
  };

  if (proj.loading && !proj.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (proj.error || !proj.data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] hover:text-[#177a43]"><ArrowLeft className="h-3.5 w-3.5" />Back to projects</Link>
        <ErrorBanner message={proj.error ?? 'Project not found'} />
      </div>
    );
  }

  const { project, statuses } = proj.data;
  const sprints = spr.data?.sprints ?? [];
  const lead = members.find((m) => m.userId === project.leadId);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'board' as const, label: 'Board' },
    { id: 'list' as const, label: 'List' },
    { id: 'calendar' as const, label: 'Calendar' },
    { id: 'sprints' as const, label: 'Backlog & sprints' },
    { id: 'members' as const, label: 'Members' },
    ...(perms.manage ? [{ id: 'settings' as const, label: 'Settings' }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 hover:text-[#177a43]"><ArrowLeft className="h-3.5 w-3.5" />Projects</Link>
        }
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eeebe0] px-2 py-1 font-mono text-xs font-bold text-[#14201a]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color ?? '#177a43' }} />
              {project.key}
            </span>
            {lead && <span className="text-xs text-[#5f6b64]">Lead: <span className="font-semibold text-[#14201a]">{lead.name}</span></span>}
            {project.archived && <Pill tone="amber">Archived</Pill>}
            {perms.work && !project.archived && (
              <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create ticket</Button>
            )}
          </>
        }
      />
      {spr.error && <ErrorBanner message={`Sprints could not be loaded: ${spr.error}`} />}
      <Tabs tabs={tabs} value={tab === 'settings' && !perms.manage ? 'overview' : tab} onChange={changeTab} />

      <div key={version}>
        {tab === 'overview' && <OverviewTab projectId={project.id} />}
        {tab === 'board' && (spr.loading && !spr.data ? <Skeleton className="h-80" /> : <BoardTab project={project} statuses={statuses} sprints={sprints} />)}
        {tab === 'list' && <ListTab project={project} statuses={statuses} sprints={sprints} />}
        {tab === 'calendar' && <CalendarTab project={project} />}
        {tab === 'sprints' && <SprintsTab project={project} sprints={sprints} sprintsLoading={spr.loading} reloadSprints={spr.reload} />}
        {tab === 'members' && <MembersTab project={project} />}
        {tab === 'settings' && perms.manage && <SettingsTab project={project} statuses={statuses} onChanged={() => { proj.reload(); }} />}
        {tab === 'settings' && !perms.manage && <OverviewTab projectId={project.id} />}
      </div>

      <TicketModal open={creating} onClose={() => setCreating(false)} projectId={project.id} statuses={statuses} sprints={sprints} onCreated={() => { setVersion((v) => v + 1); spr.reload(); }} />
    </div>
  );
}
