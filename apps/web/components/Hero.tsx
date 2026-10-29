'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  Play,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  Layers,
  CheckSquare,
  Clock,
  Sparkles,
  Server,
  ChevronRight,
  ChevronDown,
  Cpu,
  Users
} from 'lucide-react';

const Hero = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'prod' | 'staging'>('prod');

  return (
    <section className="relative overflow-hidden pt-12 pb-24 md:pt-16 md:pb-32 bg-[#fafaf9]">
      {/* Background Subtle Ambient Aura */}
      <div 
        className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[850px] sm:w-[1100px] h-[550px] -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(219, 234, 254, 0.65) 0%, rgba(238, 242, 255, 0.45) 40%, rgba(254, 243, 199, 0.25) 70%, rgba(250, 250, 249, 0) 100%)',
          filter: 'blur(50px)'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Capsule Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 mb-6 shadow-[0_1px_3px_rgba(59,130,246,0.08)]">
          <Link2 className="w-3.5 h-3.5 text-blue-600 rotate-45" />
          <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-blue-700">
            Intelligent Engineering Operations
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="font-serif-title text-4xl sm:text-6xl md:text-7xl font-normal text-slate-900 tracking-tight leading-[1.08] max-w-4xl mx-auto">
          Intelligent Engineering Operations.
          <br className="hidden sm:inline" />
          <span className="block mt-1 sm:mt-2">In One Workspace.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 sm:mt-6 text-slate-600 text-base sm:text-lg md:text-[19px] max-w-2xl mx-auto leading-relaxed font-normal">
          ResolveX connects project planning, API monitoring, incident response, and
          service visibility so your team can ship with confidence and recover instantly.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[15px] font-medium px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            Start Free Trial
          </Link>
          <a
            href="#demo"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 text-slate-800 hover:text-slate-950 bg-white/70 hover:bg-white border border-slate-200/90 text-[15px] font-medium px-5 py-3 rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            <span className="w-5 h-5 rounded-full border border-slate-400/80 flex items-center justify-center text-slate-700">
              <Play className="w-2.5 h-2.5 fill-slate-700 ml-0.5" />
            </span>
            See How It Works
          </a>
        </div>

        {/* Hero Product Mockup Preview */}
        <div className="mt-12 sm:mt-16 relative max-w-6xl mx-auto">
          {/* Subtle multi-color border glow */}
          <div className="absolute -inset-1.5 sm:-inset-2 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-300/40 via-indigo-300/30 to-amber-200/30 blur-xl opacity-75 -z-10" />

          {/* Main Dashboard Card Window */}
          <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.14)] overflow-hidden text-left">
            {/* Window Topbar */}
            <div className="bg-[#f8fafc] border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-4">
              {/* Left Controls & Workspace Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
                <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-xs hover:bg-slate-50 transition">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Production</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {/* Middle Search Bar with AI prompt */}
              <div className="flex-1 max-w-md hidden sm:flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 shadow-xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1 truncate">Search with AI / Ask anything...</span>
                <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded border border-slate-200">
                  ⌘K
                </kbd>
              </div>

              {/* Right Profile & Alerts */}
              <div className="flex items-center gap-3">
                <button className="relative p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-xs">
                    RX
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Three-Column Body Grid */}
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-gradient-to-b from-white to-[#fafbfc]">
              {/* Left Column: Services & Environments (3 cols on lg) */}
              <div className="lg:col-span-3 border border-slate-100 bg-[#fbfcfd] rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-[13px] font-semibold text-slate-800">
                      Services & Environments
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 font-medium px-1.5 py-0.5 rounded">
                      Live
                    </span>
                  </div>

                  {/* Endpoint status section 1 */}
                  <div className="mt-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                      Endpoint status
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs hover:border-slate-200 transition">
                        <span className="text-xs font-medium text-slate-700">
                          Service endpoint
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Healthy
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200/70 shadow-2xs">
                        <span className="text-xs font-medium text-slate-700">
                          Payment gateway
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Degraded
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Endpoint status section 2 */}
                  <div className="mt-4">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                      Microservices
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { name: 'Auth Cluster API', status: 'Healthy' },
                        { name: 'Webhooks Ingest', status: 'Healthy' },
                        { name: 'Postgres Replica', status: 'Healthy' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 shadow-2xs hover:border-slate-200 transition"
                        >
                          <span className="text-xs font-medium text-slate-700">
                            {item.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>5 of 6 active</span>
                  <span className="text-blue-600 font-medium hover:underline cursor-pointer">
                    Manage →
                  </span>
                </div>
              </div>

              {/* Middle Column: Active Incidents & Alerts (5 cols on lg) */}
              <div className="lg:col-span-5 flex flex-col gap-3.5">
                {/* 3 Metric Cards with Sparklines */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* Uptime Card */}
                  <div className="bg-[#f0fdf4] border border-emerald-200/80 rounded-xl p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        Uptime
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center">
                        ▲ 99.98%
                      </span>
                    </div>
                    <div className="h-6 mt-1 flex items-end gap-1">
                      {[60, 75, 80, 95, 90, 100, 98].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-emerald-400/80 rounded-xs"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] text-emerald-700 mt-1">Last 30 days</div>
                  </div>

                  {/* Alerts Card */}
                  <div className="bg-[#eff6ff] border border-blue-200/80 rounded-xl p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-blue-800">
                        Alerts
                      </span>
                      <span className="text-[10px] font-bold text-blue-600">
                        3 Active
                      </span>
                    </div>
                    <div className="h-6 mt-1 flex items-end gap-1">
                      {[30, 45, 60, 20, 80, 40, 25].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-400/80 rounded-xs"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] text-blue-700 mt-1">Escalated: 0</div>
                  </div>

                  {/* Responder Card */}
                  <div className="bg-[#fffbeb] border border-amber-200/80 rounded-xl p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-800">
                        Responder
                      </span>
                      <span className="text-[10px] font-bold text-amber-600">
                        46s avg
                      </span>
                    </div>
                    <div className="h-6 mt-1 flex items-end gap-1">
                      {[85, 70, 50, 40, 35, 30, 28].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-amber-400/80 rounded-xs"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] text-amber-700 mt-1">MTTR -64%</div>
                  </div>
                </div>

                {/* Incident Feed Items */}
                <div className="flex-1 flex flex-col gap-2.5">
                  <div className="text-[13px] font-semibold text-slate-800 flex items-center justify-between">
                    <span>Active Incidents & Alerts</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Real-time stream
                    </span>
                  </div>

                  {/* Feed card 1 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        Active Incidents & Alerts
                      </span>
                      <span className="text-slate-400 text-[11px]">11 minutes ago</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-700 leading-snug">
                      ResolveX connected escalation policy. Engineers alert auto-handling.
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Responders:</span>
                        <div className="flex -space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                            JS
                          </div>
                          <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                            RK
                          </div>
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                            AL
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                        Auto-assigned
                      </span>
                    </div>
                  </div>

                  {/* Feed card 2 */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80 text-[11px]">
                        <Activity className="w-3 h-3" />
                        Continuous API & Health
                      </span>
                      <span className="text-slate-400 text-[11px]">35 minutes ago</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-700 leading-snug">
                      Continuous API and endpoint health checks verified across 12 global regions.
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Latency: 18ms</span>
                      <span className="text-emerald-600 font-medium">All green</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Operations Dashboard & Timeline (4 cols on lg) */}
              <div className="lg:col-span-4 border border-slate-100 bg-[#fbfcfd] rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-[13px] font-semibold text-slate-800">
                      Operations Dashboard & Timeline
                    </span>
                  </div>

                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-3 mb-2">
                    Connected Events
                  </div>

                  {/* Vertical Timeline */}
                  <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                    {/* Item 1 */}
                    <div className="relative text-xs">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>Deployment</span>
                        <span className="text-[10px] text-slate-400 font-normal">v2.4.1</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Deployment on staging/prod automated
                      </p>
                    </div>

                    {/* Item 2 */}
                    <div className="relative text-xs">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white" />
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>Alerts</span>
                        <span className="text-[10px] text-amber-600 font-medium">P2 Incident</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Active responder assigned via policy
                      </p>
                    </div>

                    {/* Item 3 */}
                    <div className="relative text-xs">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
                      <div className="font-semibold text-slate-800">
                        Active Responders
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex -space-x-1">
                          <div className="w-5 h-5 rounded-full bg-slate-700 text-white text-[8px] flex items-center justify-center font-bold ring-1 ring-white">
                            JD
                          </div>
                          <div className="w-5 h-5 rounded-full bg-blue-700 text-white text-[8px] flex items-center justify-center font-bold ring-1 ring-white">
                            SK
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500">2 on rotation</span>
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div className="relative text-xs">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                      <div className="font-semibold text-slate-800">
                        Deployment Verification
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Deconfliction alert clear
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1">
                    View timeline <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Process Flow Divider Strip (as in screenshot) */}
        <div className="mt-14 sm:mt-18 max-w-4xl mx-auto flex items-center justify-center gap-4 text-xs sm:text-sm text-slate-500 font-medium">
          <div className="hidden sm:block h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-300" />
          <div className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-slate-600 tracking-wide">
            <span className="hover:text-blue-600 transition">Plan</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Build</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Deploy</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Monitor</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Respond</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Learn</span>
            <span className="text-slate-300">→</span>
            <span className="hover:text-blue-600 transition">Improve</span>
          </div>
          <div className="hidden sm:block h-[1px] flex-1 bg-gradient-to-l from-transparent via-slate-300 to-slate-300" />
        </div>

        {/* Three Feature Highlight Columns (Bottom of Hero in Screenshot) */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
          {/* Card 1 */}
          <div className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                Intelligent Responder Routing
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                On-call schedules, escalation policies, and commonalities, routing alerts
                automatically to the exact engineer with contextual service ownership.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">
              Explore routing <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-sky-200 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
                Continuous Monitoring
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Continuous API and endpoint health checks, synthetic transactions and real-time
                performance telemetry across every microservice.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-sky-600 group-hover:translate-x-0.5 transition-transform">
              See synthetic checks <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <CheckSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Unified Project Management
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Connected tasks, Kanban boards, and team workflows synchronized with live
                deployments and post-incident action items.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform">
              View workspace tools <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;