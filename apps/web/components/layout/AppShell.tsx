"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";
import { ResponderAvatar } from "../ui/ResponderAvatar";
import { RESPONDERS } from "../../lib/incident-data";

interface NavItem {
  label: string;
  href: string;
  matchPrefix: string;
  icon: IconName;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/",
    matchPrefix: "/",
    icon: "dashboard",
  },
  {
    label: "Incidents",
    href: "/incidents/INC-1042",
    matchPrefix: "/incidents",
    icon: "warning",
  },
  {
    label: "Services",
    href: "/services",
    matchPrefix: "/services",
    icon: "dns",
  },
  {
    label: "On-Call",
    href: "/on-call",
    matchPrefix: "/on-call",
    icon: "schedule",
  },
  {
    label: "Settings",
    href: "/settings",
    matchPrefix: "/settings",
    icon: "settings",
  },
];

interface AppShellProps {
  children: React.ReactNode;
  fullHeightStream?: boolean;
}

export function AppShell({ children, fullHeightStream = false }: AppShellProps) {
  const pathname = usePathname() || "/";
  const primaryResponder = RESPONDERS.asha!;

  return (
    <div className="wr-shell">
      <aside className="wr-sidebar" aria-label="Primary Navigation">
        <div className="wr-sidebar-top">
          <Link href="/" className="wr-brand">
            <span className="wr-brand-mark" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <circle cx="8" cy="15" r="1.5" fill="currentColor" />
                <line x1="12" y1="15" x2="18" y2="15" />
              </svg>
            </span>
            <span className="wr-brand-text">
              <span className="wr-brand-title">War-Room</span>
              <span className="wr-brand-subtitle">Incident Response</span>
            </span>
          </Link>

          <nav className="wr-nav">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.matchPrefix === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.matchPrefix);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`wr-nav-link ${
                    isActive ? "wr-nav-link--active" : ""
                  }`.trim()}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="wr-sidebar-footer">
          <ResponderAvatar responder={primaryResponder} size="sm" />
          <div className="wr-operator-meta">
            <span className="wr-operator-name">{primaryResponder.name}</span>
            <span className="wr-operator-status">
              <span className="wr-dot wr-dot--green" aria-hidden="true" />
              Primary On-Call
            </span>
          </div>
        </div>
      </aside>

      <div className="wr-main-wrapper">
        <header className="wr-topbar">
          <div className="wr-row wr-gap-2">
            <span
              className="wr-dot wr-dot--sev1 wr-dot--pulse"
              aria-hidden="true"
            />
            <span className="wr-topbar-status">
              System Status: Degraded · 1 SEV-1 Active
            </span>
          </div>

          <div className="wr-row wr-gap-3">
            <Link href="/status" className="wr-status-page-link">
              <span>Public Status Page</span>
              <Icon name="arrow_outward" size={13} />
            </Link>

            <div className="wr-soc2-pill" title="SOC2 Compliance Audit Logging Active">
              <Icon name="lock" size={13} />
              <span>SOC2 Mode</span>
            </div>
          </div>
        </header>

        <main
          className={`wr-canvas ${
            fullHeightStream ? "wr-canvas--stream" : ""
          }`.trim()}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
