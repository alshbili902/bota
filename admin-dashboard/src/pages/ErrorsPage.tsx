import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  EyeOff,
  Clock,
  Code2,
} from 'lucide-react';
import { ErrorItem } from '../types';
import { adminApi } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface ErrorsPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ErrorsPage: React.FC<ErrorsPageProps> = ({ onShowToast }) => {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorItem | null>(null);

  const fetchErrors = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getErrors();
      setErrors(data);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب سجل الأخطاء.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'resolved' | 'ignored') => {
    try {
      await adminApi.updateErrorStatus(id, status);
      onShowToast(
        status === 'resolved' ? 'تم تحديد الخطأ كـ "تم الحل".' : 'تم تجاهل هذا الخطأ.',
        'success'
      );
      fetchErrors();
      if (selectedError?.id === id) {
        setSelectedError(prev => (prev ? { ...prev, status } : null));
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
              الاستثناءات ومشاكل التنزيل
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مركز الأخطاء والتشخيص</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            تجميع تلقائي للأخطاء المتكررة الناتجة عن الروابط التالفة أو قيود المنصات لتسهيل معالجتها.
          </p>
        </div>

        <button
          onClick={fetchErrors}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* Errors List */}
      <div className="grid grid-cols-1 gap-4">
        {errors.length === 0 ? (
          <div className="admin-card p-12 text-center rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">لا توجد أخطاء مسجلة.</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">لم يتم تسجيل أي استثناءات أو أخطاء في النظام</p>
          </div>
        ) : (
          errors.map(err => (
            <div
              key={err.id}
              className="admin-card p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-rose-500/30 transition-colors"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                    {err.error_type}
                  </span>
                  <StatusBadge status={err.status} type="error" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    تكرر {err.occurrences} مرة
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {err.summary}
                </p>

                {err.source && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                    المصدر: {err.source}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {err.details && (
                  <button
                    onClick={() => setSelectedError(err)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-white/10 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>التفاصيل البرمجية</span>
                  </button>
                )}

                {err.status === 'active' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(err.id, 'resolved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>تم الحل</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(err.id, 'ignored')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-white/10 transition-colors"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>تجاهل</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stack Trace Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="admin-card max-w-3xl w-full p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111827] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">تفاصيل الخطأ وتتبع المسار (Traceback)</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-0.5">{selectedError.error_type}</p>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm"
              >
                إغلاق
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-emerald-400 border border-slate-800 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed dir-ltr text-left">
              <pre>{selectedError.details}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
