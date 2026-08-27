import React from 'react';
import { Download, History, Settings as SettingsIcon, Sun, Moon, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: 'downloader' | 'history';
  onTabChange: (tab: 'downloader' | 'history') => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenSettings }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-brand-200/30 dark:border-brand-900/30 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center shadow-soft text-white font-bold text-xl tracking-tight">
            <Sparkles className="w-5 h-5 text-white/90" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-stone-900 dark:text-white font-display">
                رهامي
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/50">
                Rahami
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1 bg-stone-200/50 dark:bg-slateDark-900/80 p-1.5 rounded-2xl border border-brand-200/20 dark:border-brand-900/30">
          <button
            onClick={() => onTabChange('downloader')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'downloader'
                ? 'bg-white dark:bg-slateDark-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            التحميل
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slateDark-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            السجل
          </button>
        </nav>

        {/* User Controls */}
        <div className="flex items-center gap-2">
          {/* User Badge */}
          {user && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-slateDark-900 border border-brand-200/40 dark:border-brand-800/40 text-xs font-semibold text-brand-700 dark:text-brand-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {user.username}
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-brand-50 dark:hover:bg-slateDark-800 border border-transparent hover:border-brand-200/50 dark:hover:border-brand-900/50 transition"
            aria-label="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-stone-600" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-brand-50 dark:hover:bg-slateDark-800 border border-transparent hover:border-brand-200/50 dark:hover:border-brand-900/50 transition"
            aria-label="الإعدادات"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex sm:hidden mt-3 pt-2 border-t border-brand-200/20 dark:border-brand-900/20 items-center justify-around">
        <button
          onClick={() => onTabChange('downloader')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'downloader'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          التحميل
        </button>
        <button
          onClick={() => onTabChange('history')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          السجل
        </button>
      </div>
    </header>
  );
};
