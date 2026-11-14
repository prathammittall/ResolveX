'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme-context';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        isDark
          ? 'bg-[#181920] hover:bg-[#222430] border border-zinc-700/80 text-amber-300 shadow-sm'
          : 'bg-[#ebd8c6]/90 hover:bg-[#e4d1bf] border border-[#c5b2a0] text-[#171a1f] shadow-xs'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-[#171a1f] transition-transform duration-300 -rotate-12 group-hover:rotate-0" />
        )}
      </div>
      <span className="text-xs font-semibold tracking-tight hidden sm:inline">
        {isDark ? 'Light mode' : 'Dark mode'}
      </span>
    </button>
  );
}
