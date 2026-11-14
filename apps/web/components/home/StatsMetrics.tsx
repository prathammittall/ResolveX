'use client';

import React from 'react';
import { ShieldCheck, Clock, TrendingDown, Zap } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function StatsMetrics() {
  const { isDark } = useTheme();

  const metrics = [
    {
      stat: '99.99%',
      label: 'SLA Monitoring Precision',
      desc: 'Multi-region consensus eliminates false alarms across 12 worldwide edge nodes.',
      icon: ShieldCheck,
      color: 'text-emerald-500',
      border: isDark ? 'border-emerald-500/30 hover:border-emerald-500/60' : 'border-[#cbbaa9] hover:border-emerald-500/60',
      glow: 'rgba(16, 185, 129, 0.1)',
    },
    {
      stat: '< 38s',
      label: 'Median Time to Triage',
      desc: 'From initial 5xx anomaly detection to auto-created task with full stack trace.',
      icon: Clock,
      color: 'text-[#ff5414]',
      border: isDark ? 'border-[#ff5414]/30 hover:border-[#ff5414]/60' : 'border-[#cbbaa9] hover:border-[#ff5414]/60',
      glow: 'rgba(255, 84, 20, 0.1)',
    },
    {
      stat: '82%',
      label: 'Alert Noise Reduction',
      desc: 'Cascade failure grouping prevents alert storms from waking up the wrong engineers.',
      icon: TrendingDown,
      color: 'text-amber-500',
      border: isDark ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-[#cbbaa9] hover:border-amber-500/60',
      glow: 'rgba(245, 158, 11, 0.1)',
    },
    {
      stat: '4.8x',
      label: 'Faster Mean Time to Recovery',
      desc: 'Canary verification confirms remediations instantly upon PR merge.',
      icon: Zap,
      color: 'text-purple-500',
      border: isDark ? 'border-purple-500/30 hover:border-purple-500/60' : 'border-[#cbbaa9] hover:border-purple-500/60',
      glow: 'rgba(168, 85, 247, 0.1)',
    },
  ];

  return (
    <section
      id="metrics"
      className={`w-full py-20 sm:py-28 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#08080a]' : 'bg-[#dfcebe]'
      }`}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className={`text-xs font-mono uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
            Proven Engineering Impact
          </span>
          <h2 className={`mt-2 text-2xl sm:text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
            Built for reliability at real production scale.
          </h2>
          <p className={`mt-3 text-sm sm:text-base ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            Engineers lose an average of 14 hours every week to fragmented tooling. ResolveX brings that down to minutes.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`p-6 sm:p-7 rounded-2xl border ${item.border} transition-all duration-300 hover:-translate-y-1 shadow-xl flex flex-col justify-between ${
                  isDark ? 'bg-[#0f1017]' : 'bg-[#eedccb]'
                }`}
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-5 ${
                    isDark ? 'bg-[#171823] border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
                  }`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>

                  <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                    isDark ? 'text-white' : 'text-[#171a1f]'
                  }`}>
                    {item.stat}
                  </div>

                  <div className={`mt-2 text-base font-bold ${isDark ? 'text-zinc-100' : 'text-[#171a1f]'}`}>
                    {item.label}
                  </div>
                </div>

                <div className={`mt-3 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
