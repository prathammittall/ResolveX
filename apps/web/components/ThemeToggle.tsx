'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme-context';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-xl border border-[#dfdbcc] dark:border-[#25362c] bg-white/70 dark:bg-[#14221b]/70 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-8 h-8 rounded-xl border border-[#dfdbcc] dark:border-[#25362c] bg-white dark:bg-[#14221b] text-[#14201a] dark:text-[#f0f4f1] shadow-[0_2px_0_#dfdbcc] dark:shadow-[0_2px_0_#1b2d23] hover:bg-[#f6f4ec] dark:hover:bg-[#1a2d24] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#177a43]/30 ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#ffb930] transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-[#177a43] transition-transform duration-200 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}
