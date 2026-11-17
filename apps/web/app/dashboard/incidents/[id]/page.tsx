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
  created: { icon: PlayCircle, color: 'bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]' },
  acknowledged: { icon: Hand, color: 'bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]' },
  status_change: { icon: Settings2, color: 'bg-[#ede9fe] text-[#7c3aed] border border-[#ddd6fe]' },
  comment: { icon: MessageCircle, color: 'bg-[#eeebe0] text-[#3d4a42] border border-[#dfdbcc]' },
  assignment: { icon: UserCog, color: 'bg-[#dcefd8] text-[#177a43] border border-[#b2e2a8]' },
  resolved: { icon: CheckCircle2, color: 'bg-[#dcefd8] text-[#15803d] border border-[#b2e2a8]' },
  system: { icon: Info, color: 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]' },
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
        <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] hover:text-[#177a43] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
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
      <div className="flex items-center justify-between border-b border-[#dfdbcc] pb-4">
        <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5f6b64] hover:text-[#177a43] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
        </Link>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {/* Header card */}
      <div className="rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-[0_2px_0_#dfdbcc]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-[#14201a]">{incident.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#5f6b64]">
              <span className="inline-flex items-center gap-1.5">
                <Server className="h-4 w-4 text-[#177a43]" />
                <Link href="/dashboard/services" className="font-bold text-[#14201a] hover:text-[#177a43] hover:underline transition">{incident.serviceName}</Link>
              </span>
              {incident.assignedResponderName && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#3d4a42]">
                  <UserCog className="h-4 w-4" />
                  {incident.assignedResponderName}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            {canAcknowledge && (
              <button
                onClick={handleAcknowledge}
                disabled={acting !== null}
                className="btn-kizupi-ink text-sm px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {acting === 'acknowledge' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Hand className="h-4 w-4 mr-1.5" />}
                Acknowledge
              </button>
            )}
            {canResolve && (
              <button
                onClick={handleResolve}
                disabled={acting !== null}
                className="btn-kizupi-go text-sm px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {acting === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Mark as Resolved
              </button>
            )}
          </div>
        </div>

        {incident.description && (
          <p className="mt-4 border-t border-[#dfdbcc]/60 pt-4 text-sm text-[#5f6b64] leading-relaxed">{incident.description}</p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#dfdbcc]/60 pt-4 sm:grid-cols-3">
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
          <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc] overflow-hidden">
            <div className="border-b border-[#dfdbcc]/80 bg-[#fbfaf6] px-5 py-4">
              <h3 className="font-display text-base font-bold text-[#14201a]">Activity Timeline</h3>
            </div>
            <div className="p-6">
              <ol className="relative space-y-6 border-l-2 border-[#dfdbcc] pl-6">
                {events.map((ev) => {
                  const raw = eventTypeMeta[ev.eventType];
                  const Icon = raw?.icon ?? Info;
                  const color = raw?.color ?? 'bg-[#eeebe0] text-[#5f6b64]';
                  return (
                    <li key={ev.id} className="relative">
                      <span className={cn('absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full bg-white ring-4 ring-white shadow-xs', color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold capitalize text-[#14201a]">
                          {ev.eventType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-[#5f6b64]">{timeAgo(ev.occurredAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-[#3d4a42]">{ev.message}</p>
                      {ev.actorName && (
                        <p className="mt-0.5 text-xs font-medium text-[#5f6b64]">by {ev.actorName}</p>
                      )}
                    </li>
                  );
                })}
                {events.length === 0 && (
                  <li className="text-sm text-[#5f6b64]">No activity recorded yet.</li>
                )}
              </ol>

              {/* Comment box */}
              {responder && (
                <form onSubmit={handleComment} className="mt-7 pt-5 border-t border-[#dfdbcc]/60">
                  <div className="flex items-start gap-2.5">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add an internal comment or triage note..."
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] placeholder-[#5f6b64]/50 outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20"
                    />
                    <button
                      type="submit"
                      disabled={postingComment || !comment.trim()}
                      className="btn-kizupi-go p-2.5 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
                      title="Post comment"
                      aria-label="Post comment"
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
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#dfdbcc]/80 bg-[#fbfaf6] px-5 py-4">
              <Bell className="h-4 w-4 text-[#177a43]" />
              <h3 className="font-display text-base font-bold text-[#14201a]">Linked Alerts</h3>
            </div>
            <div className="p-5">
              {alerts.length === 0 ? (
                <p className="text-sm text-[#5f6b64]">No raw alerts linked to this incident.</p>
              ) : (
                <ul className="space-y-2.5">
                  {alerts.map((a) => (
                    <li key={a.id} className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2.5">
                      <p className="truncate font-mono text-xs font-bold text-[#14201a]">{a.providerEventId}</p>
                      <p className="mt-0.5 text-xs text-[#5f6b64]">
                        {a.provider} · {timeAgo(a.receivedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#177a43]" />
              <h3 className="font-display text-sm font-bold text-[#14201a]">Lifecycle & SLA Policy</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5f6b64]">
              Recovery alerts transition an incident to <span className="font-semibold text-[#b45309]">mitigated</span>, but require human responder sign-off to formally close.
              Resolving confirms the service is healthy and unblocks monitoring pipelines.
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
      <dt className="text-xs font-bold uppercase tracking-wider text-[#5f6b64]">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-[#14201a]">{value}</dd>
      {sub && <p className="text-xs text-[#5f6b64] mt-0.5">{sub}</p>}
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
