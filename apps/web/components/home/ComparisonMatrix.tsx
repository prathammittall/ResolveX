'use client';

import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

export default function ComparisonMatrix() {
  const rows = [
    {
      feature: 'Sprint & Kanban Task Management',
      jira: true,
      monitoring: false,
      resolvex: true,
    },
    {
      feature: 'Distributed Edge API Telemetry (30s polling)',
      jira: false,
      monitoring: true,
      resolvex: true,
    },
    {
      feature: 'Native Microservice Catalog & Ownership',
      jira: 'Partial / Add-on',
      monitoring: 'Complex Tagging',
      resolvex: 'Native Core',
    },
    {
      feature: 'Automated Incident Creation on Outage',
      jira: false,
      monitoring: 'Manual / Pager',
      resolvex: 'Autonomous Pipeline',
    },
    {
      feature: 'Incident-to-Sprint Task Linking',
      jira: 'Manual Copy-Paste',
      monitoring: false,
      resolvex: 'Instant 1-Click Sync',
    },
    {
      feature: 'Consecutive Failure Threshold Verification',
      jira: false,
      monitoring: true,
      resolvex: true,
    },
    {
      feature: 'Automatic Recovery Verification & Ticket Closing',
      jira: false,
      monitoring: 'Alert clears only',
      resolvex: 'Bi-Directional Sync',
    },
    {
      feature: 'Zero Alert Fatigue & Direct Maintainer Routing',
      jira: false,
      monitoring: 'Broad on-call blast',
      resolvex: 'Targeted Service Owner',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-[#f6f4ec]">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eeebe0] border border-[#dfdbcc] text-[#14201a] text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#177a43]" /> Architectural Advantage
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#14201a]">
            More than project management.{' '}
            <span className="text-[#177a43]">More than uptime monitoring.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5f6b64] leading-relaxed">
            Stop bridging Jira and PagerDuty with manual Slack updates. ResolveX brings operational health
            directly into your daily development cycle.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-hidden rounded-3xl border-2 border-[#14201a] bg-white shadow-[6px_6px_0_#14201a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#14201a] bg-[#fbfaf6]">
                  <th className="p-5 sm:p-6 text-sm sm:text-base font-extrabold text-[#14201a] w-2/5">
                    Operational Capability
                  </th>
                  <th className="p-5 sm:p-6 text-xs sm:text-sm font-bold text-[#5f6b64] w-1/5 text-center">
                    Traditional PM<br />
                    <span className="font-normal text-xs text-[#5f6b64]">(Jira / Linear)</span>
                  </th>
                  <th className="p-5 sm:p-6 text-xs sm:text-sm font-bold text-[#5f6b64] w-1/5 text-center">
                    Standalone Monitoring<br />
                    <span className="font-normal text-xs text-[#5f6b64]">(Datadog / BetterStack)</span>
                  </th>
                  <th className="p-5 sm:p-6 text-sm sm:text-base font-black text-[#177a43] bg-[#dcefd8]/50 w-1/5 text-center border-l-2 border-[#14201a]">
                    ResolveX<br />
                    <span className="font-bold text-xs text-[#177a43]">Connected Platform</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc] text-sm">
                {rows.map((r, i) => (
                  <tr key={r.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fbfaf6]/60'}>
                    <td className="p-5 sm:p-6 font-bold text-[#14201a] text-xs sm:text-sm">
                      {r.feature}
                    </td>

                    {/* Jira / Linear */}
                    <td className="p-5 sm:p-6 text-center text-xs text-[#5f6b64]">
                      {typeof r.jira === 'boolean' ? (
                        r.jira ? (
                          <span className="inline-flex w-6 h-6 rounded-full bg-[#dcefd8] text-[#177a43] items-center justify-center font-bold">✓</span>
                        ) : (
                          <span className="inline-flex w-6 h-6 rounded-full bg-[#fee2e2] text-[#dc2626] items-center justify-center font-bold">✕</span>
                        )
                      ) : (
                        <span className="font-medium">{r.jira}</span>
                      )}
                    </td>

                    {/* Standalone Monitoring */}
                    <td className="p-5 sm:p-6 text-center text-xs text-[#5f6b64]">
                      {typeof r.monitoring === 'boolean' ? (
                        r.monitoring ? (
                          <span className="inline-flex w-6 h-6 rounded-full bg-[#dcefd8] text-[#177a43] items-center justify-center font-bold">✓</span>
                        ) : (
                          <span className="inline-flex w-6 h-6 rounded-full bg-[#fee2e2] text-[#dc2626] items-center justify-center font-bold">✕</span>
                        )
                      ) : (
                        <span className="font-medium">{r.monitoring}</span>
                      )}
                    </td>

                    {/* ResolveX */}
                    <td className="p-5 sm:p-6 text-center bg-[#dcefd8]/30 border-l-2 border-[#14201a]">
                      {typeof r.resolvex === 'boolean' ? (
                        <span className="inline-flex w-7 h-7 rounded-full bg-[#177a43] text-white items-center justify-center font-bold shadow-xs">✓</span>
                      ) : (
                        <span className="inline-flex px-3 py-1 rounded-full bg-[#177a43] text-white text-xs font-bold shadow-xs">
                          {r.resolvex}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
