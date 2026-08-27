import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowLeft, Moon, Sun } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const { login } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة، يرجى المحاولة مجددًا.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070A10] flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Decorative ambient lights */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/10 dark:bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl pointer-events-none" />

      {/* Top right theme toggle */}
      <div className="absolute top-5 left-5 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 shadow-sm transition-colors"
          title="تبديل المظهر (فاتح / داكن)"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="admin-card p-8 sm:p-10 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0F1626]/90 backdrop-blur-xl">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20 text-white">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-wide">
              لوحة إدارة منصة رهامي
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              بوابة الدخول المشفرة والمحصنة لمسؤول النظام فقط
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3 text-xs text-rose-700 dark:text-rose-300 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>اسم مستخدم المشرف</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="اسم المستخدم..."
                required
                autoComplete="username"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>كلمة المرور</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جارِ التحقق الأمني...</span>
                </div>
              ) : (
                <>
                  <span>تسجيل دخول المشرف</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              جميع محاولات الدخول مراقبة ومسجلة في سجل الرقابة الأمني.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
