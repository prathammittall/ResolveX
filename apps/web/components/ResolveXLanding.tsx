'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  FolderKanban,
  Globe,
  Layers,
  Menu,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import EcosystemBar from './home/EcosystemBar';
import HowItWorks from './home/HowItWorks';
import InteractiveSimulator from './home/InteractiveSimulator';
import FeaturesGrid from './home/FeaturesGrid';
import ComparisonMatrix from './home/ComparisonMatrix';
import PricingPlans from './home/PricingPlans';
import FaqSection from './home/FaqSection';
import Cta from './home/Cta';
import Footer from './home/Footer';

export function ResolveXLogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="9" fill="#14201a" />
      <circle cx="9.5" cy="10.5" r="3" fill="#c6f36b" />
      <circle cx="22.5" cy="10.5" r="3" fill="#c6f36b" />
      <circle cx="16" cy="22" r="3.5" fill="#177a43" />
      <path d="M9.5 10.5L16 22L22.5 10.5" stroke="#c6f36b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="14.5" r="1.5" fill="#ffffff" />
    </svg>
  );
}

export default function ResolveXLanding() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f4ec] text-[#14201a] selection:bg-[#c6f36b] selection:text-[#14201a] flex flex-col justify-between overflow-x-hidden">
      {/* Kizupi-inspired Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#f6f4ec]/90 backdrop-blur-md border-b border-[#dfdbcc]">
        <div className="wrap max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Left: Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <ResolveXLogoMark className="w-7 h-7 transition-transform group-hover:scale-105 duration-200" />
            <span className="font-display font-extrabold text-2xl tracking-tight text-[#14201a]">
              Resolve<span className="text-[#177a43]">X</span>
            </span>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-bold text-[#3d4a42]">
            <a href="#features" className="hover:text-[#177a43] transition">Product</a>
            <a href="#features" className="hover:text-[#177a43] transition">Features</a>
            <a href="#demo" className="hover:text-[#177a43] transition flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#177a43] animate-pulse" />
              Monitoring
            </a>
            <a href="#pricing" className="hover:text-[#177a43] transition">Pricing</a>
            <a href="#faq" className="hover:text-[#177a43] transition">FAQ</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-bold text-[#3d4a42] hover:text-[#14201a] px-3.5 py-2 transition"
            >
              Sign in
            </Link>
            <Link
              href="/login?tab=register"
              className="btn-kizupi-go text-xs sm:text-sm px-4 sm:px-5 py-2.5"
            >
              Get started free
            </Link>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#14201a] hover:bg-[#eeebe0] transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-[#f6f4ec] border-b border-[#dfdbcc] px-6 py-6 space-y-4 shadow-xl">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-base text-[#14201a]"
            >
              Product
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-base text-[#14201a]"
            >
              Features
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-base text-[#14201a]"
            >
              Monitoring
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-base text-[#14201a]"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-base text-[#14201a]"
            >
              FAQ
            </a>
            <div className="pt-4 border-t border-[#dfdbcc] flex flex-col gap-3">
              <Link
                href="/login"
                className="btn-kizupi-white w-full py-2.5 text-center text-sm"
              >
                Sign in
              </Link>
              <Link
                href="/login?tab=register"
                className="btn-kizupi-go w-full py-2.5 text-center text-sm"
              >
                Get started free
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Page Body */}
      <main id="main">
        {/* HERO SECTION */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-32 relative overflow-hidden">
          {/* Subtle top warm glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[#c6f36b]/15 rounded-full blur-[100px] pointer-events-none -z-10" />

          <div className="wrap max-w-6xl mx-auto px-4 sm:px-6 text-center">
            {/* Trust Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#dfdbcc] text-xs font-bold text-[#14201a] shadow-[0_2px_0_#dfdbcc] mb-8">
              <span className="w-2 h-2 rounded-full bg-[#177a43]" />
              Project management · Real-time monitoring · Automated incident response
            </div>

            {/* Headline with Kizupi highlight */}
            <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-extrabold tracking-tight leading-[1.04] text-[#14201a] max-w-4xl mx-auto">
              Your projects and production health.{' '}
              <mark className="why bg-[#c6f36b] text-[#14201a] px-3 py-0.5 rounded-xl inline-block mt-1 sm:mt-0">
                Finally connected.
              </mark>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-7 text-base sm:text-xl text-[#3d4a42] max-w-2xl mx-auto leading-relaxed font-normal">
              Plan engineering work, monitor every critical endpoint, and automatically turn
              production failures into actionable incidents. Everything your engineering team needs, in one place.
            </p>

            {/* Call to Action Buttons */}
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login?tab=register"
                className="btn-kizupi-go text-base px-8 py-4 w-full sm:w-auto font-bold"
              >
                Get started free for 14 days <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <a
                href="#features"
                className="btn-kizupi-white text-base px-7 py-4 w-full sm:w-auto font-bold"
              >
                Explore the platform
              </a>
            </div>

            <p className="mt-4 text-xs text-[#5f6b64]">
              No credit card required. Free 14-day trial with full access.
            </p>

            {/* HERO VISUAL: Custom Product Showcase Composition */}
            {/* Overlapping rounded panels on pastel backgrounds inspired by Kizupi */}
            <div className="mt-16 sm:mt-20 max-w-5xl mx-auto relative text-left">
              <div className="bg-[#eeebe0] p-4 sm:p-7 rounded-[32px] border-2 border-[#14201a] shadow-[8px_8px_0_#14201a] relative">
                {/* Top window dots */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#dfdbcc]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ee4b57]" />
                    <span className="w-3 h-3 rounded-full bg-[#ffb930]" />
                    <span className="w-3 h-3 rounded-full bg-[#177a43]" />
                    <span className="ml-2 font-mono text-xs font-semibold text-[#5f6b64]">resolvex.internal/operations-hub</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#177a43] bg-[#dcefd8] border border-[#b2e2a8] px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#177a43] animate-pulse" />
                    All Systems Live
                  </div>
                </div>

                {/* Overlapping Card Composition */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  {/* Left: Miniature Project Board (6 cols) */}
                  <div className="md:col-span-7 bg-white rounded-2xl border border-[#dfdbcc] p-4 sm:p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#dfdbcc]">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-[#177a43]" />
                        <span className="font-bold text-xs text-[#14201a]">Active Engineering Sprint</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#5f6b64]">SPRINT-14</span>
                    </div>

                    {/* Task 1 (Linked to Outage) */}
                    <div className="p-3.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] hover:border-[#177a43] transition">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#5553a8] font-bold">PAY-842</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-bold">In Progress</span>
                      </div>
                      <p className="mt-1 font-bold text-xs text-[#14201a]">
                        Payment Gateway Timeout — Mitigate & Tune Backoff
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-[#dfdbcc]/50 flex items-center justify-between text-[11px]">
                        <span className="text-[#dc2626] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Linked to SEV1 Incident #INC-1042
                        </span>
                        <div className="w-5 h-5 rounded-full bg-[#177a43] text-white text-[10px] font-bold flex items-center justify-center">
                          S
                        </div>
                      </div>
                    </div>

                    {/* Task 2 */}
                    <div className="p-3.5 rounded-xl border border-[#dfdbcc] bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#5f6b64] font-bold">AUTH-109</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#dcefd8] text-[#177a43] text-[10px] font-bold">Ready for Review</span>
                      </div>
                      <p className="mt-1 font-semibold text-xs text-[#14201a]">
                        Upgrade OAuth token rotation keys to Ed25519
                      </p>
                    </div>
                  </div>

                  {/* Right: Service Health & Telemetry Indicators (5 cols) */}
                  <div className="md:col-span-5 space-y-4 flex flex-col justify-between">
                    {/* Panel 1: Real-time Uptime Card (Mint background #dcefd8) */}
                    <div className="p-4 rounded-2xl bg-[#dcefd8] border border-[#b2e2a8] shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#177a43]">Service Telemetry</span>
                        <span className="text-xs font-mono font-bold text-[#177a43]">99.99% UPTIME</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <div>
                          <span className="font-display text-2xl font-black text-[#14201a]">22ms</span>
                          <span className="text-xs text-[#3d4a42] ml-1.5 font-medium">p95 Latency</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-white text-[#177a43] text-[10px] font-extrabold border border-[#b2e2a8]">
                          HEALTHY
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-mono text-[#3d4a42]">
                        payments-checkout-api · 12 Edge Probes
                      </div>
                    </div>

                    {/* Panel 2: Incident Notification (Peach/Coral background #faefe3) */}
                    <div className="p-4 rounded-2xl bg-[#faefe3] border border-[#f5d5c4] shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#9a3412]">Autonomous Escalation</span>
                        <span className="text-[10px] font-bold bg-[#dc2626] text-white px-2 py-0.5 rounded">SEV1 ALERT</span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-[#14201a]">
                        Consecutive 500 Outage Detected & Deduplicated
                      </p>
                      <p className="text-[11px] text-[#5f6b64] mt-1">
                        Service owner <strong>@sarah-devops</strong> paged directly. Sprint ticket automatically dispatched.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Night Stats Strip */}
        <EcosystemBar />

        {/* Product Introduction (3 Large Feature Sections on Pastel Backgrounds) */}
        <HowItWorks />

        {/* Interactive Product Demonstration (The Kizupi #ladder section adapted for ResolveX) */}
        <InteractiveSimulator />

        {/* Feature Showcase & Smart Alerting Section */}
        <FeaturesGrid />

        {/* Comparison Section */}
        <ComparisonMatrix />

        {/* Transparent Pricing Section */}
        <PricingPlans />

        {/* FAQ Section */}
        <FaqSection />

        {/* Final CTA */}
        <Cta />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
