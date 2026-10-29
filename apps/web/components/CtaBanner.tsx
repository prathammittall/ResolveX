import React from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, CheckCircle, Zap } from 'lucide-react';

const CtaBanner = () => {
  return (
    <section className="py-20 sm:py-28 bg-[#fafaf9] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-[#1e2e54] via-[#152342] to-[#0f172a] text-white p-8 sm:p-16 overflow-hidden shadow-2xl">
          {/* Ambient background glow inside the banner */}
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5" />
              Instant 2-Minute Onboarding
            </div>

            <h2 className="font-serif-title text-3xl sm:text-5xl md:text-6xl font-normal tracking-tight text-white leading-[1.1]">
              Ready to recover faster and ship with confidence?
            </h2>

            <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Join thousands of engineers who rely on ResolveX for zero-downtime operations, automated incident triage, and continuous reliability.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm sm:text-base px-7 py-3.5 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all duration-150 active:scale-[0.98]"
              >
                Start Free 14-Day Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-white/10 hover:bg-white/15 text-white border border-white/20 font-medium text-sm sm:text-base px-6 py-3.5 rounded-xl transition-all duration-150"
              >
                Schedule Architecture Review
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Setup in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>SOC 2 Type II Certified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaBanner;
