'use client';

/**
 * Customer-facing status page renderer. Used by the public page (/status/[slug]) and by the dashboard
 * preview. Colors are applied with inline styles so the page always renders in the light theme, even
 * when the dashboard's dark theme remaps the palette classes.
 */
import React from 'react';
import { AlertOctagon, AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, HelpCircle, Wrench } from 'lucide-react';
import { UptimeBars } from '../dashboard/_components/kit';

export type PublicStatusService = {
  key: string;
  name: string;
  status: 'operational' | 'degraded_performance' | 'major_outage' | 'under_maintenance' | 'unknown' | string;
  uptime90d: number | null;
  daily: Array<{ date: string; uptime: number | null }>;
};
export type PublicStatusIncident = { title: string; status: string; severity: string; service: string; startedAt: string; resolvedAt: string | null };
export type PublicStatusPage = {
  name: string;
  slug: string;
  description: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  supportUrl: string | null;
  overallStatus: string;
  services: PublicStatusService[];
  activeIncidents: PublicStatusIncident[];
  incidentHistory: PublicStatusIncident[];
  scheduledMaintenance: Array<{ name: string; description: string | null; startsAt: string; endsAt: string; recurrence: string | null }>;
  generatedAt: string;
};

const C = {
  ink: '#14201a',
  ink2: '#3d4a42',
  muted: '#5f6b64',
  rule: '#dfdbcc',
  paper: '#f6f4ec',
  paper2: '#fbfaf6',
  card: '#ffffff',
  pine: '#177a43',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  operational: { label: 'Operational', color: '#177a43', bg: '#dcefd8', border: '#b2e2a8', Icon: CheckCircle2 },
  degraded_performance: { label: 'Degraded performance', color: '#92400e', bg: '#fef3c7', border: '#fde68a', Icon: AlertTriangle },
  major_outage: { label: 'Major outage', color: '#991b1b', bg: '#fee2e2', border: '#fecaca', Icon: AlertOctagon },
  under_maintenance: { label: 'Under maintenance', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd', Icon: Wrench },
  unknown: { label: 'No data', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', Icon: HelpCircle },
};
const meta = (s: string) => STATUS_META[s] ?? STATUS_META.unknown!;

const BANNER: Record<string, string> = {
  operational: 'All systems operational',
  degraded_performance: 'Some systems are experiencing degraded performance',
  major_outage: 'We are experiencing a major outage',
  under_maintenance: 'Scheduled maintenance in progress',
};

const INCIDENT_STATUS: Record<string, string> = {
  open: 'Investigating',
  acknowledged: 'Identified',
  investigating: 'Investigating',
  mitigated: 'Monitoring',
  resolved: 'Resolved',
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** Fill the last 90 days so days without checks render as gray "no data" bars. */
function ninetyDays(daily: PublicStatusService['daily']) {
  const byDate = new Map(daily.map((d) => [d.date, d.uptime]));
  const out: Array<{ date: string; uptime: number | null }> = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, uptime: byDate.has(key) ? byDate.get(key)! : null });
  }
  return out;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border" style={{ background: C.card, borderColor: C.rule }}>
      <h2 className="border-b px-5 py-3.5 text-sm font-bold" style={{ borderColor: C.rule, color: C.ink }}>
        {title}
      </h2>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function IncidentList({ items, empty }: { items: PublicStatusIncident[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: C.muted }}>{empty}</p>;
  return (
    <ul className="divide-y" style={{ borderColor: C.rule }}>
      {items.map((i, idx) => (
        <li key={`${i.title}-${i.startedAt}-${idx}`} className="py-3 first:pt-0 last:pb-0" style={{ borderColor: C.rule }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: C.ink }}>{i.title}</span>
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={i.status === 'resolved' ? { background: '#dcefd8', color: '#177a43', borderColor: '#b2e2a8' } : { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}
            >
              {INCIDENT_STATUS[i.status] ?? i.status}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>
            {i.service} · {i.severity.toUpperCase()} · started {fmt(i.startedAt)}
            {i.resolvedAt ? ` · resolved ${fmt(i.resolvedAt)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function StatusView({ page }: { page: PublicStatusPage }) {
  const accent = page.brandColor && /^#[0-9a-fA-F]{6}$/.test(page.brandColor) ? page.brandColor : C.pine;
  const overall = meta(page.overallStatus);
  const OverallIcon = overall.Icon;
  const now = Date.now();
  const maintenance = [...page.scheduledMaintenance].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="min-h-full w-full" style={{ background: C.paper, color: C.ink, colorScheme: 'light' }}>
      <div className="h-1.5 w-full" style={{ background: accent }} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {page.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.logoUrl} alt={`${page.name} logo`} className="h-10 w-10 shrink-0 rounded-xl object-contain" style={{ background: C.card, border: `1px solid ${C.rule}` }} referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ background: accent }} aria-hidden="true">
                {page.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl font-extrabold tracking-tight" style={{ color: C.ink }}>{page.name}</h1>
              {page.description && <p className="text-sm" style={{ color: C.muted }}>{page.description}</p>}
            </div>
          </div>
          {page.supportUrl && (
            <a href={page.supportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: C.rule, background: C.card, color: C.ink }}>
              Get support <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </header>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border px-5 py-4" role="status" style={{ background: overall.bg, borderColor: overall.border, color: overall.color }}>
          <OverallIcon className="h-6 w-6 shrink-0" />
          <p className="text-base font-bold">{BANNER[page.overallStatus] ?? overall.label}</p>
        </div>

        <div className="mt-6 space-y-6">
          {page.activeIncidents.length > 0 && (
            <Card title="Active incidents">
              <IncidentList items={page.activeIncidents} empty="" />
            </Card>
          )}

          {maintenance.length > 0 && (
            <Card title="Scheduled maintenance">
              <ul className="space-y-3">
                {maintenance.map((m, idx) => {
                  const active = Date.parse(m.startsAt) <= now && Date.parse(m.endsAt) >= now;
                  return (
                    <li key={`${m.name}-${idx}`} className="flex gap-3">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#0369a1' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: C.ink }}>
                          {m.name}
                          {active && <span className="ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>In progress</span>}
                        </p>
                        <p className="text-xs" style={{ color: C.muted }}>
                          {fmt(m.startsAt)} – {fmt(m.endsAt)}
                          {m.recurrence && m.recurrence !== 'none' ? ` · repeats ${m.recurrence}` : ''}
                        </p>
                        {m.description && <p className="mt-1 text-sm" style={{ color: C.ink2 }}>{m.description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title="Services">
            {page.services.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>No services are listed on this status page yet.</p>
            ) : (
              <ul className="space-y-5">
                {page.services.map((s) => {
                  const m = meta(s.status);
                  return (
                    <li key={s.key}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold" style={{ color: C.ink }}>{s.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: m.color }}>
                          <m.Icon className="h-3.5 w-3.5" /> {m.label}
                        </span>
                      </div>
                      <UptimeBars days={ninetyDays(s.daily)} />
                      <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.muted }}>
                        <span>90 days ago</span>
                        <span>{s.uptime90d === null ? 'No checks recorded' : `${s.uptime90d.toFixed(2)}% uptime`}</span>
                        <span>Today</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {page.incidentHistory.length > 0 && (
            <Card title="Past incidents (last 90 days)">
              <IncidentList items={page.incidentHistory} empty="No incidents in the last 90 days." />
            </Card>
          )}
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: C.muted }}>
          <span>Last updated {fmt(page.generatedAt)}</span>
          <span>
            Powered by <span className="font-semibold" style={{ color: C.ink }}>ResolveX</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
