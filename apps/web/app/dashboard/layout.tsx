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
import { ResolveXLogoMark } from '../../components/ResolveXLanding';
import { ThemeToggle } from '../../components/ThemeToggle';

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
      const here = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [isLoading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setSwitcherOpen(false);
  }, [pathname]);

  // Load user organizations
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ organizations: OrganizationSummary[] }>('/api/organizations')
      .then((res) => {
        if (!cancelled) setOrgs(res.organizations);
      })
      .catch(() => {
        // Optional error handling
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
  const admin = isAdmin(user.role);

  async function handleSwitch(organizationId: string) {
    setSwitching(organizationId);
    const res = await switchOrg(organizationId);
    if (res.ok) {
      window.location.assign('/dashboard');
    } else {
      setSwitching(null);
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#ffffff] dark:bg-[#14221b] border-r border-[#dfdbcc] dark:border-[#23372c]">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-5 border-b border-[#dfdbcc] dark:border-[#23372c]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <ResolveXLogoMark className="w-6 h-6 transition-transform group-hover:scale-105 duration-200" />
          <span className="font-display font-extrabold text-xl tracking-tight text-[#14201a] dark:text-[#f0f5f2]">
            Resolve<span className="text-[#177a43] dark:text-[#22b163]">X</span>
          </span>
        </Link>
      </div>

      {/* Organization switcher */}
      <div className="relative px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => orgs.length > 1 && setSwitcherOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0c1410] hover:bg-[#eeebe0] dark:hover:bg-[#18261e] text-[#14201a] dark:text-[#f0f5f2] px-3 py-2 text-left transition cursor-pointer shadow-[0_1px_0_#dfdbcc] dark:shadow-[0_1px_0_#1b2d23]',
            orgs.length <= 1 && 'cursor-default'
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#dcefd8] dark:bg-[#163824] text-[#177a43] dark:text-[#38d47d]">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[#14201a] dark:text-[#f0f5f2]">{currentOrg?.name ?? 'Workspace'}</span>
            <span className="block text-xs font-medium text-[#5f6b64] dark:text-[#87998e]">{ROLE_LABEL[user.role]}</span>
          </span>
          {orgs.length > 1 && <ChevronsUpDown className="h-4 w-4 text-[#5f6b64] dark:text-[#87998e]" />}
        </button>
        {switcherOpen && (
          <ul
            role="listbox"
            className="absolute left-3 right-3 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] text-[#14201a] dark:text-[#f0f5f2] p-1.5 shadow-xl"
          >
            {orgs.map((o) => (
              <li key={o.id} role="option" aria-selected={o.current}>
                <button
                  type="button"
                  disabled={o.current || switching !== null}
                  onClick={() => handleSwitch(o.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition cursor-pointer disabled:opacity-60 hover:bg-[#f6f4ec] dark:hover:bg-[#18261e] text-[#14201a] dark:text-[#f0f5f2]"
                >
                  <span className="truncate font-semibold">{o.name}</span>
                  <span className="ml-2 shrink-0 text-xs font-medium text-[#5f6b64] dark:text-[#87998e]">
                    {switching === o.id ? 'Switching…' : o.current ? 'Current' : ROLE_LABEL[o.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || admin);
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#5f6b64] dark:text-[#87998e]">
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
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
                        active
                          ? 'bg-[#dcefd8] dark:bg-[#163824] text-[#177a43] dark:text-[#38d47d] border border-[#b2e2a8] dark:border-[#1e5234] shadow-xs'
                          : 'text-[#3d4a42] dark:text-[#c4d3cb] hover:bg-[#f6f4ec] dark:hover:bg-[#18261e] hover:text-[#14201a] dark:hover:text-[#f0f5f2]'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#177a43] dark:text-[#38d47d]' : 'text-[#5f6b64] dark:text-[#87998e]')} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Controls: User Info */}
      <div className="border-t border-[#dfdbcc] dark:border-[#23372c] p-3 space-y-2 bg-[#fbfaf6] dark:bg-[#0e1713]">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#5f6b64] dark:text-[#87998e] hover:bg-[#eeebe0] dark:hover:bg-[#1a2a21] hover:text-[#14201a] dark:hover:text-[#f0f5f2] transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Back to website
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] px-3 py-2 shadow-xs">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#177a43] text-sm font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#14201a] dark:text-[#f0f5f2]">{displayName}</p>
            <p className="truncate text-[11px] text-[#5f6b64] dark:text-[#87998e]">{user.email}</p>
          </div>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-[#5f6b64] dark:text-[#87998e] hover:bg-[#fee2e2] dark:hover:bg-[#341414] hover:text-[#dc2626] dark:hover:text-[#f87171] transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f4ec] dark:bg-[#0c1410] text-[#14201a] dark:text-[#f0f5f2] transition-colors duration-150">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        {sidebarContent}
      </aside>

      {/* Mobile Sticky Topbar */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg text-[#14201a] dark:text-[#f0f5f2]">
          <ResolveXLogoMark className="w-5 h-5" />
          <span>Resolve<span className="text-[#177a43] dark:text-[#22b163]">X</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 transition text-[#3d4a42] dark:text-[#c4d3cb] hover:bg-[#f6f4ec] dark:hover:bg-[#1a2a21]"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Page Content */}
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
