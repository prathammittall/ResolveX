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
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
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

  const { login, verifyOtp, resendOtp, register: registerUser } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification state
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (!isOtpStep || otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpStep, otpCooldown]);



  // Sync mode if query param or path changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register' || pathname?.includes('register')) {
      setMode('register');
    } else if (tab === 'login') {
      setMode('login');
    }

    const errorParam = searchParams.get('error');
    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }
  }, [searchParams, pathname]);

  const handleTabSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setIsOtpStep(false);
    setOtpCode('');
    setOtpToken(null);
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
        if (res.requireOtp) {
          setIsOtpStep(true);
          setOtpEmail(res.email || email);
          setOtpToken(res.otpToken || null);
          setOtpCooldown(30);
          setSuccessMessage(res.message || 'Verification code sent to your email.');
          return;
        }
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

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyOtp({
        email: otpEmail,
        otp: cleanOtp,
        otpToken: otpToken || undefined,
      });
      if (res.ok) {
        setSuccessMessage(`Verification successful${res.user?.name ? `, welcome ${res.user.name}` : ''}! Redirecting to workspace...`);
        setTimeout(() => {
          router.push(nextPath);
        }, 1000);
      } else {
        setErrorMessage(res.error || 'Invalid verification code. Please check and try again.');
      }
    } catch {
      setErrorMessage('Verification failed due to a network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtpCode = async () => {
    if (otpCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);

    try {
      const res = await resendOtp({
        email: otpEmail,
        otpToken: otpToken || undefined,
      });
      if (res.ok) {
        if (res.otpToken) setOtpToken(res.otpToken);
        setOtpCooldown(30);
        setSuccessMessage(res.message || 'A new verification code has been dispatched.');
      } else {
        setErrorMessage(res.error || 'Failed to resend verification code. Please try again later.');
      }
    } catch {
      setErrorMessage('Failed to resend code due to network error.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    setIsOtpStep(false);
    setOtpCode('');
    setOtpToken(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Real Google OAuth 2.0 flow: navigates directly to Google's official sign-in / account chooser
  const handleGoogleClick = () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    const redirectUri = `${origin}/api/auth/google/callback`;

    if (clientId) {
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', clientId);
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('prompt', 'select_account');
      googleAuthUrl.searchParams.set('access_type', 'offline');
      googleAuthUrl.searchParams.set('state', nextPath || '/dashboard');

      window.location.href = googleAuthUrl.toString();
    } else {
      window.location.href = `/api/auth/google?next=${encodeURIComponent(nextPath || '/dashboard')}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-[#f6f4ec] text-[#14201a] selection:bg-[#c6f36b] selection:text-[#14201a]">
      {/* Top subtle decorative pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 dither-band"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="h-16 px-6 max-w-6xl w-full mx-auto flex items-center justify-between shrink-0 z-10 border-b border-[#dfdbcc]">
        <Link href="/" className="group flex items-center gap-2.5">
          <ResolveXLogoMark className="w-6 h-6 transition-transform group-hover:scale-105 duration-200" />
          <span className="font-display font-extrabold text-xl tracking-tight text-[#14201a]">
            Resolve<span className="text-[#177a43]">X</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dcefd8] border border-[#b2e2a8] text-[11px] font-bold text-[#177a43]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#177a43] animate-pulse" />
            Operational
          </span>
        </Link>
        <Link
          href="/"
          className="btn-kizupi-white text-xs px-3.5 py-2 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to website</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[440px] rounded-3xl border border-[#dfdbcc] bg-white text-[#14201a] shadow-[0_4px_0_#dfdbcc] p-6 sm:p-8">
          {isOtpStep ? (
            <div>
              {/* Shield Icon & Header */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#dcefd8] border border-[#b2e2a8] text-[#177a43] flex items-center justify-center mx-auto mb-3.5 shadow-xs">
                  <Shield className="w-6 h-6" />
                </div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#14201a]">
                  Two-Factor Verification
                </h1>
                <p className="mt-1 text-xs text-[#5f6b64]">
                  Enter the 6-digit verification code sent to
                </p>
                <p className="mt-1 text-xs font-bold text-[#14201a] truncate max-w-[320px] mx-auto bg-[#eeebe0] px-3 py-1.5 rounded-lg border border-[#dfdbcc]">
                  {otpEmail}
                </p>
              </div>

              {/* Error & Success Feedback Banners */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-[#fee2e2] border border-[#fca5a5] text-[#991b1b] text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-3 rounded-xl bg-[#dcefd8] border border-[#b2e2a8] text-[#15803d] text-xs font-bold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#177a43]" />
                  <div className="flex-1">{successMessage}</div>
                </div>
              )}

              {/* OTP Form */}
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#14201a]">
                      One-Time Password (OTP)
                    </label>
                    <span className="text-[11px] text-[#5f6b64]">Expires in 10 mins</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#5f6b64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••••"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] text-[#177a43] font-mono font-bold text-center text-2xl tracking-[0.4em] placeholder:text-[#5f6b64]/30 placeholder:tracking-[0.4em] transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                    />
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isVerifying || otpCode.length < 6}
                  className="btn-kizupi-go w-full py-3 px-4 font-bold text-sm cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Access Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend Section */}
              <div className="mt-5 pt-4 border-t border-[#dfdbcc] text-center space-y-2.5">
                <div className="text-xs text-[#5f6b64]">
                  {otpCooldown > 0 ? (
                    <span>
                      Didn&apos;t receive the code? Resend available in{' '}
                      <strong className="text-[#14201a] font-semibold">{otpCooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtpCode}
                      disabled={isResending}
                      className="text-xs font-bold text-[#177a43] hover:underline cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Resending...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Resend verification code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-xs text-[#5f6b64] hover:text-[#14201a] transition inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in / use different email</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Card Title & Segmented Tab Switcher */}
              <div className="text-center mb-5">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">
                  {mode === 'login' ? 'Sign in to ResolveX' : 'Create your workspace'}
                </h1>
                <p className="mt-1 text-xs text-[#5f6b64]">
                  {mode === 'login'
                    ? 'Incident response, API health, and team sprint boards.'
                    : 'Free 14-day trial. No credit card required to start.'}
                </p>

                {/* Segmented Mode Selector */}
                <div className="mt-4 p-1 rounded-xl flex items-center text-xs font-bold border bg-[#eeebe0] border-[#dfdbcc]">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('login')}
                    className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${mode === 'login'
                        ? 'bg-[#177a43] text-white shadow-xs font-bold'
                        : 'text-[#5f6b64] hover:text-[#14201a]'
                      }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('register')}
                    className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-150 cursor-pointer ${mode === 'register'
                        ? 'bg-[#177a43] text-white shadow-xs font-bold'
                        : 'text-[#5f6b64] hover:text-[#14201a]'
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#177a43]" />
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
                  <div className="w-full border-t border-[#dfdbcc]" />
                </div>
                <span className="relative px-2.5 font-bold uppercase tracking-wider text-[10px] bg-white text-[#5f6b64]">
                  or with email
                </span>
              </div>

              {/* Error & Success Feedback Banners */}
              {errorMessage && (
                <div className="mb-3.5 p-3 rounded-xl bg-[#fee2e2] border border-[#fca5a5] text-[#991b1b] text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="mb-3.5 p-3 rounded-xl bg-[#dcefd8] border border-[#b2e2a8] text-[#15803d] text-xs font-bold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#177a43]" />
                  <div className="flex-1">{successMessage}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* If Register: Full Name */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#14201a]">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#5f6b64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Alex Morgan"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] text-[#14201a] placeholder:text-[#5f6b64]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                      />
                    </div>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#14201a]">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#5f6b64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="alex@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] text-[#14201a] placeholder:text-[#5f6b64]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                    />
                  </div>
                </div>

                {/* If Register: Optional Company Name */}
                {mode === 'register' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#14201a]">
                        Organization / Company
                      </label>
                      <span className="text-[11px] text-[#5f6b64]">Optional</span>
                    </div>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[#5f6b64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Operations"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] text-[#14201a] placeholder:text-[#5f6b64]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                      />
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#14201a]">
                      Password
                    </label>
                    {mode === 'login' ? (
                      <Link
                        href="/forgot-password"
                        className="text-xs font-semibold text-[#177a43] hover:underline transition cursor-pointer"
                      >
                        Forgot password?
                      </Link>
                    ) : (
                      <span className="text-[11px] text-[#5f6b64]">Min. 6 characters</span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#5f6b64] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] text-[#14201a] placeholder:text-[#5f6b64]/50 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#177a43]/20 focus:border-[#177a43]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6b64] hover:text-[#14201a] p-1 rounded transition cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Login Extras: Remember Me */}


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
              <div className="mt-5 pt-4 border-t border-[#dfdbcc] text-center">
                <p className="text-xs text-[#5f6b64]">
                  {mode === 'login' ? (
                    <>
                      Don&apos;t have an account yet?{' '}
                      <button
                        type="button"
                        onClick={() => handleTabSwitch('register')}
                        className="text-[#177a43] font-bold hover:underline cursor-pointer"
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
                        className="text-[#177a43] font-bold hover:underline cursor-pointer"
                      >
                        Sign in here
                      </button>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="h-14 px-6 max-w-6xl w-full mx-auto flex items-center justify-between text-xs shrink-0 z-10 border-t border-[#dfdbcc] text-[#5f6b64]">
        <span>© {new Date().getFullYear()} ResolveX Inc. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-[#177a43]" />
            AES-256 Encrypted
          </span>
          <span className="hidden sm:inline opacity-40">•</span>
          <span className="hidden sm:inline font-medium">SOC-2 Type II Compliant</span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#f6f4ec]">
          <Loader2 className="w-7 h-7 animate-spin text-[#177a43]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
