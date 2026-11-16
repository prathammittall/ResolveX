'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart } from 'lucide-react';
import { ResolveXLogoMark } from '../ResolveXLanding';

export default function Footer() {
  return (
    <footer className="bg-[#f6f4ec] text-[#14201a] border-t border-[#dfdbcc] py-14 sm:py-20">
      <div className="wrap max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-14">
          {/* Brand info */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <ResolveXLogoMark className="w-6 h-6" />
              <span className="font-display font-extrabold text-xl tracking-tight text-[#14201a]">
                Resolve<span className="text-[#177a43]">X</span>
              </span>
            </Link>
            <p className="text-sm text-[#5f6b64] max-w-sm leading-relaxed">
              The engineering operations platform combining sprint planning, microservice catalog ownership,
              API monitoring, and automated incident response.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#177a43] bg-[#dcefd8] border border-[#b2e2a8] px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-[#177a43] animate-pulse" />
              All monitoring edge probes 100% operational
            </div>
          </div>

          {/* Product links */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#14201a]">
              Product
            </h4>
            <ul className="space-y-2 text-sm text-[#5f6b64]">
              <li><a href="#features" className="hover:text-[#177a43] transition">Project Boards</a></li>
              <li><a href="#features" className="hover:text-[#177a43] transition">Service Catalog</a></li>
              <li><a href="#demo" className="hover:text-[#177a43] transition">API Monitoring</a></li>
              <li><a href="#features" className="hover:text-[#177a43] transition">Incident Response</a></li>
              <li><a href="#pricing" className="hover:text-[#177a43] transition">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Solutions & Docs */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#14201a]">
              Resources
            </h4>
            <ul className="space-y-2 text-sm text-[#5f6b64]">
              <li><Link href="/dashboard" className="hover:text-[#177a43] transition">Developer Portal</Link></li>
              <li><a href="#demo" className="hover:text-[#177a43] transition">Interactive Simulator</a></li>
              <li><a href="#faq" className="hover:text-[#177a43] transition">Documentation & FAQ</a></li>
              <li><Link href="/login" className="hover:text-[#177a43] transition">Webhook Specs</Link></li>
              <li><Link href="/dashboard/audit" className="hover:text-[#177a43] transition">Security & SLA</Link></li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#14201a]">
              Company & Legal
            </h4>
            <ul className="space-y-2 text-sm text-[#5f6b64]">
              <li><a href="mailto:support@resolvex.dev" className="hover:text-[#177a43] transition">Contact Engineers</a></li>
              <li><Link href="/dashboard/settings" className="hover:text-[#177a43] transition">Privacy Policy</Link></li>
              <li><Link href="/dashboard/settings" className="hover:text-[#177a43] transition">Terms of Service</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#177a43] transition">GitHub Repository</a></li>
              <li><span className="text-xs text-[#5f6b64]">SOC-2 Type II Certified</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-8 border-t border-[#dfdbcc] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5f6b64] gap-4">
          <p>© {new Date().getFullYear()} ResolveX Technologies Inc. Plan your work. Protect your services.</p>
          <div className="flex items-center gap-1.5 font-medium">
            <span>Crafted for high-reliability engineering teams worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
