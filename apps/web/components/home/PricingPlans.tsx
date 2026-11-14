'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function PricingPlans() {
  const { isDark } = useTheme();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const tiers = [
    {
      name: 'Starter',
      priceMonthly: 0,
      priceAnnual: 0,
      period: 'forever free',
      desc: 'Essential API checks and on-call rotation for indie developers & small startups.',
      features: [
        'Up to 5 team members',
        '10 synthetic endpoints (1 min intervals)',
        'Basic email & webhook alerts',
        '7 days telemetry history',
        'Unlimited Kanban boards',
        'Community Discord support',
      ],
      cta: 'Get Started Free',
      href: '/login?tab=register',
      highlighted: false,
    },
    {
      name: 'Pro Team',
      priceMonthly: 29,
      priceAnnual: 23,
      period: 'per engineer / month',
      desc: 'Full operational suite with AI root-cause analysis, bi-directional Jira sync & automated triage.',
      features: [
        'Unlimited team members',
        '100+ endpoints with 5s check intervals',
        'AI Root-Cause Diagnosis Engine',
        'Slack, SMS & Voice war-room alerts',
        'GitHub, GitLab & Linear bi-directional sync',
        '90 days telemetry retention',
        '24/7 Priority engineer support',
      ],
      cta: 'Start 14-Day Free Trial',
      href: '/login?tab=register',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      priceMonthly: 'Custom',
      priceAnnual: 'Custom',
      period: 'tailored annual contract',
      desc: 'Dedicated private VPC probes, custom SLAs, SOC-2 compliance, and dedicated architect.',
      features: [
        'Unlimited volume & 1-year telemetry retention',
        'Custom SSO / SAML & SCIM provisioning',
        'Dedicated Private Probing Agents (VPC)',
        '99.99% Financial Uptime SLA',
        'Dedicated Customer Success Architect',
        'HIPAA & SOC-2 Type II audit packs',
      ],
      cta: 'Contact Sales',
      href: '#demo',
      highlighted: false,
    },
  ];

  return (
    <section
      id="pricing"
      className={`w-full py-24 sm:py-32 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#08080a]' : 'bg-[#e2cfc0]'
      }`}
    >
      {/* Background radial glow */}
      <div 
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[550px] -z-10 opacity-25"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" />
            Predictable Developer Pricing
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-[50px] tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Simple Pricing That{' '}
            <span className="text-[#ff5414]">Scales With Your Stack</span>
          </h2>

          <p className={`mt-4 text-base sm:text-lg ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            No surprise per-metric overages or hidden fees. Start free and scale as your traffic grows.
          </p>

          {/* Billing Toggle */}
          <div className={`mt-8 inline-flex items-center p-1 rounded-xl border ${
            isDark ? 'bg-[#12131b] border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
          }`}>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? isDark
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'bg-[#171a1f] text-white shadow-xs'
                  : isDark
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-[#574f47] hover:text-[#171a1f]'
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? isDark
                    ? 'bg-[#f5e6d3] text-zinc-950 shadow-xs'
                    : 'bg-[#171a1f] text-white shadow-xs'
                  : isDark
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-[#574f47] hover:text-[#171a1f]'
              }`}
            >
              <span>Annual billing</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#ff5414] text-white font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-6xl mx-auto items-stretch">
          {tiers.map((tier, idx) => {
            const price = typeof tier.priceMonthly === 'number'
              ? (billingCycle === 'annual' ? `$${tier.priceAnnual}` : `$${tier.priceMonthly}`)
              : 'Custom';

            return (
              <div
                key={idx}
                className={`relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  tier.highlighted
                    ? isDark
                      ? 'bg-[#10111a] border-2 border-[#ff5414] shadow-[0_0_40px_rgba(255,84,20,0.22)] scale-[1.03] z-10'
                      : 'bg-[#ebd8c6] border-2 border-[#ff5414] shadow-2xl scale-[1.03] z-10'
                    : isDark
                      ? 'bg-[#0f1017] border border-zinc-800/90 hover:border-zinc-700 shadow-xl'
                      : 'bg-[#eedccb] border border-[#cbbaa9] hover:border-[#bfae9c] shadow-md'
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#ea580c] via-[#ff5414] to-[#f97316] text-white text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {tier.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                      {tier.name}
                    </h3>
                  </div>

                  <p className={`mt-2 text-xs leading-relaxed min-h-[36px] ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                    {tier.desc}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                      {price}
                    </span>
                    <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
                      {tier.period}
                    </span>
                  </div>

                  <div className={`mt-8 pt-6 border-t space-y-3 ${isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'}`}>
                    <span className={`text-[11px] uppercase font-mono font-semibold block ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                      Everything included:
                    </span>
                    {tier.features.map((feat, i) => (
                      <div key={i} className={`flex items-start gap-2.5 text-xs ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                        <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href={tier.href}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 ${
                      tier.highlighted
                        ? isDark
                          ? 'bg-[#f5e6d3] hover:bg-[#faebd7] text-zinc-950 shadow-[0_2px_15px_rgba(245,230,211,0.2)]'
                          : 'bg-[#171a1f] hover:bg-black text-white shadow-md'
                        : isDark
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                          : 'bg-[#dfcebe] hover:bg-[#d5c2b0] border border-[#cbbaa9] text-[#171a1f]'
                    }`}
                  >
                    <span>{tier.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
