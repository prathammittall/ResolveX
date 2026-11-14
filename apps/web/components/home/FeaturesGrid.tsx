'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  Kanban, 
  Cpu, 
  BellRing, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Lock
} from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function FeaturesGrid() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const { isDark } = useTheme();

  const features = [
    {
      id: 1,
      title: 'Continuous Synthetic Probing',
      tag: 'Edge Ingestion',
      desc: 'Probe REST, GraphQL, and gRPC endpoints across 12 worldwide edge locations. Configure custom HTTP headers, payload assertions, SSL certificate warnings, and check frequencies down to 5 seconds.',
      badge: '5s Frequency',
      icon: Activity,
      colSpan: 'lg:col-span-7',
      accent: isDark ? 'border-orange-500/40 hover:border-orange-500/80' : 'border-[#cbbaa9] hover:border-orange-500/80',
      glow: 'rgba(255, 84, 20, 0.08)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border font-mono text-[11px] space-y-1 ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
        }`}>
          <div className={`flex justify-between ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>
            <span>GET /v1/healthz</span>
            <span className="text-emerald-500 font-semibold">● 12 Nodes Online</span>
          </div>
          <div className={`flex justify-between ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            <span>p50: 18ms · p95: 42ms · p99: 78ms</span>
            <span className="text-orange-500 font-medium">SSL: 84d valid</span>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: 'Telemetry-Linked Agile Kanban',
      tag: 'Bi-Directional Sync',
      desc: 'The project board that knows when services degrade. Outages create tasks automatically, PR deploys trigger verification, and healthy canary checks move cards to Done.',
      badge: 'Zero-Touch',
      icon: Kanban,
      colSpan: 'lg:col-span-5',
      accent: isDark ? 'border-amber-500/40 hover:border-amber-500/80' : 'border-[#cbbaa9] hover:border-amber-500/80',
      glow: 'rgba(245, 158, 11, 0.08)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
        }`}>
          <span className={isDark ? 'text-zinc-400' : 'text-[#574f47]'}>RES-1049 (Payment API)</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 text-[10px] font-bold">
            In Progress
          </span>
        </div>
      )
    },
    {
      id: 3,
      title: 'AI Root-Cause Diagnosis',
      tag: 'Instant Correlation',
      desc: 'ResolveX analyzes git commits, container metrics, and stack traces simultaneously to isolate the exact pull request that triggered the regression—saving up to 45 minutes of manual log searching.',
      badge: 'Auto-Triage',
      icon: Cpu,
      colSpan: 'lg:col-span-5',
      accent: isDark ? 'border-purple-500/40 hover:border-purple-500/80' : 'border-[#cbbaa9] hover:border-purple-500/80',
      glow: 'rgba(168, 85, 247, 0.08)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border text-[11px] ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
        }`}>
          <span className="text-purple-500 font-mono font-semibold block">Commit 9cf18a identified:</span>
          <span className={isDark ? 'text-zinc-400' : 'text-[#574f47]'}>Database connection pool reduced from 100 to 10 in commit #382.</span>
        </div>
      )
    },
    {
      id: 4,
      title: 'Smart Deduplication & On-Call',
      tag: 'Alert Sanity',
      desc: 'Stop 3 AM pager storms. ResolveX groups downstream cascade failures into one primary incident ticket so your on-call engineer only receives a single actionable notification.',
      badge: '-82% Noise',
      icon: BellRing,
      colSpan: 'lg:col-span-7',
      accent: isDark ? 'border-blue-500/40 hover:border-blue-500/80' : 'border-[#cbbaa9] hover:border-blue-500/80',
      glow: 'rgba(59, 130, 246, 0.08)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
        }`}>
          <span className={isDark ? 'text-zinc-400' : 'text-[#574f47]'}>48 Secondary Alerts Correlated</span>
          <span className="text-emerald-500 font-semibold">→ 1 Root Ticket Dispatched</span>
        </div>
      )
    },
    {
      id: 5,
      title: 'Microservice Blast Radius Mapping',
      tag: 'Service Topology',
      desc: 'Visualize service architectures and dependencies. When an API slows down, instantly see which upstream user interfaces and downstream databases are affected.',
      badge: 'Live Map',
      icon: Layers,
      colSpan: 'lg:col-span-6',
      accent: isDark ? 'border-emerald-500/40 hover:border-emerald-500/80' : 'border-[#cbbaa9] hover:border-emerald-500/80',
      glow: 'rgba(16, 185, 129, 0.08)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-around text-xs font-mono ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80 text-zinc-400' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#574f47]'
        }`}>
          <span>Web Client</span>
          <span>→</span>
          <span className="text-rose-500 font-bold">API Gateway (502)</span>
          <span>→</span>
          <span>PostgreSQL</span>
        </div>
      )
    },
    {
      id: 6,
      title: 'Enterprise Audit Logs & RBAC',
      tag: 'SOC-2 Ready',
      desc: 'Immutable audit trails for every incident response action, probe configuration change, and role delegation. Full SAML SSO, SCIM provisioning, and exportable compliance reports.',
      badge: 'SOC-2 Type II',
      icon: ShieldCheck,
      colSpan: 'lg:col-span-6',
      accent: isDark ? 'border-zinc-700 hover:border-zinc-500' : 'border-[#cbbaa9] hover:border-[#84786d]',
      glow: 'rgba(255, 255, 255, 0.05)',
      detail: (
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
          isDark ? 'bg-[#090a0f] border-zinc-800/80 text-zinc-400' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#574f47]'
        }`}>
          <div className="flex items-center gap-1.5 text-emerald-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Audit Trail Verified</span>
          </div>
          <span className={isDark ? 'text-zinc-500' : 'text-[#84786d]'}>SHA-256 Tamper-Proof</span>
        </div>
      )
    },
  ];

  return (
    <section
      id="features"
      className={`w-full py-24 sm:py-32 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#08080a]' : 'bg-[#e2cfc0]'
      }`}
    >
      {/* Background glow */}
      <div 
        className="pointer-events-none absolute top-1/3 right-10 w-[700px] h-[500px] -z-10 opacity-25"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.08) 0%, transparent 70%)',
          filter: 'blur(90px)'
        }}
      />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" />
            The Operational Cockpit
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-[52px] tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Engineered For{' '}
            <span className="text-[#ff5414]">Zero-Downtime Releases</span>
          </h2>

          <p className={`mt-5 text-base sm:text-lg leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            Stop switching between Jira, Datadog, PagerDuty, and Slack. ResolveX integrates monitoring telemetry directly into your daily development workflow.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                onMouseEnter={() => setHoveredCard(feat.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`relative rounded-2xl border ${feat.accent} p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl ${feat.colSpan} ${
                  isDark ? 'bg-[#0f1017]' : 'bg-[#eedccb]'
                }`}
                style={{
                  boxShadow: hoveredCard === feat.id ? `0 10px 40px -10px ${feat.glow}` : undefined
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-orange-500 shadow-sm ${
                        isDark ? 'bg-[#171822] border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-mono uppercase tracking-wider ${
                        isDark ? 'text-zinc-500' : 'text-[#675d54]'
                      }`}>
                        {feat.tag}
                      </span>
                    </div>

                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                      isDark
                        ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300'
                        : 'bg-[#dfcebe] border-[#cbbaa9] text-[#4a4239]'
                    }`}>
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                    {feat.title}
                  </h3>

                  <p className={`mt-2.5 text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                    {feat.desc}
                  </p>
                </div>

                {feat.detail}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
