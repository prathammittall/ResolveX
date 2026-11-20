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

// --- Kizupi-Inspired Badges ---

const healthConfig: Record<
  ServiceHealthStatus,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  healthy: {
    label: 'Healthy',
    cls: 'bg-[#dcefd8] text-[#177a43] border border-[#b2e2a8]',
    Icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    cls: 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]',
    Icon: AlertTriangle,
  },
  down: {
    label: 'Down',
    cls: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]',
    Icon: AlertOctagon,
  },
  unknown: {
    label: 'Unknown',
    cls: 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]',
    Icon: HelpCircle,
  },
  pending: {
    label: 'Pending',
    cls: 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]',
    Icon: Loader2,
  },
  maintenance: {
    label: 'Maintenance',
    cls: 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]',
    Icon: HelpCircle,
  },
};

export function HealthBadge({ status }: { status: ServiceHealthStatus }) {
  const c = healthConfig[status];
  const Icon = c?.Icon ?? HelpCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        c?.cls ?? 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]'
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {c?.label ?? status}
    </span>
  );
}

const severityConfig: Record<IncidentSeverity, { label: string; cls: string }> = {
  sev1: { label: 'SEV1', cls: 'bg-[#fee2e2] text-[#991b1b] border border-[#f87171] font-bold' },
  sev2: { label: 'SEV2', cls: 'bg-[#ffedd5] text-[#9a3412] border border-[#fb923c] font-bold' },
  sev3: { label: 'SEV3', cls: 'bg-[#fef9c3] text-[#854d0e] border border-[#facc15] font-semibold' },
  sev4: { label: 'SEV4', cls: 'bg-[#e0f2fe] text-[#075985] border border-[#38bdf8] font-semibold' },
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const c = severityConfig[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] uppercase tracking-wide',
        c?.cls ?? 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]'
      )}
    >
      {c?.label ?? severity.toUpperCase()}
    </span>
  );
}

const statusConfig: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
  open: { label: 'Open', cls: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]', dot: 'bg-[#dc2626]' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]', dot: 'bg-[#0284c7]' },
  investigating: { label: 'Investigating', cls: 'bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe]', dot: 'bg-[#7c3aed]' },
  mitigated: { label: 'Mitigated', cls: 'bg-[#fef3c7] text-[#a16207] border border-[#fde68a]', dot: 'bg-[#d97706]' },
  resolved: { label: 'Resolved', cls: 'bg-[#dcefd8] text-[#15803d] border border-[#b2e2a8]', dot: 'bg-[#16a34a]' },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        c?.cls ?? 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c?.dot ?? 'bg-slate-400')} />
      {c?.label ?? status}
    </span>
  );
}

const alertStatusConfig: Record<AlertProcessingStatus, { label: string; cls: string }> = {
  processed: { label: 'Processed', cls: 'bg-[#dcefd8] text-[#15803d] border border-[#b2e2a8]' },
  pending: { label: 'Pending', cls: 'bg-[#fef3c7] text-[#a16207] border border-[#fde68a]' },
  failed: { label: 'Failed', cls: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]' },
  ignored: { label: 'Ignored', cls: 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]' },
};

export function AlertStatusBadge({ status }: { status: AlertProcessingStatus }) {
  const c = alertStatusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        c?.cls ?? 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]'
      )}
    >
      {c?.label ?? status}
    </span>
  );
}

// --- Layout pieces ---

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-[#177a43]', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8 text-[#177a43]" />
        <span className="text-xs font-semibold text-[#5f6b64]">Loading workspace...</span>
      </div>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dfdbcc] bg-[#fbfaf6] px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eeebe0] text-[#177a43]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3 font-display text-lg font-bold text-[#14201a]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[#5f6b64]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
    slate: 'bg-[#eeebe0] text-[#3d4a42]',
    emerald: 'bg-[#dcefd8] text-[#177a43]',
    rose: 'bg-[#fee2e2] text-[#dc2626]',
    amber: 'bg-[#fef3c7] text-[#d97706]',
    blue: 'bg-[#e0f2fe] text-[#0284c7]',
    violet: 'bg-[#ede9fe] text-[#7c3aed]',
  };
  return (
    <div className="rounded-2xl border border-[#dfdbcc] bg-white p-5 shadow-[0_2px_0_#dfdbcc] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_0_#dfdbcc]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5f6b64]">{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', accents[accent] ?? accents.slate)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold text-[#14201a] tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-[#5f6b64]">{sub}</div>}
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
    <div className={cn('rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#dfdbcc]/80 px-5 py-4">
          <div>
            {title && <h3 className="font-display text-base font-bold text-[#14201a]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-[#5f6b64]">{subtitle}</p>}
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
    <div className="flex items-start gap-2.5 rounded-xl border border-[#fca5a5] bg-[#fee2e2] px-4 py-3 text-sm font-medium text-[#991b1b]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" />
      <span>{message}</span>
    </div>
  );
}
