'use client';

import React from 'react';
import { Star, Quote } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export default function TestimonialsDark() {
  const { isDark } = useTheme();

  const testimonials = [
    {
      quote:
        'ResolveX allowed us to sunset Datadog Synthetics and PagerDuty alert rules. Our on-call engineers now have one single place to see what broke, which PR caused it, and who is fixing it.',
      author: 'Elena Rostova',
      role: 'VP of Infrastructure',
      company: 'ScaleCloud',
      avatar: 'ER',
      accent: 'from-orange-500 to-amber-600',
    },
    {
      quote:
        'The automated root-cause correlation is pure gold. When our checkout API started throwing 502s during our flash sale, ResolveX pointed directly to a database connection limit change made in a deploy 4 minutes earlier.',
      author: 'Marcus Vance',
      role: 'Principal SRE',
      company: 'FinStack Systems',
      avatar: 'MV',
      accent: 'from-blue-500 to-indigo-600',
    },
    {
      quote:
        'Having our sprint tasks, deployments, and live incident response unified in one workspace has completely eliminated the blind spot between development and production. On-call happiness is up 300%.',
      author: 'Aria Chen',
      role: 'Head of Engineering',
      company: 'HyperRoute',
      avatar: 'AC',
      accent: 'from-emerald-500 to-teal-600',
    },
  ];

  return (
    <section
      id="testimonials"
      className={`w-full py-24 sm:py-32 border-t transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#090a0f] border-zinc-800/80' : 'bg-[#dfcebe] border-[#cbbaa9]'
      }`}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>

          <h2 className={`font-sans font-black text-3xl sm:text-5xl tracking-tight uppercase leading-[1.1] ${
            isDark ? 'text-white' : 'text-[#171a1f]'
          }`}>
            Loved By Engineers Who{' '}
            <span className="text-[#ff5414]">Value Sleep & Stability</span>
          </h2>

          <p className={`mt-4 text-base sm:text-lg ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
            See how high-performing infrastructure teams rely on ResolveX to run resilient systems.
          </p>
        </div>

        {/* Testimonials 3-Col Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className={`p-7 sm:p-8 rounded-2xl border transition-all flex flex-col justify-between shadow-xl relative ${
                isDark
                  ? 'bg-[#0f1017] border-zinc-800/90 hover:border-zinc-700'
                  : 'bg-[#eedccb] border-[#cbbaa9] hover:border-[#bfae9c]'
              }`}
            >
              <Quote className={`w-7 h-7 mb-4 ${isDark ? 'text-zinc-700' : 'text-[#cbb9a7]'}`} />

              <p className={`text-sm sm:text-base leading-relaxed italic ${
                isDark ? 'text-zinc-300' : 'text-[#27272a]'
              }`}>
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className={`mt-8 pt-6 border-t flex items-center gap-3.5 ${
                isDark ? 'border-zinc-800/80' : 'border-[#cbbaa9]'
              }`}>
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.accent} text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>{t.author}</div>
                  <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                    {t.role} · <span className="text-orange-500 font-semibold">{t.company}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
