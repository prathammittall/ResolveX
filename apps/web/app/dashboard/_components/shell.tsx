'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, CheckCheck, FileText, FolderKanban, Laptop, Moon, Search, Server, Sun, Ticket, User, MessageSquare, CornerDownLeft, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { cn, timeAgo } from './ui';

// ============ Theme ============
export type ThemePref = 'light' | 'dark' | 'system';
function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>('light');
  useEffect(() => {
    let saved: ThemePref = 'light';
    try {
      const stored = localStorage.getItem('rx-theme');
      if (stored === 'dark') {
        saved = 'dark';
      } else {
        saved = 'light';
        localStorage.setItem('rx-theme', 'light');
      }
    } catch {}
    setPref(saved);
    applyTheme(saved);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let cur: ThemePref = 'light';
      try {
        cur = (localStorage.getItem('rx-theme') as ThemePref) || 'light';
      } catch {}
      if (cur === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      // Leaving the dashboard: marketing pages are light-only.
      delete document.documentElement.dataset.theme;
    };
  }, []);
  const set = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem('rx-theme', p);
    } catch {}
    applyTheme(p);
  };
  return { pref, set };
}

export function ThemeToggle({ pref, onChange }: { pref: ThemePref; onChange: (p: ThemePref) => void }) {
  const next: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'system', system: 'light' };
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Laptop;
  return (
    <button onClick={() => onChange(next[pref])} title={`Theme: ${pref} (click to change)`} aria-label={`Theme: ${pref}`} className="rounded-xl p-2 text-[#3d4a42] transition hover:bg-[#eeebe0]">
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}

// ============ Notifications dropdown ============
type NotificationRow = { id: number; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api.get<{ unreadCount: number }>('/api/notifications/unread-count').then((r) => setUnread(r.unreadCount)).catch(() => undefined);
  }, []);
  useEffect(() => {
    refreshCount();
    const t = setInterval(() => document.visibilityState === 'visible' && refreshCount(), 30_000);
    return () => clearInterval(t);
  }, [refreshCount]);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ notifications: NotificationRow[]; unreadCount: number }>('/api/notifications?limit=15')
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unreadCount);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function openItem(n: NotificationRow) {
    if (!n.readAt) {
      await api.patch(`/api/notifications/${n.id}`, { read: true }).catch(() => undefined);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }
  async function readAll() {
    await api.post('/api/notifications/read-all').catch(() => undefined);
    setItems((all) => all.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative rounded-xl p-2 text-[#3d4a42] transition hover:bg-[#eeebe0]">
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#dfdbcc] px-4 py-3">
            <span className="font-display text-sm font-bold text-[#14201a]">Notifications</span>
            <button onClick={readAll} disabled={unread === 0} className="flex items-center gap-1 text-xs font-semibold text-[#177a43] hover:underline disabled:opacity-40">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 && <li className="px-4 py-6 text-center text-xs text-[#5f6b64]">Loading…</li>}
            {!loading && items.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#5f6b64]">You&apos;re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={cn('flex w-full gap-3 border-b border-[#dfdbcc] px-4 py-3 text-left transition hover:bg-[#fbfaf6]', !n.readAt && 'bg-[#dcefd8]/30')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-[#177a43]')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#14201a]">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-[#5f6b64]">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-[#5f6b64]">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="block border-t border-[#dfdbcc] px-4 py-2.5 text-center text-xs font-semibold text-[#177a43] hover:bg-[#fbfaf6]">
            View all notifications &amp; preferences
          </Link>
        </div>
      )}
    </div>
  );
}

// ============ Command palette (Ctrl/Cmd+K) ============
type SearchResult = { type: string; id: string; title: string; subtitle?: string; href: string };
const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = { task: Ticket, project: FolderKanban, service: Server, incident: AlertTriangle, person: User, comment: MessageSquare, doc: FileText, page: CornerDownLeft };

export function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: Array<{ label: string; href: string }> }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    try {
      setRecent(JSON.parse(localStorage.getItem('rx-recent-searches') || '[]'));
    } catch {
      setRecent([]);
    }
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const pageHits: SearchResult[] = pages.filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase())).slice(0, term ? 5 : 8).map((p) => ({ type: 'page', id: p.href, title: `Go to ${p.label}`, href: p.href }));
    if (term.length < 2) {
      setResults(pageHits);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const types = filter === 'all' ? '' : `&types=${filter}`;
      fetch(`/api/search?q=${encodeURIComponent(term)}${types}`, { credentials: 'same-origin', signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => {
          setResults([...(d.results ?? []), ...pageHits]);
          setActive(0);
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open, pages, filter]);

  function go(r: SearchResult) {
    const term = q.trim();
    if (term.length >= 2) {
      const next = [term, ...recent.filter((x) => x !== term)].slice(0, 6);
      try {
        localStorage.setItem('rx-recent-searches', JSON.stringify(next));
      } catch {}
    }
    onClose();
    if (/^https?:\/\//.test(r.href)) window.open(r.href, '_blank', 'noopener,noreferrer');
    else router.push(r.href);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-[#14201a]/40 p-4 pt-[12vh] backdrop-blur-xs" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#dfdbcc] px-4">
          <Search className="h-4 w-4 text-[#5f6b64]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && results[active]) go(results[active]!);
            }}
            placeholder="Search tickets, incidents, services, people… or type PAY-12"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-sm text-[#14201a] outline-none"
          />
          <kbd className="rounded border border-[#dfdbcc] px-1.5 text-[10px] text-[#5f6b64]">Esc</kbd>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[#dfdbcc] px-3 py-2">
          {['all', 'tasks', 'incidents', 'services', 'projects', 'people', 'comments', 'docs'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-2 py-1 text-xs font-semibold capitalize', filter === f ? 'bg-[#dcefd8] text-[#177a43]' : 'text-[#5f6b64] hover:bg-[#eeebe0]')}>{f}</button>
          ))}
        </div>
        {q.trim().length < 2 && recent.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 pt-3">
            {recent.map((r) => (
              <button key={r} onClick={() => setQ(r)} className="flex items-center gap-1 rounded-lg bg-[#eeebe0] px-2 py-1 text-xs text-[#3d4a42]"><Clock className="h-3 w-3" />{r}</button>
            ))}
          </div>
        )}
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-[#5f6b64]">{q.trim().length < 2 ? 'Type to search' : 'No matches'}</li>}
          {results.map((r, i) => {
            const Icon = TYPE_ICON[r.type] ?? FileText;
            return (
              <li key={`${r.type}-${r.id}-${i}`} role="option" aria-selected={i === active}>
                <button onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left', i === active ? 'bg-[#dcefd8]' : '')}>
                  <Icon className="h-4 w-4 shrink-0 text-[#5f6b64]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#14201a]">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-[#5f6b64]">{r.subtitle}</span>}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#5f6b64]">{r.type}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
