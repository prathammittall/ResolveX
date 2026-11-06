'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const userDisplayName = user?.name || user?.username || user?.email?.split('@')[0] || 'User';
  const initial = userDisplayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-[#fafaf9]/90 backdrop-blur-md border-b border-slate-200/50 transition-all">
      <div className="relative max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo (Left) */}
        <div className="flex items-center">
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-serif-title text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
              ResolveX
            </span>
          </Link>
        </div>

        {/* Desktop Navigation Links (Centered) */}
        <nav className="hidden md:flex items-center gap-8 text-[15px] text-slate-600 font-medium absolute left-1/2 -translate-x-1/2">
          <Link
            href="/#product"
            className="hover:text-slate-900 transition-colors py-1 flex items-center gap-1"
          >
            Product
          </Link>
          <Link
            href="/#features"
            className="hover:text-slate-900 transition-colors py-1"
          >
            Features
          </Link>
          <Link
            href="/#pricing"
            className="hover:text-slate-900 transition-colors py-1"
          >
            Pricing
          </Link>
          <Link
            href="/#docs"
            className="hover:text-slate-900 transition-colors py-1"
          >
            Docs
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/#demo"
            className="text-[15px] font-medium text-slate-700 hover:text-slate-950 px-3.5 py-2 rounded-lg transition-colors"
          >
            Book Demo
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-[14px] font-medium text-blue-700 hover:text-blue-900 px-3 py-2 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-700">
                <span className="w-6 h-6 rounded-full bg-[#25396e] text-white flex items-center justify-center font-bold text-[11px]">
                  {initial}
                </span>
                <span className="max-w-[120px] truncate">{userDisplayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase font-semibold">
                  {user.role}
                </span>
              </div>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 px-2.5 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login?tab=register"
                className="text-[14px] font-medium text-slate-700 hover:text-slate-950 px-3 py-2 rounded-lg transition-colors"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-[#25396e] hover:bg-[#1b2b57] text-white text-[14px] font-medium px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98]"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-blue-700 px-2 py-1 rounded bg-blue-50"
              >
                Dashboard
              </Link>
              <span className="w-7 h-7 rounded-full bg-[#25396e] text-white flex items-center justify-center text-xs font-bold">
                {initial}
              </span>
              <button
                onClick={() => logout()}
                className="text-xs text-rose-600 font-medium px-2 py-1 rounded bg-rose-50"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-[#25396e] text-white text-xs font-medium px-3 py-1.5 rounded-md"
            >
              Sign In
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-[#fafaf9] px-6 py-4 flex flex-col gap-3 shadow-lg">
          <Link
            href="/#product"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-700 font-medium py-2 hover:text-blue-600"
          >
            Product
          </Link>
          <Link
            href="/#features"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-700 font-medium py-2 hover:text-blue-600"
          >
            Features
          </Link>
          <Link
            href="/#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-700 font-medium py-2 hover:text-blue-600"
          >
            Pricing
          </Link>
          <Link
            href="/#docs"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-700 font-medium py-2 hover:text-blue-600"
          >
            Docs
          </Link>
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            {user && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-blue-700 font-semibold"
              >
                Go to Dashboard
              </Link>
            )}
            <Link
              href="/#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2 text-slate-700 font-medium hover:text-slate-900"
            >
              Book Demo
            </Link>
            {!user && (
              <Link
                href="/login?tab=register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-blue-700 font-semibold"
              >
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
