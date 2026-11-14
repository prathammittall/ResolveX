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
import { useTheme } from '../../lib/theme-context';
import { api } from '../../lib/api';
import { isAdmin, ROLE_LABEL } from '../../lib/permissions';
import type { OrganizationSummary } from '../../lib/types';
import { Spinner, cn } from './_components/ui';
import { ResolveXLogoMark } from '../../components/ResolveXLanding';
import ThemeToggle from '../../components/ThemeToggle';

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
  const { isDark } = useTheme();
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

  // Load the organizations the user belongs to
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ organizations: OrganizationSummary[] }>('/api/organizations')
      .then((res) => {
        if (!cancelled) setOrgs(res.organizations);
      })
      .catch(() => {
        // Optional
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-[#08080a]' : 'bg-[#e2cfc0]'}`} role="status" aria-label="Loading">
        <Spinner className="h-8 w-8 text-[#ff5414]" />
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
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className={`flex h-16 items-center px-5 border-b ${isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'}`}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <ResolveXLogoMark className="w-6 h-6 transition-transform group-hover:scale-105 duration-200" />
          <span className={`font-sans font-bold text-lg tracking-tight transition-colors ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            ResolveX
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
            'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition cursor-pointer',
            isDark
              ? 'border-zinc-800 bg-[#12131b] hover:bg-[#181924] text-white'
              : 'border-[#cbbaa9] bg-[#dfcebe] hover:bg-[#d5c2b0] text-[#171a1f]',
            orgs.length <= 1 && 'cursor-default'
          )}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#eedccb] text-[#574f47]'
          }`}>
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{currentOrg?.name ?? 'Workspace'}</span>
            <span className={`block text-xs ${isDark ? 'text-zinc-400' : 'text-[#675d54]'}`}>{ROLE_LABEL[user.role]}</span>
          </span>
          {orgs.length > 1 && <ChevronsUpDown className="h-4 w-4 opacity-50" />}
        </button>
        {switcherOpen && (
          <ul
            role="listbox"
            className={`absolute left-3 right-3 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border p-1 shadow-2xl ${
              isDark ? 'border-zinc-800 bg-[#101117] text-white' : 'border-[#cbbaa9] bg-[#eedccb] text-[#171a1f]'
            }`}
          >
            {orgs.map((o) => (
              <li key={o.id} role="option" aria-selected={o.current}>
                <button
                  type="button"
                  disabled={o.current || switching !== null}
                  onClick={() => handleSwitch(o.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition cursor-pointer disabled:opacity-60 ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-[#dfcebe] text-[#171a1f]'
                  }`}
                >
                  <span className="truncate font-medium">{o.name}</span>
                  <span className={`ml-2 shrink-0 text-xs ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
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
              <p className={`px-3 pb-1 text-[11px] font-mono font-semibold uppercase tracking-wider ${
                isDark ? 'text-zinc-500' : 'text-[#675d54]'
              }`}>
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
                          ? isDark
                            ? 'bg-[#ff5414] text-white shadow-sm font-semibold'
                            : 'bg-[#171a1f] text-white shadow-sm font-semibold'
                          : isDark
                            ? 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                            : 'text-[#574f47] hover:bg-[#dfcebe] hover:text-[#171a1f]'
                      )}
                    >
                      <Icon className={cn('h-4.5 w-4.5', active ? (isDark ? 'text-white' : 'text-[#ff5414]') : 'opacity-60')} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Controls: Theme Toggle & User Info */}
      <div className={`border-t p-3 space-y-2 ${isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'}`}>
        <ThemeToggle className="w-full justify-center" />

        <Link
          href="/"
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
            isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-[#574f47] hover:bg-[#dfcebe] hover:text-[#171a1f]'
          }`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Back to website
        </Link>

        <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
        }`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff5414] text-sm font-bold text-white shadow-xs">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-bold ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>{displayName}</p>
            <p className={`truncate text-xs ${isDark ? 'text-zinc-400' : 'text-[#675d54]'}`}>{user.email}</p>
          </div>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-[#08080a] text-white' : 'bg-[#e2cfc0] text-[#171a1f]'
    }`}>
      {/* Desktop Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 border-r md:block transition-colors duration-300 ${
        isDark ? 'border-zinc-800 bg-[#0e0f14]' : 'border-[#cbbaa9] bg-[#eedccb]'
      }`}>
        {sidebarContent}
      </aside>

      {/* Mobile Sticky Topbar */}
      <div className={`sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 md:hidden transition-colors duration-300 ${
        isDark ? 'border-zinc-800 bg-[#0e0f14]' : 'border-[#cbbaa9] bg-[#eedccb]'
      }`}>
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <ResolveXLogoMark className="w-5 h-5" />
          <span>ResolveX</span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className={`rounded-lg p-2 transition ${isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-[#574f47] hover:bg-[#dfcebe]'}`}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className={`absolute inset-y-0 left-0 w-64 shadow-2xl border-r ${
            isDark ? 'bg-[#0e0f14] border-zinc-800' : 'bg-[#eedccb] border-[#cbbaa9]'
          }`}>
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
