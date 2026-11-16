'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, Zap } from 'lucide-react';

export default function PricingPlans() {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      desc: 'For small engineering teams and indie hackers getting services online.',
      monthly: 19,
      annual: 15,
      features: [
        'Up to 5 team members',
        '3 connected projects & Kanban boards',
        '10 monitored API endpoints (1-minute checks)',
        'Automated incident creation',
        'Email & webhook alerts',
        '7-day metrics retention',
      ],
      highlight: false,
      cta: 'Start 14-day trial',
      btnCls: 'btn-kizupi-white',
    },
    {
      name: 'Team Pro',
      desc: 'For fast-growing SaaS startups demanding real-time operational reliability.',
      monthly: 49,
      annual: 39,
      features: [
        'Unlimited team members',
        'Unlimited projects, boards & sprints',
        '50 monitored API endpoints (30-second checks)',
        'Consecutive failure verification engine',
        'Native service catalog & owner routing',
        'Slack & PagerDuty bi-directional sync',
        '30-day telemetry retention',
        'Audit logs & multi-tenant isolation',
      ],
      highlight: true,
      cta: 'Try Pro Free for 14 Days',
      btnCls: 'btn-kizupi-go',
    },
    {
      name: 'Enterprise',
      desc: 'For high-scale engineering organizations with strict SLA and compliance needs.',
      monthly: 149,
      annual: 119,
      features: [
        'Unlimited endpoints & team seats',
        'Sub-15s distributed edge polling',
        'Custom webhook signing & key rotation',
        'SAML SSO & Okta integration',
        'SOC-2 Type II audit report & BAA',
        'Dedicated Solutions Architect & 99.99% SLA',
        '1-year telemetry retention',
      ],
      highlight: false,
      cta: 'Contact Enterprise',
      btnCls: 'btn-kizupi-white',
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-32 bg-[#f6f4ec]">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eeebe0] border border-[#dfdbcc] text-[#14201a] text-xs font-bold uppercase tracking-wider mb-3">
            <Zap className="w-3.5 h-3.5 text-[#177a43]" /> Transparent Pricing
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#14201a]">
            Simple, fair pricing.{' '}
            <span className="text-[#177a43]">Zero hidden surprise fees.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5f6b64] leading-relaxed">
            Every plan includes a 14-day free trial. No credit card required to get started. Cancel anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-2xl bg-[#eeebe0] border border-[#dfdbcc]">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                !annual ? 'bg-white text-[#14201a] shadow-xs' : 'text-[#5f6b64] hover:text-[#14201a]'
              }`}
            >
              Billed Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                annual ? 'bg-[#177a43] text-white shadow-xs' : 'text-[#5f6b64] hover:text-[#14201a]'
              }`}
            >
              <span>Billed Yearly</span>
              <span className="px-2 py-0.5 rounded-full bg-[#c6f36b] text-[#14201a] text-[10px] font-black">SAVE 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((p) => {
            const price = annual ? p.annual : p.monthly;
            return (
              <div
                key={p.name}
                className={`rounded-3xl p-7 sm:p-9 flex flex-col justify-between transition-all relative ${
                  p.highlight
                    ? 'border-2 border-[#14201a] bg-white shadow-[6px_6px_0_#14201a] lg:-translate-y-2'
                    : 'border border-[#dfdbcc] bg-[#fbfaf6] shadow-[0_2px_0_#dfdbcc]'
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#c6f36b] text-[#14201a] border-2 border-[#14201a] text-xs font-black uppercase tracking-wider shadow-xs">
                    Most Popular for SaaS Teams
                  </div>
                )}

                <div>
                  <h3 className="font-display text-2xl font-extrabold text-[#14201a]">
                    {p.name}
                  </h3>
                  <p className="mt-2 text-xs text-[#5f6b64] leading-relaxed min-h-[36px]">
                    {p.desc}
                  </p>

                  {/* Price */}
                  <div className="mt-6 pb-6 border-b border-[#dfdbcc]">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl sm:text-5xl font-extrabold text-[#14201a]">
                        ${price}
                      </span>
                      <span className="text-xs font-semibold text-[#5f6b64]">
                        / month {annual && 'billed annually'}
                      </span>
                    </div>
                  </div>

                  {/* Features list */}
                  <ul className="mt-6 space-y-3 text-xs sm:text-sm text-[#3d4a42]">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="w-4 h-4 rounded-full bg-[#dcefd8] text-[#177a43] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-[#dfdbcc]">
                  <Link
                    href="/login?tab=register"
                    className={`${p.btnCls} w-full py-3 text-sm font-bold text-center`}
                  >
                    {p.cta}
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
