'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  CheckCircle2,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useTheme } from '../../lib/theme-context';
import ThemeToggle from '../../components/ThemeToggle';
import { ResolveXLogoMark } from '../../components/ResolveXLanding';

/** Only same-site relative paths are honoured, so `?next=` cannot be used as an open redirect. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/dashboard';
}

function LoginContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRegisterRoute = pathname === '/register' || pathname.endsWith('/register');
  const nextPath = safeNext(searchParams.get('next'));
  const initialTab = searchParams.get('tab') === 'register' || isRegisterRoute ? 'register' : 'login';

  const { user, login, register: registerUser } = useAuth();
  const { isDark } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Sync mode if query param or path changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register' || pathname?.includes('register')) {
      setMode('register');
    } else if (tab === 'login') {
      setMode('login');
    }
  }, [searchParams, pathname]);

  // If already logged in, show welcome and redirect option
  useEffect(() => {
    if (user && !successMessage) {
      setSuccessMessage(`Signed in as ${user.email}. Taking you to your workspace...`);
      const timer = setTimeout(() => {
        router.push(nextPath);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, router, successMessage, nextPath]);

  const handleTabSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.ok) {
          setSuccessMessage(`Welcome back${res.user?.name ? `, ${res.user.name}` : ''}! Redirecting to workspace...`);
          setTimeout(() => {
            router.push(nextPath);
          }, 1200);
        } else {
          setErrorMessage(res.error || 'Invalid credentials. Please try again.');
        }
      } else {
        const res = await registerUser({
          email,
          password,
          name: name.trim() || undefined,
          companyName: companyName.trim() || undefined,
        });
        if (res.ok) {
          setSuccessMessage('Account created successfully! Preparing your workspace...');
          setTimeout(() => {
            router.push(nextPath);
          }, 1400);
        } else {
          setErrorMessage(res.error || 'Failed to create account. Please try again.');
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotModalOpen(false);
      setForgotSuccess(false);
      setForgotEmail('');
    }, 2500);
  };

  return (
    <div
      className={`h-screen h-[100dvh] max-h-screen overflow-hidden flex flex-col justify-between relative transition-colors duration-300 ${
        isDark
          ? 'bg-[#08080a] text-white selection:bg-[#ff5414]/30 selection:text-orange-200'
          : 'bg-[#e2cfc0] text-[#171a1f] selection:bg-[#ff5414]/25 selection:text-[#ff5414]'
      }`}
    >
      {/* Background Decorative Mesh & Radial Aura */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, #ffffff08 1px, transparent 1px), linear-gradient(to bottom, #ffffff08 1px, transparent 1px)'
            : 'linear-gradient(to right, #0000000a 1px, transparent 1px), linear-gradient(to bottom, #0000000a 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] -z-10 opacity-30"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at top, rgba(255, 84, 20, 0.15) 0%, rgba(20, 20, 24, 0) 75%)'
            : 'radial-gradient(ellipse at top, rgba(255, 110, 30, 0.18) 0%, rgba(226, 207, 192, 0) 75%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="h-14 sm:h-16 px-6 max-w-6xl w-full mx-auto flex items-center justify-between shrink-0 z-10">
        <Link href="/" className="group flex items-center gap-2.5">
          <ResolveXLogoMark className="w-6 h-6 transition-transform group-hover:scale-105 duration-200" />
          <span className={`font-sans font-bold text-xl tracking-tight transition-colors ${
            isDark ? 'text-white group-hover:text-zinc-200' : 'text-[#171a1f] group-hover:text-black'
          }`}>
            ResolveX
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Systems Operational
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-xl border transition ${
              isDark
                ? 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                : 'bg-[#ebd8c6]/80 hover:bg-[#e4d1bf] border-[#c5b2a0] text-[#171a1f]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Container - Centered within 100vh with no scrollbar */}
      <main className="flex-1 flex items-center justify-center px-4 py-1 sm:py-2 min-h-0 z-10 overflow-y-auto sm:overflow-hidden">
        <div className={`w-full max-w-[420px] rounded-3xl border shadow-2xl p-5 sm:p-6 my-auto transition-all ${
          isDark
            ? 'bg-[#101117] border-zinc-800 text-white'
            : 'bg-[#eedccb] border-[#cbbaa9] text-[#171a1f]'
        }`}>
          {/* Card Title & Segmented Tab Switcher */}
          <div className="text-center mb-4">
            <h1 className="font-sans text-2xl sm:text-[25px] font-black tracking-tight leading-snug">
              {mode === 'login' ? 'Sign in to ResolveX' : 'Create your workspace'}
            </h1>
            <p className={`mt-1 text-[12px] sm:text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              {mode === 'login'
                ? 'Incident command center & real-time telemetry.'
                : 'Get started with autonomous telemetry & incident rooms.'}
            </p>

            {/* Segmented Mode Selector */}
            <div className={`mt-3.5 p-1 rounded-xl flex items-center text-xs font-semibold border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#dfcebe] border-[#cbbaa9]'
            }`}>
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${
                  mode === 'login'
                    ? isDark
                      ? 'bg-zinc-800 text-white shadow-xs font-bold'
                      : 'bg-[#171a1f] text-white shadow-xs font-bold'
                    : isDark
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-[#574f47] hover:text-[#171a1f]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${
                  mode === 'register'
                    ? isDark
                      ? 'bg-zinc-800 text-white shadow-xs font-bold'
                      : 'bg-[#171a1f] text-white shadow-xs font-bold'
                    : isDark
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-[#574f47] hover:text-[#171a1f]'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Social Auth Providers */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setErrorMessage('GitHub sign-in is not configured for this environment.')}
              className={`py-1.5 px-2.5 rounded-xl border text-[11px] sm:text-xs font-medium flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  : 'bg-[#dfcebe] hover:bg-[#d5c2b0] border-[#cbbaa9] text-[#171a1f]'
              }`}
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => setErrorMessage('Google sign-in is not configured for this environment.')}
              className={`py-1.5 px-2.5 rounded-xl border text-[11px] sm:text-xs font-medium flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  : 'bg-[#dfcebe] hover:bg-[#d5c2b0] border-[#cbbaa9] text-[#171a1f]'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-3 text-center text-[10px]">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-zinc-800' : 'border-[#cbbaa9]'}`} />
            </div>
            <span className={`relative px-2.5 font-medium uppercase tracking-wider text-[10px] ${
              isDark ? 'bg-[#101117] text-zinc-500' : 'bg-[#eedccb] text-[#675d54]'
            }`}>
              or with email
            </span>
          </div>

          {/* Error & Success Feedback Banners */}
          {errorMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* If Register: Full Name */}
            {mode === 'register' && (
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Alex Chen"
                    className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs sm:text-[13px] transition focus:outline-none focus:ring-2 focus:ring-[#ff5414]/20 focus:border-[#ff5414] ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600'
                        : 'bg-[#dfcebe]/80 border-[#c4b19f] text-[#171a1f] placeholder:text-[#7d7268]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                Email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="alex.chen@example.com"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs sm:text-[13px] transition focus:outline-none focus:ring-2 focus:ring-[#ff5414]/20 focus:border-[#ff5414] ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600'
                      : 'bg-[#dfcebe]/80 border-[#c4b19f] text-[#171a1f] placeholder:text-[#7d7268]'
                  }`}
                />
              </div>
            </div>

            {/* If Register: Optional Company Name */}
            {mode === 'register' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                    Organization / Team
                  </label>
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Optional</span>
                </div>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Reliability"
                    className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs sm:text-[13px] transition focus:outline-none focus:ring-2 focus:ring-[#ff5414]/20 focus:border-[#ff5414] ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600'
                        : 'bg-[#dfcebe]/80 border-[#c4b19f] text-[#171a1f] placeholder:text-[#7d7268]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`block text-[11px] font-semibold ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                  Password
                </label>
                {mode === 'login' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-[#ff5414] hover:underline transition cursor-pointer"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-[#675d54]'}`}>Min. 6 chars</span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-8 pr-9 py-1.5 rounded-xl border text-xs sm:text-[13px] transition focus:outline-none focus:ring-2 focus:ring-[#ff5414]/20 focus:border-[#ff5414] ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600'
                      : 'bg-[#dfcebe]/80 border-[#c4b19f] text-[#171a1f] placeholder:text-[#7d7268]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Login Extras: Remember Me */}
            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 border-zinc-400"
                  />
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
                    Keep me signed in
                  </span>
                </label>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full mt-1.5 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] ${
                isDark
                  ? 'bg-[#f5e6d3] hover:bg-[#faebd7] text-zinc-950 disabled:bg-zinc-700 disabled:text-zinc-500'
                  : 'bg-[#171a1f] hover:bg-black text-white disabled:bg-stone-400'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-current" />
                  <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Workspace Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Card Footer: Mode Switch */}
          <div className={`mt-3.5 pt-3 border-t flex flex-col gap-2 text-center ${
            isDark ? 'border-zinc-800' : 'border-[#cbbaa9]'
          }`}>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('register')}
                    className="text-[#ff5414] font-bold hover:underline cursor-pointer"
                  >
                    Start 14-day free trial
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('login')}
                    className="text-[#ff5414] font-bold hover:underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className={`h-10 sm:h-11 px-6 max-w-6xl w-full mx-auto flex items-center justify-between text-[11px] shrink-0 z-10 border-t ${
        isDark ? 'border-zinc-800/80 text-zinc-500' : 'border-[#cbbaa9]/80 text-[#675d54]'
      }`}>
        <span>© {new Date().getFullYear()} ResolveX Technologies</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            AES-256 Encrypted
          </span>
          <span className="hidden sm:inline opacity-40">•</span>
          <span className="hidden sm:inline">SOC-2 Type II Certified</span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-2xl max-w-sm w-full p-6 shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? 'bg-[#101117] border-zinc-800 text-white' : 'bg-[#eedccb] border-[#cbbaa9] text-[#171a1f]'
          }`}>
            <h3 className="font-sans text-xl font-bold">Reset Password</h3>
            <p className={`mt-1 text-xs ${isDark ? 'text-zinc-400' : 'text-[#574f47]'}`}>
              Enter your email address and we will dispatch a secure recovery token.
            </p>

            {forgotSuccess ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Reset instructions sent to your email!
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-zinc-300' : 'text-[#171a1f]'}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className={`w-full px-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5414]/20 focus:border-[#ff5414] ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600'
                        : 'bg-[#dfcebe]/80 border-[#c4b19f] text-[#171a1f]'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                      isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-[#574f47] hover:bg-[#dfcebe]'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer ${
                      isDark ? 'bg-[#f5e6d3] text-zinc-950 hover:bg-[#faebd7]' : 'bg-[#171a1f] text-white hover:bg-black'
                    }`}
                  >
                    Send Recovery Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen h-[100dvh] flex items-center justify-center bg-[#e2cfc0]">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff5414]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
