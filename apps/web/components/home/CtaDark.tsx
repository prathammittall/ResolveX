'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function CtaDark() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const { isDark } = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      router.push(`/login?tab=register&email=${encodeURIComponent(email)}`);
    } else {
      router.push('/login?tab=register');
    }
  };

  return (
    <section className={`w-full py-20 sm:py-28 transition-colors duration-300 relative overflow-hidden ${
      isDark ? 'bg-[#08080a]' : 'bg-[#e2cfc0]'
    }`}>
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Banner Card */}
        <div className={`relative rounded-3xl border p-8 sm:p-16 overflow-hidden text-center transition-all ${
          isDark
            ? 'bg-gradient-to-br from-[#181924] via-[#10111a] to-[#0b0c12] border-orange-500/30 shadow-[0_20px_70px_rgba(255,84,20,0.15)]'
            : 'bg-gradient-to-br from-[#eedccb] via-[#ebd8c6] to-[#dfcebe] border-orange-500/40 shadow-[0_20px_70px_rgba(255,84,20,0.1)]'
        }`}>
          
          {/* Ambient Orange Background Glow */}
          <div 
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] -z-10 opacity-40"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 84, 20, 0.35) 0%, transparent 70%)',
              filter: 'blur(70px)'
            }}
          />

          <div className="max-w-3xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/70 border border-orange-500/40 text-orange-400 text-xs font-mono uppercase tracking-widest mb-6">
              <Zap className="w-3.5 h-3.5" />
              Instant 2-Minute Onboarding
            </div>

            {/* Headline */}
            <h2 className={`font-sans font-black text-3xl sm:text-5xl md:text-6xl tracking-tight uppercase leading-[1.08] ${
              isDark ? 'text-white' : 'text-[#171a1f]'
            }`}>
              Ready to Recover Faster and{' '}
              <span className="text-[#ff5414]">Ship With Confidence?</span>
            </h2>

            {/* Subtitle */}
            <p className={`mt-5 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${
              isDark ? 'text-zinc-300' : 'text-[#574f47]'
            }`}>
              Join thousands of engineers who rely on ResolveX for zero-downtime releases, automated incident triage, and continuous reliability.
            </p>

            {/* Action Form */}
            <form 
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter work email..."
                className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors shadow-inner ${
                  isDark
                    ? 'bg-[#0a0b0f] border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-[#dfcebe] border border-[#cbbaa9] text-[#171a1f] placeholder:text-[#7d7268]'
                }`}
              />
              <button
                type="submit"
                className={`w-full sm:w-auto shrink-0 font-bold text-sm px-6 py-3 rounded-xl transition-all duration-150 active:scale-95 whitespace-nowrap cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-[#f5e6d3] hover:bg-[#faebd7] text-zinc-950'
                    : 'bg-[#171a1f] hover:bg-black text-white'
                }`}
              >
                <span>Start Free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Trust Micro-Bullets */}
            <div className={`mt-8 flex flex-wrap items-center justify-center gap-6 text-xs ${
              isDark ? 'text-zinc-400' : 'text-[#574f47]'
            }`}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>5-minute self-serve setup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span>SOC-2 Type II Certified</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
