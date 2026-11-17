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
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { ResolveXLogoMark } from '../../components/ResolveXLanding';
import { ThemeToggle } from '../../components/ThemeToggle';

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

  const { login, loginWithGoogle, register: registerUser } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Google sign in modal / developer preview state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('sarah.google@resolvex.ai');
  const [googleNameInput, setGoogleNameInput] = useState('Sarah Miller');

  // Sync mode if query param or path changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register' || pathname?.includes('register')) {
      setMode('register');
    } else if (tab === 'login') {
      setMode('login');
    }
  }, [searchParams, pathname]);

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

  // Execute Google Authentication with server
  const executeGoogleAuth = async (payload: { credential?: string; email?: string; name?: string }) => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await loginWithGoogle(payload);
      if (res.ok) {
        setGoogleModalOpen(false);
        setSuccessMessage(`Signed in with Google${res.user?.name ? ` as ${res.user.name}` : ''}! Redirecting...`);
        setTimeout(() => {
          router.push(nextPath);
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Google sign-in failed. Please try again.');
      }
    } catch {
      setErrorMessage('An unexpected network error occurred during Google sign-in.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google sign in click handler
  const handleGoogleClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // If client ID is present in environment, attempt Google Identity Services OAuth popup
    if (googleClientId && typeof window !== 'undefined') {
      setIsGoogleLoading(true);
      try {
        if (!(window as unknown as { google?: { accounts?: { id?: unknown } } }).google?.accounts?.id) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(script);
          });
        }

        const google = (window as unknown as {
          google: {
            accounts: {
              id: {
                initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
                prompt: (cb: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
              };
            };
          };
        }).google;

        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential: string }) => {
            if (response.credential) {
              await executeGoogleAuth({ credential: response.credential });
            }
          },
        });

        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
            setGoogleModalOpen(true);
          }
        });
        return;
      } catch (err) {
        console.warn('Google SDK initialization notice:', err);
        setIsGoogleLoading(false);
      }
    }

    // Default: open the Google Auth Dialog
    setGoogleModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-[#f6f4ec] dark:bg-[#0c1410] text-[#14201a] dark:text-[#f0f5f2] selection:bg-[#c6f36b] selection:text-[#14201a] transition-colors duration-150">
      {/* Top subtle decorative pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 dark:opacity-5 dither-band"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="h-16 px-6 max-w-6xl w-full mx-auto flex items-center justify-between shrink-0 z-10 border-b border-[#dfdbcc] dark:border-[#23372c]">
        <Link href="/" className="group flex items-center gap-2.5">
          <ResolveXLogoMark className="w-6 h-6 transition-transform group-hover:scale-105 duration-200" />
          <span className="font-display font-extrabold text-xl tracking-tight text-[#14201a] dark:text-[#f0f5f2]">
            Resolve<span className="text-[#177a43] dark:text-[#22b163]">X</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dcefd8] dark:bg-[#163824] border border-[#b2e2a8] dark:border-[#1e5234] text-[11px] font-bold text-[#177a43] dark:text-[#38d47d]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#177a43] dark:bg-[#38d47d] animate-pulse" />
            Operational
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="btn-kizupi-white text-xs px-3.5 py-2 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to website</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[440px] rounded-3xl border border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] text-[#14201a] dark:text-[#f0f5f2] shadow-[0_4px_0_#dfdbcc] dark:shadow-[0_4px_0_#1b2d23] p-6 sm:p-8 transition-all">
          {/* Card Title & Segmented Tab Switcher */}
          <div className="text-center mb-5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a] dark:text-[#f0f5f2]">
              {mode === 'login' ? 'Sign in to ResolveX' : 'Create your workspace'}
            </h1>
            <p className="mt-1 text-xs text-[#5f6b64] dark:text-[#87998e]">
              {mode === 'login'
                ? 'Incident response, API health, and team sprint boards.'
                : 'Free 14-day trial. No credit card required to start.'}
            </p>

            {/* Segmented Mode Selector */}
            <div className="mt-4 p-1 rounded-xl flex items-center text-xs font-bold border bg-[#eeebe0] dark:bg-[#0c1410] border-[#dfdbcc] dark:border-[#23372c]">
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#177a43] text-white shadow-xs font-bold'
                    : 'text-[#5f6b64] dark:text-[#87998e] hover:text-[#14201a] dark:hover:text-[#f0f5f2]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#177a43] text-white shadow-xs font-bold'
                    : 'text-[#5f6b64] dark:text-[#87998e] hover:text-[#14201a] dark:hover:text-[#f0f5f2]'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Social Auth Providers */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <button
              type="button"
              onClick={() => setErrorMessage('GitHub sign-in is not configured for this environment.')}
              className="btn-kizupi-white text-xs py-2 px-3 font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isGoogleLoading}
              className="btn-kizupi-white text-xs py-2 px-3 font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#177a43] dark:text-[#38d47d]" />
              ) : (
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
              )}
              <span>{isGoogleLoading ? 'Connecting...' : 'Google'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-4 text-center text-[10px]">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#dfdbcc] dark:border-[#23372c]" />
            </div>
            <span className="relative px-2.5 font-bold uppercase tracking-wider text-[10px] bg-white dark:bg-[#14221b] text-[#5f6b64] dark:text-[#87998e]">
              or with email
            </span>
          </div>

          {/* Error & Success Feedback Banners */}
          {errorMessage && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#fee2e2] dark:bg-[#341414] border border-[#fca5a5] dark:border-[#572222] text-[#991b1b] dark:text-[#fca5a5] text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626] dark:text-[#f87171]" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#dcefd8] dark:bg-[#122e1b] border border-[#b2e2a8] dark:border-[#1e5234] text-[#15803d] dark:text-[#4ade80] text-xs font-bold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#177a43] dark:text-[#38d47d]" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* If Register: Full Name */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold mb-1 text-[#14201a] dark:text-[#f0f5f2]">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#5f6b64] dark:text-[#87998e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Sarah Miller"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0e1713] text-[#14201a] dark:text-[#f0f5f2] placeholder:text-[#5f6b64]/50 dark:placeholder:text-[#87998e]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold mb-1 text-[#14201a] dark:text-[#f0f5f2]">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5f6b64] dark:text-[#87998e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="sarah@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0e1713] text-[#14201a] dark:text-[#f0f5f2] placeholder:text-[#5f6b64]/50 dark:placeholder:text-[#87998e]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                />
              </div>
            </div>

            {/* If Register: Optional Company Name */}
            {mode === 'register' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#14201a] dark:text-[#f0f5f2]">
                    Organization / Company
                  </label>
                  <span className="text-[11px] text-[#5f6b64] dark:text-[#87998e]">Optional</span>
                </div>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#5f6b64] dark:text-[#87998e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Operations"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0e1713] text-[#14201a] dark:text-[#f0f5f2] placeholder:text-[#5f6b64]/50 dark:placeholder:text-[#87998e]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#14201a] dark:text-[#f0f5f2]">
                  Password
                </label>
                {mode === 'login' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#177a43] dark:text-[#38d47d] hover:underline transition cursor-pointer"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <span className="text-[11px] text-[#5f6b64] dark:text-[#87998e]">Min. 6 characters</span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5f6b64] dark:text-[#87998e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0e1713] text-[#14201a] dark:text-[#f0f5f2] placeholder:text-[#5f6b64]/50 dark:placeholder:text-[#87998e]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6b64] dark:text-[#87998e] hover:text-[#14201a] dark:hover:text-[#f0f5f2] p-1 rounded transition cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    className="w-4 h-4 rounded accent-[#177a43] border-[#dfdbcc] dark:border-[#23372c]"
                  />
                  <span className="text-xs font-medium text-[#3d4a42] dark:text-[#c4d3cb]">
                    Remember this device for 30 days
                  </span>
                </label>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="btn-kizupi-go w-full py-3 px-4 font-bold text-sm cursor-pointer disabled:opacity-60 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  <span>{mode === 'login' ? 'Authenticating...' : 'Provisioning Workspace...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Get Started Free'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Card Footer: Mode Switch */}
          <div className="mt-5 pt-4 border-t border-[#dfdbcc] dark:border-[#23372c] text-center">
            <p className="text-xs text-[#5f6b64] dark:text-[#87998e]">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('register')}
                    className="text-[#177a43] dark:text-[#38d47d] font-bold hover:underline cursor-pointer"
                  >
                    Start 14-day free trial
                  </button>
                </>
              ) : (
                <>
                  Already registered with ResolveX?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('login')}
                    className="text-[#177a43] dark:text-[#38d47d] font-bold hover:underline cursor-pointer"
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
      <footer className="h-14 px-6 max-w-6xl w-full mx-auto flex items-center justify-between text-xs shrink-0 z-10 border-t border-[#dfdbcc] dark:border-[#23372c] text-[#5f6b64] dark:text-[#87998e]">
        <span>© {new Date().getFullYear()} ResolveX Inc. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-[#177a43] dark:text-[#38d47d]" />
            AES-256 Encrypted
          </span>
          <span className="hidden sm:inline opacity-40">•</span>
          <span className="hidden sm:inline font-medium">SOC-2 Type II Compliant</span>
        </div>
      </footer>

      {/* Google Sign-in Interactive Modal */}
      {googleModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#14201a]/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] text-[#14201a] dark:text-[#f0f5f2] animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0c1410] flex items-center justify-center shadow-xs">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Sign in with Google</h3>
                  <p className="text-xs text-[#5f6b64] dark:text-[#87998e]">
                    Authenticate with your Google Workspace identity
                  </p>
                </div>
              </div>
            </div>

            {/* Quick 1-Click Test Identity */}
            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={() => executeGoogleAuth({ email: googleEmailInput, name: googleNameInput })}
                className="w-full p-3.5 rounded-2xl border border-[#177a43] bg-[#dcefd8]/40 dark:bg-[#163824]/50 hover:bg-[#dcefd8] dark:hover:bg-[#163824] transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-[#177a43] text-white font-bold text-xs flex items-center justify-center">
                    {googleNameInput ? googleNameInput[0] : 'G'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#14201a] dark:text-[#f0f5f2] flex items-center gap-1.5">
                      <span>{googleNameInput}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#177a43] text-white">Verified</span>
                    </div>
                    <div className="text-[11px] text-[#5f6b64] dark:text-[#87998e]">{googleEmailInput}</div>
                  </div>
                </div>
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#177a43] dark:text-[#38d47d]" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-[#177a43] dark:text-[#38d47d] transition-transform group-hover:translate-x-1" />
                )}
              </button>

              {/* Custom Google identity inputs */}
              <div className="pt-2 border-t border-[#dfdbcc] dark:border-[#23372c]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#5f6b64] dark:text-[#87998e] uppercase tracking-wider">
                    Or Use Custom Google Account
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-[#177a43] dark:text-[#38d47d]" />
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={googleNameInput}
                    onChange={(e) => setGoogleNameInput(e.target.value)}
                    placeholder="Display Name"
                    className="w-full px-3 py-2 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0c1410] text-[#14201a] dark:text-[#f0f5f2] text-xs focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                  />
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="name@google.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0c1410] text-[#14201a] dark:text-[#f0f5f2] text-xs focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                  />
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-[#dfdbcc] dark:border-[#23372c]">
              <span className="text-[10px] text-[#5f6b64] dark:text-[#87998e]">
                OAuth 2.0 / OpenID Connect
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleModalOpen(false)}
                  className="btn-kizupi-white text-xs px-3.5 py-1.5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isGoogleLoading || !googleEmailInput}
                  onClick={() => executeGoogleAuth({ email: googleEmailInput, name: googleNameInput })}
                  className="btn-kizupi-go text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isGoogleLoading ? 'Signing In...' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#14201a]/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#dfdbcc] dark:border-[#23372c] bg-white dark:bg-[#14221b] text-[#14201a] dark:text-[#f0f5f2]">
            <h3 className="font-display text-xl font-bold">Reset Password</h3>
            <p className="mt-1 text-xs text-[#5f6b64] dark:text-[#87998e]">
              Enter your registered email address and we will dispatch a secure reset token.
            </p>

            {forgotSuccess ? (
              <div className="mt-4 p-3 rounded-xl bg-[#dcefd8] dark:bg-[#122e1b] border border-[#b2e2a8] dark:border-[#1e5234] text-[#15803d] dark:text-[#4ade80] text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-[#177a43] dark:text-[#38d47d]" />
                Password reset instructions dispatched!
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#14201a] dark:text-[#f0f5f2]">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#dfdbcc] dark:border-[#23372c] bg-[#fbfaf6] dark:bg-[#0e1713] text-[#14201a] dark:text-[#f0f5f2] text-sm focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="btn-kizupi-white text-xs px-3.5 py-1.5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-kizupi-go text-xs px-4 py-1.5 cursor-pointer"
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
        <div className="h-screen flex items-center justify-center bg-[#f6f4ec] dark:bg-[#0c1410]">
          <Loader2 className="w-7 h-7 animate-spin text-[#177a43] dark:text-[#38d47d]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
