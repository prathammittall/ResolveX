'use client';

/**
 * Shared dashboard kit: toasts, confirm dialogs, modal, form controls, tabs, skeletons, SVG charts,
 * safe markdown, and data hooks. Every page uses these so the product looks and behaves consistently.
 * Colors use the dashboard palette, which globals.css remaps for dark mode.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { cn } from './ui';

// ============ Toasts ============
type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string };
const ToastCtx = createContext<(kind: Toast['kind'], message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
          return (
            <div key={t.id} role="status" className="rx-toast pointer-events-auto flex items-start gap-3 rounded-xl border border-[#dfdbcc] bg-white px-4 py-3 text-sm shadow-xl">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.kind === 'success' ? 'text-[#177a43]' : t.kind === 'error' ? 'text-[#dc2626]' : 'text-[#0284c7]')} />
              <span className="flex-1 text-[#14201a]">{t.message}</span>
              <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-[#5f6b64] hover:text-[#14201a]">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastCtx);
  return useMemo(
    () => ({
      success: (m: string) => push('success', m),
      error: (e: unknown) => push('error', e instanceof ApiError || e instanceof Error ? e.message : String(e)),
      info: (m: string) => push('info', m),
    }),
    [push],
  );
}

// ============ Modal & confirm ============
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the focus effect (callers often pass inline handlers).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#14201a]/40 p-4 pt-[8vh] backdrop-blur-xs" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cn('w-full rounded-2xl border border-[#dfdbcc] bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-[#dfdbcc] px-5 py-4">
          <h2 className="font-display text-lg font-bold text-[#14201a]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-[#5f6b64] hover:bg-[#eeebe0]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[#dfdbcc] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

type ConfirmOpts = { title: string; message: string; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmLabel ?? 'Confirm'}</Button>
          </>
        }
      >
        <div className="flex gap-3">
          {state?.danger && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#dc2626]" />}
          <p className="text-sm text-[#3d4a42]">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ============ Controls ============
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean };
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-[#177a43] text-white hover:bg-[#0f5e32] border border-[#177a43]',
    secondary: 'bg-white text-[#14201a] border border-[#dfdbcc] hover:bg-[#eeebe0]',
    ghost: 'text-[#3d4a42] hover:bg-[#eeebe0] border border-transparent',
    danger: 'bg-[#dc2626] text-white hover:bg-[#b91c1c] border border-[#dc2626]',
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm', styles, className)}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5f6b64]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[#5f6b64]">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-[#dc2626]">{error}</span>}
    </label>
  );
}
const controlCls = 'w-full rounded-xl border border-[#dfdbcc] bg-white px-3 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cn(controlCls, className)} />;
});
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(controlCls, 'cursor-pointer', className)} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(controlCls, 'min-h-[90px]', className)} />;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[#dfdbcc]">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition', value === t.id ? 'border-[#177a43] text-[#177a43]' : 'border-transparent text-[#5f6b64] hover:text-[#14201a]')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-[#eeebe0] px-1.5 py-0.5 text-[10px]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold text-[#5f6b64]">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#14201a] sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#5f6b64]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rx-skeleton h-4', className)} aria-hidden="true" />;
}
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet' }) {
  const tones = {
    slate: 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]',
    green: 'bg-[#dcefd8] text-[#177a43] border-[#b2e2a8]',
    red: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
    amber: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    blue: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
    violet: 'bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}

// ============ Data hooks ============
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

export type Member = { userId: number; name: string; email: string; role: string; avatarUrl?: string | null };
let membersCache: Promise<Member[]> | null = null;
/** Organization members (cached per page load) for assignee/owner pickers. */
export function useMembers(): Member[] {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    membersCache ??= api
      .get<{ members: Array<{ userId: number; name?: string | null; email: string; role: string; avatarUrl?: string | null }> }>('/api/org/members')
      .then((r) => r.members.map((m) => ({ userId: m.userId, name: m.name || m.email.split('@')[0] || m.email, email: m.email, role: m.role, avatarUrl: m.avatarUrl })))
      .catch(() => {
        membersCache = null;
        return [];
      });
    membersCache.then(setMembers);
  }, []);
  return members;
}

export function MemberSelect({ value, onChange, allowNone = true, noneLabel = 'Unassigned', className }: { value: number | null; onChange: (v: number | null) => void; allowNone?: boolean; noneLabel?: string; className?: string }) {
  const members = useMembers();
  return (
    <Select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {allowNone && <option value="">{noneLabel}</option>}
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name}
        </option>
      ))}
    </Select>
  );
}

// ============ Formatting ============
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}
export const pct = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : `${v.toFixed(digits)}%`);

// ============ Charts (dependency-free SVG) ============
export type Series = { label: string; color: string; values: Array<number | null> };

/** Line/area chart with hover readout. `labels` align with each series' values. */
export function LineChart({ labels, series, height = 180, area = false, unit = '', markers = [] }: { labels: string[]; series: Series[]; height?: number; area?: boolean; unit?: string; markers?: Array<{ index: number; label: string }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (labels.length === 0 || all.length === 0) return <div className="flex items-center justify-center text-xs text-[#5f6b64]" style={{ height }}>No data recorded for this period yet</div>;
  const max = Math.max(...all, 1);
  const min = Math.min(0, ...all);
  const x = (i: number) => pad.l + (labels.length === 1 ? 0 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (labels.length - 1));
          setHover(Math.max(0, Math.min(labels.length - 1, i)));
        }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-[#dfdbcc]" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-current text-[#5f6b64]">{Math.round(t)}</text>
          </g>
        ))}
        {markers.map((m, i) => (
          <line key={i} x1={x(m.index)} x2={x(m.index)} y1={pad.t} y2={H - pad.b} stroke="#7c3aed" strokeDasharray="2 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke"><title>{m.label}</title></line>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const segs: string[] = [];
          let cur = '';
          pts.forEach((p) => {
            if (!p) {
              if (cur) segs.push(cur);
              cur = '';
              return;
            }
            cur += `${cur ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
          });
          if (cur) segs.push(cur);
          return (
            <g key={s.label}>
              {area && segs.map((d, i) => <path key={i} d={`${d}L${d.split('L').pop()!.replace(/^M/, '').split(',')[0]},${H - pad.b}L${d.slice(1).split(',')[0]},${H - pad.b}Z`} fill={s.color} opacity={0.12} />)}
              {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-[#5f6b64]" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        <text x={pad.l} y={H - 6} fontSize="10" className="fill-current text-[#5f6b64]">{labels[0]}</text>
        <text x={W - pad.r} y={H - 6} fontSize="10" textAnchor="end" className="fill-current text-[#5f6b64]">{labels[labels.length - 1]}</text>
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-[#dfdbcc] bg-white px-2.5 py-1.5 text-xs shadow-xl" style={{ left: `min(calc(${(x(hover) / W) * 100}% + 8px), calc(100% - 160px))` }}>
          <div className="font-semibold text-[#14201a]">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[#3d4a42]">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}: {s.values[hover] === null ? '—' : `${s.values[hover]}${unit}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 160, color = '#177a43', unit = '' }: { data: Array<{ label: string; value: number; color?: string }>; height?: number; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <div className="text-xs text-[#5f6b64]">No data</div>;
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.value}${unit}`}>
          <div className="w-full rounded-t-md transition-opacity group-hover:opacity-80" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: d.color ?? color }} />
        </div>
      ))}
    </div>
  );
}

export function HBarList({ items, unit = '' }: { items: Array<{ label: string; value: number; color?: string; href?: string }>; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <div className="text-xs text-[#5f6b64]">Nothing to show yet</div>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="flex justify-between gap-2"><span className="truncate text-[#14201a]">{it.href ? <a className="hover:underline" href={it.href}>{it.label}</a> : it.label}</span><span className="font-semibold text-[#3d4a42]">{it.value}{unit}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-[#eeebe0]"><div className="h-1.5 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? '#177a43' }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ items, size = 140 }: { items: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Distribution">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-[#eeebe0]" strokeWidth="18" />
        {total > 0 && items.map((it) => {
          const len = (it.value / total) * c;
          const el = <circle key={it.label} cx="70" cy="70" r={r} fill="none" stroke={it.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)"><title>{`${it.label}: ${it.value}`}</title></circle>;
          offset += len;
          return el;
        })}
        <text x="70" y="76" textAnchor="middle" fontSize="22" fontWeight="800" className="fill-current text-[#14201a]">{total}</text>
      </svg>
      <ul className="space-y-1 text-xs">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-[#3d4a42]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />{it.label}<span className="font-semibold text-[#14201a]">{it.value}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** 90-day style uptime bars (one per bucket). */
export function UptimeBars({ days }: { days: Array<{ date: string; uptime: number | null }> }) {
  return (
    <div className="flex h-8 items-stretch gap-[2px]">
      {days.map((d) => (
        <div key={d.date} title={`${d.date}: ${d.uptime === null ? 'no data' : `${d.uptime}%`}`} className="flex-1 rounded-sm" style={{ background: d.uptime === null ? 'var(--paper-3)' : d.uptime >= 99.5 ? '#22a35a' : d.uptime >= 95 ? '#e3a008' : '#dc2626' }} />
      ))}
    </div>
  );
}

// ============ Markdown (escape first, then a small safe subset) ============
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function inline(s: string) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>')
    .replace(/(^|\s)@([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g, '$1<span class="mention">@$2</span>');
}
export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src).split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let code = false;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      close();
      out.push(code ? '</code></pre>' : '<pre><code>');
      code = !code;
      continue;
    }
    if (code) {
      out.push(line + '\n');
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (h) {
      close();
      out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`);
    } else if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`);
    } else if (/^&gt;\s?/.test(line)) {
      close();
      out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/, ''))}</blockquote>`);
    } else if (line.trim() === '') {
      close();
    } else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  if (code) out.push('</code></pre>');
  return out.join('');
}
export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!source) return <p className="text-sm italic text-[#5f6b64]">Nothing here yet.</p>;
  return <div className={cn('rx-prose text-sm text-[#14201a]', className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
