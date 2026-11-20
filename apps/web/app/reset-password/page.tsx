'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { AuthShell, Notice, inputCls, postPublic } from '../forgot-password/AuthShell';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Your password must be at least 8 characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try {
      await postPublic('/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token || token.length < 10) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs the link from your password reset email.">
        <Notice kind="error">The reset link is incomplete. Open the link from the email again, or request a new one.</Notice>
        <Link href="/forgot-password" className="btn-kizupi-go px-4 py-2 text-sm">Request a new link</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated">
        <Notice kind="success">Your password was changed and all existing sessions were signed out.</Notice>
        <Link href="/login" className="btn-kizupi-go px-4 py-2 text-sm">Sign in with your new password</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters. You’ll be signed out everywhere else.">
      {error && (
        <Notice kind="error">
          {error}
          {/invalid|expired/i.test(error) && (
            <>
              {' '}
              <Link href="/forgot-password" className="underline">Request a new link</Link>.
            </>
          )}
        </Notice>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="rp-password" className="mb-1 block text-xs font-bold text-[#14201a]">New password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6b64]" />
            <input id="rp-password" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pl-10 pr-10`} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-[#5f6b64] hover:text-[#14201a]">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="rp-confirm" className="mb-1 block text-xs font-bold text-[#14201a]">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6b64]" />
            <input id="rp-confirm" type={show ? 'text' : 'password'} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputCls} pl-10`} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-kizupi-go w-full cursor-pointer px-4 py-3 text-sm font-bold disabled:opacity-60">
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f6f4ec]">
          <Loader2 className="h-7 w-7 animate-spin text-[#177a43]" />
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
