'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  GitBranch, 
  ArrowRight, 
  Clock, 
  Zap, 
  Layers, 
  Kanban,
  Server,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const { isDark } = useTheme();

  const steps = [
    {
      num: '01',
      title: 'Continuous Synthetic Probing',
      tagline: 'Multi-Region Ingestion (< 10s intervals)',
      desc: 'Edge probes continuously test HTTP, gRPC, and GraphQL endpoints across global regions. The moment status codes slip to 5xx, latency spikes, or contract payloads mismatch, an anomaly event triggers.',
      badge: 'Edge Ingestion',
      icon: Activity,
    },
    {
      num: '02',
      title: 'Instant Incident-to-Task Synthesis',
      tagline: 'Zero-touch Kanban Card Creation (< 3s)',
      desc: 'ResolveX correlates the API telemetry with recent Git commits, generates a structured Kanban task on your active sprint board, calculates initial severity, and assigns the on-call engineer.',
      badge: 'Auto-Tasking',
      icon: Kanban,
    },
    {
      num: '03',
      title: 'Canary Verification & Auto-Closure',
      tagline: 'Automated Post-Deploy Telemetry Check',
      desc: 'When your team merges a remediation PR, ResolveX fires targeted canary probes. Once latency normalizes and 3 consecutive checks return 200 OK, the card automatically transitions to Done.',
      badge: 'Closed-Loop',
      icon: CheckCircle2,
    },
  ];

  return (
    <section
      id="how-it-works"
      className={`w-full py-24 sm:py-32 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#08080a]' : 'bg-[#e2cfc0]'
      }`}
    >
      {/* Background subtle glow */}
      <div 
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] -z-10 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" />
            Autonomous Resolution Loop
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-[52px] tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            From Outage to Closed Task{' '}
            <span className="text-[#ff5414]">In 3 Synchronized Steps</span>
          </h2>

          <p className={`mt-5 text-base sm:text-lg leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            Eliminate human triage latency. ResolveX creates an unbroken feedback loop between live production health and developer sprint backlogs.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {steps.map((step, idx) => {
            const isSelected = activeStep === idx + 1;
            const Icon = step.icon;
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(idx + 1)}
                className={`text-left p-5 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? isDark
                      ? 'bg-[#12131a] border-[#ff5414]/60 shadow-[0_0_25px_rgba(255,84,20,0.15)] ring-1 ring-[#ff5414]/40'
                      : 'bg-[#ebd8c6] border-[#ff5414] shadow-md ring-1 ring-[#ff5414]/40'
                    : isDark
                      ? 'bg-[#0e0f14]/80 border-zinc-800/80 hover:border-zinc-700 hover:bg-[#111218]'
                      : 'bg-[#dfcebe]/80 border-[#cbbaa9] hover:border-[#bfae9c] hover:bg-[#ebd8c6]/70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-2xl font-black font-mono ${
                    isSelected ? 'text-[#ff5414]' : isDark ? 'text-zinc-600' : 'text-[#84786d]'
                  }`}>
                    {step.num}
                  </span>
                  <div className={`p-2 rounded-xl ${
                    isSelected
                      ? 'bg-orange-500/15 text-orange-400'
                      : isDark
                        ? 'bg-zinc-800/50 text-zinc-400'
                        : 'bg-[#dfcebe] text-[#524b44]'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className={`font-sans font-bold text-base sm:text-lg ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                  {step.title}
                </div>

                <div className={`text-xs font-mono mt-1 ${isDark ? 'text-orange-300/80' : 'text-orange-700'}`}>
                  {step.tagline}
                </div>

                <p className={`mt-3 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                  {step.desc}
                </p>

                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff5414] to-transparent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Visual Workflow Stage Showcase */}
        <div className={`rounded-2xl border p-5 sm:p-8 shadow-2xl relative transition-colors duration-200 ${
          isDark ? 'bg-[#0d0e14] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
        }`}>
          
          {/* Top Bar Indicator */}
          <div className={`flex flex-wrap items-center justify-between gap-3 pb-6 border-b text-xs font-mono ${
            isDark ? 'border-zinc-800/70' : 'border-[#cbbaa9]'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-[#4a4239]'}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Engine Stream
              </span>
              <span className={isDark ? 'text-zinc-600' : 'text-[#84786d]'}>|</span>
              <span className={isDark ? 'text-zinc-400' : 'text-[#4a4239]'}>Step {activeStep} of 3 active</span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded border ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-[#ebd8c6] border-[#cbbaa9] text-[#171a1f]'
              }`}>
                Environment: Production (us-east-1)
              </span>
              <span className="px-2.5 py-1 rounded bg-orange-950/70 border border-orange-800/60 text-orange-300 font-semibold">
                Auto-Sync Enabled
              </span>
            </div>
          </div>

          {/* Interactive Dynamic Display based on activeStep */}
          <div className="pt-6">
            
            {activeStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left: Terminal Output */}
                <div className="lg:col-span-7 bg-[#09090d] border border-zinc-800 rounded-xl p-4 sm:p-5 font-mono text-xs text-zinc-300 shadow-inner">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 text-zinc-500 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      <span className="ml-2 text-zinc-400">synthetic-probe-runner.log</span>
                    </div>
                    <span>Region: us-east-1</span>
                  </div>

                  <div className="mt-4 space-y-2 leading-relaxed">
                    <p className="text-zinc-500"># Probe target: POST https://api.resolvex.io/v1/payments/verify</p>
                    <p className="text-emerald-400">[08:42:10] GET /healthz → 200 OK (28ms)</p>
                    <p className="text-emerald-400">[08:42:15] GET /healthz → 200 OK (31ms)</p>
                    <p className="text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/50">
                      [08:42:20] POST /v1/payments/verify → <span className="font-bold underline">502 BAD GATEWAY</span> (842ms)
                      <br />
                      <span className="text-rose-300 text-[11px]">Error: upstream connection pool exhausted. Memory utilization 94.2%.</span>
                    </p>
                    <p className="text-amber-400">
                      [08:42:21] DISPATCHING ANOMALY EVENT → EventID: ev_9918af → Correlating active sprint board...
                    </p>
                  </div>
                </div>

                {/* Right: Quick Insights */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#13141c] border-zinc-800' : 'bg-[#ebd8c6] border-[#cbbaa9]'
                  }`}>
                    <span className={`text-xs uppercase font-mono font-semibold ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Anomaly Threshold</span>
                    <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>Multi-Node Consensus Verification</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                      Cross-referenced across Virginia, Frankfurt, and Singapore probes before alerting to eliminate false positives.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-500/30">
                    <span className="text-xs uppercase font-mono text-orange-400 font-semibold">Triage Trigger Time</span>
                    <p className={`text-2xl font-bold mt-1 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>1.2 seconds</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>Average time between probe failure and ticket synthesis.</p>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left: Kanban Card Preview */}
                <div className={`lg:col-span-7 border rounded-xl p-5 shadow-[0_0_25px_rgba(255,84,20,0.1)] ${
                  isDark ? 'bg-[#101118] border-orange-500/40' : 'bg-[#ebd8c6] border-orange-500/50'
                }`}>
                  <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-[#cbbaa9]'}`}>
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500/20 text-rose-500 border border-rose-500/40 text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                        P0 - BLOCKER
                      </span>
                      <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#524b44]'}`}>RES-1049</span>
                    </div>
                    <span className="text-xs text-orange-500 font-medium">Auto-Created from Live Alert</span>
                  </div>

                  <h4 className={`font-bold text-base mt-3 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                    [AUTO] payment-api 502 Bad Gateway under checkout load
                  </h4>

                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                    Root service: <code className="text-orange-600 bg-orange-500/10 px-1 py-0.5 rounded">svc-payment-v2</code> · Endpoint: <code className="text-orange-600 bg-orange-500/10 px-1 py-0.5 rounded">/v1/payments/verify</code>.
                    Recent release <code className="text-amber-700 bg-amber-500/10 px-1 py-0.5 rounded">commit 4a9f11b</code> deployed 6 minutes prior by @marcus-sre.
                  </p>

                  <div className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                    isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-[10px]">
                        MV
                      </div>
                      <span className={isDark ? 'text-zinc-300' : 'text-[#171a1f]'}>Marcus Vance (Assigned on-call)</span>
                    </div>
                    <span className="text-amber-600 font-mono text-[11px] font-semibold">SLA Target: 15m MTTR</span>
                  </div>
                </div>

                {/* Right: Correlation Details */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#13141c] border-zinc-800' : 'bg-[#ebd8c6] border-[#cbbaa9]'
                  }`}>
                    <span className={`text-xs uppercase font-mono font-semibold ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Git Correlation</span>
                    <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>PR #342: Upgrade connection pooling</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                      ResolveX isolated the regression commit automatically by scanning deployment timestamps against API latency curves.
                    </p>
                  </div>
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#13141c] border-zinc-800' : 'bg-[#ebd8c6] border-[#cbbaa9]'
                  }`}>
                    <span className={`text-xs uppercase font-mono font-semibold ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Slack & PagerDuty Notification</span>
                    <p className={`text-xs mt-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                      Thread created in <span className="text-orange-500 font-semibold">#war-room-payments</span> with 1-click rollback button and stack trace.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left: Canary Verification */}
                <div className={`lg:col-span-7 border rounded-xl p-5 shadow-[0_0_25px_rgba(16,185,129,0.1)] ${
                  isDark ? 'bg-[#090a0e] border-emerald-500/40' : 'bg-[#ebd8c6] border-emerald-500/50'
                }`}>
                  <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-[#cbbaa9]'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-600 font-semibold text-xs">Canary Verification: Succeeded</span>
                    </div>
                    <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#524b44]'}`}>3/3 Checks Passed</span>
                  </div>

                  <div className="mt-4 space-y-2.5 font-mono text-xs">
                    <div className={`flex items-center justify-between p-2 rounded border ${
                      isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                    }`}>
                      <span>Probe 1 (us-east-1): 200 OK</span>
                      <span className="text-emerald-500 font-semibold">32ms</span>
                    </div>
                    <div className={`flex items-center justify-between p-2 rounded border ${
                      isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                    }`}>
                      <span>Probe 2 (eu-central-1): 200 OK</span>
                      <span className="text-emerald-500 font-semibold">41ms</span>
                    </div>
                    <div className={`flex items-center justify-between p-2 rounded border ${
                      isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                    }`}>
                      <span>Probe 3 (ap-southeast-1): 200 OK</span>
                      <span className="text-emerald-500 font-semibold">68ms</span>
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                    isDark ? 'border-zinc-800' : 'border-[#cbbaa9]'
                  }`}>
                    <span className="text-emerald-600 font-medium">Ticket RES-1049 transitioned to:</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-md font-bold">
                      Done ✓
                    </span>
                  </div>
                </div>

                {/* Right: Closed loop stats */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                    <span className="text-xs uppercase font-mono text-emerald-500 font-semibold">Total Incident Duration</span>
                    <p className={`text-2xl font-bold mt-1 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>4m 18s</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>From initial 502 anomaly to verified rollback and sprint board closure.</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-[#13141c] border-zinc-800' : 'bg-[#ebd8c6] border-[#cbbaa9]'
                  }`}>
                    <span className={`text-xs uppercase font-mono font-semibold ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Post-Mortem Auto-Export</span>
                    <p className={`text-xs mt-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                      Complete timeline with request payloads, metrics graphs, and commit author synced to your engineering wiki.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Step Controller */}
          <div className={`mt-8 pt-5 border-t flex items-center justify-between ${
            isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
          }`}>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStep(s)}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer ${
                    activeStep === s
                      ? isDark
                        ? 'bg-[#f5e6d3] text-zinc-950 shadow-md scale-105'
                        : 'bg-[#171a1f] text-white shadow-md scale-105'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        : 'bg-[#ebd8c6] text-[#524b44] hover:text-black hover:bg-[#e4d1bf]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveStep((prev) => (prev % 3) + 1)}
              className="flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
            >
              <span>Next step in loop</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}
