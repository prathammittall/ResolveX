'use client';

import React from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Server,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export default function HowItWorks() {
  return (
    <section id="features" className="py-20 md:py-32 bg-[#f6f4ec]">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eeebe0] border border-[#dfdbcc] text-[#14201a] text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#177a43]" /> Core Platform Pillars
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#14201a]">
            Everything your engineering team needs.{' '}
            <span className="text-[#177a43]">In one place.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5f6b64] leading-relaxed">
            From planning the next release to responding to production failures, ResolveX connects
            the entire engineering workflow into one cohesive, high-trust system.
          </p>
        </div>

        {/* 3 Large Pastel Feature Sections */}
        <div className="space-y-14 sm:space-y-20">
          {/* Pillar 1: Project Management (Soft Lavender #ede9fe / #dcd8f7) */}
          <div className="rounded-3xl border-2 border-[#14201a] bg-[#ede9fe] shadow-[6px_6px_0_#14201a] p-6 sm:p-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-5 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcd8f7] text-[#5553a8] text-xs font-bold border border-[#c4bef0]">
                  <FolderKanban className="w-3.5 h-3.5" /> 01 · Planning & Sprints
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#14201a] leading-tight">
                  Project Management with real-time operational context
                </h3>
                <p className="text-[#3d4a42] text-sm sm:text-base leading-relaxed">
                  Plan engineering sprints, manage dynamic Kanban boards, assign tickets, and collaborate
                  with teammates—without ever losing track of which services are live and healthy.
                </p>
                <ul className="space-y-2.5 pt-2 text-sm text-[#14201a] font-semibold">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#5553a8] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Customizable Kanban columns & issue types (Bugs, Tasks, Epics)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#5553a8] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Priority tags, due dates, subtask nesting, and audit history
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#5553a8] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Live production status pill embedded directly on ticket cards
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/login?tab=register" className="btn-kizupi-go text-sm px-5 py-2.5">
                    Explore Project Boards <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </div>
              </div>

              {/* Visual Showcase: Miniature Kanban Board Preview */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-[#dfdbcc] p-4 sm:p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-[#dfdbcc] mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#eeebe0] px-2 py-0.5 rounded text-[#14201a]">CORE-SPRINT-14</span>
                      <span className="text-xs font-bold text-[#14201a]">Checkout & Ingestion</span>
                    </div>
                    <span className="text-xs text-[#5f6b64] font-medium">8 tickets active</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Column 1: In Progress */}
                    <div className="bg-[#fbfaf6] p-3 rounded-xl border border-[#dfdbcc]">
                      <span className="font-bold text-[11px] text-[#5f6b64] uppercase tracking-wider block mb-2">In Progress (2)</span>
                      <div className="space-y-2">
                        <div className="bg-white p-3 rounded-xl border border-[#dfdbcc] shadow-xs">
                          <span className="font-mono text-[10px] text-[#5553a8] font-bold">PAY-104</span>
                          <p className="font-bold text-xs text-[#14201a] mt-0.5">Optimize Redis connection pool</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#dfdbcc]/50">
                            <span className="text-[10px] font-bold text-[#ea580c]">High Priority</span>
                            <span className="w-5 h-5 rounded-full bg-[#177a43] text-white text-[10px] font-bold flex items-center justify-center">S</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-[#dfdbcc] shadow-xs">
                          <span className="font-mono text-[10px] text-[#5553a8] font-bold">API-289</span>
                          <p className="font-bold text-xs text-[#14201a] mt-0.5">Add retry backoff on gateway</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#dfdbcc]/50">
                            <span className="text-[10px] font-bold text-[#d97706]">Medium</span>
                            <span className="w-5 h-5 rounded-full bg-[#5553a8] text-white text-[10px] font-bold flex items-center justify-center">D</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: In Review & Done */}
                    <div className="bg-[#fbfaf6] p-3 rounded-xl border border-[#dfdbcc]">
                      <span className="font-bold text-[11px] text-[#5f6b64] uppercase tracking-wider block mb-2">Done Today (2)</span>
                      <div className="space-y-2">
                        <div className="bg-white p-3 rounded-xl border border-[#b2e2a8] bg-[#dcefd8]/20 shadow-xs">
                          <span className="font-mono text-[10px] text-[#177a43] font-bold">RES-842</span>
                          <p className="font-bold text-xs text-[#14201a] mt-0.5">Payment gateway auto-recovery</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#dfdbcc]/50">
                            <span className="text-[10px] font-bold text-[#177a43]">Verified OK</span>
                            <span className="w-5 h-5 rounded-full bg-[#177a43] text-white text-[10px] font-bold flex items-center justify-center">A</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-[#dfdbcc] opacity-70">
                          <span className="font-mono text-[10px] text-[#5f6b64] font-bold">AUTH-91</span>
                          <p className="font-medium text-xs text-[#14201a] mt-0.5">JWT signature algorithm update</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 2: Service Monitoring (Pastel Mint #dcefd8 / #d3e8d9) */}
          <div className="rounded-3xl border-2 border-[#14201a] bg-[#dcefd8] shadow-[6px_6px_0_#14201a] p-6 sm:p-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Visual Showcase: Service Catalog Card Preview */}
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="bg-white rounded-2xl border border-[#dfdbcc] p-4 sm:p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#dfdbcc]">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-[#177a43]" />
                      <span className="font-display font-bold text-sm text-[#14201a]">Service Health Registry</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#dcefd8] text-[#177a43] text-xs font-bold border border-[#b2e2a8]">
                      4 Services Monitored
                    </span>
                  </div>

                  {/* Service 1 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#fbfaf6] border border-[#dfdbcc]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#14201a]">payments-checkout-api</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#eeebe0] text-[10px] font-semibold text-[#5f6b64]">Production</span>
                      </div>
                      <span className="text-[11px] text-[#5f6b64]">Owner: Payments Team · 24ms avg latency</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#dcefd8] text-[#177a43] text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  </div>

                  {/* Service 2 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#fbfaf6] border border-[#dfdbcc]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#14201a]">auth-oauth2-service</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#eeebe0] text-[10px] font-semibold text-[#5f6b64]">Production</span>
                      </div>
                      <span className="text-[11px] text-[#5f6b64]">Owner: Security Core · 12ms avg latency</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#dcefd8] text-[#177a43] text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  </div>

                  {/* Service 3 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#fbfaf6] border border-[#dfdbcc]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#14201a]">notification-worker-queue</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#eeebe0] text-[10px] font-semibold text-[#5f6b64]">Staging</span>
                      </div>
                      <span className="text-[11px] text-[#5f6b64]">Owner: Platform Infra · 104ms</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-xs font-bold flex items-center gap-1.5">
                      Degraded
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c2e4bd] text-[#177a43] text-xs font-bold border border-[#a6d89f]">
                  <Activity className="w-3.5 h-3.5" /> 02 · Health & Telemetry
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#14201a] leading-tight">
                  Service Monitoring that maps endpoints to owners
                </h3>
                <p className="text-[#3d4a42] text-sm sm:text-base leading-relaxed">
                  Register internal microservices, monitor public and private API endpoints, track
                  p95 latency, and identify service degradation before customers notice.
                </p>
                <ul className="space-y-2.5 pt-2 text-sm text-[#14201a] font-semibold">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#177a43] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Multi-region edge polling with customizable interval thresholds
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#177a43] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Native service ownership mapping (team, repo, on-call contact)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#177a43] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Instant webhook ingestion for Datadog, CloudWatch, and Grafana
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/login?tab=register" className="btn-kizupi-go text-sm px-5 py-2.5">
                    Start Monitoring Services <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Automated Incident Response (Muted Peach #faefe3 / #f5d5c4) */}
          <div className="rounded-3xl border-2 border-[#14201a] bg-[#faefe3] shadow-[6px_6px_0_#14201a] p-6 sm:p-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-5 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5d5c4] text-[#9a3412] text-xs font-bold border border-[#ecc4b0]">
                  <AlertTriangle className="w-3.5 h-3.5" /> 03 · Autonomous Response
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#14201a] leading-tight">
                  Automated Incident Creation with zero alert fatigue
                </h3>
                <p className="text-[#3d4a42] text-sm sm:text-base leading-relaxed">
                  When services fail verification thresholds, ResolveX automatically creates an incident,
                  notifies the exact service owner, and links a triage ticket into the active sprint.
                </p>
                <ul className="space-y-2.5 pt-2 text-sm text-[#14201a] font-semibold">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ea580c] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Smart deduplication collapses thousands of error bursts into 1 incident
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ea580c] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Auto-escalates to backup responders if unacknowledged in 15 minutes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ea580c] text-white flex items-center justify-center text-xs font-bold">✓</span>
                    Continuous recovery checks automatically confirm operational restoration
                  </li>
                </ul>
                <div className="pt-4">
                  <Link href="/login?tab=register" className="btn-kizupi-go text-sm px-5 py-2.5">
                    See Incident Workflows <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </div>
              </div>

              {/* Visual Showcase: Incident Room Timeline Preview */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-[#dfdbcc] p-4 sm:p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#dfdbcc]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5] text-xs font-bold">
                        SEV1 INCIDENT
                      </span>
                      <span className="font-bold text-xs text-[#14201a]">#INC-1042 · Payments Timeout</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#177a43] bg-[#dcefd8] px-2 py-0.5 rounded-full">
                      Auto-Created
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-[#fbfaf6] border border-[#dfdbcc]">
                      <div className="flex items-center justify-between text-[#5f6b64]">
                        <span className="font-bold text-[#14201a]">14:42:10 · Failure Verification</span>
                        <span>2m ago</span>
                      </div>
                      <p className="text-[#3d4a42] mt-1">3 edge probes reported consecutive 500 status codes. Threshold exceeded.</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#fbfaf6] border border-[#dfdbcc]">
                      <div className="flex items-center justify-between text-[#5f6b64]">
                        <span className="font-bold text-[#14201a]">14:42:12 · Service Owner Notified</span>
                        <span>1m ago</span>
                      </div>
                      <p className="text-[#3d4a42] mt-1">Direct alert dispatched to @sarah-devops (Payments Core lead).</p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#dcefd8]/40 border border-[#b2e2a8]">
                      <div className="flex items-center justify-between text-[#177a43]">
                        <span className="font-bold text-[#15803d]">14:42:15 · Sprint Ticket Synced</span>
                        <span>Just now</span>
                      </div>
                      <p className="text-[#14201a] font-medium mt-1">Linked ticket PAY-842 automatically added to active Sprint 14 board.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
