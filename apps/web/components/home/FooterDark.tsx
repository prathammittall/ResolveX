'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../../lib/theme-context';

export function ResolveXLogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 6L16 16L7 26"
        stroke="#f97316"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export default function FooterDark() {
  const { isDark } = useTheme();

  return (
    <footer className={`w-full border-t text-xs sm:text-sm transition-colors duration-300 ${
      isDark ? 'bg-[#060608] border-zinc-800/80 text-zinc-400' : 'bg-[#d8c5b3] border-[#c5b19e] text-[#574f47]'
    }`}>
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          
          {/* Brand Col (2 cols) */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 group">
              <ResolveXLogoMark className="w-7 h-7 transition-transform group-hover:scale-105" />
              <span className={`font-sans font-bold text-xl tracking-tight ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
                ResolveX
              </span>
            </Link>

            <p className={`mt-4 text-xs sm:text-sm leading-relaxed max-w-sm ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              The intelligent engineering operations cockpit connecting agile sprint planning, continuous synthetic API monitoring, and instant incident response.
            </p>

            {/* Live Status Indicator */}
            <div className={`mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium ${
              isDark
                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                : 'bg-[#e4d3c2] border-emerald-500/40 text-emerald-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational (99.99%)</span>
            </div>
          </div>

          {/* Product Col */}
          <div>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-4 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
              Product
            </h4>
            <ul className={`space-y-2.5 text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              <li><Link href="#features" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Synthetic Probing</Link></li>
              <li><Link href="#features" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Telemetry Kanban</Link></li>
              <li><Link href="#features" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>AI Root-Cause</Link></li>
              <li><Link href="#features" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Smart On-Call</Link></li>
              <li><Link href="#pricing" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Pricing Plans</Link></li>
            </ul>
          </div>

          {/* Solutions Col */}
          <div>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-4 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
              Solutions
            </h4>
            <ul className={`space-y-2.5 text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              <li><Link href="#comparison" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>For SRE Teams</Link></li>
              <li><Link href="#comparison" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>For Engineering Leads</Link></li>
              <li><Link href="#comparison" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Jira Migration</Link></li>
              <li><Link href="#ecosystem" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Integrations</Link></li>
              <li><Link href="#simulator" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Interactive Demo</Link></li>
            </ul>
          </div>

          {/* Resources Col */}
          <div>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-4 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
              Resources
            </h4>
            <ul className={`space-y-2.5 text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              <li><Link href="#how-it-works" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>How It Works</Link></li>
              <li><Link href="#faq" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>FAQ</Link></li>
              <li><Link href="/dashboard" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Live Dashboard</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>GitHub Repo</a></li>
              <li><a href="#simulator" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Changelog</a></li>
            </ul>
          </div>

          {/* Company Col */}
          <div>
            <h4 className={`font-bold text-xs uppercase tracking-wider mb-4 font-mono ${isDark ? 'text-white' : 'text-[#171a1f]'}`}>
              Company
            </h4>
            <ul className={`space-y-2.5 text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              <li><Link href="/" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>About Us</Link></li>
              <li><Link href="/" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Security & Trust</Link></li>
              <li><Link href="/" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Privacy Policy</Link></li>
              <li><Link href="/" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Terms of Service</Link></li>
              <li><Link href="/" className={`transition ${isDark ? 'hover:text-white' : 'hover:text-[#171a1f]'}`}>Contact</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className={`mt-14 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
          isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-[#c5b19e] text-[#574f47]'
        }`}>
          <div>
            © {new Date().getFullYear()} ResolveX Technologies Inc. All rights reserved.
          </div>

          <div className="flex items-center gap-5">
            <a href="https://github.com" target="_blank" rel="noreferrer" className={`transition ${isDark ? 'hover:text-white text-zinc-400' : 'hover:text-black text-[#574f47]'}`} aria-label="GitHub">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className={`transition ${isDark ? 'hover:text-white text-zinc-400' : 'hover:text-black text-[#574f47]'}`} aria-label="Twitter">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className={`transition ${isDark ? 'hover:text-white text-zinc-400' : 'hover:text-black text-[#574f47]'}`} aria-label="LinkedIn">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
