'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  AlertTriangle,
  Kanban,
  ListTodo,
  Box,
  Flame,
  Settings,
} from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import ThemeToggle from './ThemeToggle';
import EcosystemBar from './home/EcosystemBar';
import HowItWorks from './home/HowItWorks';
import InteractiveSimulator from './home/InteractiveSimulator';
import FeaturesGrid from './home/FeaturesGrid';
import StatsMetrics from './home/StatsMetrics';
import ComparisonMatrix from './home/ComparisonMatrix';
import TestimonialsDark from './home/TestimonialsDark';
import PricingPlans from './home/PricingPlans';
import FaqSection from './home/FaqSection';
import CtaDark from './home/CtaDark';
import FooterDark from './home/FooterDark';

export function ResolveXLogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left Chevron */}
      <path
        d="M7 6L16 16L7 26"
        stroke="#f97316"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Chevron */}
      <path
        d="M25 6L16 16L25 26"
        stroke="#ff5414"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 4-Point Star Sparkle Mark from design
function StarSparkleMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
    </svg>
  );
}

export default function ResolveXLanding() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [activeModal, setActiveModal] = useState<'features' | 'docs' | 'pricing' | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showDemoNotification, setShowDemoNotification] = useState(false);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      router.push(`/login?tab=register&email=${encodeURIComponent(email)}`);
    } else {
      router.push('/login?tab=register');
    }
  };

  const handleDemoClick = () => {
    setShowDemoNotification(true);
    const simEl = document.getElementById('simulator');
    if (simEl) {
      simEl.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      setShowDemoNotification(false);
    }, 4000);
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden relative flex flex-col justify-between transition-colors duration-300 ${
        isDark
          ? 'bg-[#08080a] text-white selection:bg-[#ff5414]/30 selection:text-orange-200'
          : 'bg-[#e2cfc0] text-[#171a1f] selection:bg-[#ff5414]/25 selection:text-[#ff5414]'
      }`}
    >
      {/* Top Background Subtle Glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[450px] -z-10 opacity-40 transition-opacity duration-300"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at top, rgba(255, 84, 20, 0.08) 0%, rgba(20, 20, 24, 0) 70%)'
            : 'radial-gradient(ellipse at top, rgba(255, 110, 30, 0.12) 0%, rgba(226, 207, 192, 0) 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Main Container */}
      <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col flex-1">

        {/* Navigation Bar */}
        <header className="w-full py-7 flex items-center justify-between">
          {/* Logo (Left) */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <ResolveXLogoMark className="w-7 h-7 transition-transform group-hover:scale-105 duration-200" />
            <span
              className={`font-sans font-bold text-[21px] tracking-tight transition-colors ${
                isDark ? 'text-white group-hover:text-zinc-200' : 'text-[#171a1f] group-hover:text-black'
              }`}
            >
              ResolveX
            </span>
          </Link>

          {/* Desktop Nav Links (Center) */}
          <nav
            className={`hidden md:flex items-center gap-6 lg:gap-8 text-[14px] font-medium transition-colors ${
              isDark ? 'text-zinc-300' : 'text-[#4a423a]'
            }`}
          >
            <a
              href="#features"
              className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}
            >
              Features
            </a>
            <button
              onClick={() => setActiveModal('docs')}
              className={`transition-colors cursor-pointer ${
                isDark ? 'hover:text-white text-zinc-300' : 'hover:text-[#171a1f] text-[#4a423a]'
              }`}
            >
              Docs
            </button>
            <a
              href="#pricing"
              className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}
            >
              Pricing
            </a>
            <a
              href="#how-it-works"
              className={`transition-colors hidden lg:inline ${
                isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'
              }`}
            >
              How It Works
            </a>
            <a
              href="#simulator"
              className="hover:text-[#ff5414] transition-colors flex items-center gap-1.5 text-orange-500 font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Live Demo
            </a>
          </nav>

          {/* Right Action: Theme Switcher & Start for Free */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Start for Free Button */}
            <Link
              href="/login?tab=register"
              className={`font-semibold text-[13.5px] px-5 py-2.5 rounded-xl transition-all duration-150 active:scale-95 ${
                isDark
                  ? 'bg-[#f5e6d3] hover:bg-[#faebd7] text-zinc-950 shadow-[0_2px_10px_rgba(245,230,211,0.12)] hover:shadow-[0_4px_16px_rgba(245,230,211,0.2)]'
                  : 'bg-[#171a1f] hover:bg-[#272a33] text-white shadow-[0_2px_10px_rgba(23,26,31,0.25)] hover:shadow-[0_4px_16px_rgba(23,26,31,0.35)]'
              }`}
            >
              Start for Free
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <div className="pt-8 pb-4 md:pt-12 md:pb-6 text-center max-w-4xl mx-auto flex flex-col items-center">

          {/* Main Headline */}
          <h1
            className={`font-sans font-black tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-[66px] leading-[1.08] uppercase ${
              isDark ? 'text-white' : 'text-[#171a1f]'
            }`}
          >
            <span className="block">THE JIRA THAT KNOWS</span>
            <span className="block mt-1 sm:mt-1.5">
              WHEN YOUR API{' '}
              <span className="text-[#ff5414] drop-shadow-[0_0_35px_rgba(255,84,20,0.65)]">
                BREAKS
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className={`mt-5 text-base sm:text-lg md:text-[17.5px] max-w-2xl font-normal leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-[#574f47]'
            }`}
          >
            Plan your development and monitor live API endpoints—all in one collaborative workspace.
          </p>

          {/* Call to Action Controls */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            {/* Email Input + Get Started Container */}
            <form
              onSubmit={handleGetStarted}
              className={`w-full sm:w-auto flex-1 flex items-center rounded-xl p-1.5 transition-colors shadow-inner ${
                isDark
                  ? 'bg-[#131316] border border-zinc-800/90 focus-within:border-zinc-600'
                  : 'bg-[#dfcebe]/80 border border-[#c4b19f] focus-within:border-[#171a1f]'
              }`}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                className={`w-full bg-transparent px-3 text-sm focus:outline-none ${
                  isDark
                    ? 'text-zinc-200 placeholder:text-zinc-500'
                    : 'text-[#171a1f] placeholder:text-[#7d7268]'
                }`}
              />
              <button
                type="submit"
                className={`shrink-0 font-semibold text-[13px] px-4 py-2 rounded-lg transition-colors active:scale-95 whitespace-nowrap cursor-pointer ${
                  isDark
                    ? 'bg-[#f5e6d3] hover:bg-[#faebd7] text-zinc-950'
                    : 'bg-[#171a1f] hover:bg-[#272a33] text-white'
                }`}
              >
                Get Started
              </button>
            </form>

            {/* View Demo Button */}
            <button
              type="button"
              onClick={handleDemoClick}
              className={`w-full sm:w-auto font-medium text-[13.5px] px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'bg-[#131316]/90 hover:bg-[#1a1a20] border border-zinc-800/90 text-white'
                  : 'bg-transparent hover:bg-[#dfcebe]/60 border border-[#ab9988] text-[#171a1f]'
              }`}
            >
              View Demo
            </button>
          </div>

          {/* Toast feedback if View Demo clicked */}
          {showDemoNotification && (
            <div className="mt-4 px-4 py-2 rounded-lg bg-orange-950/80 border border-orange-500/40 text-orange-200 text-xs flex items-center gap-2 animate-bounce">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Interactive simulator active! Notice the Live API Monitor alert on the tablet below.</span>
            </div>
          )}
        </div>

        {/* 3D Perspective Device Showcase */}
        <div className="relative mt-2 sm:mt-4 md:mt-6 pb-20 w-full">

          {/* Ambient Warm Underglow Behind Tablet */}
          <div
            className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] md:w-[860px] h-[360px] -z-10 animate-pulse-glow"
            style={{
              background: isDark
                ? 'radial-gradient(ellipse 65% 55% at 50% 60%, rgba(255, 95, 25, 0.28) 0%, rgba(200, 75, 15, 0.14) 40%, rgba(10, 10, 14, 0) 75%)'
                : 'radial-gradient(ellipse 65% 55% at 50% 60%, rgba(255, 95, 25, 0.2) 0%, rgba(220, 120, 45, 0.12) 40%, rgba(226, 207, 192, 0) 75%)',
              filter: 'blur(55px)',
            }}
          />

          {/* Perspective Container */}
          <div className="perspective-container w-full max-w-5xl mx-auto">

            {/* Tilted Mockup Frame */}
            <div
              className="tilted-mockup rounded-[28px] p-[2px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.65),0_0_45px_rgba(255,84,20,0.18)]"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(220, 185, 145, 0.9) 0%, rgba(140, 105, 75, 0.4) 45%, rgba(215, 180, 140, 0.85) 100%)'
                  : 'linear-gradient(135deg, rgba(220, 195, 170, 0.9) 0%, rgba(180, 150, 125, 0.5) 45%, rgba(225, 200, 175, 0.9) 100%)',
              }}
            >
              {/* Inner Tablet Bezel with Camera Notch */}
              <div className="bg-[#14151a] p-2.5 sm:p-3.5 rounded-[26px]">

                {/* Webcam / Sensor Notch at top center of bezel */}
                <div className="w-24 h-3 bg-[#0a0b0e] rounded-b-md mx-auto mb-2 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                  <div className="w-1 h-1 rounded-full bg-zinc-700" />
                </div>

                {/* Mockup Screen Window */}
                <div
                  className={`rounded-[18px] border overflow-hidden shadow-2xl flex flex-row min-h-[440px] text-left transition-colors duration-200 ${
                    isDark ? 'bg-[#0c0d11] border-zinc-800/80' : 'bg-[#e2cfc0] border-[#cbbaa9]'
                  }`}
                >

                  {/* Left Sidebar */}
                  <div className="w-12 sm:w-14 bg-[#111216] border-r border-zinc-800/80 flex flex-col items-center py-4 gap-5 shrink-0">
                    <ResolveXLogoMark className="w-5 h-5" />

                    <div className="flex flex-col items-center gap-3.5 mt-2">
                      {/* Active Kanban Icon */}
                      <button
                        title="Boards"
                        className="w-8 h-8 rounded-lg border border-amber-600/70 bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                      >
                        <Kanban className="w-4 h-4" />
                      </button>

                      {/* Tasks List Icon */}
                      <button
                        title="List view"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <ListTodo className="w-4 h-4" />
                      </button>

                      {/* Settings/Components Icon */}
                      <button
                        title="Modules"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <Box className="w-4 h-4" />
                      </button>

                      <button
                        title="Settings"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Kanban Content Area */}
                  <div className={`flex-1 flex flex-col min-w-0 transition-colors duration-200 ${
                    isDark ? 'bg-[#0e0f14]' : 'bg-[#dfcebe]'
                  }`}>

                    {/* Top Action Header Bar */}
                    <div className={`h-12 border-b px-4 flex items-center justify-between ${
                      isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
                    }`}>
                      <div className={`flex items-center gap-1.5 font-semibold text-xs sm:text-sm ${
                        isDark ? 'text-zinc-200' : 'text-[#171a1f]'
                      }`}>
                        <span>Kanban board</span>
                        <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-[#524b44]'}`} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push('/login')}
                          className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 text-zinc-300'
                              : 'bg-[#eedccb] hover:bg-[#ebd8c7] border-[#cbbaa9] text-[#171a1f]'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 text-zinc-400'
                              : 'bg-[#eedccb] hover:bg-[#ebd8c7] border-[#cbbaa9] text-[#524b44]'
                          }`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Columns Container */}
                    <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">

                      {/* Column 1: In Progress */}
                      <div className={`rounded-xl border p-2.5 sm:p-3 flex flex-col gap-2.5 ${
                        isDark
                          ? 'border-amber-500/50 bg-[#121319]/80 shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                          : 'border-[#cbbaa9] bg-[#e6d6c7]/90'
                      }`}>
                        <div className={`flex items-center justify-between text-xs font-medium px-1 ${
                          isDark ? 'text-zinc-300' : 'text-[#171a1f]'
                        }`}>
                          <span>In Progress</span>
                          <MoreHorizontal className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-pointer" />
                        </div>

                        {/* Card 1 */}
                        <div className={`rounded-lg p-3 shadow-xs transition-shadow cursor-pointer ${
                          isDark
                            ? 'bg-[#f6ede2] text-zinc-950'
                            : 'bg-[#eedccb] border border-[#d8c3af] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-semibold leading-snug">
                            Pronote container card task
                          </p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDark ? 'bg-amber-100 text-amber-900' : 'bg-[#cbb6a1] text-[#2c2722]'
                            }`}>
                              Done
                            </span>
                            <div className="flex items-center gap-1 text-[10.5px] opacity-70">
                              <MessageSquare className="w-3 h-3" />
                              <span>14pt</span>
                            </div>
                          </div>
                        </div>

                        {/* Card 2 */}
                        <div className={`rounded-lg p-3 shadow-xs transition-shadow cursor-pointer ${
                          isDark
                            ? 'bg-[#f6ede2] text-zinc-950'
                            : 'bg-[#eedccb] border border-[#d8c3af] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-semibold leading-snug">
                            Compm probabilit a card to terovtient
                          </p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDark ? 'bg-amber-100 text-amber-900' : 'bg-[#cbb6a1] text-[#2c2722]'
                            }`}>
                              Done
                            </span>
                            <div className="flex items-center gap-1 text-[10.5px] opacity-70">
                              <MessageSquare className="w-3 h-3" />
                              <span>14pt</span>
                            </div>
                          </div>
                        </div>

                        {/* Card 3 */}
                        <div className={`rounded-lg p-3 shadow-xs transition-shadow cursor-pointer ${
                          isDark
                            ? 'bg-[#1b1c23] border border-zinc-800/80 text-zinc-200'
                            : 'bg-[#eedccb] border border-[#d8c3af] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-medium leading-snug">
                            Build vpr development
                          </p>
                        </div>
                      </div>

                      {/* Column 2: In Review */}
                      <div className={`rounded-xl border p-2.5 sm:p-3 flex flex-col gap-2.5 ${
                        isDark
                          ? 'border-zinc-800/80 bg-[#121319]/80'
                          : 'border-[#cbbaa9] bg-[#e6d6c7]/90'
                      }`}>
                        <div className={`flex items-center justify-between text-xs font-medium px-1 ${
                          isDark ? 'text-zinc-400' : 'text-[#171a1f]'
                        }`}>
                          <span>In Review</span>
                          <MoreHorizontal className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-pointer" />
                        </div>

                        {/* Card 1 */}
                        <div className={`rounded-lg p-3 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#1b1c23] border border-zinc-800/80 text-zinc-200'
                            : 'bg-[#ebd9c8] border border-[#d5c0ac] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-medium leading-snug">
                            Review understandd card task
                          </p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#d8c3af] text-[#2c2722]'
                            }`}>
                              Review
                            </span>
                            <div className="flex items-center gap-1 text-[10.5px] opacity-70">
                              <MessageSquare className="w-3 h-3" />
                              <span>14pt</span>
                            </div>
                          </div>
                        </div>

                        {/* Card 2 */}
                        <div className={`rounded-lg p-3 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#1b1c23] border border-zinc-800/80 text-zinc-200'
                            : 'bg-[#ebd9c8] border border-[#d5c0ac] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-medium leading-snug">
                            Add sm contirior text card tasks
                          </p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#d8c3af] text-[#2c2722]'
                            }`}>
                              Done
                            </span>
                            <div className="flex items-center gap-1 text-[10.5px] opacity-70">
                              <MessageSquare className="w-3 h-3" />
                              <span>14pt</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Done */}
                      <div className={`hidden lg:flex rounded-xl border p-2.5 sm:p-3 flex-col gap-2.5 ${
                        isDark
                          ? 'border-zinc-800/80 bg-[#121319]/80 ring-1 ring-emerald-500/20'
                          : 'border-[#cbbaa9] bg-[#e6d6c7]/90'
                      }`}>
                        <div className={`flex items-center justify-between text-xs font-medium px-1 ${
                          isDark ? 'text-zinc-400' : 'text-[#171a1f]'
                        }`}>
                          <span>Done</span>
                          <MoreHorizontal className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-pointer" />
                        </div>

                        {/* Card 1 */}
                        <div className={`rounded-lg p-3 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#1b1c23] border border-zinc-800/80 text-zinc-200'
                            : 'bg-[#ebd9c8] border border-[#d5c0ac] text-[#171a1f]'
                        }`}>
                          <p className="text-[12px] font-medium leading-snug">
                            Andostore development card tasks
                          </p>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isDark ? 'bg-emerald-950 text-emerald-400' : 'bg-[#d8c3af] text-[#2c2722]'
                            }`}>
                              Done
                            </span>
                            <div className="flex items-center gap-1 text-[10.5px] opacity-70">
                              <MessageSquare className="w-3 h-3" />
                              <span>16pt</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Right Inspector Panel: Live API Monitor */}
                  <div className={`w-64 sm:w-72 border-l p-3 sm:p-4 flex flex-col justify-between shrink-0 transition-colors duration-200 ${
                    isDark ? 'bg-[#0d0e13] border-zinc-800/80' : 'bg-[#dccab9] border-[#cbbaa9]'
                  }`}>

                    <div className="flex flex-col gap-3">
                      {/* Monitor Panel Header */}
                      <div className="flex items-center justify-between pb-1">
                        <span className={`font-semibold text-xs tracking-tight ${
                          isDark ? 'text-white' : 'text-[#171a1f]'
                        }`}>
                          Live API Monitor
                        </span>
                        <button
                          onClick={() => setAlertDismissed(!alertDismissed)}
                          title="Toggle view"
                          className="opacity-60 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Service 1: Registry */}
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                          Registry
                        </span>
                        <button className={`text-[10.5px] px-2 py-0.5 rounded font-medium transition ${
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-[#cbb6a1] hover:bg-[#bfae9c] text-[#171a1f]'
                        }`}>
                          Add r registry
                        </button>
                      </div>

                      {/* Service 2: payment-api */}
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                          payment-api
                        </span>
                        <div className={`flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
                          isDark
                            ? 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-400'
                            : 'bg-[#a3d9a5]/70 border border-[#7ecb82] text-[#134e19]'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Healthy</span>
                        </div>
                      </div>

                      {/* Service 3: payment-api (second check) */}
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                          payment-api
                        </span>
                        <div className={`flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
                          isDark
                            ? 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-400'
                            : 'bg-[#a3d9a5]/70 border border-[#7ecb82] text-[#134e19]'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Healthy</span>
                        </div>
                      </div>

                      {/* Auto-Alert Box (Overlaid Prominent Banner) */}
                      {!alertDismissed && (
                        <div className="mt-1 bg-gradient-to-r from-[#ea580c] via-[#ff5414] to-[#fb923c] text-white font-bold text-[11px] px-3 py-2.5 rounded-lg shadow-[0_4px_20px_rgba(234,88,12,0.55)] flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>[AUTO-ALERT] payment-api DOWN 🚨</span>
                          </div>
                        </div>
                      )}

                      {/* Connect with API boards */}
                      <div className={`text-[11px] pt-1 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                        <div className="flex items-center gap-1">
                          <span>— Connect with API boards</span>
                        </div>
                      </div>

                      {/* Service 4: Registry Outage badge */}
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>Registry</span>
                        <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-500 text-[10.5px] font-medium px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          <span>Outage</span>
                        </div>
                      </div>
                    </div>

                    {/* Subtext and Lower Preview */}
                    <div className={`pt-3 border-t flex flex-col gap-1.5 ${
                      isDark ? 'border-zinc-800/60' : 'border-[#cbbaa9]'
                    }`}>
                      <p className={`text-[10px] text-center italic ${
                        isDark ? 'text-zinc-400' : 'text-[#574f47]'
                      }`}>
                        The Jira that knows when your API breaks
                      </p>
                    </div>

                  </div>

                </div>

              </div>
            </div>

          </div>

          {/* Decorative 4-Point Star Sparkle at bottom right (from uploaded image) */}
          <div className="absolute -bottom-6 sm:-bottom-8 right-4 sm:right-10 pointer-events-none opacity-80 animate-pulse">
            <StarSparkleMark
              className={`w-8 h-8 sm:w-10 sm:h-10 ${
                isDark ? 'text-zinc-700' : 'text-[#cbb6a1]'
              }`}
            />
          </div>

        </div>

      </div>

      {/* Ecosystem Integrations Bar */}
      <EcosystemBar />

      {/* Autonomous Resolution Loop: 3 Steps */}
      <HowItWorks />

      {/* Interactive Telemetry & Incident Sandbox */}
      <InteractiveSimulator />

      {/* Bento-Grid Features Deep Dive */}
      <FeaturesGrid />

      {/* SLA & Production Metrics */}
      <StatsMetrics />

      {/* Side-by-Side Comparison Matrix */}
      <ComparisonMatrix />

      {/* Customer Testimonials & Reviews */}
      <TestimonialsDark />

      {/* Transparent Developer & Team Pricing */}
      <PricingPlans />

      {/* Frequently Asked Questions */}
      <FaqSection />

      {/* Bottom Conversion CTA Banner */}
      <CtaDark />

      {/* Full-Featured Footer */}
      <FooterDark />

      {/* Interactive Modal for Features / Docs / Pricing */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative ${
            isDark ? 'bg-[#101014] border-zinc-800' : 'bg-[#eedccb] border-[#cbbaa9]'
          }`}>
            <button
              onClick={() => setActiveModal(null)}
              className={`absolute top-4 right-4 p-1 rounded-lg transition ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-[#574f47] hover:text-black hover:bg-[#dfcebe]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            {activeModal === 'features' && (
              <div>
                <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-[#171a1f]'
                }`}>
                  <ResolveXLogoMark className="w-5 h-5" />
                  ResolveX Features
                </h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                  Everything you need to connect development with live service telemetry:
                </p>
                <div className="space-y-3 text-sm">
                  <div className={`p-3 rounded-xl border ${
                    isDark ? 'bg-zinc-900/70 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                  }`}>
                    <span className="font-semibold block mb-0.5">Automatic Incident Detection</span>
                    Direct webhook & synthetic probe alerts automatically link to Kanban task backlogs.
                  </div>
                  <div className={`p-3 rounded-xl border ${
                    isDark ? 'bg-zinc-900/70 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                  }`}>
                    <span className="font-semibold block mb-0.5">Bi-Directional Jira Workflows</span>
                    Move cards, calculate velocity, and trigger rollback monitors seamlessly.
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Link
                    href="/dashboard"
                    className={`font-semibold text-xs px-4 py-2 rounded-lg transition ${
                      isDark ? 'bg-[#f5e6d3] text-zinc-950 hover:bg-[#faebd7]' : 'bg-[#171a1f] text-white hover:bg-black'
                    }`}
                  >
                    Open Live Dashboard
                  </Link>
                </div>
              </div>
            )}

            {activeModal === 'docs' && (
              <div>
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                  Documentation & Guides
                </h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                  Quickstart instructions for monitoring your API endpoints and integrating Jira issues.
                </p>
                <div className={`p-3 rounded-xl border text-xs font-mono mb-4 ${
                  isDark ? 'bg-zinc-900/70 border-zinc-800 text-zinc-300' : 'bg-[#dfcebe] border-[#cbbaa9] text-[#171a1f]'
                }`}>
                  npx @resolvex/cli monitor --endpoint https://api.yourdomain.com
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveModal(null)}
                    className={`font-medium text-xs px-4 py-2 rounded-lg transition cursor-pointer ${
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-[#171a1f] hover:bg-black text-white'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {activeModal === 'pricing' && (
              <div>
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                  Simple, Developer-Friendly Pricing
                </h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                  Start free with your team and upgrade as you scale live monitoring.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={`p-3 rounded-xl border ${
                    isDark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
                  }`}>
                    <span className="text-xs uppercase font-semibold opacity-70">Free Tier</span>
                    <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>$0</p>
                    <p className="text-[11px] opacity-80 mt-1">Up to 5 services & unlimited boards</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${
                    isDark ? 'bg-zinc-900/70 border-amber-600/50' : 'bg-[#dfcebe] border-amber-600/50'
                  }`}>
                    <span className="text-xs text-amber-500 uppercase font-semibold">Pro Team</span>
                    <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                      $19<span className="text-xs opacity-70">/mo</span>
                    </p>
                    <p className="text-[11px] opacity-80 mt-1">Real-time alerts, SLA & unlimited history</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link
                    href="/login?tab=register"
                    className={`font-semibold text-xs px-4 py-2 rounded-lg transition ${
                      isDark ? 'bg-[#f5e6d3] text-zinc-950 hover:bg-[#faebd7]' : 'bg-[#171a1f] text-white hover:bg-black'
                    }`}
                  >
                    Start Free Now
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
