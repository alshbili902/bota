import React, { useState } from 'react';
import { Lock, User, Sparkles, Loader2, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50 dark:bg-slateDark-950 transition-colors">
      {/* Background Soft Gradients */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-300/20 dark:bg-brand-500/10 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-champagne-300/30 dark:bg-brand-600/10 blur-3xl pointer-events-none"></div>

      {/* Top Controls */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl glass-panel text-stone-600 dark:text-stone-300 hover:bg-brand-50 dark:hover:bg-slateDark-800 transition shadow-sm"
          aria-label="تبديل المظهر"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-stone-600" />}
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-3xl shadow-glass dark:shadow-glass-dark relative z-10 animate-fade-in border border-brand-200/40 dark:border-brand-900/30">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl gradient-brand shadow-soft text-white mb-4">
            <Sparkles className="w-8 h-8 text-white/95" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-stone-900 dark:text-white font-display mb-2">
            رهامي
          </h1>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            مساحتك الخاصة للتحميل
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm font-medium text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 mr-1">
              اسم المستخدم أو البريد
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخلي اسم المستخدم..."
                disabled={isLoading}
                required
                className="w-full px-4 py-3.5 pr-11 rounded-2xl glass-input text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm outline-none"
              />
              <User className="w-5 h-5 text-stone-400 dark:text-stone-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 mr-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                required
                className="w-full px-4 py-3.5 pr-11 rounded-2xl glass-input text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm outline-none"
              />
              <Lock className="w-5 h-5 text-stone-400 dark:text-stone-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 mt-2 rounded-2xl gradient-brand text-white font-bold text-base shadow-soft hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>

        {/* Private Access Badge */}
        <div className="mt-8 pt-6 border-t border-brand-200/30 dark:border-brand-900/30 flex items-center justify-center gap-2 text-xs font-medium text-stone-400 dark:text-stone-500">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <span>منصة خاصة ومحمية بالكامل</span>
        </div>
      </div>
    </div>
  );
};
