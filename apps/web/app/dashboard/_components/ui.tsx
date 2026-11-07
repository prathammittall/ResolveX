import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Inbox,
} from 'lucide-react';
import type {
  AlertProcessingStatus,
  IncidentSeverity,
  IncidentStatus,
  ServiceHealthStatus,
} from '../../../lib/types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// --- Date / time formatting ---

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

// --- Badges (lookups guard for noUncheckedIndexedAccess) ---

const healthConfig: Record<
  ServiceHealthStatus,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', Icon: AlertTriangle },
  down: { label: 'Down', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', Icon: AlertOctagon },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20', Icon: HelpCircle },
};

export function HealthBadge({ status }: { status: ServiceHealthStatus }) {
  const c = healthConfig[status];
  const Icon = c?.Icon ?? HelpCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        c?.cls ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      <Icon className="h-3 w-3" />
      {c?.label ?? status}
    </span>
  );
}

const severityConfig: Record<IncidentSeverity, { label: string; cls: string }> = {
  sev1: { label: 'SEV1', cls: 'bg-rose-100 text-rose-700 ring-rose-600/30' },
  sev2: { label: 'SEV2', cls: 'bg-orange-100 text-orange-700 ring-orange-600/30' },
  sev3: { label: 'SEV3', cls: 'bg-amber-100 text-amber-700 ring-amber-600/30' },
  sev4: { label: 'SEV4', cls: 'bg-sky-100 text-sky-700 ring-sky-600/30' },
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const c = severityConfig[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset',
        c?.cls ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      {c?.label ?? severity.toUpperCase()}
    </span>
  );
}

const statusConfig: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
  open: { label: 'Open', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' },
  investigating: { label: 'Investigating', cls: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500' },
  mitigated: { label: 'Mitigated', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        c?.cls ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c?.dot ?? 'bg-slate-400')} />
      {c?.label ?? status}
    </span>
  );
}

const alertStatusConfig: Record<AlertProcessingStatus, { label: string; cls: string }> = {
  processed: { label: 'Processed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  ignored: { label: 'Ignored', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

export function AlertStatusBadge({ status }: { status: AlertProcessingStatus }) {
  const c = alertStatusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        c?.cls ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      {c?.label ?? status}
    </span>
  );
}

// --- Layout pieces ---

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-[#25396e]', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-serif-title text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = 'slate',
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'slate' | 'emerald' | 'rose' | 'amber' | 'blue' | 'violet';
  sub?: string;
}) {
  const accents: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', accents[accent] ?? accents.slate)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 font-serif-title text-3xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-xs', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="font-serif-title text-base font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
