'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Shield, Rocket } from 'lucide-react';

export default function Cta() {
  return (
    <section className="py-20 md:py-28 bg-[#111914] text-white relative overflow-hidden">
      {/* Decorative dither background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none dither-band" />

      <div className="wrap max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a251e] border border-[#2a372f] text-[#c6f36b] text-xs font-bold uppercase tracking-wider mb-6">
          <Rocket className="w-3.5 h-3.5" /> Start Shipping Confidently
        </div>

        {/* Headline */}
        <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Build better software.{' '}
          <span className="text-[#c6f36b]">Keep it running.</span>
        </h2>

        {/* Subtitle */}
        <p className="mt-5 text-base sm:text-xl text-[#a5b5ab] max-w-2xl mx-auto leading-relaxed">
          Bring your engineering backlog and production health together with ResolveX.
          Set up in under five minutes with zero infrastructure maintenance.
        </p>

        {/* CTA Buttons */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login?tab=register"
            className="btn-kizupi-lime text-base px-8 py-3.5 font-extrabold w-full sm:w-auto"
          >
            Get started free for 14 days <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <a
            href="#features"
            className="btn-kizupi-white text-base px-7 py-3.5 font-bold w-full sm:w-auto"
          >
            Explore all features
          </a>
        </div>

        {/* Price Sub-note */}
        <p className="mt-4 text-xs text-[#a5b5ab]">
          Then just $15/mo. billed yearly, or $19/mo. Cancel anytime with 1-click.
        </p>

        {/* Final Trust Notes (like Kizupi final-notes) */}
        <ul className="mt-8 pt-8 border-t border-[#2a372f] flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-[#a5b5ab]">
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#177a43] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
            14-day full feature trial
          </li>
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#177a43] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
            No credit card required
          </li>
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#177a43] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
            Full multi-tenant tenant isolation
          </li>
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#177a43] text-white flex items-center justify-center text-[10px] font-bold">✓</span>
            SOC-2 Type II compliant
          </li>
        </ul>
      </div>
    </section>
  );
}
