'use client';

import React from 'react';
import { X, Check, Zap } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function ComparisonMatrix() {
  const { isDark } = useTheme();

  const comparisons = [
    {
      feature: 'Incident-to-Ticket Creation',
      traditional: '15 - 30 minutes of manual copy-pasting across tabs',
      traditionalStatus: false,
      resolvex: 'Automated synthesis in < 3 seconds with stack trace',
      resolvexStatus: true,
    },
    {
      feature: 'Root-Cause Commit Isolation',
      traditional: 'Manual git bisect or scouring deployment logs',
      traditionalStatus: false,
      resolvex: 'AI correlates API latency spikes to exact commit SHA',
      resolvexStatus: true,
    },
    {
      feature: 'Alert Noise & Pager Fatigue',
      traditional: 'Cascading floods: 100+ alerts for 1 root DB outage',
      traditionalStatus: false,
      resolvex: '82% noise reduction with intelligent root grouping',
      resolvexStatus: true,
    },
    {
      feature: 'Deploy & Rollback Verification',
      traditional: 'Engineers manually verify logs or forget to check',
      traditionalStatus: false,
      resolvex: 'Automated multi-region canary probes verify PR health',
      resolvexStatus: true,
    },
    {
      feature: 'Ticket Lifecycle & Closure',
      traditional: 'Forgotten tickets remain open in Jira backlog for weeks',
      traditionalStatus: false,
      resolvex: 'Cards automatically transition to Done once health returns',
      resolvexStatus: true,
    },
    {
      feature: 'Total Tooling Cost',
      traditional: '$160 - $220 / engineer / mo across 4 disconnected tools',
      traditionalStatus: false,
      resolvex: '$29 / seat / mo with all features included',
      resolvexStatus: true,
    },
  ];

  return (
    <section
      id="comparison"
      className={`w-full py-24 sm:py-32 border-t transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#090a0f] border-zinc-800/80' : 'bg-[#e2cfc0] border-[#cbbaa9]'
      }`}
    >
      {/* Background glow */}
      <div 
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] -z-10 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" />
            Stack Comparison
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-[50px] tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Why Modern Teams{' '}
            <span className="text-[#ff5414]">Ditch Tool Sprawl</span>
          </h2>

          <p className={`mt-5 text-base sm:text-lg leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            See how ResolveX unifies monitoring telemetry and sprint task management compared to the traditional patchwork of disconnected tools.
          </p>
        </div>

        {/* Comparison Table Card */}
        <div className={`rounded-2xl border overflow-hidden shadow-2xl ${
          isDark ? 'bg-[#0e0f17] border-zinc-800/90' : 'bg-[#eedccb] border-[#cbbaa9]'
        }`}>
          
          {/* Table Headers */}
          <div className={`grid grid-cols-1 md:grid-cols-12 border-b text-xs font-mono uppercase tracking-wider ${
            isDark ? 'border-zinc-800/80 bg-[#12131d]' : 'border-[#cbbaa9] bg-[#e4d1bf]'
          }`}>
            <div className={`md:col-span-4 p-4 sm:p-5 font-semibold ${isDark ? 'text-zinc-400' : 'text-[#524b44]'}`}>
              Operational Capability
            </div>
            <div className={`md:col-span-4 p-4 sm:p-5 font-semibold border-t md:border-t-0 md:border-l ${
              isDark ? 'text-zinc-500 border-zinc-800' : 'text-[#675d54] border-[#cbbaa9]'
            }`}>
              Fragmented Stack (Jira + Datadog + PagerDuty)
            </div>
            <div className={`md:col-span-4 p-4 sm:p-5 font-bold border-t md:border-t-0 md:border-l flex items-center justify-between ${
              isDark
                ? 'text-orange-400 border-zinc-800 bg-orange-950/20'
                : 'text-orange-600 border-[#cbbaa9] bg-orange-500/10'
            }`}>
              <span>The ResolveX Way</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] uppercase font-mono">
                Unified
              </span>
            </div>
          </div>

          {/* Table Rows */}
          <div className={`divide-y ${isDark ? 'divide-zinc-800/70' : 'divide-[#cbbaa9]'}`}>
            {comparisons.map((row, idx) => (
              <div 
                key={idx} 
                className={`grid grid-cols-1 md:grid-cols-12 transition-colors text-sm ${
                  isDark ? 'hover:bg-[#12131e]/50' : 'hover:bg-[#f4e4d4]'
                }`}
              >
                {/* Feature Name */}
                <div className={`md:col-span-4 p-4 sm:p-5 font-semibold flex items-center ${
                  isDark ? 'text-white' : 'text-[#171a1f]'
                }`}>
                  {row.feature}
                </div>

                {/* Traditional Stack */}
                <div className={`md:col-span-4 p-4 sm:p-5 border-t md:border-t-0 md:border-l flex items-start gap-2.5 ${
                  isDark ? 'text-zinc-400 border-zinc-800/80' : 'text-[#574f47] border-[#cbbaa9]'
                }`}>
                  <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm">{row.traditional}</span>
                </div>

                {/* ResolveX */}
                <div className={`md:col-span-4 p-4 sm:p-5 border-t md:border-t-0 md:border-l flex items-start gap-2.5 ${
                  isDark
                    ? 'text-zinc-200 border-zinc-800/80 bg-orange-950/10'
                    : 'text-[#171a1f] border-[#cbbaa9] bg-orange-500/5'
                }`}>
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className={`text-xs sm:text-sm font-medium ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>{row.resolvex}</span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
