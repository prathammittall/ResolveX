'use client';

import React from 'react';
import {
  FolderKanban,
  Server,
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Radio,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';

export default function FeaturesGrid() {
  return (
    <section className="py-20 md:py-32 bg-[#eeebe0]/60 border-t border-[#dfdbcc]">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#dfdbcc] text-[#14201a] text-xs font-bold uppercase tracking-wider mb-3">
            <Layers className="w-3.5 h-3.5 text-[#177a43]" /> Unified Engineering Stack
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#14201a]">
            Designed for the way <span className="text-[#177a43]">engineering teams work.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5f6b64] leading-relaxed">
            Four specialized operational capabilities unified into a single responsive interface.
          </p>
        </div>

        {/* 4 Distinct Showcase Compositions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {/* Card 1: Kanban Workflows */}
          <div className="rounded-3xl border border-[#dfdbcc] bg-white p-7 shadow-[0_3px_0_#dfdbcc] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-[#ede9fe] text-[#6d28d9]">
                  <FolderKanban className="w-5 h-5" />
                </span>
                <span className="text-xs font-mono font-bold text-[#5f6b64]">PROJECTS & SPRINTS</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#14201a]">
                Frictionless Kanban & Backlog Management
              </h3>
              <p className="mt-2 text-sm text-[#5f6b64] leading-relaxed">
                Organize Epics, Stories, Tasks, and Bugs with customizable columns, drag-and-drop movement,
                assignee avatars, and multi-tenant isolation.
              </p>
            </div>

            {/* Micro Mockup inside Card 1 */}
            <div className="mt-6 p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfdbcc]">
                <span className="font-bold text-[#14201a]">Core Platform Board</span>
                <span className="text-[11px] text-[#5f6b64]">Sprint 14</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfdbcc] shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#5f6b64] font-bold">CORE-12</span>
                  <span className="font-semibold text-[#14201a]">Migrate Postgres read pool</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-bold">In Review</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfdbcc] shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#5f6b64] font-bold">CORE-19</span>
                  <span className="font-semibold text-[#14201a]">Configure canary deploy gate</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#dcefd8] text-[#177a43] text-[10px] font-bold">Done</span>
              </div>
            </div>
          </div>

          {/* Card 2: Service Catalog */}
          <div className="rounded-3xl border border-[#dfdbcc] bg-white p-7 shadow-[0_3px_0_#dfdbcc] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-[#dcefd8] text-[#177a43]">
                  <Server className="w-5 h-5" />
                </span>
                <span className="text-xs font-mono font-bold text-[#5f6b64]">SERVICE REPOSITORY</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#14201a]">
                Living Service Catalog & Ownership Registry
              </h3>
              <p className="mt-2 text-sm text-[#5f6b64] leading-relaxed">
                Know who owns what. Every microservice, background worker, and database has an assigned
                engineering team, runbook, criticality level, and environment tag.
              </p>
            </div>

            {/* Micro Mockup inside Card 2 */}
            <div className="mt-6 p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfdbcc]">
                <span className="font-bold text-[#14201a]">Registered Catalog</span>
                <span className="text-[11px] text-[#177a43] font-bold">100% Owner Coverage</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfdbcc] shadow-xs">
                <div>
                  <span className="font-bold text-[#14201a] block">auth-identity-svc</span>
                  <span className="text-[10px] text-[#5f6b64]">Owner: Security Core · Production</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#dcefd8] text-[#177a43] text-[10px] font-bold">Critical (Tier 1)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfdbcc] shadow-xs">
                <div>
                  <span className="font-bold text-[#14201a] block">email-dispatcher</span>
                  <span className="text-[10px] text-[#5f6b64]">Owner: Comms Team · Staging</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] text-[10px] font-bold">Medium (Tier 3)</span>
              </div>
            </div>
          </div>

          {/* Card 3: API Monitoring */}
          <div className="rounded-3xl border border-[#dfdbcc] bg-white p-7 shadow-[0_3px_0_#dfdbcc] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-[#e0f2fe] text-[#0369a1]">
                  <Activity className="w-5 h-5" />
                </span>
                <span className="text-xs font-mono font-bold text-[#5f6b64]">API TELEMETRY</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#14201a]">
                Global Endpoint Health & Latency Distribution
              </h3>
              <p className="mt-2 text-sm text-[#5f6b64] leading-relaxed">
                Monitor HTTP status codes, response headers, SSL cert expiration, and p99 latency
                from distributed global checkpoints every 30 or 60 seconds.
              </p>
            </div>

            {/* Micro Mockup inside Card 3 */}
            <div className="mt-6 p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfdbcc]">
                <span className="font-mono text-[11px] text-[#14201a] font-bold">GET /api/v1/health</span>
                <span className="text-[11px] text-[#177a43] font-bold">99.98% Uptime</span>
              </div>
              <div className="flex items-center justify-between text-[#5f6b64] text-[11px]">
                <span>Response Time: <strong className="text-[#14201a]">22ms</strong></span>
                <span>Checked: <strong className="text-[#14201a]">12s ago</strong></span>
              </div>
              {/* Latency mini sparkline blocks */}
              <div className="grid grid-cols-12 gap-1 pt-1">
                {[20, 24, 18, 22, 28, 25, 19, 23, 21, 24, 26, 22].map((ms, i) => (
                  <div key={i} className="h-6 rounded bg-[#dcefd8] border border-[#b2e2a8] flex items-end justify-center">
                    <div className="w-full bg-[#177a43] rounded-b" style={{ height: `${(ms / 30) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Incident Lifecycle */}
          <div className="rounded-3xl border border-[#dfdbcc] bg-white p-7 shadow-[0_3px_0_#dfdbcc] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="p-2.5 rounded-xl bg-[#fee2e2] text-[#dc2626]">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <span className="text-xs font-mono font-bold text-[#5f6b64]">INCIDENT BRIDGE</span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#14201a]">
                Automated Incident Rooms & Task Sync
              </h3>
              <p className="mt-2 text-sm text-[#5f6b64] leading-relaxed">
                When repeated outages strike, ResolveX generates an incident room, records event timelines,
                notifies responders, and automatically creates linked sprint tasks.
              </p>
            </div>

            {/* Micro Mockup inside Card 4 */}
            <div className="mt-6 p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfdbcc]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                  <span className="font-bold text-[#14201a]">Incident #INC-94</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626] text-[10px] font-bold">Investigating</span>
              </div>
              <div className="flex items-center justify-between text-[#3d4a42]">
                <span>Assigned Responder: <strong>Sarah Chen</strong></span>
                <span className="text-[11px] text-[#5f6b64]">Ack in 2m</span>
              </div>
              <div className="p-2 rounded-xl bg-[#dcefd8]/40 border border-[#b2e2a8] text-[11px] font-medium text-[#15803d]">
                Linked Sprint Ticket: PAY-104 (In Progress)
              </div>
            </div>
          </div>
        </div>

        {/* Smart Alerting Section (Phase 4.F) */}
        <div className="rounded-3xl border-2 border-[#14201a] bg-white shadow-[6px_6px_0_#14201a] p-8 sm:p-14">
          <div className="max-w-3xl mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#177a43] bg-[#dcefd8] px-3 py-1 rounded-full border border-[#b2e2a8]">
              Zero-Noise Pipeline
            </span>
            <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#14201a] mt-3">
              Less alert noise. More meaningful action.
            </h3>
            <p className="mt-2 text-base text-[#5f6b64] leading-relaxed">
              ResolveX verifies failures, groups repeated events, and routes incidents directly to the
              engineers responsible for fixing them.
            </p>
          </div>

          {/* Alert Verification Pipeline Workflow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#eeebe0] text-[#14201a] font-bold text-xs flex items-center justify-center">1</span>
              <h4 className="font-bold text-sm text-[#14201a]">Consecutive Verification</h4>
              <p className="text-xs text-[#5f6b64]">Requires N consecutive failures across distinct edge nodes before alerting.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#eeebe0] text-[#14201a] font-bold text-xs flex items-center justify-center">2</span>
              <h4 className="font-bold text-sm text-[#14201a]">Smart Deduplication</h4>
              <p className="text-xs text-[#5f6b64]">Merges hundreds of rapid failure webhooks into a single grouped incident.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#eeebe0] text-[#14201a] font-bold text-xs flex items-center justify-center">3</span>
              <h4 className="font-bold text-sm text-[#14201a]">Owner-Based Routing</h4>
              <p className="text-xs text-[#5f6b64]">Dispatches alarms directly to the catalog service owner via Slack and webhooks.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#fbfaf6] border border-[#dfdbcc] space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#eeebe0] text-[#14201a] font-bold text-xs flex items-center justify-center">4</span>
              <h4 className="font-bold text-sm text-[#14201a]">Backup Escalation</h4>
              <p className="text-xs text-[#5f6b64]">Escalates to secondary responders if unacknowledged within SLA window.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#dcefd8] border border-[#b2e2a8] space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#177a43] text-white font-bold text-xs flex items-center justify-center">5</span>
              <h4 className="font-bold text-sm text-[#14201a]">Recovery Confirmation</h4>
              <p className="text-xs text-[#3d4a42]">Verifies 3 consecutive healthy probes before auto-mitigating the incident.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
