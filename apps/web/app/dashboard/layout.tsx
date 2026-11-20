'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderKanban,
  GitBranch,
  Globe,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Network,
  Plug,
  Plus,
  Rocket,
  ScrollText,
  Search,
  Server,
  Settings,
  Users,
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { can, isAdmin, ROLE_LABEL, type Permission } from '../../lib/permissions';
import type { OrganizationSummary } from '../../lib/types';
import { Spinner, cn } from './_components/ui';
import { ConfirmProvider, ToastProvider } from './_components/kit';
import { CommandPalette, NotificationBell, ThemeToggle, useTheme } from './_components/shell';
import { ResolveXLogoMark } from '../../components/ResolveXLanding';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  adminOnly?: boolean;
  permission?: Permission;
};

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/insights', label: 'Insights', icon: Lightbulb },
    ],
  },
  {
    title: 'Work',
    items: [
      { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
      { href: '/dashboard/work', label: 'My work', icon: ClipboardList },
    ],
  },
  {
    title: 'Operate',
    items: [
      { href: '/dashboard/incidents', label: 'Incidents', icon: AlertTriangle },
      { href: '/dashboard/services', label: 'Services', icon: Server },
      { href: '/dashboard/monitors', label: 'Monitors', icon: Activity },
      { href: '/dashboard/dependency-map', label: 'Dependency map', icon: Network },
      { href: '/dashboard/deployments', label: 'Deployments', icon: Rocket },
      { href: '/dashboard/oncall', label: 'On-call', icon: CalendarClock },
      { href: '/dashboard/escalation', label: 'Escalation', icon: GitBranch },
      { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/dashboard/status-pages', label: 'Status pages', icon: Globe },
      { href: '/dashboard/postmortems', label: 'Postmortems', icon: FileText },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Organization',
    items: [
      { href: '/dashboard/team', label: 'People', icon: Users },
      { href: '/dashboard/teams', label: 'Teams', icon: UsersRound },
      { href: '/dashboard/integrations', label: 'Integrations', icon: Plug, permission: 'integrations:manage' },
      { href: '/dashboard/api-docs', label: 'API & docs', icon: BookOpen },
      { href: '/dashboard/audit', label: 'Audit log', icon: ScrollText, adminOnly: true },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, switchOrg } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('rx-sidebar') === 'collapsed');
    } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('rx-sidebar', c ? 'expanded' : 'collapsed');
      } catch {}
      return !c;
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      const here = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [isLoading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSwitcherOpen(false);
    setUserMenu(false);
  }, [pathname]);

  // Ctrl/Cmd+K opens the command palette; "/" too when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ organizations: OrganizationSummary[] }>('/api/organizations')
      .then((res) => !cancelled && setOrgs(res.organizations))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => (!i.adminOnly || isAdmin(user?.role)) && (!i.permission || can(user?.role, i.permission))) })).filter((g) => g.items.length > 0),
    [user?.role],
  );
  const pages = useMemo(() => visibleGroups.flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href }))), [visibleGroups]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f4ec]" role="status" aria-label="Loading">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-[#177a43]" />
          <span className="text-xs font-semibold text-[#5f6b64]">Opening ResolveX...</span>
        </div>
      </div>
    );
  }

  const displayName = user.name || user.username || user.email.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const currentOrg = orgs.find((o) => o.current);

  async function handleSwitch(organizationId: string) {
    setSwitching(organizationId);
    const res = await switchOrg(organizationId);
    if (res.ok) window.location.assign('/dashboard');
    else setSwitching(null);
  }

  async function createOrg() {
    const name = window.prompt('Name of the new organization');
    if (!name?.trim()) return;
    try {
      const res = await api.post<{ organization: { id: string } }>('/api/organizations', { name: name.trim() });
      await handleSwitch(res.organization.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not create the organization');
    }
  }

  const sidebar = (mini: boolean) => (
    <div className="flex h-full flex-col border-r border-[#dfdbcc] bg-white">
      <div className={cn('flex h-14 items-center border-b border-[#dfdbcc]', mini ? 'justify-center px-2' : 'justify-between px-4')}>
        <Link href="/dashboard" className="group flex items-center gap-2.5" title="ResolveX">
          <ResolveXLogoMark className="h-6 w-6 transition-transform duration-200 group-hover:scale-105" />
          {!mini && (
            <span className="font-display text-lg font-extrabold tracking-tight text-[#14201a]">
              Resolve<span className="text-[#177a43]">X</span>
            </span>
          )}
        </Link>
      </div>

      {/* Organization switcher */}
      <div className="relative px-2.5 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          title={currentOrg?.name ?? 'Workspace'}
          className={cn('flex w-full items-center gap-2.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-2.5 py-2 text-left text-[#14201a] transition hover:bg-[#eeebe0]', mini && 'justify-center px-0')}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#dcefd8] text-[#177a43]">
            <Building2 className="h-4 w-4" />
          </span>
          {!mini && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{currentOrg?.name ?? 'Workspace'}</span>
                <span className="block text-xs font-medium text-[#5f6b64]">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-[#5f6b64]" />
            </>
          )}
        </button>
        {switcherOpen && (
          <ul role="listbox" className="absolute left-2.5 top-full z-30 mt-1 max-h-72 w-60 overflow-auto rounded-xl border border-[#dfdbcc] bg-white p-1.5 text-[#14201a] shadow-xl">
            {orgs.map((o) => (
              <li key={o.id} role="option" aria-selected={o.current}>
                <button type="button" disabled={o.current || switching !== null} onClick={() => handleSwitch(o.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#f6f4ec] disabled:opacity-60">
                  <span className="truncate font-semibold">{o.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-[#5f6b64]">{switching === o.id ? 'Switching…' : o.current ? 'Current' : ROLE_LABEL[o.role]}</span>
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-[#dfdbcc] pt-1">
              <button type="button" onClick={createOrg} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#177a43] hover:bg-[#f6f4ec]">
                <Plus className="h-4 w-4" /> New organization
              </button>
            </li>
          </ul>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-2" aria-label="Main">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            {!mini && <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#5f6b64]">{group.title}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={mini ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-semibold transition',
                      mini && 'justify-center px-0 py-2',
                      active ? 'bg-[#dcefd8] text-[#177a43]' : 'text-[#3d4a42] hover:bg-[#f6f4ec] hover:text-[#14201a]',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#177a43]' : 'text-[#5f6b64]')} />
                    {!mini && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#dfdbcc] p-2.5">
        <button onClick={toggleCollapsed} className="hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#5f6b64] hover:bg-[#eeebe0] md:flex" aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'}>
          {mini ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen bg-[#f6f4ec] text-[#14201a]">
          <aside className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block', collapsed ? 'w-16' : 'w-60')}>{sidebar(collapsed)}</aside>

          {mobileOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div className="absolute inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
              <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">{sidebar(false)}</aside>
            </div>
          )}

          <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-16' : 'md:pl-60')}>
            {/* Top bar */}
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[#dfdbcc] bg-white/90 px-3 backdrop-blur sm:px-5">
              <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg p-2 text-[#3d4a42] hover:bg-[#eeebe0] md:hidden" aria-label="Toggle navigation" aria-expanded={mobileOpen}>
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <button onClick={() => setPaletteOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 text-sm text-[#5f6b64] transition hover:bg-[#eeebe0]" aria-label="Search (Ctrl+K)">
                <Search className="h-4 w-4" />
                <span className="flex-1 truncate text-left">Search or jump to…</span>
                <kbd className="hidden rounded border border-[#dfdbcc] px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
              </button>
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle pref={theme.pref} onChange={theme.set} />
                <NotificationBell />
                <div className="relative">
                  <button onClick={() => setUserMenu((v) => !v)} aria-label="Account menu" aria-expanded={userMenu} className="ml-1 flex items-center gap-2 rounded-xl p-1 hover:bg-[#eeebe0]">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#177a43] text-sm font-bold text-white">{initial}</span>
                    )}
                  </button>
                  {userMenu && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#dfdbcc] bg-white p-1.5 shadow-2xl">
                      <div className="border-b border-[#dfdbcc] px-3 py-2">
                        <p className="truncate text-sm font-bold text-[#14201a]">{displayName}</p>
                        <p className="truncate text-xs text-[#5f6b64]">{user.email}</p>
                      </div>
                      <Link href="/dashboard/settings" className="block rounded-lg px-3 py-2 text-sm text-[#3d4a42] hover:bg-[#f6f4ec]">Profile &amp; account</Link>
                      <Link href="/dashboard/notifications" className="block rounded-lg px-3 py-2 text-sm text-[#3d4a42] hover:bg-[#f6f4ec]">Notifications</Link>
                      <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#3d4a42] hover:bg-[#f6f4ec]"><ExternalLink className="h-3.5 w-3.5" /> Website</Link>
                      <button onClick={() => logout().then(() => router.replace('/login'))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#dc2626] hover:bg-[#fee2e2]">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} pages={pages} />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
