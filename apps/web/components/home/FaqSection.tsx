'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  id: string;
  n: string;
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    id: 'faq-1',
    n: '01',
    q: 'What is ResolveX?',
    a: 'ResolveX is a unified engineering operations platform that integrates project management, service catalog ownership, API health monitoring, and automated incident response into one synchronized workspace. Think of it as a Jira that knows the exact instant your microservices or API endpoints fail in production.',
  },
  {
    id: 'faq-2',
    n: '02',
    q: 'How does API monitoring work?',
    a: 'ResolveX polls your configured HTTP/API endpoints from multiple geographically distributed edge nodes at intervals as low as 30 seconds. It evaluates HTTP status codes, latency spikes, SSL certificate validity, and JSON response payloads to accurately measure service health.',
  },
  {
    id: 'faq-3',
    n: '03',
    q: 'Can ResolveX automatically create incidents?',
    a: 'Yes. When an endpoint or external webhook fails verification thresholds (e.g. 3 consecutive failure probes across multiple edge regions), ResolveX autonomously creates a SEV incident, generates a dedicated incident room, and records all failure events on a timeline.',
  },
  {
    id: 'faq-4',
    n: '04',
    q: 'How does incident deduplication work?',
    a: 'Rather than blasting 1,000 alerts during a catastrophic cascading outage, ResolveX groups related alerts from the same service into a single parent incident. Recurring failure spikes update the existing incident timeline instead of triggering redundant alert storms.',
  },
  {
    id: 'faq-5',
    n: '05',
    q: 'Can I assign service owners?',
    a: 'Yes! Every service registered in your Service Catalog has an assigned owner, maintainer team, repository link, and environment tier (production, staging, development). When an incident fires, ResolveX routes alerts directly to the responsible team rather than blasting the entire company.',
  },
  {
    id: 'faq-6',
    n: '06',
    q: 'Does ResolveX support multiple organizations?',
    a: 'Yes. ResolveX includes full multi-tenant isolation with a built-in workspace switcher in the dashboard. Users can belong to multiple organizations (e.g. personal projects, client accounts, or separate business units) with distinct roles and cryptographic separation.',
  },
  {
    id: 'faq-7',
    n: '07',
    q: 'Can I monitor production and staging separately?',
    a: 'Absolutely. Every service and endpoint is tagged with an environment (production, staging, or development). You can configure different probe frequencies, consecutive failure thresholds, and alerting policies for staging versus mission-critical production clusters.',
  },
  {
    id: 'faq-8',
    n: '08',
    q: 'How are alerts delivered?',
    a: 'Alerts are delivered in real time via email, Slack channels, Microsoft Teams, custom webhook endpoints, and in-dashboard notifications. You can configure granular notification escalation rules to wake secondary backup responders if an incident remains unacknowledged within 15 minutes.',
  },
];

export default function FaqSection() {
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="py-20 md:py-32 bg-[#eeebe0]/60 border-t border-[#dfdbcc]">
      <div className="wrap max-w-4xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#dfdbcc] text-[#14201a] text-xs font-bold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5 text-[#177a43]" /> Answers & FAQ
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#14201a]">
            The things engineering teams ask first.
          </h2>
          <p className="mt-3 text-base text-[#5f6b64]">
            Every team starts with a 14-day free trial. Have a technical question?{' '}
            <a href="mailto:support@resolvex.dev" className="text-[#177a43] font-bold underline hover:text-[#0f5e32]">
              Write to our engineers
            </a>
            , an engineer answers.
          </p>
        </div>

        {/* Accordion FAQ (Kizupi numbered style) */}
        <div className="space-y-3.5">
          {faqs.map((f) => {
            const isOpen = openId === f.id;
            return (
              <div
                key={f.id}
                className="rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc] overflow-hidden transition-all duration-150"
              >
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-expanded={isOpen}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#fbfaf6] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-[#177a43] bg-[#dcefd8] px-2 py-0.5 rounded-md">
                      {f.n}
                    </span>
                    <span className="font-display text-base sm:text-lg font-bold text-[#14201a]">
                      {f.q}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#5f6b64] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#177a43]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-[#dfdbcc]/50 text-sm sm:text-base text-[#3d4a42] leading-relaxed animate-in fade-in duration-150">
                    <p className="pt-3">{f.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
