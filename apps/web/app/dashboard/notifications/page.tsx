'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Mail, MailCheck, MailWarning, MailX, RefreshCw, RotateCcw, Trash2, Circle, CircleDot } from 'lucide-react';
import { api, apiFetch } from '../../../lib/api';
import { EmptyState, ErrorBanner, SectionCard, cn, formatDateTime, timeAgo } from '../_components/ui';
import { Button, Field, PageHeader, Pill, Select, SkeletonRows, Tabs, useApi, useConfirm, useToast } from '../_components/kit';

type EmailStatus = 'skipped' | 'pending' | 'sent' | 'failed';
type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  emailStatus: EmailStatus | null;
  emailError: string | null;
  createdAt: string;
};
type ListResponse = { notifications: NotificationRow[]; unreadCount: number };
type ChannelPrefs = { inApp: boolean; email: boolean };
type PrefsResponse = { types: string[]; settings: Record<string, ChannelPrefs> };

const PAGE_SIZE = 30;

const TYPE_LABELS: Record<string, { label: string; help: string }> = {
  'incident.created': { label: 'New incident', help: 'An incident is opened on a service you are involved with' },
  'incident.assigned': { label: 'Incident assigned to me', help: 'You become the responder for an incident' },
  'incident.escalated': { label: 'Incident escalated', help: 'An unacknowledged incident escalates to you' },
  'incident.resolved': { label: 'Incident resolved', help: 'An incident you follow is resolved' },
  'incident.comment': { label: 'Incident comment', help: 'Someone comments on an incident timeline' },
  'service.down': { label: 'Service down', help: 'A service you own starts failing checks' },
  'service.recovered': { label: 'Service recovered', help: 'A service you own is healthy again' },
  'task.assigned': { label: 'Task assigned to me', help: 'A task or ticket is assigned to you' },
  'task.comment': { label: 'Task comment', help: 'New comments on tasks you follow' },
  'task.mentioned': { label: 'Mentioned in a task', help: 'Someone @mentions you' },
  'task.status': { label: 'Task status changed', help: 'A task you follow moves to another status' },
  'org.invitation': { label: 'Organization invitation', help: 'Invitations and membership changes' },
  'maintenance.scheduled': { label: 'Maintenance scheduled', help: 'Planned maintenance windows' },
  'postmortem.action_item': { label: 'Postmortem action item', help: 'Action items assigned to you from postmortems' },
  'oncall.shift': { label: 'On-call shift', help: 'Your on-call shift starts or changes' },
};

function typeLabel(t: string) {
  return TYPE_LABELS[t]?.label ?? t.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function EmailBadge({ status, error }: { status: EmailStatus | null; error: string | null }) {
  if (!status || status === 'skipped')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#5f6b64]" title="No email was sent for this notification">
        <Mail className="h-3 w-3" /> In-app only
      </span>
    );
  if (status === 'sent')
    return (
      <Pill tone="green">
        <MailCheck className="h-3 w-3" /> Email sent
      </Pill>
    );
  if (status === 'pending')
    return (
      <Pill tone="blue">
        <MailWarning className="h-3 w-3" /> Email pending
      </Pill>
    );
  return (
    <span title={error ?? 'Delivery failed'}>
      <Pill tone="red">
        <MailX className="h-3 w-3" /> Email failed
      </Pill>
    </span>
  );
}

// ================= Inbox =================
function Inbox({ types, onUnreadChange }: { types: string[]; onUnreadChange: (n: number) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState('');
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [markingAll, setMarkingAll] = useState(false);

  const buildPath = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (unreadOnly) p.set('unread', 'true');
      if (type) p.set('type', type);
      return `/api/notifications?${p.toString()}`;
    },
    [unreadOnly, type],
  );

  const setUnread = useCallback(
    (n: number) => {
      setUnreadCount(n);
      onUnreadChange(n);
    },
    [onUnreadChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<ListResponse>(buildPath(0));
      setRows(r.notifications);
      setHasMore(r.notifications.length === PAGE_SIZE);
      setUnread(r.unreadCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [buildPath, setUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await api.get<ListResponse>(buildPath(rows.length));
      setRows((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...r.notifications.filter((x) => !seen.has(x.id))];
      });
      setHasMore(r.notifications.length === PAGE_SIZE);
      setUnread(r.unreadCount);
    } catch (e) {
      toast.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const withBusy = async (id: number, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await fn();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
    }
  };

  const setRead = (n: NotificationRow, read: boolean, quiet = false) =>
    withBusy(n.id, async () => {
      const r = await api.patch<{ notification: NotificationRow }>(`/api/notifications/${n.id}`, { read });
      const wasUnread = !n.readAt;
      if (unreadOnly && read) setRows((all) => all.filter((x) => x.id !== n.id));
      else setRows((all) => all.map((x) => (x.id === n.id ? { ...x, readAt: r.notification?.readAt ?? (read ? new Date().toISOString() : null) } : x)));
      if (wasUnread && read) setUnread(Math.max(0, unreadCount - 1));
      if (!wasUnread && !read) setUnread(unreadCount + 1);
      if (!quiet) toast.success(read ? 'Marked as read' : 'Marked as unread');
    });

  const remove = async (n: NotificationRow) => {
    const ok = await confirm({ title: 'Delete notification', message: `Delete "${n.title}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await withBusy(n.id, async () => {
      await api.del(`/api/notifications/${n.id}`);
      setRows((all) => all.filter((x) => x.id !== n.id));
      if (!n.readAt) setUnread(Math.max(0, unreadCount - 1));
      toast.success('Notification deleted');
    });
  };

  const retryEmail = (n: NotificationRow) =>
    withBusy(n.id, async () => {
      await api.post(`/api/notifications/${n.id}/retry-email`);
      setRows((all) => all.map((x) => (x.id === n.id ? { ...x, emailStatus: 'pending', emailError: null } : x)));
      toast.success('Email queued for redelivery');
    });

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/api/notifications/read-all');
      toast.success('All notifications marked as read');
      await load();
    } catch (e) {
      toast.error(e);
    } finally {
      setMarkingAll(false);
    }
  };

  const typeOptions = types.length ? types : Object.keys(TYPE_LABELS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Show" className="w-40">
            <Select value={unreadOnly ? 'unread' : 'all'} onChange={(e) => setUnreadOnly(e.target.value === 'unread')}>
              <option value="all">All</option>
              <option value="unread">Unread only</option>
            </Select>
          </Field>
          <Field label="Type" className="w-56">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#5f6b64]">{unreadCount} unread</span>
          <Button variant="secondary" size="sm" onClick={() => void load()} aria-label="Refresh notifications" disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={markAllRead} loading={markingAll} disabled={unreadCount === 0}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 && !error ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly || type ? 'No matching notifications' : "You're all caught up"}
          description={unreadOnly || type ? 'Try clearing the filters.' : 'Notifications about incidents, services and tasks will appear here.'}
          action={
            unreadOnly || type ? (
              <Button variant="secondary" size="sm" onClick={() => { setUnreadOnly(false); setType(''); }}>Clear filters</Button>
            ) : undefined
          }
        />
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <ul className="divide-y divide-[#dfdbcc]">
            {rows.map((n) => {
              const unread = !n.readAt;
              const isBusy = Boolean(busy[n.id]);
              const title = <span className={cn('text-sm text-[#14201a]', unread ? 'font-bold' : 'font-medium')}>{n.title}</span>;
              return (
                <li key={n.id} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between', unread && 'bg-[#fbfaf6]')}>
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-1 shrink-0" aria-hidden="true">
                      {unread ? <CircleDot className="h-3.5 w-3.5 text-[#177a43]" /> : <Circle className="h-3.5 w-3.5 text-[#dfdbcc]" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {n.link && n.link.startsWith('/') ? (
                          <Link href={n.link} className="hover:underline" onClick={() => unread && void setRead(n, true, true)}>
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                        <Pill tone="slate">{typeLabel(n.type)}</Pill>
                      </div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-[#3d4a42]">{n.body}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs text-[#5f6b64]" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                        <EmailBadge status={n.emailStatus} error={n.emailError} />
                      </div>
                      {n.emailStatus === 'failed' && n.emailError && <p className="mt-1 break-words text-xs text-[#991b1b]">Email error: {n.emailError}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-6 sm:pl-0">
                    {n.emailStatus === 'failed' && (
                      <Button variant="secondary" size="sm" onClick={() => void retryEmail(n)} disabled={isBusy}>
                        <RotateCcw className="h-3.5 w-3.5" /> Retry email
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => void setRead(n, unread)} disabled={isBusy}>
                      {unread ? 'Mark read' : 'Mark unread'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void remove(n)} disabled={isBusy} aria-label={`Delete notification ${n.title}`}>
                      <Trash2 className="h-3.5 w-3.5 text-[#dc2626]" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="border-t border-[#dfdbcc] p-3 text-center">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ================= Preferences =================
type PrefsState = { data: PrefsResponse | null; error: string | null; loading: boolean; reload: () => void };

function Preferences({ prefs }: { prefs: PrefsState }) {
  const toast = useToast();
  const { data, error, loading, reload } = prefs;
  const [draft, setDraft] = useState<Record<string, ChannelPrefs>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data.settings);
  }, [data]);

  const types = data?.types ?? [];
  const dirty = useMemo(() => Boolean(data) && types.some((t) => draft[t]?.inApp !== data!.settings[t]?.inApp || draft[t]?.email !== data!.settings[t]?.email), [data, draft, types]);

  const toggle = (t: string, ch: keyof ChannelPrefs) =>
    setDraft((d) => ({ ...d, [t]: { inApp: d[t]?.inApp ?? true, email: d[t]?.email ?? false, [ch]: !(d[t]?.[ch] ?? false) } }));

  const setColumn = (ch: keyof ChannelPrefs, value: boolean) =>
    setDraft((d) => Object.fromEntries(types.map((t) => [t, { inApp: d[t]?.inApp ?? true, email: d[t]?.email ?? false, [ch]: value }])));

  const save = async () => {
    setSaving(true);
    try {
      const settings = Object.fromEntries(types.map((t) => [t, { inApp: Boolean(draft[t]?.inApp), email: Boolean(draft[t]?.email) }]));
      await apiFetch('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ settings }) });
      toast.success('Notification preferences saved');
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <SkeletonRows rows={8} />;
  if (error && !data)
    return (
      <div className="space-y-2">
        <ErrorBanner message={error} />
        <Button size="sm" variant="secondary" onClick={reload}>Try again</Button>
      </div>
    );
  if (!data || types.length === 0) return <EmptyState icon={Bell} title="No notification types" description="There are no configurable notification types." />;

  const allOn = (ch: keyof ChannelPrefs) => types.every((t) => draft[t]?.[ch]);

  return (
    <SectionCard
      title="Delivery preferences"
      subtitle="Choose how you hear about each kind of event. Email requires SMTP to be configured by an admin."
      action={
        <div className="flex items-center gap-2">
          {dirty && <span className="hidden text-xs font-semibold text-[#92400e] sm:inline">Unsaved changes</span>}
          <Button variant="ghost" size="sm" onClick={() => setDraft(data.settings)} disabled={!dirty || saving}>Reset</Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>Save preferences</Button>
        </div>
      }
    >
      <div className="-mx-5 -my-5 overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-left text-xs uppercase tracking-wide text-[#5f6b64]">
              <th className="px-5 py-2.5 font-semibold">Event</th>
              {(['inApp', 'email'] as const).map((ch) => (
                <th key={ch} className="w-28 px-3 py-2.5 text-center font-semibold">
                  <div>{ch === 'inApp' ? 'In-app' : 'Email'}</div>
                  <button
                    type="button"
                    onClick={() => setColumn(ch, !allOn(ch))}
                    className="mt-0.5 text-[10px] font-semibold normal-case text-[#177a43] hover:underline"
                  >
                    {allOn(ch) ? 'Turn all off' : 'Turn all on'}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dfdbcc]">
            {types.map((t) => (
              <tr key={t} className="hover:bg-[#fbfaf6]">
                <td className="px-5 py-3">
                  <div className="font-semibold text-[#14201a]">{typeLabel(t)}</div>
                  {TYPE_LABELS[t]?.help && <div className="text-xs text-[#5f6b64]">{TYPE_LABELS[t]!.help}</div>}
                </td>
                {(['inApp', 'email'] as const).map((ch) => (
                  <td key={ch} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[#177a43]"
                      checked={Boolean(draft[t]?.[ch])}
                      onChange={() => toggle(t, ch)}
                      aria-label={`${typeLabel(t)}: ${ch === 'inApp' ? 'in-app' : 'email'}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'inbox' | 'preferences'>('inbox');
  const [unread, setUnread] = useState<number | undefined>(undefined);
  const prefs = useApi<PrefsResponse>('/api/notifications/preferences');
  const onUnreadChange = useCallback((n: number) => setUnread(n), []);

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description="Your notification history, email delivery status and delivery preferences." />
      <Tabs
        tabs={[
          { id: 'inbox', label: 'Inbox', count: unread },
          { id: 'preferences', label: 'Preferences' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'inbox' ? <Inbox types={prefs.data?.types ?? []} onUnreadChange={onUnreadChange} /> : <Preferences prefs={prefs} />}
    </div>
  );
}
