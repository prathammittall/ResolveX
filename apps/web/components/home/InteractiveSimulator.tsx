'use client';

import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  GitPullRequest,
  Activity,
  Terminal,
  Kanban,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

type Scenario = 'payment' | 'auth' | 'db';
type SimState = 'idle' | 'outage' | 'diagnosed' | 'canary' | 'resolved';

interface ScenarioInfo {
  id: Scenario;
  title: string;
  endpoint: string;
  service: string;
  errorStatus: string;
  errorLatency: string;
  rootCause: string;
  fixCommit: string;
  author: string;
}

const scenarios: Record<Scenario, ScenarioInfo> = {
  payment: {
    id: 'payment',
    title: 'Payment Gateway 502 Spike',
    endpoint: 'POST /v1/charges',
    service: 'payment-api',
    errorStatus: '502 Bad Gateway',
    errorLatency: '1,420ms',
    rootCause: 'Connection timeout with upstream acquirer webhook',
    fixCommit: 'fix(pay): add retry backoff and circuit breaker #482',
    author: 'Sarah Chen (Senior SRE)',
  },
  auth: {
    id: 'auth',
    title: 'Auth Service P99 Latency Anomaly',
    endpoint: 'POST /v1/oauth/token',
    service: 'auth-service',
    errorStatus: '504 Gateway Timeout',
    errorLatency: '2,890ms',
    rootCause: 'Redis token cache eviction storm under peak load',
    fixCommit: 'perf(auth): tune redis TTL and connection pool #319',
    author: 'Alex Rivera (Backend Lead)',
  },
  db: {
    id: 'db',
    title: 'PostgreSQL Read-Replica Lag Outage',
    endpoint: 'GET /v1/workspaces',
    service: 'db-replica-cluster',
    errorStatus: '500 Internal Server Error',
    errorLatency: '4,100ms',
    rootCause: 'WAL replication slot stalled by unindexed migration',
    fixCommit: 'fix(db): add partial index on organization_id and restart slot #194',
    author: 'Dmitri Volkov (Principal Infra)',
  },
};

export default function InteractiveSimulator() {
  const { isDark } = useTheme();
  const [selectedScenario, setSelectedScenario] = useState<Scenario>('payment');
  const [simState, setSimState] = useState<SimState>('idle');
  const [canaryStep, setCanaryStep] = useState<number>(0);

  const current = scenarios[selectedScenario];

  const [logs, setLogs] = useState<string[]>([
    `[14:40:01] PROBE-US-EAST   GET ${current.endpoint} -> 200 OK (22ms)`,
    `[14:40:06] PROBE-EU-CENT   GET ${current.endpoint} -> 200 OK (31ms)`,
    `[14:40:11] PROBE-AP-SOUTH  GET ${current.endpoint} -> 200 OK (28ms)`,
    `[14:40:16] HEALTH CHECK:   All 12 edge probes reporting nominal SLA (99.99%)`,
  ]);

  // Handle Outage Trigger
  const triggerOutage = () => {
    setSimState('outage');
    const now = new Date().toTimeString().split(' ')[0];

    setLogs((prev) => [
      `[${now}] 🚨 PROBE ALERT    POST ${current.endpoint} -> ${current.errorStatus} (${current.errorLatency})`,
      `[${now}] ⚡ SYNTHESIS      Auto-generating incident card on Kanban board: RES-1082`,
      `[${now}] 🤖 AI ROOT CAUSE  Identified regression: ${current.rootCause}`,
      ...prev.slice(0, 4),
    ]);

    setTimeout(() => {
      setSimState('diagnosed');
    }, 1200);
  };

  // Handle Deploy Fix & Canary Verification
  const deployFix = () => {
    setSimState('canary');
    setCanaryStep(1);
    const now = new Date().toTimeString().split(' ')[0];

    setLogs((prev) => [
      `[${now}] 🚀 DEPLOY WEBHOOK Remediated PR merged: ${current.fixCommit}`,
      `[${now}] 🔍 CANARY START   Firing automated 3-stage multi-region canary checks...`,
      ...prev,
    ]);

    setTimeout(() => {
      setCanaryStep(2);
      const now2 = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        `[${now2}] 🟢 CANARY CHECK 1/3 PASSED (US-EAST 200 OK · 24ms)`,
        `[${now2}] 🟢 CANARY CHECK 2/3 PASSED (EU-CENT 200 OK · 32ms)`,
        ...prev,
      ]);
    }, 1200);

    setTimeout(() => {
      setCanaryStep(3);
      setSimState('resolved');
      const now3 = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        `[${now3}] 🟢 CANARY CHECK 3/3 PASSED (AP-SOUTH 200 OK · 26ms)`,
        `[${now3}] ✅ AUTO-RESOLVE   Telemetry fully restored. Moving RES-1082 to Done.`,
        `[${now3}] 🔒 INCIDENT RETRO Auto-archived root metrics to sprint retrospective.`,
        ...prev,
      ]);
    }, 2400);
  };

  const resetSimulator = () => {
    setSimState('idle');
    setCanaryStep(0);
    setLogs([
      `[14:40:01] PROBE-US-EAST   GET ${current.endpoint} -> 200 OK (22ms)`,
      `[14:40:06] PROBE-EU-CENT   GET ${current.endpoint} -> 200 OK (31ms)`,
      `[14:40:11] PROBE-AP-SOUTH  GET ${current.endpoint} -> 200 OK (28ms)`,
      `[14:40:16] HEALTH CHECK:   All 12 edge probes reporting nominal SLA (99.99%)`,
    ]);
  };

  return (
    <section
      id="simulator"
      className={`w-full py-24 sm:py-32 transition-colors duration-300 relative overflow-hidden border-t ${
        isDark ? 'bg-[#08080a] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
      }`}
    >
      {/* Background ambient radial glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[550px] -z-10 opacity-25"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.12) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Flame className="w-3.5 h-3.5 text-[#ff5414]" />
            Interactive Incident Sandbox
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-[50px] tracking-tight uppercase leading-[1.08] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Test Drive the{' '}
            <span className="text-[#ff5414]">Auto-Resolution Loop</span>
          </h2>

          <p className={`mt-4 text-base sm:text-lg leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            Click below to trigger a live production failure. Watch ResolveX detect the anomaly, link the root-cause commit, auto-assign a Kanban card, and verify recovery without human intervention.
          </p>
        </div>

        {/* Controls Bar: Scenario Tabs + Action Triggers */}
        <div className={`border rounded-2xl p-4 sm:p-5 mb-8 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-5 ${
          isDark ? 'bg-[#111218] border-zinc-800/80' : 'bg-[#eedccb] border-[#cbbaa9]'
        }`}>
          {/* Scenario Selector */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className={`text-xs font-mono uppercase mr-2 ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Scenario:</span>
            {(['payment', 'auth', 'db'] as Scenario[]).map((scKey) => {
              const sc = scenarios[scKey];
              const isSelected = selectedScenario === scKey;
              return (
                <button
                  key={scKey}
                  onClick={() => setSelectedScenario(scKey)}
                  className={`text-xs font-medium px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-[#1e202b] text-white border border-orange-500/50 shadow-[0_0_15px_rgba(255,84,20,0.15)]'
                        : 'bg-[#171a1f] text-white shadow-sm'
                      : isDark
                        ? 'text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800'
                        : 'text-[#4a4239] hover:text-black bg-[#dfcebe] hover:bg-[#d5c2b0] border border-[#cbbaa9]'
                  }`}
                >
                  {sc.title}
                </button>
              );
            })}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {simState === 'idle' && (
              <button
                onClick={triggerOutage}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 via-[#ff5414] to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold text-xs uppercase tracking-wide px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(255,84,20,0.35)] active:scale-95 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Simulate Outage</span>
              </button>
            )}

            {(simState === 'outage' || simState === 'diagnosed') && (
              <button
                onClick={deployFix}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wide px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <GitPullRequest className="w-4 h-4" />
                <span>Deploy Fix & Canary Check</span>
              </button>
            )}

            {simState === 'canary' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs font-mono font-medium animate-pulse">
                <Activity className="w-4 h-4 animate-spin" />
                <span>Verifying Canary Probes ({canaryStep}/3)...</span>
              </div>
            )}

            {simState === 'resolved' && (
              <button
                onClick={resetSimulator}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 font-medium text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-[#171a1f] hover:bg-black text-white'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-300" />
                <span>Reset Simulation</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Cockpit Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Telemetry & Edge Stream (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Real-Time Telemetry Monitor Widget */}
            <div className={`border rounded-2xl p-5 shadow-2xl relative overflow-hidden ${
              isDark ? 'bg-[#0e0f14] border-zinc-800/90' : 'bg-[#eedccb] border-[#cbbaa9]'
            }`}>
              <div className={`flex items-center justify-between pb-4 border-b mb-4 ${
                isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
              }`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      simState === 'idle' || simState === 'resolved'
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                        : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-ping'
                    }`}
                  />
                  <div>
                    <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>{current.service}</span>
                    <span className={`font-mono text-[11px] ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>{current.endpoint}</span>
                  </div>
                </div>

                {/* Health Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 ${
                    simState === 'idle' || simState === 'resolved'
                      ? 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-400'
                      : 'bg-rose-950/80 border border-rose-700/80 text-rose-400 animate-pulse'
                  }`}
                >
                  {simState === 'idle' || simState === 'resolved' ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>HEALTHY (200 OK)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{current.errorStatus}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Metrics Bar */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className={`border rounded-xl p-3 ${
                  isDark ? 'bg-[#14151e] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
                }`}>
                  <span className={`text-[10.5px] uppercase font-mono block ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Latency p95</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      simState === 'idle' || simState === 'resolved'
                        ? isDark ? 'text-zinc-200' : 'text-[#171a1f]'
                        : 'text-rose-500'
                    }`}
                  >
                    {simState === 'idle' || simState === 'resolved' ? '24ms' : current.errorLatency}
                  </span>
                </div>

                <div className={`border rounded-xl p-3 ${
                  isDark ? 'bg-[#14151e] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
                }`}>
                  <span className={`text-[10.5px] uppercase font-mono block ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Edge Consensus</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      simState === 'idle' || simState === 'resolved' ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {simState === 'idle' || simState === 'resolved' ? '12/12 Up' : '3/12 Degraded'}
                  </span>
                </div>

                <div className={`border rounded-xl p-3 ${
                  isDark ? 'bg-[#14151e] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
                }`}>
                  <span className={`text-[10.5px] uppercase font-mono block ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Error Rate</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      simState === 'idle' || simState === 'resolved' ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {simState === 'idle' || simState === 'resolved' ? '0.00%' : '14.82%'}
                  </span>
                </div>
              </div>

              {/* Live Edge Terminal Log Stream */}
              <div>
                <div className={`flex items-center justify-between text-xs font-mono mb-2 ${
                  isDark ? 'text-zinc-400' : 'text-[#574f47]'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Terminal className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`} />
                    Synthetic Edge Telemetry Stream
                  </span>
                  <span className="text-[10px]">Live Webhook Log</span>
                </div>
                <div className="bg-[#090a0f] border border-zinc-800/80 rounded-xl p-3.5 font-mono text-[11px] space-y-1.5 max-h-[160px] overflow-y-auto">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={
                        log.includes('🚨')
                          ? 'text-rose-400 font-semibold'
                          : log.includes('🟢') || log.includes('✅')
                          ? 'text-emerald-400'
                          : log.includes('🤖') || log.includes('⚡')
                          ? 'text-orange-300'
                          : 'text-zinc-400'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Root-Cause Diagnostic Card */}
            <div
              className={`rounded-2xl border transition-all duration-300 p-5 ${
                simState === 'diagnosed' || simState === 'canary' || simState === 'resolved'
                  ? isDark
                    ? 'bg-gradient-to-r from-[#171424] to-[#12131c] border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.15)] opacity-100'
                    : 'bg-[#ebd8c6] border-purple-500/50 shadow-md opacity-100'
                  : isDark
                    ? 'bg-[#0e0f14]/50 border-zinc-800/60 opacity-40'
                    : 'bg-[#dfcebe]/50 border-[#cbbaa9]/60 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-purple-600 dark:text-purple-300 font-semibold">
                    AI Root-Cause Commit Isolation
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                  {simState === 'diagnosed' || simState === 'canary' || simState === 'resolved'
                    ? '99.2% Confidence'
                    : 'Awaiting Anomaly'}
                </span>
              </div>

              {simState === 'diagnosed' || simState === 'canary' || simState === 'resolved' ? (
                <div className="space-y-2 text-xs">
                  <p className={isDark ? 'text-zinc-200' : 'text-[#171a1f]'}>
                    <span className={`font-medium ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>Suspect Regression: </span>
                    {current.rootCause}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-purple-300 bg-purple-950/40 p-2 rounded-lg border border-purple-900/60">
                    <GitPullRequest className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">PR #392 merged 4m prior · Author: {current.author}</span>
                  </div>
                </div>
              ) : (
                <p className={`text-xs italic ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
                  Engine ready. When telemetry degrades, ResolveX cross-references git commit history and container stack traces in real time.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Linked Sprint Kanban State (5 cols) */}
          <div className={`lg:col-span-5 flex flex-col justify-between border rounded-2xl p-5 shadow-2xl ${
            isDark ? 'bg-[#0e0f14] border-zinc-800/90' : 'bg-[#eedccb] border-[#cbbaa9]'
          }`}>
            <div>
              {/* Board Header */}
              <div className={`flex items-center justify-between pb-3.5 border-b mb-4 ${
                isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
              }`}>
                <div className="flex items-center gap-2">
                  <Kanban className="w-4 h-4 text-[#ff5414]" />
                  <span className={`font-bold text-xs uppercase tracking-wide ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                    Sprint Backlog (Active Board)
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-[#675d54]'}`}>Sprint 42 · Telemetry-Linked</span>
              </div>

              {/* Mini Columns State */}
              <div className="space-y-3">
                {/* Column: In Progress */}
                <div className={`border rounded-xl p-3 ${
                  isDark ? 'bg-[#12131b] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${
                    isDark ? 'text-zinc-400' : 'text-[#574f47]'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      In Progress
                    </span>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
                      {simState === 'outage' || simState === 'diagnosed' || simState === 'canary' ? '2 tasks' : '1 task'}
                    </span>
                  </div>

                  {/* Existing Task */}
                  <div className={`border text-xs p-2.5 rounded-lg mb-2 ${
                    isDark ? 'bg-[#181924] border-zinc-800 text-zinc-300' : 'bg-[#eedccb] border-[#cbbaa9] text-[#171a1f]'
                  }`}>
                    <p className="font-medium text-[11px]">RES-1040: Migrate auth tokens to Ed25519</p>
                    <span className={`text-[10px] mt-1 block ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Assigned: Maya K.</span>
                  </div>

                  {/* AUTO-GENERATED INCIDENT TASK */}
                  {(simState === 'outage' || simState === 'diagnosed' || simState === 'canary') && (
                    <div className="bg-gradient-to-br from-[#2a1310] to-[#1a111a] border-2 border-orange-500/80 text-white p-3 rounded-lg shadow-[0_0_20px_rgba(255,84,20,0.25)] animate-fadeIn">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold bg-orange-950 text-orange-400 px-1.5 py-0.5 rounded border border-orange-700/60">
                          AUTO-TICKET · RES-1082
                        </span>
                        <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> P1 Outage
                        </span>
                      </div>
                      <p className="font-bold text-xs leading-snug">{current.title}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">Endpoint: {current.endpoint}</p>

                      <div className="mt-2 pt-2 border-t border-orange-900/40 flex items-center justify-between text-[10px]">
                        <span className="text-orange-300">Assignee: On-Call Primary</span>
                        {simState === 'canary' ? (
                          <span className="text-amber-400 font-mono animate-pulse">Canary verification in progress</span>
                        ) : (
                          <span className="text-zinc-400 font-mono">Auto-Triage &lt; 3s</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column: Done */}
                <div className={`border rounded-xl p-3 ${
                  isDark ? 'bg-[#12131b] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${
                    isDark ? 'text-zinc-400' : 'text-[#574f47]'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Done (Verified Closed)
                    </span>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
                      {simState === 'resolved' ? '2 tasks' : '1 task'}
                    </span>
                  </div>

                  {/* AUTO-TRANSITIONED RESOLVED TASK */}
                  {simState === 'resolved' && (
                    <div className="bg-gradient-to-br from-[#0c2419] to-[#0e1814] border-2 border-emerald-500/80 text-emerald-200 p-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] mb-2 animate-fadeIn">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/60">
                          AUTO-CLOSED · RES-1082
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 3/3 Canaries OK
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-white leading-snug">{current.title}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">Verified fix via deploy {current.fixCommit.slice(0, 24)}...</p>
                    </div>
                  )}

                  {/* Standard completed task */}
                  <div className={`border text-xs p-2.5 rounded-lg opacity-70 ${
                    isDark ? 'bg-[#181924] border-zinc-800 text-zinc-400' : 'bg-[#eedccb] border-[#cbbaa9] text-[#675d54]'
                  }`}>
                    <p className="font-medium text-[11px] line-through">RES-1038: Rate limit header normalization</p>
                    <span className={`text-[10px] mt-1 block ${isDark ? 'text-zinc-500' : 'text-[#84786d]'}`}>Completed Sprint 41</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Insight Footer */}
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] ${
              isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-[#cbbaa9] text-[#574f47]'
            }`}>
              <span className={`flex items-center gap-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                <Zap className="w-3.5 h-3.5 text-[#ff5414]" />
                Zero human ticket copying required
              </span>
              <span className={`font-mono ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>&lt; 3.2s MTTA</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
