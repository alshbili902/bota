import React, { useEffect, useState } from 'react';
import { X, Sun, Moon, Shield, HardDrive, Cpu, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import type { SystemHealth } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getHealth().then(setHealth).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl shadow-glass dark:shadow-glass-dark border border-brand-200/40 dark:border-brand-900/30 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-brand-200/30 dark:border-brand-900/30 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-xl font-black text-stone-900 dark:text-white font-display">
              الإعدادات والحساب
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slateDark-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account Info */}
        <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/40 dark:border-brand-800/40 mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">الحساب الحالي</span>
            <h4 className="text-base font-black text-stone-900 dark:text-white mt-0.5">
              {user?.username}
            </h4>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            حساب مصرح به
          </span>
        </div>

        {/* Theme Settings */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3 mr-1">
            المظهر والألوان
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => theme === 'dark' && toggleTheme()}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                theme === 'light'
                  ? 'border-brand-500 bg-white dark:bg-slateDark-800 text-brand-600 shadow-sm ring-1 ring-brand-500'
                  : 'border-brand-200/30 dark:border-brand-900/30 text-stone-600 dark:text-stone-400'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-bold">الوضع الفاتح</span>
            </button>

            <button
              onClick={() => theme === 'light' && toggleTheme()}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                theme === 'dark'
                  ? 'border-brand-500 bg-white dark:bg-slateDark-800 text-brand-400 shadow-sm ring-1 ring-brand-500'
                  : 'border-brand-200/30 dark:border-brand-900/30 text-stone-600 dark:text-stone-400'
              }`}
            >
              <Moon className="w-5 h-5 text-brand-400" />
              <span className="text-sm font-bold">الوضع الليلي</span>
            </button>
          </div>
        </div>

        {/* System Health & Limits */}
        {health && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3 mr-1">
              حالة النظام ومساحة التخزين
            </h4>
            <div className="space-y-2 text-xs font-medium text-stone-700 dark:text-stone-300">
              <div className="p-3 rounded-2xl bg-stone-100/70 dark:bg-slateDark-900/60 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-brand-500" />
                  المساحة المستخدمة حاليًا
                </span>
                <span className="font-bold">{health.storage_used_mb} MB من أصل {health.max_storage_gb} GB</span>
              </div>

              <div className="p-3 rounded-2xl bg-stone-100/70 dark:bg-slateDark-900/60 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-brand-500" />
                  محرك التحميل والمعالجة
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  جاهز ونشط
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-stone-100/70 dark:bg-slateDark-900/60 flex items-center justify-between">
                <span>الحد الأقصى لحجم الملف الواحد</span>
                <span className="font-bold">200 ميجابايت</span>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-sm font-bold border border-rose-200 dark:border-rose-900/60 transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من المنصة</span>
        </button>
      </div>
    </div>
  );
};
