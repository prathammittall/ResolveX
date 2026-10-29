'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Bot,
  Activity,
  Layers,
  ArrowRight,
  Terminal,
  CheckCircle2,
  Clock,
  Zap,
  Globe2,
  GitPullRequest,
  Check,
  SlidersHorizontal
} from 'lucide-react';

const FeatureDeepDive = () => {
  const [activeTab, setActiveTab] = useState<'ai' | 'monitor' | 'workflow'>('ai');

  return (
    <section id="features" className="py-24 sm:py-32 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Full-Spectrum Operations Platform
          </div>
          <h2 className="font-serif-title text-3xl sm:text-5xl font-normal text-slate-900 tracking-tight leading-[1.15]">
            Engineered to eliminate chaos between code and production.
          </h2>
          <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">
            Stop juggling fragmented dashboards. ResolveX consolidates monitoring, on-call schedules,
            and task management into one cohesive operational cockpit.
          </p>

          {/* Interactive Tab Switcher */}
          <div className="mt-8 inline-flex p-1.5 rounded-xl bg-slate-200/60 border border-slate-300/60 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'ai'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AI Root-Cause Analysis
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'monitor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Continuous API Telemetry
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'workflow'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Synchronized Workflows
            </button>
          </div>
        </div>

        {/* Tab Content 1: AI Root Cause Analysis */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-5 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="font-serif-title text-2xl sm:text-3xl text-slate-900 font-normal">
                Autonomous Incident Diagnosis in under 30 seconds.
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                When an anomaly spikes, ResolveX correlates telemetry across your stack,
                scans recent git commits, and isolates the offending deployment with suggested rollback recipes.
              </p>
              <ul className="space-y-3 pt-2 text-sm text-slate-700">
                {[
                  'Instant correlation with recent PRs and infrastructure config diffs',
                  'Noise suppression filters out 80% of secondary alerts',
                  'Automated Slack / Microsoft Teams war room generation',
                  'One-click remediation scripts and rollback approvals',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-5 text-slate-200 font-mono text-xs shadow-2xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-slate-400 ml-2">resolvex-ai-agent --diagnose</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  AUTO-TRIAGE ACTIVE
                </span>
              </div>
              <div className="space-y-2 text-slate-300">
                <p className="text-slate-400">
                  [19:42:01.120] <span className="text-amber-400">ALERT TRIGGERED:</span> Endpoint /api/v2/checkout 504 Gateway Timeout spike (9.4% errors)
                </p>
                <p className="text-blue-400">
                  [19:42:01.840] Correlating deployment event: commit #f8a10d ("Update stripe retry policy")
                </p>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg my-2">
                  <span className="text-xs font-semibold text-emerald-300">
                    💡 AI Root Cause Recommendation:
                  </span>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Database connection pool exhaustion caused by unclosed cursor in <span className="text-amber-300">checkout_controller.go:142</span>.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Suggested Action: Rollback to deployment v3.8.2 or apply hotfix patch PR #412.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Assigned: @sarah-sre (Lead On-Call)</span>
                  <span className="text-emerald-400">MTTR Saved: ~32 mins</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Continuous Telemetry */}
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-5 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif-title text-2xl sm:text-3xl text-slate-900 font-normal">
                Global Synthetic Probes with Real-time SLA tracking.
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Execute automated HTTP, gRPC, and browser checks every 10 seconds across 18 edge locations. Detect degradations before your users do.
              </p>
              <ul className="space-y-3 pt-2 text-sm text-slate-700">
                {[
                  'Sub-second alerting on p95 and p99 latency regressions',
                  'Multi-step user journey synthetic test automation',
                  'Multi-cloud health verification (AWS, GCP, Azure, Cloudflare)',
                  'Public and private status pages with custom branding',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">
                  Global Probing Network Latency
                </span>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded border border-emerald-200">
                  18/18 Regions Operational
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { region: 'US East (N. Virginia)', latency: '12ms', status: 'Healthy', bar: 'w-[15%]' },
                  { region: 'EU West (Frankfurt)', latency: '18ms', status: 'Healthy', bar: 'w-[22%]' },
                  { region: 'AP Southeast (Singapore)', latency: '42ms', status: 'Healthy', bar: 'w-[45%]' },
                  { region: 'SA East (São Paulo)', latency: '58ms', status: 'Healthy', bar: 'w-[60%]' },
                ].map((row, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.region}</span>
                      <span className="text-slate-500 font-mono">{row.latency}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-sky-500 rounded-full ${row.bar}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Synchronized Workflows */}
        {activeTab === 'workflow' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-5 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-serif-title text-2xl sm:text-3xl text-slate-900 font-normal">
                Seamless Bridge between Sprint Tasks and Live Incidents.
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Connect your sprint board directly to your live production incidents. Every post-mortem item becomes a prioritized engineering task with full telemetry context.
              </p>
              <ul className="space-y-3 pt-2 text-sm text-slate-700">
                {[
                  'Bi-directional sync with GitHub Issues, Linear, and Jira',
                  'Automatic resolution of alerts when corresponding fix is deployed',
                  'Service dependency mapping with clear ownership tags',
                  'Developer on-call fairness metrics and handover reports',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 bg-[#fbfcfd] rounded-2xl p-5 border border-slate-200 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-800">
                  Sprint Board ↔ Incident Backlog
                </span>
                <span className="text-xs text-indigo-600 font-medium">Sprint 24 (Live)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Incident Action Item
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Fix DB Pool Max Limit
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                      P1 - Blocker
                    </span>
                    <span>Assigned to @dan</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Deployment Pipeline
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Auto-Canary Rollout
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                      Success 100%
                    </span>
                    <span>Commit #9a20</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeatureDeepDive;
