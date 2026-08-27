import React from 'react';
import { Menu, Moon, Sun, Shield, ExternalLink } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  onToggleSidebar: () => void;
  title: string;
  systemStatus?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  title,
  systemStatus = 'healthy',
}) => {
  const { admin } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-[#0B0F17]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              systemStatus === 'healthy'
                ? 'bg-emerald-500 animate-pulse'
                : systemStatus === 'warning'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500 animate-pulse'
            }`}
          />
          <span>حالة النظام:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {systemStatus === 'healthy' ? 'ممتازة' : systemStatus === 'warning' ? 'تحذير' : 'حرجة'}
          </span>
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors"
          title="تبديل المظهر (فاتح / داكن)"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>

        {/* View Main Website link */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>الموقع الرئيسي</span>
        </a>

        {/* Admin profile pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-indigo-600/20 border border-blue-200 dark:border-blue-500/30">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-blue-950 dark:text-white font-mono">{admin?.username}</span>
        </div>
      </div>
    </header>
  );
};
