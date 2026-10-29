import React from 'react';

const TrustBar = () => {
  const companies = [
    { name: 'Linear', font: 'font-semibold tracking-tight' },
    { name: 'Supabase', font: 'font-bold tracking-tight' },
    { name: 'Vercel', font: 'font-medium tracking-widest uppercase text-xs' },
    { name: 'Stripe', font: 'font-bold tracking-tight' },
    { name: 'Cloudflare', font: 'font-semibold tracking-tighter' },
    { name: 'Datadog', font: 'font-medium tracking-tight' },
  ];

  return (
    <section className="py-12 border-y border-slate-200/60 bg-white/60 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-8">
          Trusted by infrastructure and platform teams worldwide
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 md:gap-20 opacity-70 grayscale hover:grayscale-0 transition-all duration-300">
          {companies.map((c, i) => (
            <div
              key={i}
              className={`text-slate-500 hover:text-slate-900 transition-colors text-lg sm:text-xl ${c.font}`}
            >
              {c.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
