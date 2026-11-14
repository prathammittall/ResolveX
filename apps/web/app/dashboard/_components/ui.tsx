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
  healthy: { label: 'Healthy', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30', Icon: AlertTriangle },
  down: { label: 'Down', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30', Icon: AlertOctagon },
  unknown: { label: 'Unknown', cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 ring-zinc-500/30', Icon: HelpCircle },
};

export function HealthBadge({ status }: { status: ServiceHealthStatus }) {
  const c = healthConfig[status];
  const Icon = c?.Icon ?? HelpCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        c?.cls ?? 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30',
      )}
    >
      <Icon className="h-3 w-3" />
      {c?.label ?? status}
    </span>
  );
}

const severityConfig: Record<IncidentSeverity, { label: string; cls: string }> = {
  sev1: { label: 'SEV1', cls: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 ring-rose-500/40' },
  sev2: { label: 'SEV2', cls: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 ring-orange-500/40' },
  sev3: { label: 'SEV3', cls: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 ring-amber-500/40' },
  sev4: { label: 'SEV4', cls: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 ring-blue-500/40' },
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const c = severityConfig[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset',
        c?.cls ?? 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30',
      )}
    >
      {c?.label ?? severity.toUpperCase()}
    </span>
  );
}

const statusConfig: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
  open: { label: 'Open', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30', dot: 'bg-rose-500' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30', dot: 'bg-blue-500' },
  investigating: { label: 'Investigating', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-purple-500/30', dot: 'bg-purple-500' },
  mitigated: { label: 'Mitigated', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30', dot: 'bg-amber-500' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30', dot: 'bg-emerald-500' },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        c?.cls ?? 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c?.dot ?? 'bg-zinc-400')} />
      {c?.label ?? status}
    </span>
  );
}

const alertStatusConfig: Record<AlertProcessingStatus, { label: string; cls: string }> = {
  processed: { label: 'Processed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30' },
  pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30' },
  failed: { label: 'Failed', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30' },
  ignored: { label: 'Ignored', cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 ring-zinc-500/30' },
};

export function AlertStatusBadge({ status }: { status: AlertProcessingStatus }) {
  const c = alertStatusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        c?.cls ?? 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30',
      )}
    >
      {c?.label ?? status}
    </span>
  );
}

// --- Layout pieces ---

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-[#ff5414]', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7 text-[#ff5414]" />
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb]/60 dark:bg-[#101117]/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dfcebe] dark:bg-zinc-800 text-[#ff5414]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-sans text-lg font-bold text-[#171a1f] dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[#574f47] dark:text-zinc-400">{description}</p>}
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
    slate: 'bg-[#dfcebe] dark:bg-zinc-800 text-[#574f47] dark:text-zinc-300',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    violet: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };
  return (
    <div className="rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#574f47] dark:text-zinc-400">{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', accents[accent] ?? accents.slate)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 font-sans font-black text-3xl font-mono text-[#171a1f] dark:text-white">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-[#675d54] dark:text-zinc-500">{sub}</div>}
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
    <div className={cn('rounded-2xl border border-[#cbbaa9] dark:border-zinc-800 bg-[#eedccb] dark:bg-[#101117] shadow-sm', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#cbbaa9]/80 dark:border-zinc-800/80 px-5 py-4">
          <div>
            {title && <h3 className="font-sans text-base font-bold text-[#171a1f] dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-[#574f47] dark:text-zinc-400">{subtitle}</p>}
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
    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
