import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  UserCheck,
  Save,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi } from '../services/api';

interface AdminAccountPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminAccountPage: React.FC<AdminAccountPageProps> = ({ onShowToast }) => {
  const { admin, refreshAdmin } = useAdminAuth();

  const [username, setUsername] = useState(admin?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      onShowToast('يرجى إدخال كلمة المرور الحالية لتأكيد الهوية.', 'error');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      onShowToast('كلمتا المرور الجديدتان غير متطابقتين.', 'error');
      return;
    }

    if (newPassword && newPassword.length < 8) {
      onShowToast('يجب أن لا تقل كلمة المرور الجديدة عن 8 خانات.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.updateAccount({
        current_password: currentPassword,
        new_username: username.trim().toLowerCase() !== admin?.username ? username.trim().toLowerCase() : undefined,
        new_password: newPassword ? newPassword : undefined,
      });

      onShowToast('تم تحديث بيانات حساب المشرف بنجاح.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshAdmin();
    } catch (err: any) {
      onShowToast(err.message || 'فشل تحديث حساب المشرف.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            حساب الإدارة والأمان
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">أمان حساب المشرف العام</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          تغيير اسم المستخدم الخاص بالدخول للوحة الإدارة وكلمة المرور المشفرة مع التحقق الأمني المباشر.
        </p>
      </div>

      {/* Security Warning Notice */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <strong>ملاحظة أمنية هامة:</strong> يتطلب أي تعديل على بيانات المشرف إدخال كلمة المرور الحالية. يتم تشفير كافة كلمات المرور عبر خوارزمية bcrypt القوية وتحديثها فورًا في قاعدة البيانات وسحابة Supabase.
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="admin-card p-6 md:p-8 rounded-3xl space-y-6">
        {/* Username Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>اسم مستخدم المشرف (Admin Username)</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Current Password Field (Mandatory) */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>كلمة المرور الحالية (إلزامية لتأكيد الهوية)</span>
          </label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="أدخل كلمة المرور الحالية للمشرف..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password & Confirmation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-200 dark:border-white/10">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>كلمة المرور الجديدة (اختياري)</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="اتركها فارغة إذا أردت تغيير الاسم فقط"
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="أعد كتابة كلمة المرور الجديدة..."
              className="w-full px-4 py-3 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'جارِ حفظ البيانات وتحديث التشفير...' : 'حفظ بيانات الحساب'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
