import React from 'react';
import { Zap, Clock, ShieldCheck, TrendingDown } from 'lucide-react';

const MetricsSection = () => {
  const metrics = [
    {
      stat: '99.99%',
      label: 'Guaranteed SLA Uptime',
      subtext: 'Across all core distributed endpoints',
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      stat: '< 45s',
      label: 'Median Time to Triage (MTTR)',
      subtext: 'From first anomaly spike to root-cause isolation',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      stat: '74%',
      label: 'Alert Noise Reduction',
      subtext: 'Intelligent de-duplication and correlation',
      icon: TrendingDown,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      stat: '15,000+',
      label: 'Services Monitored 24/7',
      subtext: 'Powering high-scale infrastructure teams',
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <section className="py-20 bg-white border-y border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-serif-title text-2xl sm:text-4xl font-normal text-slate-900 tracking-tight">
            Built for reliability at real engineering scale.
          </h2>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            Engineers lose an average of 14 hours every week to fragmented tooling. ResolveX brings that down to minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#fafaf9] border border-slate-200/80 hover:shadow-md transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight font-serif-title">
                  {item.stat}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {item.subtext}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MetricsSection;
