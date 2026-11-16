'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Hand,
  PlayCircle,
  MessageCircle,
  UserCog,
  Settings2,
  Info,
  Loader2,
  Send,
  Server,
  Bell,
  ShieldCheck,
  Clock3,
  ListChecks,
} from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { canRespond } from '../../../../lib/permissions';
import type {
  IncidentDetailResponse,
  IncidentEventType,
  MessageResponse,
} from '../../../../lib/types';
import {
  cn,
  ErrorBanner,
  PageLoader,
  SeverityBadge,
  StatusBadge,
  formatDateTime,
  timeAgo,
} from '../../_components/ui';

const eventTypeMeta: Record<IncidentEventType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  created: { icon: PlayCircle, color: 'bg-blue-100 text-blue-600' },
  acknowledged: { icon: Hand, color: 'bg-blue-100 text-blue-600' },
  status_change: { icon: Settings2, color: 'bg-violet-100 text-violet-600' },
  comment: { icon: MessageCircle, color: 'bg-slate-100 text-slate-600' },
  assignment: { icon: UserCog, color: 'bg-indigo-100 text-indigo-600' },
  resolved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  system: { icon: Info, color: 'bg-slate-100 text-slate-500' },
};

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const responder = canRespond(user?.role);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<'acknowledge' | 'resolve' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const res = await api.get<IncidentDetailResponse>(`/api/incidents/${id}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(false), 5000);
    return () => window.clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleAcknowledge() {
    setActionError(null);
    setActing('acknowledge');
    try {
      await api.post<MessageResponse>(`/api/incidents/${id}/acknowledge`);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to acknowledge');
    } finally {
      setActing(null);
    }
  }

  async function handleResolve() {
    setActionError(null);
    setActing('resolve');
    try {
      await api.post<MessageResponse>(`/api/incidents/${id}/resolve`);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to resolve');
    } finally {
      setActing(null);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPostingComment(true);
    setActionError(null);
    try {
      await api.post<MessageResponse>(`/api/incidents/${id}/comments`, { message: comment.trim() });
      setComment('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  if (loading) return <PageLoader />;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to incidents
        </Link>
        <ErrorBanner message={error || 'Incident not found'} />
      </div>
    );
  }

  const { incident, events, alerts } = data;
  const escalation = data.escalation;
  const remainingMs = escalation?.nextEscalationAt
    ? Math.max(0, Date.parse(escalation.nextEscalationAt) - now)
    : null;
  const canAcknowledge = responder && incident.status === 'open';
  const canResolve = responder && incident.status !== 'resolved';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to incidents
        </Link>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
            </div>
            <h1 className="mt-3 font-serif-title text-2xl font-semibold text-slate-900">{incident.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                <Link href="/dashboard/services" className="font-medium text-slate-700 hover:underline">{incident.serviceName}</Link>
              </span>
              {incident.assignedResponderName && (
                <span className="inline-flex items-center gap-1.5">
                  <UserCog className="h-3.5 w-3.5" />
                  {incident.assignedResponderName}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {canAcknowledge && (
              <button
                onClick={handleAcknowledge}
                disabled={acting !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {acting === 'acknowledge' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                Acknowledge
              </button>
            )}
            {canResolve && (
              <button
                onClick={handleResolve}
                disabled={acting !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {acting === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Resolve
              </button>
            )}
          </div>
        </div>

        {incident.description && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">{incident.description}</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <DetailItem label="Detected" value={formatDateTime(incident.detectedAt)} sub={timeAgo(incident.detectedAt)} />
          <DetailItem
            label="Acknowledged"
            value={incident.acknowledgedAt ? formatDateTime(incident.acknowledgedAt) : '—'}
            sub={incident.acknowledgedAt ? timeAgo(incident.acknowledgedAt) : undefined}
          />
          <DetailItem
            label="MTTA"
            value={incident.mttaSeconds == null ? '—' : `${Math.round(incident.mttaSeconds / 60)} min`}
            sub={incident.escalationStatus ? `Escalation ${incident.escalationStatus}` : undefined}
          />
          <DetailItem
            label="Acknowledgment due"
            value={incident.acknowledgmentDueAt ? formatDateTime(incident.acknowledgmentDueAt) : '—'}
            sub={incident.acknowledgmentDueAt ? timeAgo(incident.acknowledgmentDueAt) : undefined}
          />
          <DetailItem
            label="Resolved"
            value={incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '—'}
            sub={incident.resolvedAt ? timeAgo(incident.resolvedAt) : undefined}
          />
        </dl>
      </div>

      {escalation && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-600" />
              <div>
                <h2 className="font-serif-title text-base font-semibold text-slate-900">Escalation monitor</h2>
                <p className="text-xs text-slate-500">
                  Step {escalation.currentStep} · {escalation.status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Next timer</p>
              <p className="font-mono text-lg font-semibold text-slate-800">
                {remainingMs === null ? '—' : remainingMs === 0 ? 'Due now' : formatDuration(remainingMs)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ListChecks className="h-3.5 w-3.5" /> Hierarchy
              </div>
              <ol className="space-y-2">
                {escalation.steps.map((step) => (
                  <li key={step.position} className="flex items-center justify-between gap-3 text-sm">
                    <span className={cn(step.position === escalation.currentStep ? 'font-semibold text-[#25396e]' : 'text-slate-600')}>
                      {step.position}. {step.targetType} · {step.targetId}
                    </span>
                    <span className="text-xs text-slate-400">{formatDelay(step.delaySeconds)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Queue and delivery</p>
              {escalation.queue.length === 0 && escalation.deliveries.length === 0 ? (
                <p className="text-sm text-slate-400">No queue activity yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-600">
                  {escalation.queue.map((job) => (
                    <li key={job.id} className="flex justify-between gap-3">
                      <span>{job.type} #{job.id}</span>
                      <span className="font-medium">{job.status}</span>
                    </li>
                  ))}
                  {escalation.deliveries.map((delivery) => (
                    <li key={delivery.id} className="flex justify-between gap-3">
                      <span>{delivery.channel} · {delivery.recipient}</span>
                      <span className="font-medium">{delivery.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-serif-title text-base font-semibold text-slate-900">Activity Timeline</h3>
            </div>
            <div className="p-5">
              <ol className="relative space-y-5 border-l border-slate-200 pl-6">
                {events.map((ev) => {
                  const raw = eventTypeMeta[ev.eventType];
                  const Icon = raw?.icon ?? Info;
                  const color = raw?.color ?? 'bg-slate-100 text-slate-500';
                  return (
                    <li key={ev.id} className="relative">
                      <span className={cn('absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white', color)}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize text-slate-800">
                          {ev.eventType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">{timeAgo(ev.occurredAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{ev.message}</p>
                      {ev.actorName && (
                        <p className="mt-0.5 text-xs text-slate-400">by {ev.actorName}</p>
                      )}
                    </li>
                  );
                })}
                {events.length === 0 && (
                  <li className="text-sm text-slate-400">No activity recorded yet.</li>
                )}
              </ol>

              {/* Comment box */}
              {responder && (
              <form onSubmit={handleComment} className="mt-6">
                <div className="flex items-start gap-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#25396e] focus:bg-white focus:ring-2 focus:ring-[#25396e]/15"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !comment.trim()}
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25396e] text-white transition hover:bg-[#1b2b57] disabled:opacity-50"
                  >
                    {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>

        {/* Linked alerts */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Bell className="h-4 w-4 text-slate-400" />
              <h3 className="font-serif-title text-base font-semibold text-slate-900">Linked Alerts</h3>
            </div>
            <div className="p-5">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-400">No alerts linked to this incident.</p>
              ) : (
                <ul className="space-y-3">
                  {alerts.map((a) => (
                    <li key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <p className="truncate font-mono text-xs text-slate-600">{a.providerEventId}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {a.provider} · {timeAgo(a.receivedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3 className="font-serif-title text-sm font-semibold text-slate-900">Lifecycle</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Recovery alerts move an incident to <span className="font-medium text-amber-600">mitigated</span> but never auto-resolve it.
              Resolving manually marks the service healthy and frees it to accept new alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatDelay(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}
