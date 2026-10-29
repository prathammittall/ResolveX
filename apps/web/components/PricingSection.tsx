import React from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

const PricingSection = () => {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      period: 'forever free',
      desc: 'Essential API checks and on-call rotation for indie developers & small startups.',
      features: [
        'Up to 5 team members',
        '10 synthetic endpoints (1 min intervals)',
        'Basic email & webhook alerting',
        '7 days telemetry history',
        'Community support',
      ],
      cta: 'Get Started Free',
      href: '/login',
      highlighted: false,
    },
    {
      name: 'Team',
      price: '$29',
      period: 'per engineer / month',
      desc: 'Full operational suite with AI root-cause analysis and automated triage.',
      features: [
        'Unlimited engineers & schedules',
        '100+ endpoints with 10s check intervals',
        'AI Root-Cause Diagnosis Engine',
        'SMS, Voice & Slack war-room paging',
        'Linear, Jira & GitHub bi-directional sync',
        '90 days telemetry retention',
        '24/7 Priority support',
      ],
      cta: 'Start 14-Day Free Trial',
      href: '/login',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'tailored annual contract',
      desc: 'Dedicated infrastructure, custom SLAs, SOC-2 compliance, and on-premise probes.',
      features: [
        'Unlimited volume & telemetry retention',
        'Custom SSO / SAML & SCIM provisioning',
        'Dedicated Private Probing Agents (VPC)',
        '99.99% Financial Uptime SLA',
        'Dedicated Customer Success Architect',
        'HIPAA / SOC2 Type II compliance reports',
      ],
      cta: 'Contact Sales',
      href: '#demo',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-white border-t border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
            Transparent, Predictable Pricing
          </div>
          <h2 className="font-serif-title text-3xl sm:text-5xl font-normal text-slate-900 tracking-tight">
            Simple pricing that scales with your infrastructure.
          </h2>
          <p className="mt-4 text-slate-600 text-base">
            No surprise per-metric charges. Predictable billing designed for high-performing engineering teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 ${
                tier.highlighted
                  ? 'bg-slate-950 text-white shadow-2xl ring-2 ring-blue-600 scale-[1.02]'
                  : 'bg-[#fafaf9] border border-slate-200/90 text-slate-900 hover:shadow-lg'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {tier.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xl font-semibold ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                    {tier.name}
                  </h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl sm:text-5xl font-bold tracking-tight ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                    {tier.price}
                  </span>
                  <span className={`text-xs ${tier.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>
                    /{tier.period}
                  </span>
                </div>
                <p className={`mt-3 text-xs leading-relaxed ${tier.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                  {tier.desc}
                </p>

                <div className={`my-6 h-[1px] ${tier.highlighted ? 'bg-slate-800' : 'bg-slate-200'}`} />

                <ul className="space-y-3 text-xs">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.highlighted ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={tier.highlighted ? 'text-slate-200' : 'text-slate-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href={tier.href}
                  className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center transition-all ${
                    tier.highlighted
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-500/25'
                      : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-300'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
