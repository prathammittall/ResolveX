'use client';

/**
 * Incident-area helpers shared by the incidents list, incident detail and postmortem pages.
 * Types mirror apps/server/src/services/api/modules/incidents.ts and the legacy incidents.ts handlers.
 */
import React from 'react';
import {
  Bell,
  CheckCircle2,
  Gauge,
  Hand,
  Info,
  Link2,
  MessageCircle,
  PlayCircle,
  Rocket,
  Settings2,
  ShieldAlert,
  Siren,
  UserCog,
  Activity,
} from 'lucide-react';
import type { IncidentEventType, IncidentSeverity, IncidentStatus, ServiceHealthStatus, TaskItem } from '../../../lib/types';

export const SEVERITY_OPTIONS: Array<{ value: IncidentSeverity; label: string; hint: string }> = [
  { value: 'sev1', label: 'SEV-1', hint: 'Critical — full outage or data loss' },
  { value: 'sev2', label: 'SEV-2', hint: 'Major — significant degradation' },
  { value: 'sev3', label: 'SEV-3', hint: 'Minor — partial or limited impact' },
  { value: 'sev4', label: 'SEV-4', hint: 'Low — cosmetic or no customer impact' },
];

export const STATUS_FLOW: IncidentStatus[] = ['open', 'acknowledged', 'investigating', 'mitigated', 'resolved'];
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  mitigated: 'Mitigated',
  resolved: 'Resolved',
};

/** Later lifecycle states reachable from the current one (the server accepts any forward move). */
export function nextStatuses(status: IncidentStatus): IncidentStatus[] {
  if (status === 'resolved') return [];
  return STATUS_FLOW.slice(STATUS_FLOW.indexOf(status) + 1);
}

/** Time to resolve, derived from detection and resolution timestamps. */
export function mttrSeconds(i: { detectedAt: string; resolvedAt: string | null }): number | null {
  if (!i.resolvedAt) return null;
  const v = (Date.parse(i.resolvedAt) - Date.parse(i.detectedAt)) / 1000;
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Full incident row (as returned by /incidents/:id/context). */
export type IncidentRow = {
  id: number;
  serviceId: number;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedResponderId: number | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  mitigatedAt: string | null;
  resolvedAt: string | null;
  mttaSeconds: number | null;
  source: string | null;
  projectId: string | null;
  taskId: string | null;
  correlationGroupId: number | null;
  correlationReason: string | null;
  customerImpact: string | null;
};

export type Deployment = {
  id: number;
  environment: string;
  version: string;
  commitSha: string | null;
  repositoryUrl: string | null;
  author: string | null;
  status: string;
  description: string | null;
  url: string | null;
  source: string;
  deployedAt: string;
};

export type ActionItem = { id: number; postmortemId: number; title: string; ownerId: number | null; dueDate: string | null; status: 'open' | 'done' | string; taskId: string | null; createdAt: string };

export type PostmortemStatus = 'draft' | 'in_review' | 'published';
export type Postmortem = {
  id: number;
  incidentId: number;
  status: PostmortemStatus;
  summary: string | null;
  rootCause: string | null;
  customerImpact: string | null;
  contributingFactors: string | null;
  resolution: string | null;
  preventiveMeasures: string | null;
  lessonsLearned: string | null;
  authorId: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  actionItems?: ActionItem[];
};

export type IncidentContext = {
  incident: IncidentRow;
  service: { id: number; name: string; environment: string; healthStatus: ServiceHealthStatus; runbookUrl: string | null; docsUrl: string | null; repositoryUrl: string | null; ownerId: number | null; projectId: string | null } | null;
  task: (TaskItem & { status: { id: string; name: string; category: string } }) | null;
  postmortem: Postmortem | null;
  relatedIncidents: Array<{ id: number; title: string; severity: IncidentSeverity; status: IncidentStatus; detectedAt: string }>;
  recentDeployments: Deployment[];
  monitors: Array<{ id: number; name: string; status: ServiceHealthStatus; lastError: string | null; lastCheckedAt: string | null }>;
  aiEnabled: boolean;
};

export type TimelineEvent = { id: number; eventType: IncidentEventType; message: string; occurredAt: string; actorName: string | null };
export type MonitorCheck = { id: number; monitorId: number; status: ServiceHealthStatus; statusCode: number | null; latencyMs: number | null; error: string | null; checkedAt: string };
export type TimelineResponse = { events: TimelineEvent[]; checks: MonitorCheck[] };

export type AssistantTask = 'summary' | 'root_cause' | 'troubleshooting' | 'postmortem_draft';
export type AssistantResult = { source: 'ai' | 'heuristic'; disclaimer: string; content: string };

export const EVENT_META: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  created: { icon: PlayCircle, cls: 'bg-[#fee2e2] text-[#dc2626] border-[#fecaca]', label: 'Created' },
  acknowledged: { icon: Hand, cls: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]', label: 'Acknowledged' },
  status_change: { icon: Settings2, cls: 'bg-[#ede9fe] text-[#6d28d9] border-[#cbd5e1]', label: 'Status change' },
  comment: { icon: MessageCircle, cls: 'bg-[#eeebe0] text-[#3d4a42] border-[#dfdbcc]', label: 'Comment' },
  assignment: { icon: UserCog, cls: 'bg-[#dcefd8] text-[#177a43] border-[#b2e2a8]', label: 'Assignment' },
  resolved: { icon: CheckCircle2, cls: 'bg-[#dcefd8] text-[#177a43] border-[#b2e2a8]', label: 'Resolved' },
  system: { icon: Info, cls: 'bg-[#f1f5f9] text-[#5f6b64] border-[#cbd5e1]', label: 'System' },
  severity_change: { icon: Gauge, cls: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]', label: 'Severity change' },
  alert: { icon: Siren, cls: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]', label: 'Alert' },
  recovery: { icon: Activity, cls: 'bg-[#dcefd8] text-[#177a43] border-[#b2e2a8]', label: 'Recovery' },
  deployment: { icon: Rocket, cls: 'bg-[#ede9fe] text-[#6d28d9] border-[#cbd5e1]', label: 'Deployment' },
  task_linked: { icon: Link2, cls: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]', label: 'Task linked' },
  escalation: { icon: ShieldAlert, cls: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]', label: 'Escalation' },
  notification: { icon: Bell, cls: 'bg-[#f1f5f9] text-[#5f6b64] border-[#cbd5e1]', label: 'Notification' },
};

export function eventMeta(type: string) {
  return EVENT_META[type] ?? { icon: Info, cls: 'bg-[#f1f5f9] text-[#5f6b64] border-[#cbd5e1]', label: type.replace(/_/g, ' ') };
}

export const CHECK_COLOR: Record<string, string> = { healthy: '#22a35a', degraded: '#e3a008', down: '#dc2626', maintenance: '#0284c7' };

/** Compact strip of monitor checks (one tick per check, newest at the right). */
export function CheckStrip({ checks, max = 120 }: { checks: MonitorCheck[]; max?: number }) {
  const shown = checks.slice(-max);
  if (shown.length === 0) return <p className="text-xs text-[#5f6b64]">No monitor checks recorded during this incident window.</p>;
  const failures = shown.filter((c) => c.status === 'down').length;
  return (
    <div>
      <div className="flex h-7 items-stretch gap-[2px]" role="img" aria-label={`${shown.length} monitor checks, ${failures} failed`}>
        {shown.map((c) => (
          <div
            key={c.id}
            className="min-w-[2px] flex-1 rounded-sm"
            style={{ background: CHECK_COLOR[c.status] ?? '#94a3b8' }}
            title={`${new Date(c.checkedAt).toLocaleString()} · ${c.status}${c.statusCode ? ` · HTTP ${c.statusCode}` : ''}${c.latencyMs != null ? ` · ${c.latencyMs}ms` : ''}${c.error ? ` · ${c.error}` : ''}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[#5f6b64]">
        <span>{new Date(shown[0]!.checkedAt).toLocaleTimeString()}</span>
        <span>
          {shown.length} checks · {failures} failed
        </span>
        <span>{new Date(shown[shown.length - 1]!.checkedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export const PM_STATUS_LABEL: Record<string, string> = { draft: 'Draft', in_review: 'In review', published: 'Published' };
export const PM_STATUS_TONE: Record<string, 'slate' | 'amber' | 'green'> = { draft: 'slate', in_review: 'amber', published: 'green' };
