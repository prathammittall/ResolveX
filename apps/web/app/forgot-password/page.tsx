'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { AuthShell, Notice, inputCls, postPublic } from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await postPublic<{ message?: string }>('/api/auth/forgot-password', { email: email.trim() });
      setSent(res.message ?? 'If an account exists for that email, a reset link is on its way.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you sign in with and we’ll send you a link to choose a new password.">
      {error && <Notice kind="error">{error}</Notice>}
      {sent ? (
        <>
          <Notice kind="success">{sent}</Notice>
          <p className="text-sm text-[#3d4a42]">The link expires in 1 hour. Didn’t get it? Check your spam folder, or send it again.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setSent(null)} className="btn-kizupi-white cursor-pointer px-4 py-2 text-sm">Send again</button>
            <Link href="/login" className="btn-kizupi-go px-4 py-2 text-sm">Back to sign in</Link>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="fp-email" className="mb-1 block text-xs font-bold text-[#14201a]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6b64]" />
              <input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={`${inputCls} pl-10`} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-kizupi-go w-full cursor-pointer px-4 py-3 text-sm font-bold disabled:opacity-60">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-xs text-[#5f6b64]">
            Remembered it? <Link href="/login" className="font-semibold text-[#177a43] hover:underline">Sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
