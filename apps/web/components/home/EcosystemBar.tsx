'use client';

import React, { useState } from 'react';
import { GitBranch, Activity, ShieldCheck, Zap, Server, RefreshCw } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

const integrations = [
  {
    name: 'GitHub',
    type: 'Version Control',
    detail: 'Auto commit correlation & PR status checks',
    badge: 'PR Sync',
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: 'GitLab',
    type: 'CI/CD Pipelines',
    detail: 'Webhook deploy triggers & pipeline verification',
    badge: 'CI/CD',
    color: 'from-orange-400 to-amber-600',
  },
  {
    name: 'Datadog',
    type: 'APM & Telemetry',
    detail: 'Bi-directional metric streaming & trace linking',
    badge: 'APM Sync',
    color: 'from-purple-400 to-indigo-600',
  },
  {
    name: 'Slack',
    type: 'Incident Rooms',
    detail: 'Instant thread creation & interactive bot triage',
    badge: '< 1s Alert',
    color: 'from-emerald-400 to-teal-600',
  },
  {
    name: 'PagerDuty',
    type: 'Escalations',
    detail: 'On-call schedule sync & smart deduplication',
    badge: 'On-Call',
    color: 'from-green-400 to-emerald-600',
  },
  {
    name: 'AWS & K8s',
    type: 'Cloud Infra',
    detail: 'Pod container metrics & health probe auto-discovery',
    badge: 'Infra',
    color: 'from-amber-400 to-orange-600',
  },
  {
    name: 'Linear',
    type: 'Issue Tracker',
    detail: 'Bi-directional issue sync & automated state transitions',
    badge: 'Issues',
    color: 'from-blue-400 to-indigo-600',
  },
  {
    name: 'Sentry',
    type: 'Crash Reporting',
    detail: 'Exception traces linked to live Kanban cards',
    badge: 'Errors',
    color: 'from-rose-400 to-pink-600',
  },
];

export default function EcosystemBar() {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const { isDark } = useTheme();

  return (
    <section
      id="ecosystem"
      className={`w-full py-16 border-y transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#0a0b0f] border-zinc-800/70' : 'bg-[#dfcebe] border-[#cbbaa9]'
      }`}
    >
      {/* Background radial gradient */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 84, 20, 0.08) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Capsule */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#ff5414] animate-ping" />
            <span className={`text-xs font-mono uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-[#524b44]'}`}>
              Bi-Directional Ecosystem Integration
            </span>
          </div>
          
          <div className={`flex items-center gap-2 text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
            <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
            <span>&lt; 10ms Webhook Dispatch · Zero-Config Ingestion</span>
          </div>
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {integrations.map((item) => (
            <div
              key={item.name}
              onMouseEnter={() => setActiveItem(item.name)}
              onMouseLeave={() => setActiveItem(null)}
              className={`group relative rounded-xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[92px] shadow-sm hover:shadow-[0_4px_20px_rgba(255,84,20,0.15)] ${
                isDark
                  ? 'bg-[#101117] hover:bg-[#161722] border border-zinc-800/80 hover:border-orange-500/50'
                  : 'bg-[#eedccb] hover:bg-[#f4e4d4] border border-[#cbbaa9] hover:border-[#ff5414]/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold text-sm transition-colors ${
                  isDark ? 'text-zinc-200 group-hover:text-white' : 'text-[#171a1f] group-hover:text-black'
                }`}>
                  {item.name}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  isDark
                    ? 'bg-zinc-800/90 text-zinc-400 group-hover:text-orange-300 group-hover:bg-orange-950/60'
                    : 'bg-[#dfcebe] text-[#524b44] group-hover:text-[#ff5414] group-hover:bg-[#ff5414]/10'
                }`}>
                  {item.badge}
                </span>
              </div>

              <div className={`mt-2 text-[11px] font-normal leading-tight transition-colors ${
                isDark ? 'text-zinc-400 group-hover:text-zinc-300' : 'text-[#5a524a] group-hover:text-[#171a1f]'
              }`}>
                {item.type}
              </div>

              {/* Tooltip on hover */}
              {activeItem === item.name && (
                <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap text-[11px] px-2.5 py-1 rounded-md shadow-xl pointer-events-none animate-fadeIn ${
                  isDark ? 'bg-zinc-900 border border-zinc-700 text-zinc-200' : 'bg-[#171a1f] border border-zinc-800 text-white'
                }`}>
                  {item.detail}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom micro quote */}
        <div className={`mt-8 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-[#675d54]'}`}>
          Syncs seamlessly with your existing infrastructure. No migrations required.
        </div>

      </div>
    </section>
  );
}
