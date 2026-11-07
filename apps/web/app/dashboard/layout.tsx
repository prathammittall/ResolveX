'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Building2,
  ChevronsUpDown,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Server,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { isAdmin, ROLE_LABEL } from '../../lib/permissions';
import type { OrganizationSummary } from '../../lib/types';
import { Spinner, cn } from './_components/ui';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  adminOnly?: boolean;
};

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
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
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/incidents', label: 'Incidents', icon: AlertTriangle },
      { href: '/dashboard/services', label: 'Services', icon: Server },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Organization',
    items: [
      { href: '/dashboard/team', label: 'Team', icon: Users },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      // Keep where the user was heading so login can bring them back (e.g. an invitation link).
      const here = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [isLoading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSwitcherOpen(false);
  }, [pathname]);

  // Load the organizations the user belongs to (for the switcher and the current org name).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ organizations: OrganizationSummary[] }>('/api/organizations')
      .then((res) => {
        if (!cancelled) setOrgs(res.organizations);
      })
      .catch(() => {
        // The switcher is optional; the rest of the dashboard still works.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafaf9]" role="status" aria-label="Loading">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const displayName = user.name || user.username || user.email.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const currentOrg = orgs.find((o) => o.current);
  const admin = isAdmin(user.role);

  async function handleSwitch(organizationId: string) {
    setSwitching(organizationId);
    const res = await switchOrg(organizationId);
    if (res.ok) {
      // Full reload so no data from the previous organization stays in memory.
      window.location.assign('/dashboard');
    } else {
      setSwitching(null);
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="font-serif-title text-xl font-semibold tracking-tight text-slate-900">
          ResolveX
        </Link>
      </div>

      {/* Organization switcher */}
      <div className="relative px-3 pb-2">
        <button
          type="button"
          onClick={() => orgs.length > 1 && setSwitcherOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left',
            orgs.length > 1 ? 'hover:bg-slate-50' : 'cursor-default',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800">{currentOrg?.name ?? 'Workspace'}</span>
            <span className="block text-xs text-slate-400">{ROLE_LABEL[user.role]}</span>
          </span>
          {orgs.length > 1 && <ChevronsUpDown className="h-4 w-4 text-slate-400" />}
        </button>
        {switcherOpen && (
          <ul
            role="listbox"
            className="absolute left-3 right-3 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {orgs.map((o) => (
              <li key={o.id} role="option" aria-selected={o.current}>
                <button
                  type="button"
                  disabled={o.current || switching !== null}
                  onClick={() => handleSwitch(o.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="truncate text-slate-800">{o.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">
                    {switching === o.id ? 'Switching…' : o.current ? 'Current' : ROLE_LABEL[o.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || admin);
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = isActive(pathname, item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        active
                          ? 'bg-[#25396e] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <Icon className={cn('h-4.5 w-4.5', active ? 'text-white' : 'text-slate-400')} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/70 p-3">
        <Link
          href="/"
          className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Back to website
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25396e] text-sm font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{displayName}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white md:block">
        {sidebarContent}
      </aside>

      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Link href="/dashboard" className="font-serif-title text-lg font-semibold text-slate-900">
          ResolveX
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
