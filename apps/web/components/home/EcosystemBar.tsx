'use client';

import React from 'react';
import { ShieldCheck, Zap, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function EcosystemBar() {
  const stats = [
    {
      metric: '99.99%',
      title: 'Monitoring Uptime',
      sub: 'Distributed edge probes checking every minute',
    },
    {
      metric: '< 10s',
      title: 'Incident Detection',
      sub: 'Consecutive failure verification eliminates false alarms',
    },
    {
      metric: '1-Click',
      title: 'Jira & Sprint Sync',
      sub: 'Converts production outages into actionable backlog tasks',
    },
    {
      metric: '100%',
      title: 'Owner-Based Routing',
      sub: 'Alerts route directly to responsible service maintainers',
    },
  ];

  return (
    <div className="bg-[#111914] text-[#e7eee9] py-8 border-y border-[#2a372f]">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8" aria-label="ResolveX at a glance">
          {stats.map((s) => (
            <li key={s.title} className="flex flex-col gap-1 border-l border-[#2a372f] pl-4 sm:pl-6 first:border-none first:pl-0">
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#c6f36b] tracking-tight">
                {s.metric}
              </span>
              <span className="text-sm font-bold text-white">
                {s.title}
              </span>
              <span className="text-xs text-[#a5b5ab] leading-snug">
                {s.sub}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
