'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function FaqSection() {
  const { isDark } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does ResolveX link API outages directly to Kanban tasks?',
      a: 'When an endpoint slips into an unhealthy state (e.g., consecutive 5xx responses or severe latency degradation), ResolveX’s telemetry engine extracts the endpoint path, error payload, and affected microservice. It correlates this with your active sprint board, creates a dedicated incident task with stack traces attached, and assigns your team’s on-call engineer in under 3 seconds.',
    },
    {
      q: 'Can I import our existing projects from Jira, Linear, or GitHub?',
      a: 'Yes. ResolveX includes 1-click bi-directional importers for Jira Cloud, Linear, and GitHub Projects. You can import your epics, sprint backlogs, and active boards without losing card IDs, assignees, or labels.',
    },
    {
      q: 'How does ResolveX prevent false alarms from temporary network hiccups?',
      a: 'ResolveX uses multi-region consensus probing. Before an incident alert or automated ticket is synthesized, probes from at least 3 geographically independent edge locations (e.g., Virginia, Frankfurt, Tokyo) must confirm the failure. Single-node transient anomalies are logged but do not trigger false alarms.',
    },
    {
      q: 'Can we monitor internal APIs running behind a private VPC or corporate firewall?',
      a: 'Yes. In addition to our global managed edge probe fleet, ResolveX provides lightweight Docker and Kubernetes daemon probes that run inside your private AWS VPC, Google Cloud, or on-prem cluster to monitor internal microservice mesh traffic securely.',
    },
    {
      q: 'How does automated canary verification work during deployments?',
      a: 'When you merge a PR linked to an incident task or trigger a release webhook, ResolveX initiates high-frequency verification checks against the target endpoint. Once 3 consecutive probes report 200 OK and latency falls below your SLA threshold, ResolveX automatically transitions the card to Done.',
    },
    {
      q: 'What notification channels and war-room integrations are supported?',
      a: 'ResolveX supports native notifications via Slack (with interactive triage threads and 1-click rollback buttons), PagerDuty, OpsGenie, Microsoft Teams, Discord, SMS, voice paging, and custom webhooks.',
    },
  ];

  return (
    <section
      id="faq"
      className={`w-full py-24 sm:py-32 border-t transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#090a0f] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
      }`}
    >
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            Common Questions
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Frequently Asked{' '}
            <span className="text-[#ff5414]">Questions</span>
          </h2>

          <p className={`mt-4 text-base ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            Everything you need to know about connecting live telemetry with sprint task management.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? isDark
                      ? 'bg-[#10111a] border-zinc-700/90 shadow-lg'
                      : 'bg-[#ebd8c6] border-[#cbbaa9] shadow-md'
                    : isDark
                      ? 'bg-[#0e0f16]/90 border-zinc-800/80 hover:border-zinc-700'
                      : 'bg-[#eedccb] border-[#cbbaa9] hover:border-[#bfae9c]'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className={`font-sans font-bold text-base sm:text-lg ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                    {faq.q}
                  </span>
                  <div className={`p-1.5 rounded-lg shrink-0 transition-transform duration-200 ${
                    isOpen
                      ? 'rotate-180 text-orange-500 bg-orange-500/15'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-400'
                        : 'bg-[#dfcebe] text-[#524b44]'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className={`px-5 pb-6 sm:px-6 sm:pb-6 text-sm leading-relaxed border-t pt-4 animate-fadeIn ${
                    isDark ? 'text-zinc-400 border-zinc-800/80' : 'text-[#574f47] border-[#cbbaa9]'
                  }`}>
                    {faq.a}
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
