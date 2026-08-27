import React, { useEffect, useState } from 'react';
import {
  Settings,
  Power,
  Sliders,
  HardDrive,
  Save,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { SiteSettings } from '../types';
import { adminApi } from '../services/api';

interface SettingsPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onShowToast }) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب إعدادات الموقع.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    try {
      const updated = await adminApi.updateSettings(settings);
      setSettings(updated);
      onShowToast('تم حفظ كافة الإعدادات بنجاح.', 'success');
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              التهيئة والسياسات
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات الموقع والصيانة</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            التحكم في وضع الصيانة العام، وتحديد أحجام الملفات المسموح بها، وفترات الاحتفاظ بالبيانات.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>استعادة الإعدادات</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Maintenance Mode Card */}
        <div
          className={`admin-card p-6 rounded-3xl border transition-all ${
            settings?.maintenance_mode
              ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/5'
              : 'border-slate-200 dark:border-white/10'
          }`}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  settings?.maintenance_mode
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'
                }`}
              >
                <Power className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">وضع الصيانة الدورية (Maintenance Mode)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  عند تفعيل هذا الوضع، يتم تعليق عمليات التنزيل العامة مع إمكانية وصول المشرف بكامل الصلاحيات
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.maintenance_mode || false}
                onChange={e =>
                  setSettings(prev => (prev ? { ...prev, maintenance_mode: e.target.checked } : null))
                }
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              رسالة الصيانة المعروضة للمستخدمين
            </label>
            <input
              type="text"
              value={settings?.maintenance_message || ''}
              onChange={e =>
                setSettings(prev => (prev ? { ...prev, maintenance_message: e.target.value } : null))
              }
              className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Download Limits & Policies */}
        <div className="admin-card p-6 rounded-3xl space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/10">
            <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">قيود ومحددات التحميل</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                أقصى حجم للملف الواحد (MB)
              </label>
              <input
                type="number"
                value={settings?.max_file_size_mb || 200}
                onChange={e =>
                  setSettings(prev =>
                    prev ? { ...prev, max_file_size_mb: parseInt(e.target.value) || 0 } : null
                  )
                }
                className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                المهلة الزمنية للتنزيل (ثانية)
              </label>
              <input
                type="number"
                value={settings?.download_timeout || 900}
                onChange={e =>
                  setSettings(prev =>
                    prev ? { ...prev, download_timeout: parseInt(e.target.value) || 0 } : null
                  )
                }
                className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                أقصى عدد للتحميلات المتزامنة
              </label>
              <input
                type="number"
                value={settings?.max_concurrent_downloads || 2}
                onChange={e =>
                  setSettings(prev =>
                    prev ? { ...prev, max_concurrent_downloads: parseInt(e.target.value) || 1 } : null
                  )
                }
                className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                أقصى عدد لإعادة المحاولة (Retries)
              </label>
              <input
                type="number"
                value={settings?.max_retries || 2}
                onChange={e =>
                  setSettings(prev =>
                    prev ? { ...prev, max_retries: parseInt(e.target.value) || 0 } : null
                  )
                }
                className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Retention & Clean Up */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/10">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">سياسة الاحتفاظ والتنظيف الذاتي</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                فترة الاحتفاظ بالملفات المنزلة (ساعات)
              </label>
              <input
                type="number"
                value={settings?.retention_hours || 24}
                onChange={e =>
                  setSettings(prev =>
                    prev ? { ...prev, retention_hours: parseInt(e.target.value) || 1 } : null
                  )
                }
                className="w-full px-4 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                يتم حذف الملفات تلقائيًا بعد انقضاء هذه المدة لتوفير المساحة
              </p>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 w-full">
                <input
                  type="checkbox"
                  checked={settings?.auto_cleanup_enabled || true}
                  onChange={e =>
                    setSettings(prev => (prev ? { ...prev, auto_cleanup_enabled: e.target.checked } : null))
                  }
                  className="w-5 h-5 rounded border-slate-300 dark:border-white/20 text-blue-600 focus:ring-0 bg-white dark:bg-slate-900"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">التنظيف التلقائي الدوري</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    تشغيل عامل الخلفية لحذف الملفات القديمة دوريًا
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جارِ حفظ التغييرات...' : 'حفظ كافة الإعدادات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
