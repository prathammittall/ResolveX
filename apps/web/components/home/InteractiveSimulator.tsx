'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';

type SimPhase = 'healthy' | 'probing' | 'verified' | 'incident' | 'escalated' | 'resolved';

export default function InteractiveSimulator() {
  const [phase, setPhase] = useState<SimPhase>('healthy');
  const [failureCount, setFailureCount] = useState<number>(0);
  const [autoMitigating, setAutoMitigating] = useState(false);

  const simulateFailure = () => {
    setPhase('probing');
    setFailureCount(1);
    setTimeout(() => {
      setFailureCount(2);
      setTimeout(() => {
        setFailureCount(3);
        setPhase('verified');
        setTimeout(() => {
          setPhase('incident');
          setTimeout(() => {
            setPhase('escalated');
          }, 1200);
        }, 1200);
      }, 900);
    }, 900);
  };

  const simulateRecovery = () => {
    setAutoMitigating(true);
    setTimeout(() => {
      setPhase('resolved');
      setFailureCount(0);
      setAutoMitigating(false);
    }, 1200);
  };

  const resetToHealthy = () => {
    setPhase('healthy');
    setFailureCount(0);
  };

  const rungs = [
    { id: 'healthy', label: 'Continuous Polling' },
    { id: 'probing', label: 'Consecutive Failures' },
    { id: 'verified', label: 'Cross-Region Verification' },
    { id: 'incident', label: 'Auto-Incident Generated' },
    { id: 'escalated', label: 'Owner Notified' },
    { id: 'resolved', label: 'SLA Restored' },
  ];

  const currentStepIndex =
    phase === 'healthy'
      ? 0
      : phase === 'probing'
        ? 1
        : phase === 'verified'
          ? 2
          : phase === 'incident'
            ? 3
            : phase === 'escalated'
              ? 4
              : 5;

  return (
    <section id="demo" className="py-20 md:py-28 bg-[#111914] text-[#e7eee9] relative overflow-hidden">
      {/* Decorative background dither */}
      <div className="absolute inset-0 opacity-5 pointer-events-none dither-band" />

      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a251e] border border-[#2a372f] text-[#c6f36b] text-xs font-bold uppercase tracking-wider mb-3">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Verification Engine
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            It doesn’t just detect problems.{' '}
            <span className="text-[#c6f36b]">It connects the dots.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#a5b5ab] leading-relaxed">
            From repeated 500 status codes at the edge to verified outage tickets in your sprint board.
            Try the interactive simulator below to see how ResolveX eliminates false alarms.
          </p>
        </div>

        {/* The Interactive Ladder Card (inspired by Kizupi's .try-card) */}
        <div className="bg-white text-[#14201a] rounded-3xl p-6 sm:p-10 border-2 border-[#14201a] shadow-[6px_6px_0_#000] relative">
          {/* Step Ladder Rungs Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#dfdbcc] gap-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#177a43] animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#5f6b64]">
                Phase {currentStepIndex + 1} of 6:
              </span>
              <span className="text-sm font-extrabold text-[#14201a]">
                {rungs[currentStepIndex]?.label}
              </span>
            </div>

            {/* Rung pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {rungs.map((r, i) => (
                <div
                  key={r.id}
                  title={r.label}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i <= currentStepIndex
                      ? 'w-7 bg-[#177a43]'
                      : 'w-2.5 bg-[#dfdbcc]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Interactive Simulation Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-8 items-start">
            {/* Left: Endpoint Monitor Preview */}
            <div className="lg:col-span-6 bg-[#fbfaf6] rounded-2xl border border-[#dfdbcc] p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#dfdbcc] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#177a43]" />
                  <span className="text-xs font-bold text-[#14201a]">payments-checkout-service</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    phase === 'healthy' || phase === 'resolved'
                      ? 'bg-[#dcefd8] text-[#177a43] border-[#b2e2a8]'
                      : 'bg-[#fee2e2] text-[#dc2626] border-[#fecaca]'
                  }`}
                >
                  {phase === 'healthy' || phase === 'resolved' ? '200 OK' : '500 ERROR'}
                </span>
              </div>

              {/* Endpoint URL */}
              <div className="font-mono text-xs bg-[#eeebe0] p-2.5 rounded-xl border border-[#dfdbcc] mb-4 flex items-center justify-between">
                <span className="text-[#3d4a42] font-semibold">POST /v1/payments/charge</span>
                <span className={phase === 'healthy' || phase === 'resolved' ? 'text-[#177a43] font-bold' : 'text-[#dc2626] font-bold'}>
                  {phase === 'healthy' || phase === 'resolved' ? '24ms latency' : '1,840ms timeout'}
                </span>
              </div>

              {/* Edge Probes Telemetry */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#dfdbcc]/70">
                  <span className="flex items-center gap-1.5 font-medium text-[#3d4a42]">
                    <Globe className="w-3.5 h-3.5 text-[#5f6b64]" /> US-East (Virginia)
                  </span>
                  <span className="font-mono font-bold text-[#14201a]">
                    {phase === 'healthy' || phase === 'resolved' ? '200 OK (18ms)' : '500 Internal Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#dfdbcc]/70">
                  <span className="flex items-center gap-1.5 font-medium text-[#3d4a42]">
                    <Globe className="w-3.5 h-3.5 text-[#5f6b64]" /> EU-Central (Frankfurt)
                  </span>
                  <span className="font-mono font-bold text-[#14201a]">
                    {phase === 'healthy' || phase === 'resolved' ? '200 OK (28ms)' : '500 Gateway Hang'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#dfdbcc]/70">
                  <span className="flex items-center gap-1.5 font-medium text-[#3d4a42]">
                    <Globe className="w-3.5 h-3.5 text-[#5f6b64]" /> AP-South (Mumbai)
                  </span>
                  <span className="font-mono font-bold text-[#14201a]">
                    {phase === 'healthy' || phase === 'resolved' ? '200 OK (32ms)' : 'Connection Timeout'}
                  </span>
                </div>
              </div>

              {/* Status bar */}
              <div className="mt-4 pt-3 border-t border-[#dfdbcc] flex items-center justify-between text-[11px] text-[#5f6b64]">
                <span>Consecutive Failures: <strong className="text-[#14201a]">{failureCount} / 3</strong></span>
                <span>Threshold: <strong>3 in 60s</strong></span>
              </div>
            </div>

            {/* Right: Automated Actions & Linked Kanban Ticket */}
            <div className="lg:col-span-6 space-y-4">
              {/* Incident Alert Pill */}
              <div
                className={`p-4 rounded-2xl border transition-all duration-300 ${
                  currentStepIndex >= 3
                    ? 'bg-[#fee2e2] border-[#f87171] shadow-xs'
                    : 'bg-[#fbfaf6] border-[#dfdbcc] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`w-4 h-4 ${currentStepIndex >= 3 ? 'text-[#dc2626]' : 'text-[#5f6b64]'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#14201a]">
                      Incident #INC-1042
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#dc2626] text-white text-[10px] font-extrabold uppercase">
                    SEV1 Outage
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[#14201a]">
                  Checkout Gateway Cluster Failing Cross-Region
                </p>
                <p className="mt-1 text-[11px] text-[#5f6b64]">
                  Automated verification confirmed 3 consecutive failed probes from 3 edge regions.
                </p>
              </div>

              {/* Service Owner Routing */}
              <div
                className={`p-4 rounded-2xl border transition-all duration-300 ${
                  currentStepIndex >= 4
                    ? 'bg-[#dcefd8] border-[#b2e2a8] shadow-xs'
                    : 'bg-[#fbfaf6] border-[#dfdbcc] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#177a43]" />
                    <span className="text-xs font-bold text-[#14201a]">On-Call Responder Notified</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#177a43]">Slack + Pager Alert</span>
                </div>
                <p className="mt-1 text-xs text-[#3d4a42]">
                  Routed directly to registered service owner: <strong>@sarah-devops</strong> (Payments Team)
                </p>
              </div>

              {/* Linked Sprint Task Card */}
              <div
                className={`p-4 rounded-2xl border transition-all duration-300 ${
                  currentStepIndex >= 3
                    ? 'bg-white border-[#14201a] shadow-[3px_3px_0_#14201a]'
                    : 'bg-[#fbfaf6] border-[#dfdbcc] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#14201a]">PAY-842</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      phase === 'resolved'
                        ? 'bg-[#dcefd8] text-[#177a43]'
                        : 'bg-[#fef3c7] text-[#92400e]'
                    }`}
                  >
                    {phase === 'resolved' ? 'Done' : 'In Progress'}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-[#14201a]">
                  Investigate Payment Gateway 500 Spike
                </p>
                <p className="mt-0.5 text-xs text-[#5f6b64]">
                  Linked automatically from incident #INC-1042 · Sprint 14
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Action Chips (Buttons like Kizupi) */}
          <div className="pt-6 border-t border-[#dfdbcc] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={simulateFailure}
                disabled={phase !== 'healthy' && phase !== 'resolved'}
                className="btn-kizupi-ink text-xs sm:text-sm px-4 py-2.5 cursor-pointer disabled:opacity-40"
              >
                <Flame className="w-4 h-4 mr-1.5 text-[#ff7a2f]" />
                Trigger API 500 Outage
              </button>

              <button
                type="button"
                onClick={simulateRecovery}
                disabled={currentStepIndex < 3 || phase === 'resolved' || autoMitigating}
                className="btn-kizupi-go text-xs sm:text-sm px-4 py-2.5 cursor-pointer disabled:opacity-40"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5 text-white" />
                {autoMitigating ? 'Verifying Hotfix...' : 'Deploy Hotfix & Verify'}
              </button>

              <button
                type="button"
                onClick={resetToHealthy}
                className="btn-kizupi-white text-xs sm:text-sm px-4 py-2.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-[#5f6b64]" />
                Reset Simulator
              </button>
            </div>

            <p className="text-xs text-[#5f6b64] font-medium">
              Self-contained demonstration. Does not alter production services.
            </p>
          </div>
        </div>

        {/* 3 Feature Notes at the Bottom with Colored Icon Tiles (just like Kizupi ladder-notes) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#1a251e] border border-[#2a372f]">
            <div className="w-10 h-10 rounded-xl bg-[#ffb930] text-[#14201a] flex items-center justify-center shrink-0 font-bold shadow-[0_2px_0_#d38a00]">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Consecutive Probing Checks</h3>
              <p className="mt-1 text-sm text-[#a5b5ab] leading-relaxed">
                Transient blips are rejected. We verify consecutive failures across distributed edge nodes before escalating.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#1a251e] border border-[#2a372f]">
            <div className="w-10 h-10 rounded-xl bg-[#c6f36b] text-[#14201a] flex items-center justify-center shrink-0 font-bold shadow-[0_2px_0_#9bcb3c]">
              <Zap className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Owner-Based Smart Routing</h3>
              <p className="mt-1 text-sm text-[#a5b5ab] leading-relaxed">
                Incidents are mapped to exact service catalogs. The engineer who owns the repo is alerted directly.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#1a251e] border border-[#2a372f]">
            <div className="w-10 h-10 rounded-xl bg-[#ff7a2f] text-white flex items-center justify-center shrink-0 font-bold shadow-[0_2px_0_#d05612]">
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Bi-Directional Board Sync</h3>
              <p className="mt-1 text-sm text-[#a5b5ab] leading-relaxed">
                A linked task lands in your team’s active sprint board. When the service recovers, the ticket is marked resolved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
