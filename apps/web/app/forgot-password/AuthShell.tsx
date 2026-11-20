'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ResolveXLogoMark } from '../../components/ResolveXLanding';

/** Light-theme frame shared by the account recovery pages (matches the login page). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#f6f4ec] text-[#14201a]">
      <header className="z-10 mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center justify-between border-b border-[#dfdbcc] px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <ResolveXLogoMark className="h-6 w-6 transition-transform duration-200 group-hover:scale-105" />
          <span className="font-display text-xl font-extrabold tracking-tight text-[#14201a]">
            Resolve<span className="text-[#177a43]">X</span>
          </span>
        </Link>
        <Link href="/login" className="btn-kizupi-white inline-flex items-center gap-1.5 px-3.5 py-2 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-[0_2px_0_#dfdbcc] sm:p-8">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#5f6b64]">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return kind === 'error' ? (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#fca5a5] bg-[#fee2e2] p-3 text-xs font-semibold text-[#991b1b]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" />
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-[#b2e2a8] bg-[#dcefd8] p-3 text-xs font-bold text-[#15803d]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#177a43]" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export const inputCls =
  'w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2.5 text-sm text-[#14201a] transition placeholder:text-[#5f6b64]/50 focus:border-[#177a43] focus:outline-none focus:ring-2 focus:ring-[#177a43]/20';

/** POST JSON to a public auth endpoint; returns the parsed body or throws with the server's message. */
export async function postPublic<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: { message?: string } } & T) | null;
  if (!res.ok || !data?.ok) {
    if (res.status === 429) throw new Error('Too many attempts. Please wait a few minutes and try again.');
    throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data;
}
