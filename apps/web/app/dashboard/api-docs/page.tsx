'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Play, Search } from 'lucide-react';
import { SectionCard, cn } from '../_components/ui';
import { Button, Field, Input, PageHeader, Pill, Tabs } from '../_components/kit';

type Endpoint = { method: string; path: string; notes?: string };
type Group = { id: string; title: string; intro?: string; endpoints: Endpoint[] };

/** Endpoint reference, transcribed from docs/API.md. Paths are relative to /api. */
const CATALOGUE: Group[] = [
  {
    id: 'account',
    title: 'Account & organization',
    endpoints: [
      { method: 'POST', path: '/auth/register', notes: 'Create an account (session)' },
      { method: 'POST', path: '/auth/login', notes: 'Sign in; sets httpOnly session cookies' },
      { method: 'POST', path: '/auth/logout' },
      { method: 'POST', path: '/auth/refresh' },
      { method: 'GET', path: '/auth/me' },
      { method: 'POST', path: '/auth/switch-org', notes: '{ organizationId }' },
      { method: 'POST', path: '/auth/verify-email', notes: '{ token }' },
      { method: 'POST', path: '/auth/verify-email/request', notes: 'Resend the verification email' },
      { method: 'POST', path: '/auth/forgot-password', notes: '{ email }' },
      { method: 'POST', path: '/auth/reset-password', notes: '{ token, password }' },
      { method: 'GET', path: '/account/profile', notes: 'Also returns role and permissions' },
      { method: 'PATCH', path: '/account/profile', notes: '{ name, username, jobTitle, timezone, avatarUrl (data:image/png|jpeg|webp;base64, ≤256KB) }' },
      { method: 'POST', path: '/account/password', notes: '{ currentPassword, newPassword } — revokes other sessions' },
      { method: 'DELETE', path: '/account/sessions', notes: 'Sign out everywhere' },
      { method: 'GET', path: '/organizations', notes: 'Organizations you belong to' },
      { method: 'POST', path: '/organizations', notes: '{ name } — creator becomes owner' },
      { method: 'GET', path: '/org' },
      { method: 'PATCH', path: '/org', notes: '{ name }' },
      { method: 'GET', path: '/org/members', notes: 'members[{ userId, email, name, role, joinedAt, avatarUrl, jobTitle }]' },
      { method: 'PATCH', path: '/org/members/:userId', notes: '{ role }' },
      { method: 'DELETE', path: '/org/members/:userId' },
      { method: 'GET', path: '/org/invitations' },
      { method: 'POST', path: '/org/invitations', notes: '{ email, role } — email sent when SMTP is configured' },
      { method: 'DELETE', path: '/org/invitations/:id' },
      { method: 'POST', path: '/invitations/accept', notes: '{ token }' },
      { method: 'GET', path: '/audit-logs?limit&before', notes: 'Admin' },
    ],
  },
  {
    id: 'teams',
    title: 'Teams',
    endpoints: [
      { method: 'GET', path: '/teams', notes: 'teams[{ id, name, description, members[{userId,name,email,isLead,avatarUrl}], projects[], services[] }]' },
      { method: 'POST', path: '/teams', notes: '{ name, description }' },
      { method: 'PATCH', path: '/teams/:id' },
      { method: 'DELETE', path: '/teams/:id' },
      { method: 'POST', path: '/teams/:id/members', notes: '{ userId, isLead }' },
      { method: 'DELETE', path: '/teams/:id/members/:userId' },
      { method: 'GET', path: '/teams/:id/activity' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications & search',
    endpoints: [
      { method: 'GET', path: '/notifications?unread=true&type=&limit&offset', notes: '{ notifications[{id,type,title,body,link,readAt,emailStatus,emailError,createdAt}], unreadCount }' },
      { method: 'GET', path: '/notifications/unread-count' },
      { method: 'POST', path: '/notifications/read-all' },
      { method: 'PATCH', path: '/notifications/:id', notes: '{ read }' },
      { method: 'DELETE', path: '/notifications/:id' },
      { method: 'POST', path: '/notifications/:id/retry-email' },
      { method: 'GET', path: '/notifications/preferences', notes: 'Also returns types' },
      { method: 'PUT', path: '/notifications/preferences', notes: '{ settings: { [type]: { inApp, email } } }' },
      { method: 'GET', path: '/search?q=&types=tasks,projects,services,incidents,people,comments,docs', notes: 'results[{ type, id, title, subtitle, href }]' },
    ],
  },
  {
    id: 'work',
    title: 'Projects, tickets & sprints',
    endpoints: [
      { method: 'GET', path: '/projects?archived=true' },
      { method: 'POST', path: '/projects', notes: '{ name, key, description, leadId, teamId, color }' },
      { method: 'GET', path: '/projects/:id' },
      { method: 'PATCH', path: '/projects/:id', notes: '{ name, description, archived, leadId, teamId, color }' },
      { method: 'DELETE', path: '/projects/:id', notes: 'Only when archived' },
      { method: 'GET', path: '/projects/:id/overview', notes: '{ health, stats, activeSprint, services, incidents }' },
      { method: 'GET', path: '/projects/:id/activity' },
      { method: 'GET', path: '/projects/:id/members' },
      { method: 'POST', path: '/projects/:id/members', notes: '{ userId, role: lead|member }' },
      { method: 'DELETE', path: '/projects/:id/members/:userId' },
      { method: 'POST', path: '/projects/:id/statuses', notes: '{ name, category: todo|in_progress|done, position }' },
      { method: 'PATCH', path: '/projects/:id/statuses/:statusId' },
      { method: 'DELETE', path: '/projects/:id/statuses/:statusId' },
      { method: 'GET', path: '/projects/:id/sprints', notes: 'Includes progress' },
      { method: 'POST', path: '/projects/:id/sprints', notes: '{ name, goal, startDate, endDate }' },
      { method: 'GET', path: '/projects/:id/sprints/:sprintId', notes: '{ sprint, burndown }' },
      { method: 'PATCH', path: '/projects/:id/sprints/:sprintId' },
      { method: 'DELETE', path: '/projects/:id/sprints/:sprintId' },
      { method: 'POST', path: '/projects/:id/sprints/:sprintId/start' },
      { method: 'POST', path: '/projects/:id/sprints/:sprintId/complete', notes: "{ moveOpenTo: sprintId|'backlog' }" },
      { method: 'GET', path: '/projects/:id/velocity', notes: '{ sprints[], averageVelocity }' },
      { method: 'GET', path: '/projects/:id/tasks', notes: 'Same filters as /tasks' },
      { method: 'POST', path: '/projects/:id/tasks', notes: 'title, description, type, priority, statusId, assigneeId, dueDate, startDate, labels[], parentId, sprintId, storyPoints, position, serviceId, incidentId' },
      { method: 'GET', path: '/tasks?assignee=me&statusCategory=open', notes: 'Filters: assignee, reporter, watching, assigneeId, statusId, statusCategory, type, priority, sprintId, label, q, overdue, dueFrom, dueTo, updatedSince, serviceId, sort, order, limit, offset → { tasks, truncated, total }' },
      { method: 'GET', path: '/tasks/:ref', notes: 'PAY-12 or uuid → task, subtasks, comments, activity, watchers, dependencies, attachments, sprint' },
      { method: 'PATCH', path: '/tasks/:ref' },
      { method: 'DELETE', path: '/tasks/:ref' },
      { method: 'POST', path: '/tasks/:ref/comments', notes: '{ body } — @mentions notify' },
      { method: 'PATCH', path: '/tasks/:ref/comments/:id' },
      { method: 'DELETE', path: '/tasks/:ref/comments/:id' },
      { method: 'POST', path: '/tasks/:ref/comments/:id/reactions', notes: '{ emoji }' },
      { method: 'POST', path: '/tasks/:ref/watchers', notes: "Toggle caller's watch" },
      { method: 'POST', path: '/tasks/:ref/dependencies', notes: '{ dependsOn: ref }' },
      { method: 'DELETE', path: '/tasks/:ref/dependencies/:id' },
      { method: 'POST', path: '/tasks/:ref/attachments', notes: '{ fileName, contentType, contentBase64 } (≤2 MB)' },
      { method: 'GET', path: '/tasks/:ref/attachments/:id', notes: 'Download' },
      { method: 'POST', path: '/tasks/bulk', notes: '{ refs[], action: update|delete, patch }' },
      { method: 'GET', path: '/saved-filters' },
      { method: 'POST', path: '/saved-filters', notes: '{ name, scope: tasks|incidents, query, shared }' },
      { method: 'DELETE', path: '/saved-filters/:id' },
    ],
  },
  {
    id: 'services',
    title: 'Services & monitoring',
    intro: 'Health states: healthy, degraded, down, pending, maintenance (unknown = never checked).',
    endpoints: [
      { method: 'GET', path: '/services?status=&environment=' },
      { method: 'POST', path: '/services', notes: 'name, description, serviceType, environment, criticality, monitoredUrl, slug, teamId, ownerId, backupOwnerId, projectId, repositoryUrl, docsUrl, runbookUrl, tags[], currentVersion' },
      { method: 'GET', path: '/services/:id' },
      { method: 'PATCH', path: '/services/:id' },
      { method: 'DELETE', path: '/services/:id' },
      { method: 'GET', path: '/services/:id/overview', notes: 'owner, team, maintenance, monitors, uptime, dailyUptime, incidents, deployments, dependencies, dependents' },
      { method: 'GET', path: '/services/:id/metrics?hours=24', notes: '{ summary, series, deployments }' },
      { method: 'POST', path: '/services/:id/dependencies', notes: '{ dependsOnId, kind: hard|soft }' },
      { method: 'DELETE', path: '/services/:id/dependencies/:depId' },
      { method: 'GET', path: '/services/:id/webhook-keys' },
      { method: 'POST', path: '/services/:id/webhook-keys' },
      { method: 'DELETE', path: '/services/:id/webhook-keys/:keyId' },
      { method: 'GET', path: '/dependency-map', notes: '{ nodes[], edges[{ from, to, kind }] } — from depends on to' },
      { method: 'GET', path: '/monitors?serviceId=' },
      { method: 'POST', path: '/monitors', notes: 'serviceId, name, url, method, headers, body, timeoutMs, intervalSeconds (≥30), expectedStatusCodes[], assertions[], retries, failureThreshold, recoveryThreshold, degradedLatencyMs, severity, autoCreateTask, enabled' },
      { method: 'POST', path: '/monitors/test', notes: 'Dry-run an unsaved config' },
      { method: 'GET', path: '/monitors/:id', notes: '{ monitor, stats24h, series }' },
      { method: 'PATCH', path: '/monitors/:id' },
      { method: 'DELETE', path: '/monitors/:id' },
      { method: 'POST', path: '/monitors/:id/run', notes: 'Check now' },
      { method: 'GET', path: '/monitors/:id/checks?status=&limit' },
    ],
  },
  {
    id: 'incidents',
    title: 'Incidents',
    intro: 'Lifecycle: open → acknowledged → investigating → mitigated → resolved; reopen with status: open.',
    endpoints: [
      { method: 'GET', path: '/incidents?status=&severity=' },
      { method: 'GET', path: '/incidents/:id', notes: 'Events, alerts, escalation' },
      { method: 'POST', path: '/incidents', notes: '{ serviceId, title, description, severity, assigneeId, projectId, createTask }' },
      { method: 'PATCH', path: '/incidents/:id', notes: '{ status, severity, assigneeId, title, description, customerImpact, projectId, note }' },
      { method: 'GET', path: '/incidents/:id/context' },
      { method: 'GET', path: '/incidents/:id/timeline', notes: '{ events, checks }' },
      { method: 'POST', path: '/incidents/:id/task', notes: '{ ref } or { projectId }' },
      { method: 'DELETE', path: '/incidents/:id/task' },
      { method: 'GET', path: '/incidents/:id/postmortem' },
      { method: 'PUT', path: '/incidents/:id/postmortem', notes: '{ status, summary, rootCause, customerImpact, contributingFactors, resolution, preventiveMeasures, lessonsLearned }' },
      { method: 'POST', path: '/incidents/:id/postmortem/action-items', notes: '{ title, ownerId, dueDate, createTaskInProject }' },
      { method: 'PATCH', path: '/postmortems/action-items/:id' },
      { method: 'DELETE', path: '/postmortems/action-items/:id' },
      { method: 'GET', path: '/postmortems' },
      { method: 'POST', path: '/incidents/:id/assistant', notes: '{ task: summary|root_cause|troubleshooting|postmortem_draft }' },
      { method: 'GET', path: '/incidents/groups', notes: 'Correlated incident groups' },
      { method: 'POST', path: '/incidents/:id/acknowledge' },
      { method: 'POST', path: '/incidents/:id/resolve' },
      { method: 'POST', path: '/incidents/:id/comments', notes: '{ message }' },
      { method: 'GET', path: '/alerts', notes: 'Ingested alert events' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    endpoints: [
      { method: 'GET', path: '/escalation-policies' },
      { method: 'POST', path: '/escalation-policies', notes: '{ name, serviceId, enabled, severities[], environment, teamId, activeHours{start,end,days[],timezone}, priority, steps[{delaySeconds,targetType,targetId,notificationChannels[]}] }' },
      { method: 'PATCH', path: '/escalation-policies/:id' },
      { method: 'DELETE', path: '/escalation-policies/:id' },
      { method: 'GET', path: '/maintenance-windows' },
      { method: 'POST', path: '/maintenance-windows', notes: '{ name, description, serviceId, serviceIds[], startsAt, endsAt, timezone, recurrence, recurrenceUntil, bypassSeverity, enabled }' },
      { method: 'PATCH', path: '/maintenance-windows/:id' },
      { method: 'DELETE', path: '/maintenance-windows/:id' },
      { method: 'GET', path: '/oncall/schedules', notes: 'Includes current{primaryUser,secondaryUser,shiftEnd} and overrides' },
      { method: 'POST', path: '/oncall/schedules', notes: '{ name, description, teamId, timezone, rotationHours, rotationStart, participants[userId] }' },
      { method: 'PATCH', path: '/oncall/schedules/:id' },
      { method: 'DELETE', path: '/oncall/schedules/:id' },
      { method: 'GET', path: '/oncall/schedules/:id/calendar?from=&days=', notes: '{ shifts[], overrides[] }' },
      { method: 'POST', path: '/oncall/schedules/:id/overrides', notes: '{ userId, startsAt, endsAt, reason }' },
      { method: 'DELETE', path: '/oncall/schedules/:id/overrides/:oid' },
      { method: 'GET', path: '/oncall/now' },
      { method: 'GET', path: '/deployments?serviceId=&environment=', notes: 'Includes serviceName, relatedIncidents' },
      { method: 'POST', path: '/deployments', notes: '{ serviceId, environment, version, commitSha, repositoryUrl, author, status, description, url }' },
      { method: 'GET', path: '/status-pages' },
      { method: 'POST', path: '/status-pages', notes: '{ name, slug, description, isPublic, brandColor, logoUrl, supportUrl, showIncidentHistory, serviceIds[] }' },
      { method: 'PATCH', path: '/status-pages/:id' },
      { method: 'DELETE', path: '/status-pages/:id' },
      { method: 'GET', path: '/status-pages/:id/preview' },
      { method: 'GET', path: '/public/status/:slug', notes: 'Public (no auth); only isPublic pages, customer-safe fields' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    endpoints: [
      { method: 'GET', path: '/analytics/overview?days=30', notes: 'services, incidents (MTTA/MTTR), tasks, monitoring, series, workload' },
      { method: 'GET', path: '/analytics/insights?days=30', notes: 'mostUnreliableServices, degradingLatency, failingEndpoints, recurringPatterns, teamWorkload, trend, recommendations' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    endpoints: [
      { method: 'GET', path: '/webhook-endpoints', notes: 'Admin' },
      { method: 'POST', path: '/webhook-endpoints', notes: '{ name, url, events[], enabled } — returns secret once' },
      { method: 'PATCH', path: '/webhook-endpoints/:id' },
      { method: 'DELETE', path: '/webhook-endpoints/:id' },
      { method: 'POST', path: '/webhook-endpoints/:id/rotate-secret' },
      { method: 'POST', path: '/webhook-endpoints/:id/test' },
      { method: 'GET', path: '/webhook-endpoints/:id/deliveries' },
      { method: 'POST', path: '/webhook-endpoints/:id/deliveries/:deliveryId/retry' },
      { method: 'GET', path: '/api-keys', notes: 'Admin' },
      { method: 'POST', path: '/api-keys', notes: '{ name, role, expiresInDays } — returns key once' },
      { method: 'DELETE', path: '/api-keys/:id' },
      { method: 'GET', path: '/integrations/github', notes: '{ configured, connection, repositories, webhookUrl }' },
      { method: 'POST', path: '/integrations/github/connect', notes: '→ { url } (OAuth)' },
      { method: 'DELETE', path: '/integrations/github/connection' },
      { method: 'POST', path: '/integrations/github/repositories', notes: '{ fullName, projectId, serviceId } — returns webhookSecret once' },
      { method: 'PATCH', path: '/integrations/github/repositories/:id' },
      { method: 'DELETE', path: '/integrations/github/repositories/:id' },
      { method: 'GET', path: '/integrations/github/repositories/:id/activity' },
      { method: 'GET', path: '/integrations/github/events?taskRef=PAY-12' },
      { method: 'POST', path: '/webhooks/github', notes: 'GitHub webhook target (push, pull_request, deployment_status; X-Hub-Signature-256)' },
    ],
  },
  {
    id: 'inbound',
    title: 'Inbound webhooks',
    intro: 'Authenticate with a per-service webhook key: Authorization: Bearer <key> (Services → service → Webhook keys).',
    endpoints: [
      { method: 'POST', path: '/webhooks/alerts', notes: '{ serviceId, eventId, eventType: firing|recovery, severity, message, occurredAt }' },
      { method: 'POST', path: '/webhooks/deployments', notes: 'Deployment body (see POST /deployments)' },
    ],
  },
];

const EVENTS = ['incident.created', 'incident.acknowledged', 'incident.status_changed', 'incident.resolved', 'service.health_changed', 'deployment.created', 'task.created', 'task.updated', 'postmortem.published'];

const VERIFY_SNIPPET = `import crypto from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.RESOLVEX_WEBHOOK_SECRET; // whsec_...

// Keep the raw body: the signature covers the exact bytes sent.
app.post('/hooks/resolvex', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('X-ResolveX-Signature') ?? '';          // t=<ts>,v1=<hex>
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const body = req.body.toString('utf8');
  const expected = crypto.createHmac('sha256', SECRET).update(\`\${parts.t}.\${body}\`).digest('hex');

  const valid = parts.v1 && expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300; // reject replays older than 5 min
  if (!valid || !fresh) return res.status(401).end();

  // X-ResolveX-Delivery is an idempotency key: skip deliveries you've already processed.
  const event = JSON.parse(body);
  console.log(req.get('X-ResolveX-Event'), req.get('X-ResolveX-Delivery'), event);
  res.sendStatus(204);
});`;

function alertExample(origin: string) {
  return `curl -X POST ${origin}/api/webhooks/alerts \\
  -H "Authorization: Bearer $SERVICE_WEBHOOK_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": 42,
    "eventId": "checkout-latency-2026-11-21T10:00Z",
    "eventType": "firing",
    "severity": "sev2",
    "message": "p95 latency above 2s for 5 minutes",
    "occurredAt": "2026-11-21T10:00:00Z"
  }'

# When the condition clears, send the same payload with a new eventId and
#   "eventType": "recovery"`;
}

function deployExample(origin: string) {
  return `curl -X POST ${origin}/api/webhooks/deployments \\
  -H "Authorization: Bearer $SERVICE_WEBHOOK_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": 42,
    "environment": "production",
    "version": "v2.14.0",
    "commitSha": "9f2c1ab",
    "author": "ci-bot",
    "status": "succeeded",
    "url": "https://ci.example.com/runs/1234"
  }'`;
}

function apiKeyExample(origin: string) {
  return `curl ${origin}/api/incidents?status=open \\
  -H "Authorization: Bearer rxk_..."`;
}

const METHOD_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'violet'> = { GET: 'green', POST: 'blue', PATCH: 'amber', PUT: 'violet', DELETE: 'red' };

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs leading-relaxed text-[#14201a]">{children}</pre>;
}

function Explorer({ preset }: { preset: string }) {
  const [path, setPath] = useState(preset);
  const [result, setResult] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep the input in sync when someone clicks "Try" on a GET endpoint.
  const [lastPreset, setLastPreset] = useState(preset);
  if (preset !== lastPreset) {
    setLastPreset(preset);
    setPath(preset);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const p = path.trim();
    if (!p.startsWith('/api/') || p.includes('..') || p.startsWith('//')) return setErr('Enter a path that starts with /api/, e.g. /api/services');
    if (/:[a-zA-Z]+/.test(p)) return setErr('Replace the :placeholders in the path with real ids first.');
    setRunning(true);
    const t0 = performance.now();
    try {
      const res = await fetch(p, { method: 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON (e.g. an attachment download); show as text.
      }
      setResult({ status: res.status, ms: Math.round(performance.now() - t0), body: body.length > 200_000 ? `${body.slice(0, 200_000)}\n… (truncated)` : body });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <SectionCard title="API explorer" subtitle="Sends GET requests with your current session. Read-only by design.">
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Path" className="flex-1">
          <Input value={path} onChange={(e) => setPath(e.target.value)} spellCheck={false} autoComplete="off" className="font-mono" placeholder="/api/services" />
        </Field>
        <Button type="submit" loading={running}><Play className="h-4 w-4" /> Send GET</Button>
      </form>
      {err && <p className="mt-2 text-xs font-semibold text-[#dc2626]">{err}</p>}
      {result && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-[#5f6b64]">
            <Pill tone={result.status < 300 ? 'green' : result.status < 500 ? 'amber' : 'red'}>HTTP {result.status}</Pill>
            <span>{result.ms} ms</span>
          </div>
          <pre className="max-h-[480px] overflow-auto rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 font-mono text-xs text-[#14201a]">{result.body || '(empty response)'}</pre>
        </div>
      )}
    </SectionCard>
  );
}

type TabId = 'reference' | 'auth' | 'webhooks' | 'guides';

export default function ApiDocsPage() {
  const [tab, setTab] = useState<TabId>('reference');
  const [q, setQ] = useState('');
  const [preset, setPreset] = useState('/api/services');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return CATALOGUE;
    return CATALOGUE.map((g) => ({ ...g, endpoints: g.endpoints.filter((e) => `${e.method} ${e.path} ${e.notes ?? ''}`.toLowerCase().includes(term)) })).filter((g) => g.endpoints.length > 0);
  }, [q]);

  return (
    <div>
      <PageHeader title="API & docs" description="REST reference, authentication, webhooks and integration guides. Every response is JSON: { ok: true, … } or { ok: false, error: { code, message, details? } }." />
      <Tabs<TabId>
        tabs={[
          { id: 'reference', label: 'Reference' },
          { id: 'auth', label: 'Authentication' },
          { id: 'webhooks', label: 'Webhooks' },
          { id: 'guides', label: 'Integration guides' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5 space-y-6">
        {tab === 'reference' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <label className="relative block">
                <span className="sr-only">Filter endpoints</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6b64]" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter endpoints (e.g. incidents, PATCH, sprint)" className="pl-9" />
              </label>
              <p className="text-xs text-[#5f6b64]">All paths are under <code className="font-mono">/api</code>. Pagination uses <code className="font-mono">?limit=&amp;offset=</code> where supported; timestamps are ISO-8601.</p>
              {groups.length === 0 && <p className="text-sm text-[#5f6b64]">No endpoints match “{q}”.</p>}
              {groups.map((g) => (
                <SectionCard key={g.id} title={g.title} subtitle={g.intro}>
                  <ul className="-my-1 divide-y divide-[#dfdbcc]">
                    {g.endpoints.map((e) => (
                      <li key={`${e.method} ${e.path}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
                        <span className="w-16 shrink-0"><Pill tone={METHOD_TONE[e.method] ?? 'slate'}>{e.method}</Pill></span>
                        <div className="min-w-0 flex-1">
                          <code className="break-all font-mono text-xs font-semibold text-[#14201a]">/api{e.path}</code>
                          {e.notes && <p className="mt-0.5 text-xs text-[#5f6b64]">{e.notes}</p>}
                        </div>
                        {e.method === 'GET' && (
                          <button type="button" onClick={() => setPreset(`/api${e.path.replace(/\?.*$/, '')}`)} className="self-start rounded-lg px-2 py-0.5 text-xs font-semibold text-[#177a43] hover:bg-[#dcefd8]">
                            Try
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ))}
            </div>
            <div className="xl:sticky xl:top-4 xl:self-start">
              <Explorer preset={preset} />
            </div>
          </div>
        )}

        {tab === 'auth' && (
          <>
            <SectionCard title="Browser sessions">
              <p className="text-sm text-[#3d4a42]">The dashboard uses httpOnly session cookies set by <code className="font-mono text-xs">POST /api/auth/login</code>. JavaScript never sees the token; the explorer reuses your session.</p>
            </SectionCard>
            <SectionCard title="API keys">
              <div className="space-y-3 text-sm text-[#3d4a42]">
                <p>
                  Create a key in <Link href="/dashboard/integrations" className="font-semibold text-[#177a43] hover:underline">Integrations → API keys</Link>. A key acts as its creator within one organization, limited to the role chosen when it was created. Send it as a bearer token:
                </p>
                <Code>{apiKeyExample(origin)}</Code>
              </div>
            </SectionCard>
            <SectionCard title="Roles">
              <p className="text-sm text-[#3d4a42]">
                <code className="font-mono text-xs">owner</code>, <code className="font-mono text-xs">admin</code>, <code className="font-mono text-xs">manager</code>, <code className="font-mono text-xs">developer</code>, <code className="font-mono text-xs">responder</code>, <code className="font-mono text-xs">member</code>, <code className="font-mono text-xs">viewer</code>. The server enforces every permission; a request without the needed permission returns <code className="font-mono text-xs">403</code>.
              </p>
            </SectionCard>
            <SectionCard title="Service webhook keys">
              <p className="text-sm text-[#3d4a42]">Alert and deployment webhooks use a per-service key (Services → service → Webhook keys), sent as <code className="font-mono text-xs">Authorization: Bearer &lt;key&gt;</code>. A key only works for its own service.</p>
            </SectionCard>
          </>
        )}

        {tab === 'webhooks' && (
          <>
            <SectionCard title="Outgoing webhooks" subtitle="Configure endpoints in Integrations → Outgoing webhooks">
              <div className="space-y-3 text-sm text-[#3d4a42]">
                <p>ResolveX sends a <code className="font-mono text-xs">POST</code> with a JSON body for each subscribed event. Failed deliveries are retried; you can inspect and retry them from the dashboard.</p>
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Events</h4>
                  <div className="flex flex-wrap gap-1.5">{EVENTS.map((e) => <Pill key={e} tone="blue">{e}</Pill>)}</div>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Headers</h4>
                  <ul className="space-y-1 text-xs">
                    <li><code className="font-mono">X-ResolveX-Event</code> — event name</li>
                    <li><code className="font-mono">X-ResolveX-Delivery</code> — unique delivery id; use it as an idempotency key</li>
                    <li><code className="font-mono">X-ResolveX-Timestamp</code> — Unix seconds when the request was signed</li>
                    <li><code className="font-mono">X-ResolveX-Signature</code> — <code className="font-mono">t=&lt;ts&gt;,v1=&lt;hex HMAC-SHA256(secret, &quot;&lt;ts&gt;.&lt;body&gt;&quot;)&gt;</code></li>
                  </ul>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Verifying signatures (Node.js)">
              <Code>{VERIFY_SNIPPET}</Code>
            </SectionCard>
          </>
        )}

        {tab === 'guides' && (
          <>
            <SectionCard title="Send alerts from your monitoring" subtitle="Prometheus Alertmanager, Grafana, Datadog, custom scripts…">
              <div className="space-y-3 text-sm text-[#3d4a42]">
                <p>Create a webhook key on the service, then POST alert events. A <code className="font-mono text-xs">firing</code> event opens (or joins) an incident; a <code className="font-mono text-xs">recovery</code> event lets it recover. Severity is one of <code className="font-mono text-xs">sev1</code>–<code className="font-mono text-xs">sev4</code>.</p>
                <Code>{alertExample(origin)}</Code>
              </div>
            </SectionCard>
            <SectionCard title="Record deployments from CI">
              <div className="space-y-3 text-sm text-[#3d4a42]">
                <p>Post each deploy so it shows on service charts and incident timelines. <code className="font-mono text-xs">status</code> is one of pending, in_progress, succeeded, failed, rolled_back; <code className="font-mono text-xs">environment</code> is production, staging or development.</p>
                <Code>{deployExample(origin)}</Code>
              </div>
            </SectionCard>
            <SectionCard title="GitHub">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#3d4a42]">
                <li>Open <Link href="/dashboard/integrations" className="font-semibold text-[#177a43] hover:underline">Integrations → GitHub</Link> and link a repository (owner/name), optionally mapping it to a project and a service.</li>
                <li>Add the webhook shown once to the repository (payload URL <code className="font-mono text-xs">/api/webhooks/github</code>, JSON, with the secret) for push, pull_request and deployment_status events.</li>
                <li>Mention ticket keys such as <code className="font-mono text-xs">PAY-12</code> in commits, branches or PR titles — they appear on the ticket. Look them up with <code className="font-mono text-xs">GET /api/integrations/github/events?taskRef=PAY-12</code>.</li>
                <li>Optionally connect a GitHub account (OAuth) to show live commits and pull requests.</li>
              </ol>
            </SectionCard>
            <SectionCard title="Public status pages">
              <p className="text-sm text-[#3d4a42]">
                Public pages are served at <code className="font-mono text-xs">/status/&lt;slug&gt;</code>; their data is available without authentication from <code className="font-mono text-xs">GET /api/public/status/&lt;slug&gt;</code> (customer-safe fields only). Manage them in{' '}
                <Link href="/dashboard/status-pages" className="font-semibold text-[#177a43] hover:underline">Status pages</Link>.
              </p>
            </SectionCard>
            <div className={cn('flex items-center gap-2 text-xs text-[#5f6b64]')}>
              <BookOpen className="h-4 w-4" /> Full reference: see the Reference tab, or <code className="font-mono">docs/API.md</code> in the repository.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
