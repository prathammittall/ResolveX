import React from 'react';
import { Star } from 'lucide-react';

const Testimonials = () => {
  const testimonials = [
    {
      quote:
        'ResolveX allowed us to sunset three redundant monitoring tools. Our on-call engineers now have one single place to see what broke, why it broke, and who is fixing it.',
      author: 'Elena Rostova',
      role: 'VP of Infrastructure',
      company: 'ScaleCloud',
      avatar: 'ER',
      bg: 'bg-blue-600',
    },
    {
      quote:
        'The automated root-cause AI is actually helpful, not a gimmick. When our API gateway started throwing 502s, ResolveX pointed directly to a database lock caused by a release 4 minutes earlier.',
      author: 'Marcus Vance',
      role: 'Principal SRE',
      company: 'FinStack Systems',
      avatar: 'MV',
      bg: 'bg-indigo-600',
    },
    {
      quote:
        'Having our sprint tasks, deployments, and live incident response unified in one workspace has dramatically improved engineering velocity and on-call happiness.',
      author: 'Aria Chen',
      role: 'Head of Engineering',
      company: 'HyperRoute',
      avatar: 'AC',
      bg: 'bg-emerald-600',
    },
  ];

  return (
    <section className="py-24 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <h2 className="font-serif-title text-3xl sm:text-4xl font-normal text-slate-900 tracking-tight">
            Loved by engineers who value sleep and stability.
          </h2>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            See how forward-thinking software teams use ResolveX to run reliable systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed italic">
                "{t.quote}"
              </p>
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full ${t.bg} text-white font-semibold flex items-center justify-center text-xs shadow-xs`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{t.author}</div>
                  <div className="text-xs text-slate-500">
                    {t.role} · <span className="font-medium text-slate-700">{t.company}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
